/**
 * GET /api/commissions/contracts — Listar contratos
 * POST /api/commissions/contracts — Crear nuevo contrato
 *
 * Ahora usando persistencia real en SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import {
  ContractRepository,
  SellerRepository,
  ClientRepository,
  PlanRepository,
  PaymentRepository,
} from '@/lib/db';
import {
  calculateCommission,
  generatePaymentSchedule,
  validateContract,
  detectUpsell,
  emitCommissionEvent,
} from '@/lib/commission-engine';
import type { Contract, ContractStatus } from '@/lib/commission-types';
import { getDb } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  ensureSchema();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const sellerId = searchParams.get('sellerId');

  const contractRepo = new ContractRepository();

  let contracts: Contract[];

  if (status) {
    contracts = contractRepo.findByStatus(status as ContractStatus);
  } else if (sellerId) {
    contracts = contractRepo.findBySeller(sellerId);
  } else {
    contracts = contractRepo.findAll();
  }

  // Apply additional combined filters
  if (status && sellerId) {
    contracts = contracts.filter((c) => c.status === status && c.sellerId === sellerId);
  }

  return NextResponse.json({
    success: true,
    data: contracts,
    total: contracts.length,
  });
}

export async function POST(request: NextRequest) {
  ensureSchema();

  const body = await request.json();

  const db = getDb();
  const contractRepo = new ContractRepository(db);
  const sellerRepo = new SellerRepository(db);
  const clientRepo = new ClientRepository(db);
  const planRepo = new PlanRepository(db);
  const paymentRepo = new PaymentRepository(db);

  const existingContracts = contractRepo.findAll();

  // Validar
  const validation = validateContract(body, existingContracts);
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, errors: validation.errors, warnings: validation.warnings },
      { status: 400 }
    );
  }

  // Resolver referencias
  const client = clientRepo.findById(body.clientId);
  const plan = planRepo.findById(body.planId);
  const seller = sellerRepo.findById(body.sellerId);

  if (!client || !plan || !seller) {
    return NextResponse.json(
      { success: false, errors: ['Cliente, plan o vendedor no encontrado'] },
      { status: 404 }
    );
  }

  // Detectar upsell
  const upsellResult = detectUpsell(
    { ...body, clientId: client.id } as Contract,
    existingContracts
  );

  // Calcular comisión
  const quantity = body.quantity || 1;
  const monthlyValue = plan.monthlyPricePerUnit * quantity;
  const commission = calculateCommission(monthlyValue, seller.commissionRate);

  const now = new Date().toISOString();
  const contractId = contractRepo.getNextId();

  const newContract: Contract = {
    id: contractId,
    clientId: client.id,
    clientName: client.name,
    planId: plan.id,
    planName: plan.name,
    planType: plan.type,
    sellerId: upsellResult.isUpsell && upsellResult.originalContract
      ? upsellResult.originalContract.sellerId
      : seller.id,
    sellerName: upsellResult.isUpsell && upsellResult.originalContract
      ? upsellResult.originalContract.sellerName
      : seller.name,
    quantity,
    monthlyValue: commission.monthlyValue,
    acv: commission.acv,
    totalCommission: commission.totalCommission,
    monthlyCommission: commission.monthlyCommission,
    startDate: body.startDate || now,
    status: 'activo',
    isUpsell: upsellResult.isUpsell,
    originalContractId: upsellResult.originalContract?.id,
    deviceImeis: body.deviceImeis || [],
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  };

  // Persistir contrato
  contractRepo.create(newContract);

  // Generar y persistir plan de pagos
  const payments = generatePaymentSchedule(newContract);
  paymentRepo.createMany(payments);

  // Emitir eventos
  emitCommissionEvent('contract_created', {
    contractId: newContract.id,
    sellerId: newContract.sellerId,
    clientId: newContract.clientId,
    description: `Nuevo contrato creado: ${newContract.clientName} - ${newContract.planName} x${newContract.quantity}`,
    metadata: {
      isUpsell: upsellResult.isUpsell,
      monthlyCommission: newContract.monthlyCommission,
      totalCommission: newContract.totalCommission,
    },
  });

  if (upsellResult.isUpsell) {
    emitCommissionEvent('upsell_detected', {
      contractId: newContract.id,
      sellerId: newContract.sellerId,
      clientId: newContract.clientId,
      description: `Upsell detectado: ${client.name} contrató ${plan.name} adicional (vendedor original: ${upsellResult.originalContract?.sellerName})`,
    });
  }

  return NextResponse.json(
    {
      success: true,
      data: { contract: newContract, payments },
      warnings: validation.warnings,
    },
    { status: 201 }
  );
}

/**
 * Real Production Data Seed Script
 *
 * Seeds the Cassper commissions database with real production data
 * extracted from Pegasus MCP (pro.analyzegps.cl v7.42.0).
 *
 * Usage:
 *   npx tsx scripts/real-data/seed-real.ts
 *
 * This replaces the mock data with real clients, vehicles, and devices
 * from the production Pegasus environment for QA testing.
 *
 * Data sources:
 *   - Pegasus MCP: vehicles, devices, groups (clients), connectivity status
 *   - Business logic: contracts, payment schedules, commission calculations
 */

import { getDb } from '@/lib/db/connection';
import { initSchema } from '@/lib/db/schema';
import { SellerRepository } from '@/lib/db/repositories/sellers';
import { ClientRepository } from '@/lib/db/repositories/clients';
import { PlanRepository } from '@/lib/db/repositories/plans';
import { ContractRepository } from '@/lib/db/repositories/contracts';
import { PaymentRepository } from '@/lib/db/repositories/payments';
import { InvoiceRepository } from '@/lib/db/repositories/invoices';
import { DeviceRepository } from '@/lib/db/repositories/devices';
import {
  calculateCommission,
  generatePaymentSchedule,
  DEFAULT_COMMISSION_CONFIG,
} from '@/lib/commission-engine';
import type {
  Seller,
  Client,
  Plan,
  Contract,
  GPSDevice,
  Invoice,
  PlanType,
} from '@/lib/commission-types';
import * as fs from 'fs';
import * as path from 'path';

// ─── Load Production Data ──────────────────────────────────────────────────

const PROD_DATA_PATH = path.join(__dirname, 'production-data.json');
const prodData = JSON.parse(fs.readFileSync(PROD_DATA_PATH, 'utf-8'));

console.log(`📦 Loading production data from: ${PROD_DATA_PATH}`);
console.log(`   Source: ${prodData._meta.source}`);
console.log(`   Version: ${prodData._meta.version}`);
console.log(`   Extracted: ${prodData._meta.extractedAt}\n`);

// ─── Production Sellers ────────────────────────────────────────────────────

const prodSellers: Seller[] = prodData.sellers.map((s: any) => ({
  id: s.id,
  name: s.name,
  email: s.email,
  commissionRate: s.commissionRate,
  active: s.active,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
}));

// ─── Plans (unchanged - realistic pricing) ─────────────────────────────────

const prodPlans: Plan[] = [
  {
    id: 'PLAN-PROD-001',
    name: 'GPS Básico',
    type: 'gps_basico' as PlanType,
    monthlyPricePerUnit: 10000,
    description: 'Rastreo GPS básico con actualización cada 5 minutos',
    active: true,
  },
  {
    id: 'PLAN-PROD-002',
    name: 'GPS Avanzado',
    type: 'gps_avanzado' as PlanType,
    monthlyPricePerUnit: 18000,
    description: 'Rastreo en tiempo real, geocercas, alertas de velocidad',
    active: true,
  },
  {
    id: 'PLAN-PROD-003',
    name: 'GPS Premium',
    type: 'gps_premium' as PlanType,
    monthlyPricePerUnit: 25000,
    description: 'Rastreo en tiempo real, dashcam, sensor de combustible, mantenimiento predictivo',
    active: true,
  },
  {
    id: 'PLAN-PROD-004',
    name: 'Flota Básico',
    type: 'flota_basico' as PlanType,
    monthlyPricePerUnit: 8000,
    description: 'Plan económico para flotas grandes (mínimo 20 unidades)',
    active: true,
  },
  {
    id: 'PLAN-PROD-005',
    name: 'Flota Avanzado',
    type: 'flota_avanzado' as PlanType,
    monthlyPricePerUnit: 15000,
    description: 'Gestión de flota completa con reportes y optimización de rutas',
    active: true,
  },
];

// ─── Production Clients (from Pegasus groups) ──────────────────────────────

// Keep pegasusGroupId for mapping (not part of Client type but needed here)
interface ProdClient extends Client {
  pegasusGroupId?: number;
}

const prodClients: ProdClient[] = prodData.clients.map((c: any) => ({
  id: c.id,
  name: c.name,
  companyName: c.companyName,
  email: c.email,
  acquiredBySellerId: c.acquiredBySellerId,
  pegasusGroupId: c.pegasusGroupId,
  createdAt: '2025-06-01T00:00:00Z',
}));

// ─── Build Contracts from Real Vehicles ────────────────────────────────────

function buildRealContracts(): { contracts: Contract[]; devices: GPSDevice[] } {
  const contracts: Contract[] = [];
  const devices: GPSDevice[] = [];

  // Group vehicles by their primary group
  const vehiclesByGroup = new Map<number, typeof prodData.vehicles>();
  for (const v of prodData.vehicles) {
    const primaryGroup = v.groups[0] || 0;
    if (!vehiclesByGroup.has(primaryGroup)) {
      vehiclesByGroup.set(primaryGroup, []);
    }
    vehiclesByGroup.get(primaryGroup)!.push(v);
  }

  // Map Pegasus groups to our clients
  const groupToClient = new Map<number, ProdClient>();
  for (const client of prodClients) {
    if (client.pegasusGroupId) {
      groupToClient.set(client.pegasusGroupId, client);
    }
  }

  // Map Pegasus groups to sellers (round-robin assignment for demo)
  const groupToSeller = new Map<number, Seller>();
  let sellerIdx = 0;
  for (const [groupId] of vehiclesByGroup) {
    groupToSeller.set(groupId, prodSellers[sellerIdx % prodSellers.length]);
    sellerIdx++;
  }

  let contractCounter = 0;

  for (const [groupId, vehicles] of vehiclesByGroup) {
    const client = groupToClient.get(groupId);
    const seller = groupToSeller.get(groupId);
    if (!client || !seller) continue;

    // Only include vehicles with real IMEIs (device > 0)
    const realVehicles = vehicles.filter((v: any) => v.device > 0);
    if (realVehicles.length === 0) continue;

    contractCounter++;

    // Determine plan based on vehicle count
    let plan: Plan;
    if (realVehicles.length >= 20) {
      plan = prodPlans[4]; // Flota Avanzado
    } else if (realVehicles.length >= 10) {
      plan = prodPlans[1]; // GPS Avanzado
    } else {
      plan = prodPlans[0]; // GPS Básico
    }

    const quantity = realVehicles.length;
    const monthlyValue = plan.monthlyPricePerUnit * quantity;
    const commission = calculateCommission(monthlyValue, seller.commissionRate);

    const deviceImeis = realVehicles.map((v: any) => String(v.device));

    const contractId = `CTR-PROD-${String(contractCounter).padStart(3, '0')}`;
    // Use local date with noon time to avoid timezone rollover issues
    const startDate = '2025-11-15T12:00:00';

    const contract: Contract = {
      id: contractId,
      clientId: client.id,
      clientName: client.name,
      planId: plan.id,
      planName: plan.name,
      planType: plan.type,
      sellerId: seller.id,
      sellerName: seller.name,
      quantity,
      monthlyValue: commission.monthlyValue,
      acv: commission.acv,
      totalCommission: commission.totalCommission,
      monthlyCommission: commission.monthlyCommission,
      startDate,
      status: 'activo',
      isUpsell: false,
      deviceImeis,
      createdAt: startDate,
      updatedAt: '2026-06-01T00:00:00Z',
    };

    contracts.push(contract);

    // Create GPS devices from real vehicles
    for (const v of realVehicles) {
      const imei = String(v.device);
      devices.push({
        imei,
        name: `${v.licensePlate || 'GPS'} - ${v.driverName || v.model || 'Unknown'}`,
        vehicleId: String(v.id),
        vehicleName: v.licensePlate || v.name,
        connected: v.connected || false,
        lastSeen: v.lastSeen || null,
        clientId: client.id,
        contractId: contractId,
        source: 'pegasus',
      });
    }
  }

  return { contracts, devices };
}

const { contracts: prodContracts, devices: prodDevices } = buildRealContracts();

// ─── Generate Payment Schedules ────────────────────────────────────────────

const prodPayments = prodContracts.flatMap((contract) =>
  generatePaymentSchedule(contract)
);

// Mark past payments as paid (simulating real history)
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

for (const payment of prodPayments) {
  const [year, month] = payment.period.split('-').map(Number);

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    payment.status = 'pagado';
    payment.invoiceVerified = true;
    payment.devicesVerified = true;
    payment.invoiceId = `INV-PROD-${payment.contractId}-${payment.period}`;
    payment.paidAt = new Date(year, month - 1, 5).toISOString();
  }
}

// ─── Generate Invoices ─────────────────────────────────────────────────────

const prodInvoices: Invoice[] = [];
for (const contract of prodContracts) {
  for (let m = 0; m < 7; m++) {
    const invDate = new Date(contract.startDate);
    invDate.setMonth(invDate.getMonth() + m);
    const period = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;

    const isPaid = invDate < now;
    prodInvoices.push({
      id: `INV-PROD-${contract.id}-${period}-${String(m + 1).padStart(2, '0')}`,
      clientId: contract.clientId,
      clientName: contract.clientName,
      contractId: contract.id,
      amount: contract.monthlyValue,
      status: isPaid ? 'pagada' : 'emitida',
      issuedAt: new Date(invDate.getFullYear(), invDate.getMonth(), 1).toISOString(),
      paidAt: isPaid ? new Date(invDate.getFullYear(), invDate.getMonth(), 15).toISOString() : undefined,
      period,
    });
  }
}

// ─── Seed Function ─────────────────────────────────────────────────────────

function seed() {
  console.log('🚀 Seeding database with PRODUCTION data...\n');

  initSchema();
  const db = getDb();

  // Clear existing data
  console.log('🧹 Clearing existing data...');
  db.exec(`
    DELETE FROM contract_devices;
    DELETE FROM commission_payments;
    DELETE FROM commission_events;
    DELETE FROM invoices;
    DELETE FROM gps_devices;
    DELETE FROM contracts;
    DELETE FROM clients;
    DELETE FROM plans;
    DELETE FROM sellers;
  `);

  const sellerRepo = new SellerRepository(db);
  const clientRepo = new ClientRepository(db);
  const planRepo = new PlanRepository(db);
  const contractRepo = new ContractRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const invoiceRepo = new InvoiceRepository(db);
  const deviceRepo = new DeviceRepository(db);

  // Seed sellers
  console.log(`👤 Sellers: ${prodSellers.length}`);
  for (const seller of prodSellers) {
    sellerRepo.create(seller);
  }

  // Seed plans
  console.log(`📋 Plans: ${prodPlans.length}`);
  for (const plan of prodPlans) {
    planRepo.create(plan);
  }

  // Seed clients
  console.log(`🏢 Clients: ${prodClients.length}`);
  for (const client of prodClients) {
    clientRepo.create(client);
  }

  // Seed contracts
  console.log(`📝 Contracts: ${prodContracts.length}`);
  for (const contract of prodContracts) {
    contractRepo.create(contract);
  }

  // Seed payments
  console.log(`💰 Payment schedules: ${prodPayments.length}`);
  paymentRepo.createMany(prodPayments);

  // Seed invoices
  console.log(`🧾 Invoices: ${prodInvoices.length}`);
  for (const invoice of prodInvoices) {
    invoiceRepo.create(invoice);
  }

  // Seed GPS devices
  console.log(`📡 GPS Devices: ${prodDevices.length}`);
  deviceRepo.upsertMany(prodDevices);

  // Seed default config
  db.prepare(`
    INSERT OR REPLACE INTO commission_config (
      id, default_commission_rate, payment_installments, invoice_grace_days,
      verify_devices_before_payment, inactive_device_tolerance,
      notify_upsell, notify_cancellation
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_COMMISSION_CONFIG.defaultCommissionRate,
    DEFAULT_COMMISSION_CONFIG.paymentInstallments,
    DEFAULT_COMMISSION_CONFIG.invoiceGraceDays,
    DEFAULT_COMMISSION_CONFIG.verifyDevicesBeforePayment ? 1 : 0,
    DEFAULT_COMMISSION_CONFIG.inactiveDeviceTolerance,
    DEFAULT_COMMISSION_CONFIG.notifyUpsell ? 1 : 0,
    DEFAULT_COMMISSION_CONFIG.notifyCancellation ? 1 : 0
  );

  // Verify
  console.log('\n✅ Real production data seed complete!');
  console.log(`   Sellers:   ${sellerRepo.count()}`);
  console.log(`   Clients:   ${clientRepo.count()}`);
  console.log(`   Plans:     ${planRepo.count()}`);
  console.log(`   Contracts: ${contractRepo.count()}`);
  console.log(`   Payments:  ${paymentRepo.count()}`);
  console.log(`   Invoices:  ${invoiceRepo.count()}`);
  console.log(`   Devices:   ${deviceRepo.count()}`);

  // Show sample data
  console.log('\n📊 Sample data:');
  const sellers = sellerRepo.findAll();
  for (const s of sellers.slice(0, 3)) {
    console.log(`   Seller: ${s.name} (${s.email}) - Rate: ${(s.commissionRate * 100).toFixed(0)}%`);
  }

  const clients = clientRepo.findAll();
  for (const c of clients.slice(0, 3)) {
    const clientContracts = prodContracts.filter(ct => ct.clientId === c.id);
    const totalDevices = clientContracts.reduce((sum, ct) => sum + ct.quantity, 0);
    console.log(`   Client: ${c.name} - Contracts: ${clientContracts.length}, Devices: ${totalDevices}`);
  }

  // Show contract summary
  console.log('\n📋 Contract summary:');
  for (const ct of prodContracts) {
    const ctDevices = prodDevices.filter(d => d.contractId === ct.id);
    const connectedCount = ctDevices.filter(d => d.connected).length;
    console.log(
      `   ${ct.id}: ${ct.clientName} | ${ct.planName} | ${ct.quantity} devices | ` +
      `${connectedCount}/${ct.quantity} connected | ` +
      `CLP ${ct.monthlyValue.toLocaleString('es-CL')}/mo | ` +
      `Com: CLP ${ct.monthlyCommission.toLocaleString('es-CL')}/mo`
    );
  }
}

// Run
seed();

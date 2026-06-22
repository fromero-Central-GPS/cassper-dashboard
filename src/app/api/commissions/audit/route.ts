/**
 * GET  /api/commissions/audit — Trazabilidad completa de pagos
 *
 * Devuelve cada pago enriquecido con:
 *  - invoice: factura vinculada al pago
 *  - devices: dispositivos del contrato con estado conectado/desconectado
 *  - events: historial de eventos del sistema para el contrato/vendedor
 *
 * Filtros: ?period=YYYY-MM &sellerId=SEL-XXX &status=retenido &search=texto
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import {
  PaymentRepository,
  ContractRepository,
  SellerRepository,
  DeviceRepository,
} from '@/lib/db';
import { InvoiceRepository } from '@/lib/db/repositories/invoices';
import type {
  CommissionPayment,
  Invoice,
  GPSDevice,
  Contract,
  CommissionEvent,
  Seller,
} from '@/lib/commission-types';

// ─── Tipos de respuesta ──────────────────────────────────────────────────

export interface AuditPaymentRecord {
  payment: CommissionPayment;
  invoice: Invoice | null;
  invoices: Invoice[];           // todas las facturas del cliente en ese período
  contract: Contract | null;
  devices: GPSDevice[];          // dispositivos del contrato
  events: CommissionEvent[];     // eventos relacionados
  traceability: {
    /** Cada peso de este pago se explica por: */
    invoiceId: string | null;
    deviceImeis: string[];
    invoiceVerified: boolean;
    devicesVerified: boolean;
    activeDeviceCount: number;
    expectedDeviceCount: number;
  };
}

export interface AuditResponse {
  payments: AuditPaymentRecord[];
  summary: {
    totalPayments: number;
    totalAmount: number;
    byStatus: Record<string, { count: number; amount: number }>;
    bySeller: Record<string, { count: number; amount: number }>;
    period: string;
  };
  filters: {
    periods: string[];
    sellers: { id: string; name: string }[];
    statuses: string[];
  };
}

// ─── GET Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  ensureSchema();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  const sellerId = searchParams.get('sellerId');
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.toLowerCase();
  const paymentId = searchParams.get('paymentId');

  const paymentRepo = new PaymentRepository();
  const contractRepo = new ContractRepository();
  const invoiceRepo = new InvoiceRepository();
  const deviceRepo = new DeviceRepository();
  const sellerRepo = new SellerRepository();

  // ── Fetch base data ────────────────────────────────────────────────────

  let payments: CommissionPayment[];

  if (paymentId) {
    const p = paymentRepo.findById(paymentId);
    payments = p ? [p] : [];
  } else if (period) {
    payments = paymentRepo.findByPeriod(period);
    if (sellerId) payments = payments.filter((p) => p.sellerId === sellerId);
    if (status) payments = payments.filter((p) => p.status === status);
  } else if (sellerId) {
    payments = paymentRepo.findBySeller(sellerId);
    if (status) payments = payments.filter((p) => p.status === status);
  } else if (status) {
    payments = paymentRepo.findByStatus(status as CommissionPayment['status']);
  } else {
    payments = paymentRepo.findAll();
  }

  // ── Search filter ──────────────────────────────────────────────────────

  if (search) {
    payments = payments.filter(
      (p) =>
        p.clientName.toLowerCase().includes(search) ||
        p.sellerName.toLowerCase().includes(search) ||
        p.contractId.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search) ||
        p.period.includes(search)
    );
  }

  // ── Enrich each payment ────────────────────────────────────────────────

  const allContracts = contractRepo.findAll();
  const allInvoices = invoiceRepo.findAll();
  const allDevices = deviceRepo.findAll();
  const allSellers = sellerRepo.findAll();

  // Build events from commission_alerts table (our event log)
  const events = loadEvents();

  const enriched: AuditPaymentRecord[] = payments.map((payment) => {
    const contract =
      allContracts.find((c) => c.id === payment.contractId) ?? null;

    // Invoice linked to this specific payment
    const linkedInvoice = payment.invoiceId
      ? (allInvoices.find((i) => i.id === payment.invoiceId) ?? null)
      : null;

    // All invoices for this client in this period
    const clientPeriodInvoices = allInvoices.filter(
      (i) => i.clientId === payment.clientId && i.period === payment.period
    );

    // Devices for this contract
    const contractDevices = allDevices.filter(
      (d) => d.contractId === payment.contractId
    );

    // Events related to this payment's contract, seller or devices
    const relatedEvents = events.filter(
      (e) =>
        e.contractId === payment.contractId ||
        e.sellerId === payment.sellerId ||
        e.clientId === payment.clientId
    );

    const activeDevices = contractDevices.filter((d) => d.connected);

    return {
      payment,
      invoice: linkedInvoice,
      invoices: clientPeriodInvoices,
      contract,
      devices: contractDevices,
      events: relatedEvents,
      traceability: {
        invoiceId: payment.invoiceId ?? null,
        deviceImeis: contractDevices.map((d) => d.imei),
        invoiceVerified: payment.invoiceVerified,
        devicesVerified: payment.devicesVerified,
        activeDeviceCount: activeDevices.length,
        expectedDeviceCount:
          payment.deviceVerification?.expectedCount ??
          contractDevices.length,
      },
    };
  });

  // ── Build summary ──────────────────────────────────────────────────────

  const byStatus: AuditResponse['summary']['byStatus'] = {};
  const bySeller: AuditResponse['summary']['bySeller'] = {};

  for (const record of enriched) {
    const st = record.payment.status;
    if (!byStatus[st]) byStatus[st] = { count: 0, amount: 0 };
    byStatus[st].count++;
    byStatus[st].amount += record.payment.amount;

    const sId = record.payment.sellerId;
    if (!bySeller[sId]) bySeller[sId] = { count: 0, amount: 0 };
    bySeller[sId].count++;
    bySeller[sId].amount += record.payment.amount;
  }

  // ── Build filters ──────────────────────────────────────────────────────

  const allPeriods = [...new Set(allContracts.flatMap((c) => {
    const payments = paymentRepo.findByContract(c.id);
    return payments.map((p) => p.period);
  }))].sort().reverse();

  const sellerFilters = allSellers
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name }));

  const statusFilters = [
    'pendiente',
    'pagado',
    'retenido',
    'cancelado',
    'disputado',
  ];

  return NextResponse.json({
    success: true,
    data: {
      payments: enriched,
      summary: {
        totalPayments: enriched.length,
        totalAmount: enriched.reduce((s, r) => s + r.payment.amount, 0),
        byStatus,
        bySeller,
        period: period ?? allPeriods[0] ?? '2026-06',
      },
      filters: {
        periods: allPeriods,
        sellers: sellerFilters,
        statuses: statusFilters,
      },
    } as AuditResponse,
    meta: {
      source: 'database',
      total: enriched.length,
    },
  });
}

// ─── Event loader — reads from commission_alerts as audit log ────────────

function loadEvents(): CommissionEvent[] {
  try {
    const { getDb } = require('@/lib/db/connection');
    const db = getDb();

    // Try the dedicated commission_events table first, fallback to alerts
    const eventRows = db
      .prepare(
        `SELECT id, type, contract_id, seller_id, client_id, device_imei,
                description, metadata_json, created_at
         FROM commission_events
         ORDER BY created_at DESC
         LIMIT 500`
      )
      .all() as Array<Record<string, unknown>>;

    if (eventRows.length > 0) {
      return eventRows.map((r) => ({
        id: r.id as string,
        type: r.type as CommissionEvent['type'],
        contractId: (r.contract_id as string) ?? undefined,
        sellerId: (r.seller_id as string) ?? undefined,
        clientId: (r.client_id as string) ?? undefined,
        deviceImei: (r.device_imei as string) ?? undefined,
        description: r.description as string,
        metadata: r.metadata_json
          ? (JSON.parse(r.metadata_json as string) as Record<string, unknown>)
          : undefined,
        createdAt: r.created_at as string,
      }));
    }

    // Fallback: build synthetic events from alerts
    const alertRows = db
      .prepare(
        `SELECT id, type, title, description, contract_id, seller_id, client_id,
                metadata_json, created_at
         FROM commission_alerts
         ORDER BY created_at DESC
         LIMIT 500`
      )
      .all() as Array<Record<string, unknown>>;

    return alertRows.map((r) => ({
      id: r.id as string,
      type: mapAlertTypeToEventType(r.type as string),
      contractId: (r.contract_id as string) ?? undefined,
      sellerId: (r.seller_id as string) ?? undefined,
      clientId: (r.client_id as string) ?? undefined,
      description: `${r.title as string}: ${r.description as string}`,
      metadata: r.metadata_json
        ? (JSON.parse(r.metadata_json as string) as Record<string, unknown>)
        : undefined,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

function mapAlertTypeToEventType(
  alertType: string
): CommissionEvent['type'] {
  const map: Record<string, CommissionEvent['type']> = {
    A1_NUEVO_DISPOSITIVO_UPSELL: 'upsell_detected',
    A2_BAJA_DISPOSITIVO_FACTURADO: 'device_deactivated',
    A3_CLIENTE_NUEVO_SIN_VENDEDOR: 'contract_created',
    A4_DISCREPANCIA_DISPOSITIVOS: 'device_deactivated',
    A5_FACTURA_IMPAGA: 'invoice_overdue',
    A6_CONTRATO_CANCELADO: 'contract_cancelled',
    A7_PAGO_LIBERADO: 'payment_released',
    A8_PAGO_RETENIDO: 'payment_withheld',
  };
  return map[alertType] ?? 'contract_created';
}

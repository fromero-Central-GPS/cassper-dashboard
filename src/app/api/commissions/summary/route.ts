/**
 * GET /api/commissions/summary
 *
 * Retorna los datos del dashboard de comisiones desde la base de datos.
 */

import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import {
  SellerRepository,
  ContractRepository,
  PaymentRepository,
  DeviceRepository,
} from '@/lib/db';
import { InvoiceRepository } from '@/lib/db/repositories/invoices';
import { generateDashboardData } from '@/lib/commission-engine';

export async function GET() {
  // Ensure the database schema exists (safe to call on every request)
  ensureSchema();

  const sellerRepo = new SellerRepository();
  const contractRepo = new ContractRepository();
  const paymentRepo = new PaymentRepository();
  const deviceRepo = new DeviceRepository();
  const invoiceRepo = new InvoiceRepository();

  const sellers = sellerRepo.findAll();
  const contracts = contractRepo.findAll();
  const payments = paymentRepo.findAll();
  const devices = deviceRepo.findAll();
  const invoices = invoiceRepo.findAll();

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const dashboardData = generateDashboardData(
    currentPeriod,
    contracts,
    payments,
    sellers,
    devices
  );

  // Invoice summary for the period
  const periodInvoices = invoices.filter((i) => i.period === currentPeriod);
  const invoiceSummary = {
    total: periodInvoices.length,
    totalAmount: periodInvoices.reduce((s, i) => s + i.amount, 0),
    paidAmount: periodInvoices.filter((i) => i.status === 'pagada').reduce((s, i) => s + i.amount, 0),
    pendingAmount: periodInvoices.filter((i) => i.status === 'emitida').reduce((s, i) => s + i.amount, 0),
    overdueAmount: periodInvoices.filter((i) => i.status === 'vencida').reduce((s, i) => s + i.amount, 0),
  };

  return NextResponse.json({
    success: true,
    data: {
      ...dashboardData,
      invoiceSummary,
    },
    meta: {
      source: 'database',
      period: currentPeriod,
      invoices: invoiceSummary,
    },
  });
}

/**
 * GET /api/commissions/invoices — Listar facturas del sistema
 *
 * Complementa el endpoint POST /api/commissions/invoices/import.
 * Soporta filtros por período, cliente, contrato, estado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import { InvoiceRepository } from '@/lib/db/repositories/invoices';
import type { Invoice } from '@/lib/commission-types';

export async function GET(request: NextRequest) {
  ensureSchema();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  const clientId = searchParams.get('clientId');
  const contractId = searchParams.get('contractId');
  const status = searchParams.get('status');

  const invoiceRepo = new InvoiceRepository();
  let invoices: Invoice[];

  if (period) {
    invoices = invoiceRepo.findByPeriod(period);
  } else if (clientId) {
    invoices = invoiceRepo.findByClient(clientId);
  } else if (contractId) {
    invoices = invoiceRepo.findByContract(contractId);
  } else {
    invoices = invoiceRepo.findAll();
  }

  // Apply additional filters
  if (status) {
    invoices = invoices.filter((inv) => inv.status === status);
  }

  // Summary stats
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter((inv) => inv.status === 'pagada').reduce((sum, inv) => sum + inv.amount, 0);
  const pendingAmount = invoices.filter((inv) => inv.status === 'emitida').reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = invoices.filter((inv) => inv.status === 'vencida').reduce((sum, inv) => sum + inv.amount, 0);

  return NextResponse.json({
    success: true,
    data: invoices,
    summary: {
      total: invoices.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
    },
  });
}

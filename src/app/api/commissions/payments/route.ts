/**
 * GET /api/commissions/payments — Listar pagos de comisión
 * PATCH /api/commissions/payments — Actualizar estado de un pago
 *
 * Ahora usando persistencia real en SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db/schema';
import { PaymentRepository, SellerRepository } from '@/lib/db';
import { shouldReleasePayment } from '@/lib/commission-engine';
import type { CommissionPayment, PaymentStatus } from '@/lib/commission-types';

export async function GET(request: NextRequest) {
  ensureSchema();

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  const sellerId = searchParams.get('sellerId');
  const status = searchParams.get('status');
  const view = searchParams.get('view');

  // Return sellers for visualization tab
  if (view === 'sellers') {
    const sellerRepo = new SellerRepository();
    const sellers = sellerRepo.findAll();
    return NextResponse.json({
      success: true,
      data: sellers,
      total: sellers.length,
    });
  }

  const paymentRepo = new PaymentRepository();

  let payments: CommissionPayment[];

  if (period) {
    payments = paymentRepo.findByPeriod(period);
  } else if (sellerId) {
    payments = paymentRepo.findBySeller(sellerId);
  } else if (status) {
    payments = paymentRepo.findByStatus(status as PaymentStatus);
  } else {
    payments = paymentRepo.findAll();
  }

  // Apply combined filters if multiple params
  if (period && sellerId) {
    payments = payments.filter((p) => p.sellerId === sellerId);
  }
  if (period && status) {
    payments = payments.filter((p) => p.status === status);
  }

  const summary = paymentRepo.getSummary();

  return NextResponse.json({
    success: true,
    data: payments,
    summary,
    total: payments.length,
  });
}

export async function PATCH(request: NextRequest) {
  ensureSchema();

  const body = await request.json();
  const { paymentId, status, invoiceVerified, devicesVerified } = body;

  const paymentRepo = new PaymentRepository();

  const payment = paymentRepo.findById(paymentId);
  if (!payment) {
    return NextResponse.json(
      { success: false, error: 'Pago no encontrado' },
      { status: 404 }
    );
  }

  // Verificar si se puede liberar
  if (status === 'pagado') {
    const verification = shouldReleasePayment(
      payment,
      invoiceVerified ?? payment.invoiceVerified,
      payment.deviceVerification
    );

    if (!verification.release) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede liberar el pago',
          reason: verification.reason,
        },
        { status: 422 }
      );
    }
  }

  // Persistir actualización
  const updateData: Partial<CommissionPayment> = { status };
  if (invoiceVerified !== undefined) updateData.invoiceVerified = invoiceVerified;
  if (devicesVerified !== undefined) updateData.devicesVerified = devicesVerified;
  if (status === 'pagado') updateData.paidAt = new Date().toISOString();

  paymentRepo.update(paymentId, updateData);

  // Refetch updated payment
  const updatedPayment = paymentRepo.findById(paymentId);

  return NextResponse.json({
    success: true,
    data: updatedPayment,
  });
}

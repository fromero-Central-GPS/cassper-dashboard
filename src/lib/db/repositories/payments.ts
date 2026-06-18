/**
 * Payments repository — CRUD + business queries for commission_payments.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { CommissionPayment, PaymentStatus, DeviceVerification } from '@/lib/commission-types';

interface PaymentRow extends Record<string, unknown> {
  id: string;
  contract_id: string;
  seller_id: string;
  seller_name: string;
  client_id: string;
  client_name: string;
  month_number: number;
  period: string;
  amount: number;
  status: string;
  invoice_verified: number;
  invoice_id: string | null;
  devices_verified: number;
  device_verification_json: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

function rowToPayment(row: unknown): CommissionPayment {
  const r = row as Record<string, unknown>;
  let deviceVerification: DeviceVerification | undefined;
  if (r.device_verification_json) {
    try {
      deviceVerification = JSON.parse(r.device_verification_json as string) as DeviceVerification;
    } catch {
      // Ignore malformed JSON
    }
  }

  return {
    id: r.id as string,
    contractId: r.contract_id as string,
    sellerId: r.seller_id as string,
    sellerName: r.seller_name as string,
    clientId: r.client_id as string,
    clientName: r.client_name as string,
    monthNumber: r.month_number as number,
    period: r.period as string,
    amount: r.amount as number,
    status: r.status as PaymentStatus,
    invoiceVerified: Boolean(r.invoice_verified),
    invoiceId: (r.invoice_id as string) ?? undefined,
    devicesVerified: Boolean(r.devices_verified),
    deviceVerification,
    paidAt: (r.paid_at as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export interface PaymentSummary {
  period: string;
  total: number;
  paid: number;
  pending: number;
  withheld: number;
  cancelled: number;
  count: number;
}

export class PaymentRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): CommissionPayment[] {
    const rows = this.db.prepare('SELECT * FROM commission_payments ORDER BY period DESC, month_number').all() as PaymentRow[];
    return rows.map(rowToPayment);
  }

  findByPeriod(period: string): CommissionPayment[] {
    const rows = this.db.prepare(
      'SELECT * FROM commission_payments WHERE period = ? ORDER BY month_number'
    ).all(period) as PaymentRow[];
    return rows.map(rowToPayment);
  }

  findBySeller(sellerId: string): CommissionPayment[] {
    const rows = this.db.prepare(
      'SELECT * FROM commission_payments WHERE seller_id = ? ORDER BY period DESC, month_number'
    ).all(sellerId) as PaymentRow[];
    return rows.map(rowToPayment);
  }

  findByContract(contractId: string): CommissionPayment[] {
    const rows = this.db.prepare(
      'SELECT * FROM commission_payments WHERE contract_id = ? ORDER BY month_number'
    ).all(contractId) as PaymentRow[];
    return rows.map(rowToPayment);
  }

  findById(id: string): CommissionPayment | null {
    const row = this.db.prepare('SELECT * FROM commission_payments WHERE id = ?').get(id) as PaymentRow | undefined;
    return row ? rowToPayment(row) : null;
  }

  findByStatus(status: PaymentStatus): CommissionPayment[] {
    const rows = this.db.prepare(
      'SELECT * FROM commission_payments WHERE status = ? ORDER BY period DESC'
    ).all(status) as PaymentRow[];
    return rows.map(rowToPayment);
  }

  create(payment: CommissionPayment): void {
    this.db.prepare(`
      INSERT INTO commission_payments (
        id, contract_id, seller_id, seller_name, client_id, client_name,
        month_number, period, amount, status, invoice_verified, invoice_id,
        devices_verified, device_verification_json, paid_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment.id,
      payment.contractId,
      payment.sellerId,
      payment.sellerName,
      payment.clientId,
      payment.clientName,
      payment.monthNumber,
      payment.period,
      payment.amount,
      payment.status,
      payment.invoiceVerified ? 1 : 0,
      payment.invoiceId ?? null,
      payment.devicesVerified ? 1 : 0,
      payment.deviceVerification ? JSON.stringify(payment.deviceVerification) : null,
      payment.paidAt ?? null,
      payment.notes ?? null,
      payment.createdAt
    );
  }

  /** Bulk insert payments for a new contract */
  createMany(payments: CommissionPayment[]): void {
    const insert = this.db.prepare(`
      INSERT INTO commission_payments (
        id, contract_id, seller_id, seller_name, client_id, client_name,
        month_number, period, amount, status, invoice_verified, invoice_id,
        devices_verified, device_verification_json, paid_at, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((payments: CommissionPayment[]) => {
      for (const payment of payments) {
        insert.run(
          payment.id,
          payment.contractId,
          payment.sellerId,
          payment.sellerName,
          payment.clientId,
          payment.clientName,
          payment.monthNumber,
          payment.period,
          payment.amount,
          payment.status,
          payment.invoiceVerified ? 1 : 0,
          payment.invoiceId ?? null,
          payment.devicesVerified ? 1 : 0,
          payment.deviceVerification ? JSON.stringify(payment.deviceVerification) : null,
          payment.paidAt ?? null,
          payment.notes ?? null,
          payment.createdAt
        );
      }
    });

    transaction(payments);
  }

  update(id: string, data: Partial<CommissionPayment>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.invoiceVerified !== undefined) { fields.push('invoice_verified = ?'); values.push(data.invoiceVerified ? 1 : 0); }
    if (data.invoiceId !== undefined) { fields.push('invoice_id = ?'); values.push(data.invoiceId); }
    if (data.devicesVerified !== undefined) { fields.push('devices_verified = ?'); values.push(data.devicesVerified ? 1 : 0); }
    if (data.deviceVerification !== undefined) { fields.push('device_verification_json = ?'); values.push(JSON.stringify(data.deviceVerification)); }
    if (data.paidAt !== undefined) { fields.push('paid_at = ?'); values.push(data.paidAt); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

    if (fields.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE commission_payments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  /** Cancel all future payments for a contract */
  cancelFuturePayments(contractId: string, currentPeriod: string): number {
    const result = this.db.prepare(`
      UPDATE commission_payments
      SET status = 'cancelado'
      WHERE contract_id = ? AND period > ? AND status = 'pendiente'
    `).run(contractId, currentPeriod);
    return result.changes;
  }

  /** Get payment summary grouped by period */
  getSummary(): PaymentSummary[] {
    const rows = this.db.prepare(`
      SELECT
        period,
        SUM(amount) as total,
        SUM(CASE WHEN status = 'pagado' THEN amount ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'pendiente' THEN amount ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'retenido' THEN amount ELSE 0 END) as withheld,
        SUM(CASE WHEN status = 'cancelado' THEN amount ELSE 0 END) as cancelled,
        COUNT(*) as count
      FROM commission_payments
      GROUP BY period
      ORDER BY period DESC
    `).all() as Array<{
      period: string;
      total: number;
      paid: number;
      pending: number;
      withheld: number;
      cancelled: number;
      count: number;
    }>;
    return rows;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM commission_payments').get() as { count: number };
    return row.count;
  }
}

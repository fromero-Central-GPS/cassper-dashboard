/**
 * Invoices repository — CRUD operations for the invoices table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Invoice } from '@/lib/commission-types';

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  client_id: string;
  client_name: string;
  contract_id: string | null;
  amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  period: string;
}

function rowToInvoice(row: unknown): Invoice {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    clientName: r.client_name as string,
    contractId: (r.contract_id as string) ?? undefined,
    amount: r.amount as number,
    status: r.status as Invoice['status'],
    issuedAt: r.issued_at as string,
    paidAt: (r.paid_at as string) ?? undefined,
    period: r.period as string,
  };
}

export class InvoiceRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): Invoice[] {
    const rows = this.db.prepare('SELECT * FROM invoices ORDER BY issued_at DESC').all() as InvoiceRow[];
    return rows.map(rowToInvoice);
  }

  findById(id: string): Invoice | null {
    const row = this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined;
    return row ? rowToInvoice(row) : null;
  }

  findByClient(clientId: string): Invoice[] {
    const rows = this.db.prepare(
      'SELECT * FROM invoices WHERE client_id = ? ORDER BY issued_at DESC'
    ).all(clientId) as InvoiceRow[];
    return rows.map(rowToInvoice);
  }

  findByPeriod(period: string): Invoice[] {
    const rows = this.db.prepare(
      'SELECT * FROM invoices WHERE period = ? ORDER BY issued_at DESC'
    ).all(period) as InvoiceRow[];
    return rows.map(rowToInvoice);
  }

  findByContract(contractId: string): Invoice[] {
    const rows = this.db.prepare(
      'SELECT * FROM invoices WHERE contract_id = ? ORDER BY issued_at DESC'
    ).all(contractId) as InvoiceRow[];
    return rows.map(rowToInvoice);
  }

  /** Find paid invoices for a client in a given period */
  findPaidForPeriod(clientId: string, period: string): Invoice[] {
    const rows = this.db.prepare(
      "SELECT * FROM invoices WHERE client_id = ? AND period = ? AND status = 'pagada'"
    ).all(clientId, period) as InvoiceRow[];
    return rows.map(rowToInvoice);
  }

  create(invoice: Invoice): void {
    this.db.prepare(`
      INSERT INTO invoices (id, client_id, client_name, contract_id, amount, status, issued_at, paid_at, period)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      invoice.id,
      invoice.clientId,
      invoice.clientName,
      invoice.contractId ?? null,
      invoice.amount,
      invoice.status,
      invoice.issuedAt,
      invoice.paidAt ?? null,
      invoice.period
    );
  }

  update(id: string, data: Partial<Invoice>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.paidAt !== undefined) { fields.push('paid_at = ?'); values.push(data.paidAt); }
    if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount); }

    if (fields.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
    return row.count;
  }
}

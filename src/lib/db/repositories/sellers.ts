/**
 * Sellers repository — CRUD operations for the sellers table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Seller } from '@/lib/commission-types';

function rowToSeller(row: unknown): Seller {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    commissionRate: r.commission_rate as number,
    active: Boolean(r.active),
    ghlUserId: r.ghl_user_id as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export class SellerRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): Seller[] {
    const rows = this.db.prepare('SELECT * FROM sellers ORDER BY name').all();
    return rows.map(rowToSeller);
  }

  findActive(): Seller[] {
    const rows = this.db.prepare('SELECT * FROM sellers WHERE active = 1 ORDER BY name').all();
    return rows.map(rowToSeller);
  }

  findById(id: string): Seller | null {
    const row = this.db.prepare('SELECT * FROM sellers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToSeller(row) : null;
  }

  create(seller: Seller): void {
    this.db.prepare(`
      INSERT INTO sellers (id, name, email, commission_rate, active, ghl_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      seller.id,
      seller.name,
      seller.email,
      seller.commissionRate,
      seller.active ? 1 : 0,
      seller.ghlUserId ?? null,
      seller.createdAt,
      seller.updatedAt
    );
  }

  update(id: string, data: Partial<Seller>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.commissionRate !== undefined) { fields.push('commission_rate = ?'); values.push(data.commissionRate); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }
    if (data.ghlUserId !== undefined) { fields.push('ghl_user_id = ?'); values.push(data.ghlUserId); }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE sellers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM sellers').get() as { count: number };
    return row.count;
  }

  upsert(seller: Seller): void {
    const existing = this.findById(seller.id);
    if (existing) {
      this.update(seller.id, seller);
    } else {
      this.create(seller);
    }
  }
}

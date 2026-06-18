/**
 * Clients repository — CRUD operations for the clients table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Client } from '@/lib/commission-types';

function rowToClient(row: unknown): Client {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    companyName: r.company_name as string | undefined,
    rut: r.rut as string | undefined,
    email: r.email as string,
    phone: r.phone as string | undefined,
    ghlContactId: r.ghl_contact_id as string | undefined,
    acquiredBySellerId: r.acquired_by_seller_id as string,
    createdAt: r.created_at as string,
  };
}

export class ClientRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): Client[] {
    const rows = this.db.prepare('SELECT * FROM clients ORDER BY name').all();
    return rows.map(rowToClient);
  }

  findById(id: string): Client | null {
    const row = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToClient(row) : null;
  }

  findBySeller(sellerId: string): Client[] {
    const rows = this.db.prepare('SELECT * FROM clients WHERE acquired_by_seller_id = ? ORDER BY name').all(sellerId);
    return rows.map(rowToClient);
  }

  create(client: Client): void {
    this.db.prepare(`
      INSERT INTO clients (id, name, company_name, rut, email, phone, ghl_contact_id, acquired_by_seller_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client.id,
      client.name,
      client.companyName ?? null,
      client.rut ?? null,
      client.email,
      client.phone ?? null,
      client.ghlContactId ?? null,
      client.acquiredBySellerId,
      client.createdAt
    );
  }

  update(id: string, data: Partial<Client>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.companyName !== undefined) { fields.push('company_name = ?'); values.push(data.companyName); }
    if (data.rut !== undefined) { fields.push('rut = ?'); values.push(data.rut); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.ghlContactId !== undefined) { fields.push('ghl_contact_id = ?'); values.push(data.ghlContactId); }
    if (data.acquiredBySellerId !== undefined) { fields.push('acquired_by_seller_id = ?'); values.push(data.acquiredBySellerId); }

    if (fields.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };
    return row.count;
  }

  /** Find a client by name (case-insensitive) */
  findByName(name: string): Client | null {
    const row = this.db.prepare(
      'SELECT * FROM clients WHERE LOWER(name) = LOWER(?) OR LOWER(company_name) = LOWER(?)'
    ).get(name, name) as Record<string, unknown> | undefined;
    return row ? rowToClient(row) : null;
  }

  upsert(client: Client): void {
    const existing = this.findById(client.id);
    if (existing) {
      this.update(client.id, client);
    } else {
      this.create(client);
    }
  }
}

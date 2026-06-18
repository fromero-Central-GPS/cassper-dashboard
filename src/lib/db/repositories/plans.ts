/**
 * Plans repository — CRUD operations for the plans table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Plan, PlanType } from '@/lib/commission-types';

function rowToPlan(row: unknown): Plan {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as PlanType,
    monthlyPricePerUnit: r.monthly_price_per_unit as number,
    description: r.description as string | undefined,
    active: Boolean(r.active),
  };
}

export class PlanRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): Plan[] {
    const rows = this.db.prepare('SELECT * FROM plans ORDER BY name').all();
    return rows.map(rowToPlan);
  }

  findActive(): Plan[] {
    const rows = this.db.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY name').all();
    return rows.map(rowToPlan);
  }

  findById(id: string): Plan | null {
    const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToPlan(row) : null;
  }

  create(plan: Plan): void {
    this.db.prepare(`
      INSERT INTO plans (id, name, type, monthly_price_per_unit, description, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      plan.id,
      plan.name,
      plan.type,
      plan.monthlyPricePerUnit,
      plan.description ?? null,
      plan.active ? 1 : 0
    );
  }

  update(id: string, data: Partial<Plan>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.monthlyPricePerUnit !== undefined) { fields.push('monthly_price_per_unit = ?'); values.push(data.monthlyPricePerUnit); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    this.db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
    return row.count;
  }

  upsert(plan: Plan): void {
    const existing = this.findById(plan.id);
    if (existing) {
      this.update(plan.id, plan);
    } else {
      this.create(plan);
    }
  }
}

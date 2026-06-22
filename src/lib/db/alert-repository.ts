/**
 * Alert repository — CRUD + aggregation queries for the commission_alerts table.
 */

import type Database from 'better-sqlite3';
import { getDb } from './connection';
import type { CommissionAlert, AlertType } from '../commission-types';

function rowToAlert(row: unknown): CommissionAlert {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    type: r.type as AlertType,
    title: r.title as string,
    description: r.description as string,
    severity: r.severity as CommissionAlert['severity'],
    contractId: r.contract_id as string | undefined,
    sellerId: r.seller_id as string | undefined,
    clientId: r.client_id as string | undefined,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json as string) : undefined,
    read: Boolean(r.is_read),
    createdAt: r.created_at as string,
  };
}

export interface AlertCountBySeverity {
  severity: string;
  count: number;
}

export interface AlertCountByType {
  type: AlertType;
  count: number;
}

export interface AlertCountByClient {
  clientId: string;
  clientName: string | null;
  count: number;
}

export class AlertRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  create(alert: Omit<CommissionAlert, 'id' | 'createdAt' | 'read'>): CommissionAlert {
    const id = `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO commission_alerts (
        id, type, title, description, severity, contract_id, seller_id, client_id, metadata_json, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      alert.type,
      alert.title,
      alert.description,
      alert.severity,
      alert.contractId ?? null,
      alert.sellerId ?? null,
      alert.clientId ?? null,
      alert.metadata ? JSON.stringify(alert.metadata) : null,
      0,
      createdAt,
    );

    return {
      ...alert,
      id,
      createdAt,
      read: false,
    };
  }

  findById(id: string): CommissionAlert | null {
    const row = this.db.prepare('SELECT * FROM commission_alerts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToAlert(row) : null;
  }

  findAll(options?: {
    sellerId?: string;
    clientId?: string;
    unreadOnly?: boolean;
    severity?: CommissionAlert['severity'];
    type?: AlertType;
    limit?: number;
    offset?: number;
  }): CommissionAlert[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.sellerId) {
      conditions.push('seller_id = ?');
      params.push(options.sellerId);
    }
    if (options?.clientId) {
      conditions.push('client_id = ?');
      params.push(options.clientId);
    }
    if (options?.unreadOnly) {
      conditions.push('is_read = 0');
    }
    if (options?.severity) {
      conditions.push('severity = ?');
      params.push(options.severity);
    }
    if (options?.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    let query = 'SELECT * FROM commission_alerts';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(query).all(...params) as unknown[];
    return rows.map(rowToAlert);
  }

  update(id: string, data: Partial<Pick<CommissionAlert, 'title' | 'description' | 'severity' | 'read'>>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.severity !== undefined) { fields.push('severity = ?'); values.push(data.severity); }
    if (data.read !== undefined) { fields.push('is_read = ?'); values.push(data.read ? 1 : 0); }

    if (fields.length === 0) return false;

    values.push(id);
    const result = this.db.prepare(`UPDATE commission_alerts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return result.changes > 0;
  }

  markAsRead(id: string): boolean {
    const result = this.db.prepare('UPDATE commission_alerts SET is_read = 1 WHERE id = ?').run(id);
    return result.changes > 0;
  }

  markAllAsRead(options?: { sellerId?: string; clientId?: string }): number {
    const conditions: string[] = ['is_read = 0'];
    const params: unknown[] = [];

    if (options?.sellerId) { conditions.push('seller_id = ?'); params.push(options.sellerId); }
    if (options?.clientId) { conditions.push('client_id = ?'); params.push(options.clientId); }

    const result = this.db.prepare(
      `UPDATE commission_alerts SET is_read = 1 WHERE ${conditions.join(' AND ')}`
    ).run(...params);
    return result.changes;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM commission_alerts WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteAll(): number {
    const result = this.db.prepare('DELETE FROM commission_alerts').run();
    return result.changes;
  }

  count(options?: { unreadOnly?: boolean; severity?: string; sellerId?: string }): number {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.unreadOnly) { conditions.push('is_read = 0'); }
    if (options?.severity) { conditions.push('severity = ?'); params.push(options.severity); }
    if (options?.sellerId) { conditions.push('seller_id = ?'); params.push(options.sellerId); }

    let query = 'SELECT COUNT(*) as count FROM commission_alerts';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const row = this.db.prepare(query).get(...params) as { count: number };
    return row.count;
  }

  // ─── Aggregation Queries ───────────────────────────────────────────────────

  /** Count alerts grouped by severity */
  countBySeverity(): AlertCountBySeverity[] {
    const rows = this.db.prepare(`
      SELECT severity, COUNT(*) as count
      FROM commission_alerts
      GROUP BY severity
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `).all() as AlertCountBySeverity[];
    return rows;
  }

  /** Count alerts grouped by alert type */
  countByType(): AlertCountByType[] {
    const rows = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM commission_alerts
      GROUP BY type
      ORDER BY count DESC
    `).all() as AlertCountByType[];
    return rows;
  }

  /** Count alerts grouped by client (top N) */
  countByClient(limit = 20): AlertCountByClient[] {
    const rows = this.db.prepare(`
      SELECT
        a.client_id as clientId,
        c.name as clientName,
        COUNT(*) as count
      FROM commission_alerts a
      LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.client_id IS NOT NULL
      GROUP BY a.client_id
      ORDER BY count DESC
      LIMIT ?
    `).all(limit) as AlertCountByClient[];
    return rows;
  }

  /** Count unread alerts grouped by seller */
  countUnreadBySeller(): { sellerId: string; sellerName: string | null; count: number }[] {
    const rows = this.db.prepare(`
      SELECT
        a.seller_id as sellerId,
        s.name as sellerName,
        COUNT(*) as count
      FROM commission_alerts a
      LEFT JOIN sellers s ON s.id = a.seller_id
      WHERE a.is_read = 0 AND a.seller_id IS NOT NULL
      GROUP BY a.seller_id
      ORDER BY count DESC
    `).all() as { sellerId: string; sellerName: string | null; count: number }[];
    return rows;
  }

  // ─── Backward-compatible static wrappers ────────────────────────────────────

  /** @deprecated Use instance method `create()` instead */
  static createAlert(alert: Omit<CommissionAlert, 'id' | 'createdAt' | 'read'>): CommissionAlert {
    return new AlertRepository().create(alert);
  }

  /** @deprecated Use instance method `findAll()` instead */
  static getAlerts(options?: { sellerId?: string; unreadOnly?: boolean; severity?: CommissionAlert['severity']; limit?: number }): CommissionAlert[] {
    return new AlertRepository().findAll(options);
  }

  /** @deprecated Use instance method `markAsRead()` instead */
  static markAsRead(id: string): void {
    new AlertRepository().markAsRead(id);
  }

  /** @deprecated Use instance method `deleteAll()` instead */
  static clearAlerts(): void {
    new AlertRepository().deleteAll();
  }
}

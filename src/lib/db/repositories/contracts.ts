/**
 * Contracts repository — CRUD + business queries for the contracts table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { Contract, ContractStatus, PlanType } from '@/lib/commission-types';

interface ContractRow extends Record<string, unknown> {
  id: string;
  client_id: string;
  client_name: string;
  plan_id: string;
  plan_name: string;
  plan_type: string;
  seller_id: string;
  seller_name: string;
  quantity: number;
  monthly_value: number;
  acv: number;
  total_commission: number;
  monthly_commission: number;
  start_date: string;
  end_date: string | null;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  is_upsell: number;
  original_contract_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function contractRowToObject(row: ContractRow, deviceImeis: string[]): Contract {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    planId: row.plan_id,
    planName: row.plan_name,
    planType: row.plan_type as PlanType,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    quantity: row.quantity,
    monthlyValue: row.monthly_value,
    acv: row.acv,
    totalCommission: row.total_commission,
    monthlyCommission: row.monthly_commission,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    status: row.status as ContractStatus,
    cancelledAt: row.cancelled_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    isUpsell: Boolean(row.is_upsell),
    originalContractId: row.original_contract_id ?? undefined,
    deviceImeis,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContractRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  private getDeviceImeis(contractId: string): string[] {
    const rows = this.db.prepare(
      'SELECT imei FROM contract_devices WHERE contract_id = ?'
    ).all(contractId) as { imei: string }[];
    return rows.map(r => r.imei);
  }

  private enrichContract(row: ContractRow): Contract {
    const imeis = this.getDeviceImeis(row.id);
    return contractRowToObject(row, imeis);
  }

  findAll(): Contract[] {
    const rows = this.db.prepare('SELECT * FROM contracts ORDER BY created_at DESC').all() as ContractRow[];
    return rows.map(r => this.enrichContract(r));
  }

  findByStatus(status: ContractStatus): Contract[] {
    const rows = this.db.prepare(
      'SELECT * FROM contracts WHERE status = ? ORDER BY created_at DESC'
    ).all(status) as ContractRow[];
    return rows.map(r => this.enrichContract(r));
  }

  findBySeller(sellerId: string): Contract[] {
    const rows = this.db.prepare(
      'SELECT * FROM contracts WHERE seller_id = ? ORDER BY created_at DESC'
    ).all(sellerId) as ContractRow[];
    return rows.map(r => this.enrichContract(r));
  }

  findByClient(clientId: string): Contract[] {
    const rows = this.db.prepare(
      'SELECT * FROM contracts WHERE client_id = ? ORDER BY created_at DESC'
    ).all(clientId) as ContractRow[];
    return rows.map(r => this.enrichContract(r));
  }

  findById(id: string): Contract | null {
    const row = this.db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as ContractRow | undefined;
    if (!row) return null;
    return this.enrichContract(row);
  }

  findActive(): Contract[] {
    return this.findByStatus('activo');
  }

  create(contract: Contract): void {
    const insertContract = this.db.prepare(`
      INSERT INTO contracts (
        id, client_id, client_name, plan_id, plan_name, plan_type,
        seller_id, seller_name, quantity, monthly_value, acv,
        total_commission, monthly_commission, start_date, end_date,
        status, cancelled_at, cancellation_reason, is_upsell,
        original_contract_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertContract.run(
      contract.id,
      contract.clientId,
      contract.clientName,
      contract.planId,
      contract.planName,
      contract.planType,
      contract.sellerId,
      contract.sellerName,
      contract.quantity,
      contract.monthlyValue,
      contract.acv,
      contract.totalCommission,
      contract.monthlyCommission,
      contract.startDate,
      contract.endDate ?? null,
      contract.status,
      contract.cancelledAt ?? null,
      contract.cancellationReason ?? null,
      contract.isUpsell ? 1 : 0,
      contract.originalContractId ?? null,
      contract.notes ?? null,
      contract.createdAt,
      contract.updatedAt
    );

    // Insert device IMEIs
    if (contract.deviceImeis.length > 0) {
      const insertDevice = this.db.prepare(
        'INSERT OR IGNORE INTO contract_devices (contract_id, imei) VALUES (?, ?)'
      );
      for (const imei of contract.deviceImeis) {
        insertDevice.run(contract.id, imei);
      }
    }
  }

  update(id: string, data: Partial<Contract>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    const fieldMap: [keyof Contract, string][] = [
      ['clientName', 'client_name'],
      ['planName', 'plan_name'],
      ['sellerName', 'seller_name'],
      ['quantity', 'quantity'],
      ['monthlyValue', 'monthly_value'],
      ['acv', 'acv'],
      ['totalCommission', 'total_commission'],
      ['monthlyCommission', 'monthly_commission'],
      ['endDate', 'end_date'],
      ['status', 'status'],
      ['cancellationReason', 'cancellation_reason'],
      ['notes', 'notes'],
    ];

    for (const [key, col] of fieldMap) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(data[key]);
      }
    }

    if (data.cancelledAt !== undefined) { fields.push('cancelled_at = ?'); values.push(data.cancelledAt); }
    if (data.isUpsell !== undefined) { fields.push('is_upsell = ?'); values.push(data.isUpsell ? 1 : 0); }
    if (data.originalContractId !== undefined) { fields.push('original_contract_id = ?'); values.push(data.originalContractId); }

    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Update device IMEIs if provided
    if (data.deviceImeis !== undefined) {
      this.db.prepare('DELETE FROM contract_devices WHERE contract_id = ?').run(id);
      const insertDevice = this.db.prepare(
        'INSERT OR IGNORE INTO contract_devices (contract_id, imei) VALUES (?, ?)'
      );
      for (const imei of data.deviceImeis) {
        insertDevice.run(id, imei);
      }
    }
  }

  addDeviceImei(contractId: string, imei: string): void {
    this.db.prepare(
      'INSERT OR IGNORE INTO contract_devices (contract_id, imei) VALUES (?, ?)'
    ).run(contractId, imei);
  }

  removeDeviceImei(contractId: string, imei: string): void {
    this.db.prepare(
      'DELETE FROM contract_devices WHERE contract_id = ? AND imei = ?'
    ).run(contractId, imei);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM contracts').get() as { count: number };
    return row.count;
  }

  /** Get the next sequential contract ID */
  getNextId(): string {
    const row = this.db.prepare(
      "SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) as max_num FROM contracts WHERE id LIKE 'CTR-%'"
    ).get() as { max_num: number | null };
    const next = (row.max_num ?? 0) + 1;
    return `CTR-${String(next).padStart(3, '0')}`;
  }
}

/**
 * GPS Devices repository — CRUD operations for the gps_devices table.
 */

import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import type { GPSDevice } from '@/lib/commission-types';

interface DeviceRow extends Record<string, unknown> {
  imei: string;
  name: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  connected: number;
  last_seen: string | null;
  client_id: string | null;
  contract_id: string | null;
  source: string;
}

function rowToDevice(row: unknown): GPSDevice {
  const r = row as Record<string, unknown>;
  return {
    imei: r.imei as string,
    name: (r.name as string) ?? undefined,
    vehicleId: (r.vehicle_id as string) ?? undefined,
    vehicleName: (r.vehicle_name as string) ?? undefined,
    connected: Boolean(r.connected),
    lastSeen: (r.last_seen as string) ?? undefined,
    clientId: (r.client_id as string) ?? undefined,
    contractId: (r.contract_id as string) ?? undefined,
    source: r.source as 'pegasus' | 'flespi',
  };
}

export class DeviceRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  findAll(): GPSDevice[] {
    const rows = this.db.prepare('SELECT * FROM gps_devices ORDER BY imei').all() as DeviceRow[];
    return rows.map(rowToDevice);
  }

  findByImei(imei: string): GPSDevice | null {
    const row = this.db.prepare('SELECT * FROM gps_devices WHERE imei = ?').get(imei) as DeviceRow | undefined;
    return row ? rowToDevice(row) : null;
  }

  findByClient(clientId: string): GPSDevice[] {
    const rows = this.db.prepare(
      'SELECT * FROM gps_devices WHERE client_id = ? ORDER BY imei'
    ).all(clientId) as DeviceRow[];
    return rows.map(rowToDevice);
  }

  findByContract(contractId: string): GPSDevice[] {
    const rows = this.db.prepare(
      'SELECT * FROM gps_devices WHERE contract_id = ? ORDER BY imei'
    ).all(contractId) as DeviceRow[];
    return rows.map(rowToDevice);
  }

  findActive(): GPSDevice[] {
    const rows = this.db.prepare(
      'SELECT * FROM gps_devices WHERE connected = 1 ORDER BY imei'
    ).all() as DeviceRow[];
    return rows.map(rowToDevice);
  }

  /** Count active devices for a given contract */
  countActiveByContract(contractId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM gps_devices WHERE contract_id = ? AND connected = 1'
    ).get(contractId) as { count: number };
    return row.count;
  }

  create(device: GPSDevice): void {
    this.db.prepare(`
      INSERT INTO gps_devices (imei, name, vehicle_id, vehicle_name, connected, last_seen, client_id, contract_id, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      device.imei,
      device.name ?? null,
      device.vehicleId ?? null,
      device.vehicleName ?? null,
      device.connected ? 1 : 0,
      device.lastSeen ?? null,
      device.clientId ?? null,
      device.contractId ?? null,
      device.source
    );
  }

  /** Bulk upsert devices */
  upsertMany(devices: GPSDevice[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO gps_devices (imei, name, vehicle_id, vehicle_name, connected, last_seen, client_id, contract_id, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(imei) DO UPDATE SET
        name = excluded.name,
        vehicle_id = excluded.vehicle_id,
        vehicle_name = excluded.vehicle_name,
        connected = excluded.connected,
        last_seen = excluded.last_seen,
        client_id = excluded.client_id,
        contract_id = excluded.contract_id,
        source = excluded.source
    `);

    const transaction = this.db.transaction((devices: GPSDevice[]) => {
      for (const device of devices) {
        upsert.run(
          device.imei,
          device.name ?? null,
          device.vehicleId ?? null,
          device.vehicleName ?? null,
          device.connected ? 1 : 0,
          device.lastSeen ?? null,
          device.clientId ?? null,
          device.contractId ?? null,
          device.source
        );
      }
    });

    transaction(devices);
  }

  update(imei: string, data: Partial<GPSDevice>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.vehicleId !== undefined) { fields.push('vehicle_id = ?'); values.push(data.vehicleId); }
    if (data.vehicleName !== undefined) { fields.push('vehicle_name = ?'); values.push(data.vehicleName); }
    if (data.connected !== undefined) { fields.push('connected = ?'); values.push(data.connected ? 1 : 0); }
    if (data.lastSeen !== undefined) { fields.push('last_seen = ?'); values.push(data.lastSeen); }
    if (data.clientId !== undefined) { fields.push('client_id = ?'); values.push(data.clientId); }
    if (data.contractId !== undefined) { fields.push('contract_id = ?'); values.push(data.contractId); }
    if (data.source !== undefined) { fields.push('source = ?'); values.push(data.source); }

    if (fields.length === 0) return;
    values.push(imei);

    this.db.prepare(`UPDATE gps_devices SET ${fields.join(', ')} WHERE imei = ?`).run(...values);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM gps_devices').get() as { count: number };
    return row.count;
  }
}

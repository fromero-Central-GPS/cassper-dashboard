/**
 * Database schema for the commission system.
 *
 * Maps the TypeScript types from commission-types.ts to SQLite tables.
 * Run once at application startup to ensure tables exist.
 */

import type Database from 'better-sqlite3';
import { getDb } from './connection';

const SCHEMA_SQL = `
-- Sellers (vendedores)
CREATE TABLE IF NOT EXISTS sellers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  commission_rate REAL NOT NULL DEFAULT 0.12,
  active          INTEGER NOT NULL DEFAULT 1,
  ghl_user_id     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Clients (clientes)
CREATE TABLE IF NOT EXISTS clients (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  company_name        TEXT,
  rut                 TEXT,
  email               TEXT NOT NULL,
  phone               TEXT,
  ghl_contact_id      TEXT,
  acquired_by_seller_id TEXT NOT NULL REFERENCES sellers(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plans (planes)
CREATE TABLE IF NOT EXISTS plans (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL CHECK (type IN (
    'gps_basico','gps_avanzado','gps_premium',
    'flota_basico','flota_avanzado','flota_premium','personalizado'
  )),
  monthly_price_per_unit REAL NOT NULL,
  description            TEXT,
  active                 INTEGER NOT NULL DEFAULT 1
);

-- Contracts (contratos)
CREATE TABLE IF NOT EXISTS contracts (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES clients(id),
  client_name         TEXT NOT NULL,
  plan_id             TEXT NOT NULL REFERENCES plans(id),
  plan_name           TEXT NOT NULL,
  plan_type           TEXT NOT NULL,
  seller_id           TEXT NOT NULL REFERENCES sellers(id),
  seller_name         TEXT NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  monthly_value       REAL NOT NULL,
  acv                 REAL NOT NULL,
  total_commission    REAL NOT NULL,
  monthly_commission  REAL NOT NULL,
  start_date          TEXT NOT NULL,
  end_date            TEXT,
  status              TEXT NOT NULL DEFAULT 'activo'
                      CHECK (status IN ('activo','suspendido','cancelado','finalizado')),
  cancelled_at        TEXT,
  cancellation_reason TEXT,
  is_upsell           INTEGER NOT NULL DEFAULT 0,
  original_contract_id TEXT REFERENCES contracts(id),
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contract devices (join table: contract <-> IMEIs)
CREATE TABLE IF NOT EXISTS contract_devices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  imei        TEXT NOT NULL UNIQUE,
  UNIQUE(contract_id, imei)
);

-- Commission payments (plan de pagos por contrato)
CREATE TABLE IF NOT EXISTS commission_payments (
  id                TEXT PRIMARY KEY,
  contract_id       TEXT NOT NULL REFERENCES contracts(id),
  seller_id         TEXT NOT NULL REFERENCES sellers(id),
  seller_name       TEXT NOT NULL,
  client_id         TEXT NOT NULL REFERENCES clients(id),
  client_name       TEXT NOT NULL,
  month_number      INTEGER NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  period            TEXT NOT NULL,  -- YYYY-MM
  amount            REAL NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','pagado','retenido','cancelado','disputado')),
  invoice_verified  INTEGER NOT NULL DEFAULT 0,
  invoice_id        TEXT,
  devices_verified  INTEGER NOT NULL DEFAULT 0,
  device_verification_json TEXT,  -- JSON-serialized DeviceVerification
  paid_at           TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invoices (facturas)
CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id),
  client_name TEXT NOT NULL,
  contract_id TEXT REFERENCES contracts(id),
  amount      REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'emitida'
              CHECK (status IN ('emitida','pagada','vencida','anulada')),
  issued_at   TEXT NOT NULL,
  paid_at     TEXT,
  period      TEXT NOT NULL  -- YYYY-MM
);

-- GPS Devices (dispositivos GPS)
CREATE TABLE IF NOT EXISTS gps_devices (
  imei         TEXT PRIMARY KEY,
  name         TEXT,
  vehicle_id   TEXT,
  vehicle_name TEXT,
  connected    INTEGER NOT NULL DEFAULT 0,
  last_seen    TEXT,
  client_id    TEXT REFERENCES clients(id),
  contract_id  TEXT REFERENCES contracts(id),
  source       TEXT NOT NULL DEFAULT 'pegasus'
               CHECK (source IN ('pegasus','flespi'))
);

-- Commission events (log de eventos del sistema)
CREATE TABLE IF NOT EXISTS commission_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  contract_id TEXT REFERENCES contracts(id),
  seller_id   TEXT REFERENCES sellers(id),
  client_id   TEXT REFERENCES clients(id),
  device_imei TEXT,
  description TEXT NOT NULL,
  metadata_json TEXT,  -- JSON-serialized metadata
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Commission config (single-row config table)
CREATE TABLE IF NOT EXISTS commission_config (
  id                          INTEGER PRIMARY KEY CHECK (id = 1),
  default_commission_rate     REAL NOT NULL DEFAULT 0.12,
  payment_installments        INTEGER NOT NULL DEFAULT 12,
  invoice_grace_days          INTEGER NOT NULL DEFAULT 5,
  verify_devices_before_payment INTEGER NOT NULL DEFAULT 1,
  inactive_device_tolerance   INTEGER NOT NULL DEFAULT 0,
  notify_upsell               INTEGER NOT NULL DEFAULT 1,
  notify_cancellation         INTEGER NOT NULL DEFAULT 1
);

-- Commission alerts
CREATE TABLE IF NOT EXISTS commission_alerts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN (
    'A1_NUEVO_DISPOSITIVO_UPSELL',
    'A2_BAJA_DISPOSITIVO_FACTURADO',
    'A3_CLIENTE_NUEVO_SIN_VENDEDOR',
    'A4_DISCREPANCIA_DISPOSITIVOS',
    'A5_FACTURA_IMPAGA',
    'A6_CONTRATO_CANCELADO',
    'A7_PAGO_LIBERADO',
    'A8_PAGO_RETENIDO'
  )),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  contract_id TEXT REFERENCES contracts(id),
  seller_id   TEXT REFERENCES sellers(id),
  client_id   TEXT REFERENCES clients(id),
  metadata_json TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pipeline runs (daily GHL analysis results)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                TEXT PRIMARY KEY,
  run_at            TEXT NOT NULL,
  pipeline_id       TEXT NOT NULL,
  pipeline_name     TEXT NOT NULL,
  total_analyzed    INTEGER NOT NULL DEFAULT 0,
  summary_json      TEXT NOT NULL,
  conversations_json TEXT,
  status            TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','failed','running')),
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);\n\n-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contracts_seller   ON contracts(seller_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client   ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status   ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_payments_contract  ON commission_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller    ON commission_payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_period    ON commission_payments(period);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client    ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period    ON invoices(period);
CREATE INDEX IF NOT EXISTS idx_gps_devices_client ON gps_devices(client_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_contract ON gps_devices(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_devices_contract ON contract_devices(contract_id);\nCREATE INDEX IF NOT EXISTS idx_commission_alerts_type ON commission_alerts(type);\nCREATE INDEX IF NOT EXISTS idx_commission_alerts_severity ON commission_alerts(severity);\nCREATE INDEX IF NOT EXISTS idx_commission_alerts_seller ON commission_alerts(seller_id);\nCREATE INDEX IF NOT EXISTS idx_commission_alerts_is_read ON commission_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run_at ON pipeline_runs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);

-- Recovery Campaigns (campañas de recuperación post-envío)
CREATE TABLE IF NOT EXISTS recovery_campaigns (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  wave_number         INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','completed','archived','draft')),
  messages_sent       INTEGER NOT NULL DEFAULT 0,
  total_value_targeted REAL NOT NULL DEFAULT 0,
  started_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recovery Sends (envíos individuales dentro de una campaña)
CREATE TABLE IF NOT EXISTS recovery_sends (
  id                      TEXT PRIMARY KEY,
  campaign_id             TEXT NOT NULL REFERENCES recovery_campaigns(id),
  contact_name            TEXT NOT NULL,
  contact_email           TEXT,
  company_name            TEXT,
  ghl_contact_id          TEXT,
  opportunity_id          TEXT,
  value_clp               REAL NOT NULL DEFAULT 0,
  channel                 TEXT NOT NULL DEFAULT 'email'
                          CHECK (channel IN ('email','whatsapp','sms')),
  message_id              TEXT,
  status                  TEXT NOT NULL DEFAULT 'sent'
                          CHECK (status IN (
                            'sent','awaiting_response','replied_positive',
                            'replied_negative','replied_neutral','no_response',
                            'followup_sent','archived','failed'
                          )),
  sent_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  response_at             TEXT,
  response_classification TEXT CHECK (response_classification IN ('positive','negative','neutral')),
  response_summary        TEXT,
  followup_sent_at        TEXT,
  followup_message_id     TEXT,
  archived_at             TEXT,
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recovery_sends_campaign ON recovery_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recovery_sends_status ON recovery_sends(status);
CREATE INDEX IF NOT EXISTS idx_recovery_sends_sent_at ON recovery_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_recovery_campaigns_status ON recovery_campaigns(status);
`;

export function initSchema(db?: Database.Database): void {
  const conn = db ?? getDb();
  conn.exec(SCHEMA_SQL);
}

/** Initialize schema if it doesn't exist (safe to call on every startup) */
export function ensureSchema(db?: Database.Database): void {
  const conn = db ?? getDb();
  const tableCount = conn.prepare(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='sellers'"
  ).get() as { count: number };

  if (tableCount.count === 0) {
    initSchema(conn);
  }
}

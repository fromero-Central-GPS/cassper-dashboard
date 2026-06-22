/**
 * Database layer barrel export.
 *
 * Usage:
 *   import { initSchema, SellerRepository, ContractRepository, ... } from '@/lib/db';
 */

export { getDb, closeDb, getMemoryDb } from './connection';
export { initSchema, ensureSchema } from './schema';
export { SellerRepository } from './repositories/sellers';
export { ClientRepository } from './repositories/clients';
export { PlanRepository } from './repositories/plans';
export { ContractRepository } from './repositories/contracts';
export { PaymentRepository } from './repositories/payments';
export type { PaymentSummary } from './repositories/payments';
export { InvoiceRepository } from './repositories/invoices';
export { DeviceRepository } from './repositories/devices';
export { AlertRepository } from './alert-repository';
export type { AlertCountBySeverity, AlertCountByType, AlertCountByClient } from './alert-repository';
export { PipelineRunRepository } from './repositories/pipeline-runs';
export type { PipelineRun, PipelineRunSummary } from './repositories/pipeline-runs';
export { RecoveryRepository } from './repositories/recovery';
export type { RecoveryCampaign, RecoverySend, RecoveryCampaignMetrics, RecoverySendStatus } from './repositories/recovery';

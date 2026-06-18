/**
 * Database seed script.
 *
 * Migrates the mock data from commission-mock-data.ts into the SQLite database.
 * Run once: npx tsx src/lib/db/seed.ts
 *
 * This preserves the mock data structure while persisting it to disk,
 * enabling the transition from in-memory data to real persistence.
 */

import { getDb } from './connection';
import { initSchema } from './schema';
import { SellerRepository } from './repositories/sellers';
import { ClientRepository } from './repositories/clients';
import { PlanRepository } from './repositories/plans';
import { ContractRepository } from './repositories/contracts';
import { PaymentRepository } from './repositories/payments';
import { InvoiceRepository } from './repositories/invoices';
import { DeviceRepository } from './repositories/devices';
import {
  mockSellers,
  mockClients,
  mockPlans,
  mockContracts,
  mockPayments,
  mockInvoices,
  generateMockDevices,
} from '@/lib/commission-mock-data';
import { DEFAULT_COMMISSION_CONFIG } from '@/lib/commission-engine';

function seed() {
  console.log('🌱 Seeding database...\n');

  // Initialize schema
  initSchema();
  const db = getDb();

  // Clear existing data (order matters due to foreign keys)
  db.exec(`
    DELETE FROM contract_devices;
    DELETE FROM commission_payments;
    DELETE FROM commission_events;
    DELETE FROM invoices;
    DELETE FROM gps_devices;
    DELETE FROM contracts;
    DELETE FROM clients;
    DELETE FROM plans;
    DELETE FROM sellers;
  `);

  const sellerRepo = new SellerRepository(db);
  const clientRepo = new ClientRepository(db);
  const planRepo = new PlanRepository(db);
  const contractRepo = new ContractRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const invoiceRepo = new InvoiceRepository(db);
  const deviceRepo = new DeviceRepository(db);

  // Seed sellers
  console.log(`📊 Sellers: ${mockSellers.length}`);
  for (const seller of mockSellers) {
    sellerRepo.create(seller);
  }

  // Seed plans
  console.log(`📋 Plans: ${mockPlans.length}`);
  for (const plan of mockPlans) {
    planRepo.create(plan);
  }

  // Seed clients
  console.log(`🏢 Clients: ${mockClients.length}`);
  for (const client of mockClients) {
    clientRepo.create(client);
  }

  // Seed contracts (with device IMEIs)
  console.log(`📝 Contracts: ${mockContracts.length}`);
  for (const contract of mockContracts) {
    contractRepo.create(contract);
  }

  // Seed payments
  console.log(`💰 Payments: ${mockPayments.length}`);
  paymentRepo.createMany(mockPayments);

  // Seed invoices
  console.log(`🧾 Invoices: ${mockInvoices.length}`);
  for (const invoice of mockInvoices) {
    invoiceRepo.create(invoice);
  }

  // Seed GPS devices
  const mockDevices = generateMockDevices();
  console.log(`📡 Devices: ${mockDevices.length}`);
  deviceRepo.upsertMany(mockDevices);

  // Seed default config
  db.prepare(`
    INSERT OR REPLACE INTO commission_config (
      id, default_commission_rate, payment_installments, invoice_grace_days,
      verify_devices_before_payment, inactive_device_tolerance,
      notify_upsell, notify_cancellation
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    DEFAULT_COMMISSION_CONFIG.defaultCommissionRate,
    DEFAULT_COMMISSION_CONFIG.paymentInstallments,
    DEFAULT_COMMISSION_CONFIG.invoiceGraceDays,
    DEFAULT_COMMISSION_CONFIG.verifyDevicesBeforePayment ? 1 : 0,
    DEFAULT_COMMISSION_CONFIG.inactiveDeviceTolerance,
    DEFAULT_COMMISSION_CONFIG.notifyUpsell ? 1 : 0,
    DEFAULT_COMMISSION_CONFIG.notifyCancellation ? 1 : 0
  );

  // Verify counts
  console.log('\n✅ Seed complete!');
  console.log(`   Sellers:  ${sellerRepo.count()}`);
  console.log(`   Clients:  ${clientRepo.count()}`);
  console.log(`   Plans:    ${planRepo.count()}`);
  console.log(`   Contracts: ${contractRepo.count()}`);
  console.log(`   Payments: ${paymentRepo.count()}`);
  console.log(`   Invoices: ${invoiceRepo.count()}`);
  console.log(`   Devices:  ${deviceRepo.count()}`);
}

// Run if called directly
seed();

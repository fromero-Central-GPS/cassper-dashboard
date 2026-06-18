/**
 * Script to synchronize device status from Pegasus to the local database.
 *
 * How it works:
 * 1. It fetches all contracts from the local database to get a list of all known device IMEIs.
 * 2. It uses the PegasusIntegrationService to query the Pegasus MCP for the last seen time of each device.
 * 3. It then updates the `gps_devices` table with the latest connectivity status and last seen time.
 *
 * This script is intended to be run periodically (e.g., via a cron job or a scheduled agent)
 * to keep the local device data in sync with the live data from Pegasus.
 *
 * Usage:
 *   npx tsx scripts/sync-pegasus.ts
 */

import { getDb, closeDb } from '@/lib/db/connection';
import { ContractRepository, DeviceRepository } from '@/lib/db';
import { PegasusIntegrationService, PegasusMcp } from '@/lib/pegasus-integration';
import type { GPSDevice } from '@/lib/commission-types';
// import { mcp_Pegasus_MCP } from '.prisma/client'; // Placeholder for real MCP tool

// --- Mock MCP for local testing ---
class MockPegasusMcp implements PegasusMcp {
  private vehicles: any[] = [];

  constructor() {
    // Populate with some mock vehicles. In a real scenario, this data comes from Pegasus.
    for (let i = 1; i <= 25; i++) {
      const imei = `8681660500000${String(i).padStart(2, '0')}`;
      this.vehicles.push({
        id: `v${i}`,
        name: imei, // Using name as IMEI for the mock
        device: imei,
      });
    }
  }

  async pegasus_list_vehicles(args: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 100 } = args;
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = this.vehicles.slice(start, end);
    return { items, has_more: end < this.vehicles.length };
  }

  async pegasus_get_vehicle(args: { vehicle_id: string }) {
    return this.vehicles.find(v => v.id === args.vehicle_id) ?? null;
  }

  async pegasus_get_rawdata(args: { vehicles: string; duration?: string, tail?: string }) {
    const vehicle = this.vehicles.find(v => v.id === args.vehicles);
    if (!vehicle) return { [args.vehicles]: [] };

    // Simulate some devices being offline
    const isOffline = parseInt(vehicle.id.substring(1)) % 5 === 0;
    if (isOffline) {
      return { [vehicle.id]: [] };
    }

    // Simulate recent activity
    const now = new Date();
    const randomMinutesAgo = Math.floor(Math.random() * 60 * 24); // Within last 24h
    const lastSeen = new Date(now.getTime() - randomMinutesAgo * 60 * 1000);

    return {
      [vehicle.id]: [{ time: lastSeen.toISOString(), lat: 0, lon: 0 }],
    };
  }
}
// --- End Mock MCP ---

async function main() {
  console.log('Starting Pegasus device synchronization...');
  const db = getDb();

  try {
    const contractRepo = new ContractRepository(db);
    const deviceRepo = new DeviceRepository(db);

    // 1. Get all unique IMEIs from our contracts database
    const allContracts = contractRepo.findAll();
    const allImeis = new Set<string>();
    for (const contract of allContracts) {
      contract.deviceImeis.forEach(imei => allImeis.add(imei));
    }
    const imeiList = Array.from(allImeis);
    console.log(`Found ${imeiList.length} unique device IMEIs in the database.`);

    // 2. Instantiate the Pegasus service with a real or mock MCP
    //    In a production environment, the real MCP tool would be passed here.
    const mcp = (process.env.NODE_ENV === 'production'
      ? null // The actual tool would be used here in production
      : new MockPegasusMcp()) as PegasusMcp;

    if (!mcp) {
      console.error('MCP tool is not available. Exiting.');
      return;
    }

    const pegasusService = new PegasusIntegrationService(mcp);

    // 3. Verify the status of all devices with Pegasus
    console.log('Querying Pegasus for device statuses...');
    const deviceStatuses = await pegasusService.verifyDevices(imeiList);
    console.log(`Received status for ${deviceStatuses.size} devices from Pegasus.`);

    // 4. Prepare data for bulk update in the local database
    const devicesToUpsert: GPSDevice[] = [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [imei, lastSeen] of deviceStatuses.entries()) {
      const isConnected = lastSeen ? lastSeen >= twentyFourHoursAgo : false;
      const contract = allContracts.find(c => c.deviceImeis.includes(imei));

      devicesToUpsert.push({
        imei: imei,
        connected: isConnected,
        lastSeen: lastSeen?.toISOString(),
        source: 'pegasus',
        // Preserve existing associations if any
        clientId: contract?.clientId,
        contractId: contract?.id,
      });
    }

    // 5. Update the local database
    if (devicesToUpsert.length > 0) {
      console.log(`Updating ${devicesToUpsert.length} devices in the local database...`);
      deviceRepo.upsertMany(devicesToUpsert);
      console.log('Device data updated successfully.');
    } else {
      console.log('No devices to update.');
    }

  } catch (error) {
    console.error('An error occurred during Pegasus synchronization:', error);
  } finally {
    closeDb();
    console.log('Synchronization process finished.');
  }
}

main().catch(err => {
  console.error('Critical error running sync script:', err);
  process.exit(1);
});

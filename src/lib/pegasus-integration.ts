/**
 * Pegasus MCP Integration Service
 *
 * This service provides a layer to communicate with the Pegasus MCP (Master Control Program)
 * for tasks like verifying device connectivity.
 */

// import type { mcp_Pegasus_MCP } from '.prisma/client'; // This is a placeholder for the actual tool type

export interface PegasusMcp {
  pegasus_list_vehicles(args?: {
    limit?: number;
    page?: number;
  }): Promise<{ items: any[]; has_more: boolean }>;
  pegasus_get_vehicle(args: { vehicle_id: string }): Promise<any>;
  pegasus_get_rawdata(args: {
    vehicles: string;
    duration?: string;
    from_?: string;
    to?: string;
    tail?: string;
  }): Promise<{ [key: string]: any[] }>;
}

export class PegasusIntegrationService {
  private readonly mcp: PegasusMcp;
  private vehicleIdMap: Map<string, string> | null = null; // imei -> vehicleId

  constructor(mcp: PegasusMcp) {
    this.mcp = mcp;
  }

  /**
   * Retrieves the last seen timestamp for a given device IMEI.
   * A device is considered active if it has transmitted data in the last 24 hours.
   * @param imei The IMEI of the device to check.
   * @returns The Date of the last message, or null if not seen recently or not found.
   */
  async getDeviceLastSeen(imei: string): Promise<Date | null> {
    const vehicleId = await this.getVehicleIdForImei(imei);
    if (!vehicleId) {
      console.warn(`[PegasusIntegration] No vehicle found for IMEI ${imei}`);
      return null;
    }

    try {
      // Fetch the last 1 event in the last 24 hours.
      const rawData = await this.mcp.pegasus_get_rawdata({
        vehicles: vehicleId,
        duration: 'PT24H', // Last 24 hours
        tail: '1', // Only the last event
      });

      const events = rawData[vehicleId];
      if (events && events.length > 0) {
        // The time is expected to be an ISO 8601 string or a unix timestamp.
        const lastEvent = events[0];
        const lastSeenTime = new Date(lastEvent.time);
        return isNaN(lastSeenTime.getTime()) ? null : lastSeenTime;
      }
      return null;
    } catch (error) {
      console.error(
        `[PegasusIntegration] Error fetching raw data for vehicle ${vehicleId} (IMEI: ${imei}):`,
        error
      );
      return null;
    }
  }

  /**
   * Verifies a list of device IMEIs against Pegasus and returns their active status.
   * @param deviceImeis An array of IMEIs to verify.
   * @returns A Map where keys are IMEIs and values are their last seen date (or null if inactive).
   */
  async verifyDevices(
    deviceImeis: string[]
  ): Promise<Map<string, Date | null>> {
    const verificationResults = new Map<string, Date | null>();

    // Pre-build the IMEI -> vehicleId map for efficiency
    await this.buildImeiToVehicleIdMap();

    const promises = deviceImeis.map(async (imei) => {
      const lastSeen = await this.getDeviceLastSeen(imei);
      verificationResults.set(imei, lastSeen);
    });

    await Promise.all(promises);

    return verificationResults;
  }

  /**
   * Maps an IMEI to a Pegasus Vehicle ID.
   * This is a critical and potentially fragile part of the integration.
   *
   * Current assumption: The vehicle's "name" in Pegasus is the device IMEI.
   * This should be replaced with a more robust method if available, e.g.,
   * using custom properties on the vehicle or a dedicated API endpoint.
   *
   * @param imei The device IMEI.
   * @returns The Pegasus vehicle ID or null if not found.
   */
  private async getVehicleIdForImei(imei: string): Promise<string | null> {
    if (!this.vehicleIdMap) {
      await this.buildImeiToVehicleIdMap();
    }
    return this.vehicleIdMap?.get(imei) ?? null;
  }

  /**
   * Builds a map of IMEI -> Vehicle ID by fetching all vehicles from Pegasus.
   * This is an expensive operation and should be done once per service instance.
   *
   * This implementation iterates through all vehicles and assumes the 'name' field holds the IMEI.
   * This is a temporary solution until a better mapping mechanism is established.
   */
  private async buildImeiToVehicleIdMap(): Promise<void> {
    if (this.vehicleIdMap) return;

    console.log('[PegasusIntegration] Building IMEI to Vehicle ID map...');
    this.vehicleIdMap = new Map<string, string>();
    let page = 1;
    let hasMore = true;

    try {
      while (hasMore) {
        const result = await this.mcp.pegasus_list_vehicles({ page, limit: 100 });
        for (const vehicle of result.items) {
          // ASSUMPTION: The vehicle name is the IMEI. This is a weak link.
          // A better approach would be to get the associated device IMEI
          // from the vehicle details if the API supports it.
          if (vehicle.name) {
            this.vehicleIdMap.set(vehicle.name, vehicle.id);
          }
        }
        hasMore = result.has_more;
        page++;
      }
      console.log(`[PegasusIntegration] Map built with ${this.vehicleIdMap.size} entries.`);
    } catch (error) {
      console.error('[PegasusIntegration] Failed to build IMEI map:', error);
      // In case of error, reset the map to allow retrying.
      this.vehicleIdMap = null;
    }
  }
}

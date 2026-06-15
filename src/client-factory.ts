import { AuvikClient as AuvikSdkClient, type AuvikRegion } from '@wyre-technology/node-auvik';
import type { AuvikCredentials } from './credentials.js';

// Tool-facing client interface. Tool handlers consume `{ data, ... }`-shaped
// responses: list calls check `response.data` / `response.data.length`, and
// single-get calls check `response.data`. The adapter in createAuvikClient maps
// this interface onto the real @wyre-technology/node-auvik SDK, which returns a
// `Page<T>` (`{ data: [...], links, meta }`) for lists and a flattened object
// for single gets — so get results are wrapped in `{ data }` to preserve the
// shape the handlers expect.
export interface AuvikClient {
  // Tenants
  tenants: {
    list(): Promise<any>;
    get(tenantId: string): Promise<any>;
    getDetail(tenantId: string): Promise<any>;
  };

  // Devices
  devices: {
    list(params?: any): Promise<any>;
    get(deviceId: string): Promise<any>;
    getDetails(deviceId: string): Promise<any>;
    getWarranty(deviceId: string): Promise<any>;
    getLifecycle(deviceId: string): Promise<any>;
  };

  // Networks
  networks: {
    list(params?: any): Promise<any>;
    get(networkId: string): Promise<any>;
  };

  // Interfaces
  interfaces: {
    list(params?: any): Promise<any>;
  };

  // Configurations
  configurations: {
    list(params?: any): Promise<any>;
    get(configId: string): Promise<any>;
  };

  // Entities (notes, audits)
  entities: {
    listNotes(params?: any): Promise<any>;
    listAudits(params?: any): Promise<any>;
  };

  // Alerts
  alerts: {
    list(params?: any): Promise<any>;
    get(alertId: string): Promise<any>;
    dismiss(alertId: string): Promise<any>;
  };

  // Statistics
  statistics: {
    device(params?: any): Promise<any>;
    interface(params?: any): Promise<any>;
    service(params?: any): Promise<any>;
    snmpPoller(params?: any): Promise<any>;
  };

  // Billing
  billing: {
    clientUsage(params?: any): Promise<any>;
    deviceUsage(params?: any): Promise<any>;
  };
}

// Tool args arrive as a loose object (e.g. { tenants: '123', filter_x: 'y' }).
// The SDK's list endpoints take their query params under `filters`, so map the
// args into `{ filters }`, coercing values to strings and dropping empties.
function toListOptions(params?: Record<string, unknown>): { filters: Record<string, string> } {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      filters[key] = String(value);
    }
  }
  return { filters };
}

export function createAuvikClient(credentials: AuvikCredentials): AuvikClient {
  // Construct the real SDK client. Region defaults to us1 (preserving prior
  // behavior) when the caller doesn't supply one via AUVIK_REGION / the
  // x-auvik-region gateway header; the SDK can also auto-resolve, but we keep
  // the explicit default to avoid per-request region probing.
  const sdk = new AuvikSdkClient({
    username: credentials.username,
    apiKey: credentials.apiKey,
    region: (credentials.region as AuvikRegion) || 'us1',
  });

  // Single-get SDK methods return a flattened resource object; tool handlers
  // expect `{ data: <obj> }`, so wrap them.
  const wrap = async <T>(promise: Promise<T>): Promise<{ data: T }> => ({ data: await promise });

  return {
    tenants: {
      list: () => sdk.tenants.list(),
      get: (tenantId) => wrap(sdk.tenants.get(tenantId)),
      getDetail: (tenantId) => sdk.tenants.listDetail({ filters: { tenants: tenantId } }),
    },

    devices: {
      list: (params) => sdk.inventoryDevice.listInfo(toListOptions(params)),
      get: (deviceId) => wrap(sdk.inventoryDevice.getInfo(deviceId)),
      getDetails: (deviceId) => wrap(sdk.inventoryDevice.getDetails(deviceId)),
      getWarranty: (deviceId) => wrap(sdk.inventoryDevice.getWarranty(deviceId)),
      getLifecycle: (deviceId) => wrap(sdk.inventoryDevice.getLifecycle(deviceId)),
    },

    networks: {
      list: (params) => sdk.inventoryNetwork.listInfo(toListOptions(params)),
      get: (networkId) => wrap(sdk.inventoryNetwork.getInfo(networkId)),
    },

    interfaces: {
      list: (params) => sdk.inventoryInterface.listInfo(toListOptions(params)),
    },

    configurations: {
      list: (params) => sdk.inventoryConfiguration.list(toListOptions(params)),
      get: (configId) => wrap(sdk.inventoryConfiguration.get(configId)),
    },

    entities: {
      listNotes: (params) => sdk.inventoryEntity.listNotes(toListOptions(params)),
      listAudits: (params) => sdk.inventoryEntity.listAudits(toListOptions(params)),
    },

    alerts: {
      list: (params) => sdk.alerts.listHistory(toListOptions(params)),
      get: (alertId) => wrap(sdk.alerts.getHistory(alertId)),
      dismiss: async (alertId) => {
        await sdk.alerts.dismiss(alertId);
        return { dismissed: true };
      },
    },

    statistics: {
      // Statistics endpoints take fromTime/thruTime at the top level (the SDK
      // destructures them) plus filter_* params, so pass the args through.
      device: (params) => sdk.statistics.getDeviceStatistics(params),
      interface: (params) => sdk.statistics.getInterfaceStatistics(params),
      service: (params) => sdk.statistics.getServiceStatistics(params),
      snmpPoller: (params) => sdk.statistics.getSnmpPollerStatistics(params),
    },

    billing: {
      clientUsage: (params) => sdk.billing.listUsageClient(toListOptions(params)),
      deviceUsage: (params) => sdk.billing.listUsageDevice(toListOptions(params)),
    },
  };
}

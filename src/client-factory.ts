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
// `keyMap` optionally renames arg keys to the API's query-param names (e.g.
// billing's `fromDate` -> `filter[fromDate]`); unmapped keys pass through.
function toListOptions(
  params?: Record<string, unknown>,
  keyMap: Record<string, string> = {},
): { filters: Record<string, string> } {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      filters[keyMap[key] ?? key] = String(value);
    }
  }
  return { filters };
}

// Auvik billing usage filters by DATE via the JSON:API params
// `filter[fromDate]`/`filter[thruDate]` (YYYY-MM-DD). (Ideally the SDK's billing
// resource would own this naming, mirroring statistics' timeStatParams — see the
// node-auvik TODO at the billing adapter below.)
const BILLING_DATE_FILTERS = { fromDate: 'filter[fromDate]', thruDate: 'filter[thruDate]' };

// Map statistics tool args into the SDK's StatisticsOptions. statId + interval
// are required by Auvik; fromTime/thruTime/tenants pass through; the
// type-specific id filter is keyed as the API expects (e.g. filter[deviceId]).
// Auvik actually *requires* `filter[thruTime]` for time-series stats (it 400s
// without it), even though the tool schema documents thruTime as "defaults to
// now" — so when a time window is requested (fromTime present) but thruTime is
// omitted, default it to now to honor that contract. snmpPoller has no fromTime
// and ignores the time window, so it is left untouched.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStatOptions(
  params: Record<string, unknown>,
  filterKey: string,
  filterValue: unknown,
): any {
  const filters: Record<string, string> = {};
  if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
    filters[filterKey] = String(filterValue);
  }
  const thruTime = params.thruTime || (params.fromTime ? new Date().toISOString() : undefined);
  return {
    statId: params.statId,
    fromTime: params.fromTime,
    interval: params.interval,
    ...(thruTime ? { thruTime } : {}),
    ...(params.tenants ? { tenants: params.tenants } : {}),
    filters,
  };
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

  // Auvik's tenant-detail endpoint is keyed by `tenantDomainPrefix`, not the
  // numeric tenant id (passing the id yields HTTP 400 "tenantDomainPrefix is
  // required"). Tool callers pass the numeric id, so resolve it to the domain
  // prefix via the tenant list, then query /tenants/detail with the plain
  // `tenantDomainPrefix` query param (not a JSON:API `filter[...]` param).
  // If a non-numeric value is passed, treat it as the prefix directly.
  const tenantDetail = async (tenantId: string) => {
    let prefix = String(tenantId);
    if (/^\d+$/.test(prefix)) {
      const list = await sdk.tenants.list();
      const match = (list.data || []).find((t) => String((t as { id?: unknown }).id) === prefix);
      const dp = match && (match as { domainPrefix?: unknown }).domainPrefix;
      if (typeof dp === 'string' && dp) prefix = dp;
    }
    return sdk.tenants.listDetail({ filters: { tenantDomainPrefix: prefix } });
  };

  return {
    tenants: {
      list: () => sdk.tenants.list(),
      get: (tenantId) => tenantDetail(tenantId),
      getDetail: (tenantId) => tenantDetail(tenantId),
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
      // Auvik statistics are /stat/{type}/{statId} with filter[fromTime] +
      // filter[interval] (required) and a type-specific id filter. Map the tool
      // args (statId/interval/fromTime/thruTime/tenants + filter_*) into the
      // SDK's options shape, keying the type filter as the API expects.
      device: (params = {}) => sdk.statistics.getDeviceStatistics(
        toStatOptions(params, 'filter[deviceId]', params.filter_devices)),
      interface: (params = {}) => sdk.statistics.getInterfaceStatistics(
        toStatOptions(params, 'filter[interfaceId]', params.filter_interfaces)),
      service: (params = {}) => sdk.statistics.getServiceStatistics(
        toStatOptions(params, 'filter[serviceId]', params.filter_services)),
      snmpPoller: (params = {}) => sdk.statistics.getSnmpPollerStatistics(
        toStatOptions(params, 'filter[oid]', params.filter_pollers)),
    },

    billing: {
      clientUsage: (params) => sdk.billing.listUsageClient(toListOptions(params, BILLING_DATE_FILTERS)),
      // TODO(node-auvik): deviceUsage also needs a device id in the path
      // (/billing/usage/device/{id}), which the SDK route does not yet pass —
      // tracked as a node-auvik follow-up.
      deviceUsage: (params) => sdk.billing.listUsageDevice(toListOptions(params, BILLING_DATE_FILTERS)),
    },
  };
}

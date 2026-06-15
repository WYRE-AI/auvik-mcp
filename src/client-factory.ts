import type { AuvikCredentials } from './credentials.js';

// Mock/placeholder for AuvikClient until node-auvik is complete
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

// Mock implementation - will be replaced when node-auvik is ready
class MockAuvikClient implements AuvikClient {
  private baseUrl: string;
  private auth: string;

  constructor(credentials: AuvikCredentials) {
    const region = credentials.region || 'us1';
    this.baseUrl = `https://auvikapi.${region}.my.auvik.com/v1`;
    this.auth = Buffer.from(`${credentials.username}:${credentials.apiKey}`).toString('base64');
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Auvik API error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  tenants = {
    list: () => this.request('/tenants'),
    get: (tenantId: string) => this.request(`/tenants/${tenantId}`),
    getDetail: (tenantId: string) => this.request(`/tenants/detail?tenants=${tenantId}`),
  };

  devices = {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/device/info${query}`);
    },
    get: (deviceId: string) => this.request(`/inventory/device/info/${deviceId}`),
    getDetails: (deviceId: string) => this.request(`/inventory/device/details/${deviceId}`),
    getWarranty: (deviceId: string) => this.request(`/inventory/device/warranty/${deviceId}`),
    getLifecycle: (deviceId: string) => this.request(`/inventory/device/lifecycle/${deviceId}`),
  };

  networks = {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/network/info${query}`);
    },
    get: (networkId: string) => this.request(`/inventory/network/info/${networkId}`),
  };

  interfaces = {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/interface/info${query}`);
    },
  };

  configurations = {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/configuration${query}`);
    },
    get: (configId: string) => this.request(`/inventory/configuration/${configId}`),
  };

  entities = {
    listNotes: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/entity/note${query}`);
    },
    listAudits: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/inventory/entity/audit${query}`);
    },
  };

  alerts = {
    list: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/alert/history${query}`);
    },
    get: (alertId: string) => this.request(`/alert/history/${alertId}`),
    dismiss: (alertId: string) => this.request(`/alert/history/${alertId}/dismiss`, { method: 'POST' }),
  };

  statistics = {
    device: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/stat/device${query}`);
    },
    interface: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/stat/interface${query}`);
    },
    service: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/stat/service${query}`);
    },
    snmpPoller: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/stat/snmpPoller${query}`);
    },
  };

  billing = {
    clientUsage: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/billing/usage/client${query}`);
    },
    deviceUsage: (params?: any) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return this.request(`/billing/usage/device${query}`);
    },
  };
}

export function createAuvikClient(credentials: AuvikCredentials): AuvikClient {
  // TODO: Replace with actual @wyre-technology/node-auvik client when ready
  return new MockAuvikClient(credentials);
}
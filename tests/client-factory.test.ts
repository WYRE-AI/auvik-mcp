import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createAuvikClient } from '../src/client-factory.js';

// These tests pin the Auvik API request paths the client builds. They mock
// `fetch` so no live API is needed, and guard against the class of bug where
// inventory/alert/stat paths drifted from the real Auvik API (e.g. the list
// endpoints must be `/inventory/<resource>/info`, not `/inventory/<resource>`).
describe('MockAuvikClient request paths', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const BASE = 'https://auvikapi.us1.my.auvik.com/v1';
  const client = createAuvikClient({ username: 'u@example.com', apiKey: 'k', region: 'us1' });

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const calledUrl = () => fetchMock.mock.calls[0][0] as string;

  it('tenants.list -> /tenants', async () => {
    await client.tenants.list();
    expect(calledUrl()).toBe(`${BASE}/tenants`);
  });

  it('tenants.getDetail -> /tenants/detail (not /tenants/{id}/detail)', async () => {
    await client.tenants.getDetail('123');
    expect(calledUrl()).toBe(`${BASE}/tenants/detail?tenants=123`);
  });

  it('devices.list -> /inventory/device/info', async () => {
    await client.devices.list();
    expect(calledUrl()).toBe(`${BASE}/inventory/device/info`);
  });

  it('devices.getDetails -> /inventory/device/details/{id}', async () => {
    await client.devices.getDetails('d1');
    expect(calledUrl()).toBe(`${BASE}/inventory/device/details/d1`);
  });

  it('networks.list -> /inventory/network/info', async () => {
    await client.networks.list();
    expect(calledUrl()).toBe(`${BASE}/inventory/network/info`);
  });

  it('interfaces.list -> /inventory/interface/info', async () => {
    await client.interfaces.list();
    expect(calledUrl()).toBe(`${BASE}/inventory/interface/info`);
  });

  it('configurations.get -> /inventory/configuration/{id}', async () => {
    await client.configurations.get('c1');
    expect(calledUrl()).toBe(`${BASE}/inventory/configuration/c1`);
  });

  it('alerts.list -> /alert/history', async () => {
    await client.alerts.list();
    expect(calledUrl()).toBe(`${BASE}/alert/history`);
  });

  it('alerts.get -> /alert/history/{id}', async () => {
    await client.alerts.get('a1');
    expect(calledUrl()).toBe(`${BASE}/alert/history/a1`);
  });

  it('alerts.dismiss -> POST /alert/history/{id}/dismiss', async () => {
    await client.alerts.dismiss('a1');
    expect(calledUrl()).toBe(`${BASE}/alert/history/a1/dismiss`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('statistics.snmpPoller -> /stat/snmpPoller', async () => {
    await client.statistics.snmpPoller();
    expect(calledUrl()).toBe(`${BASE}/stat/snmpPoller`);
  });
});

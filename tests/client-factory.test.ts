import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createAuvikClient } from '../src/client-factory.js';

// Integration test of the adapter + real @wyre-technology/node-auvik SDK: we
// stub global fetch and assert (a) each tool-facing method drives the SDK to the
// correct Auvik API path, and (b) single-get results are wrapped in `{ data }`
// while list results keep their `{ data: [...] }` Page shape. region is set to
// us1 so the SDK skips region auto-resolution. No live API is contacted.
describe('createAuvikClient (real SDK adapter)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const BASE = 'https://auvikapi.us1.my.auvik.com/v1';

  beforeEach(() => {
    // JSON:API-shaped response: list endpoints get an array, gets get one object.
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        data: [{ id: 'x1', type: 'thing', attributes: { name: 'n' } }],
        links: {},
        meta: {},
      }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const client = () => createAuvikClient({ username: 'u@example.com', apiKey: 'k', region: 'us1' });
  const urlOf = (callIndex = 0) => String(fetchMock.mock.calls[callIndex][0]);

  it('devices.list -> /inventory/device/info', async () => {
    await client().devices.list();
    expect(urlOf()).toBe(`${BASE}/inventory/device/info`);
  });

  it('devices.list passes filters as query params', async () => {
    await client().devices.list({ networks: 'n1' });
    expect(urlOf()).toContain('networks=n1');
  });

  it('devices.getDetails -> /inventory/device/detail/{id} and wraps in { data }', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'd1', type: 'device', attributes: { name: 'sw' } } }),
      text: async () => '',
    });
    const res = await client().devices.getDetails('d1');
    expect(urlOf()).toBe(`${BASE}/inventory/device/detail/d1`);
    expect(res.data).toBeTruthy();
    expect(res.data.id).toBe('d1');
  });

  it('networks.list -> /inventory/network/info', async () => {
    await client().networks.list();
    expect(urlOf()).toBe(`${BASE}/inventory/network/info`);
  });

  it('interfaces.list -> /inventory/interface/info', async () => {
    await client().interfaces.list();
    expect(urlOf()).toBe(`${BASE}/inventory/interface/info`);
  });

  it('configurations.get -> /inventory/configuration/{id} wrapped in { data }', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: { id: 'c1', type: 'configuration', attributes: {} } }),
      text: async () => '',
    });
    const res = await client().configurations.get('c1');
    expect(urlOf()).toBe(`${BASE}/inventory/configuration/c1`);
    expect(res.data.id).toBe('c1');
  });

  it('alerts.list -> /alert/history/info', async () => {
    await client().alerts.list();
    expect(urlOf()).toBe(`${BASE}/alert/history/info`);
  });

  it('alerts.dismiss -> POST /alert/dismiss/{id}', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 204,
      headers: { get: () => null },
      json: async () => ({}),
      text: async () => '',
    });
    const res = await client().alerts.dismiss('a1');
    expect(urlOf()).toBe(`${BASE}/alert/dismiss/a1`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(res).toEqual({ dismissed: true });
  });

  it('statistics.device -> /stat/device/{statId} with filter[fromTime]/filter[interval]/filter[deviceId]', async () => {
    await client().statistics.device({ statId: 'cpuUtilization', fromTime: 'T1', interval: 'hour', thruTime: 'T2', filter_devices: 'd1' });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/stat/device/cpuUtilization`)).toBe(true);
    expect(u).toContain('filter%5BfromTime%5D=T1');
    expect(u).toContain('filter%5Binterval%5D=hour');
    expect(u).toContain('filter%5BdeviceId%5D=d1');
  });

  it('statistics.snmpPoller -> /stat/oid/{statId}', async () => {
    await client().statistics.snmpPoller({ statId: 'abc', filter_pollers: 'p1' });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/stat/oid/abc`)).toBe(true);
    expect(u).toContain('filter%5Boid%5D=p1');
  });

  it('billing.clientUsage -> /billing/usage/client', async () => {
    await client().billing.clientUsage({ fromDate: '2026-01-01', thruDate: '2026-01-31' });
    expect(urlOf().startsWith(`${BASE}/billing/usage/client`)).toBe(true);
  });

  it('tenants.list -> /tenants', async () => {
    await client().tenants.list();
    expect(urlOf()).toBe(`${BASE}/tenants`);
  });
});

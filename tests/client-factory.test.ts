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

  // Builds a stubbed fetch Response. Defaults to a 200 JSON:API reply; pass
  // { status, contentType } to vary (e.g. a 204 dismiss with no content type).
  const jsonResponse = (
    body: unknown,
    opts: { status?: number; contentType?: string | null } = {},
  ) => {
    const { status = 200, contentType = 'application/json' } = opts;
    return {
      ok: status < 400,
      status,
      headers: { get: () => contentType },
      json: async () => body,
      text: async () => '',
    };
  };

  beforeEach(() => {
    // JSON:API-shaped response: list endpoints get an array, gets get one object.
    fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ id: 'x1', type: 'thing', attributes: { name: 'n' } }], links: {}, meta: {} }),
    );
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
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { id: 'd1', type: 'device', attributes: { name: 'sw' } } }),
    );
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
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { id: 'c1', type: 'configuration', attributes: {} } }),
    );
    const res = await client().configurations.get('c1');
    expect(urlOf()).toBe(`${BASE}/inventory/configuration/c1`);
    expect(res.data.id).toBe('c1');
  });

  it('alerts.list -> /alert/history/info', async () => {
    await client().alerts.list();
    expect(urlOf()).toBe(`${BASE}/alert/history/info`);
  });

  it('alerts.list maps detected-time/status/severity/sort to Auvik params and lifts pagination', async () => {
    await client().alerts.list({
      filter_detectedTimeAfter: '2026-06-01T00:00:00Z',
      filter_detectedTimeBefore: '2026-06-17T00:00:00Z',
      filter_status: 'created',
      filter_severity: 'critical',
      sort: '-detectedTime',
      tenants: 't1',
      pageSize: 100,
      pageAfter: 'CURSOR123',
    });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/alert/history/info`)).toBe(true);
    expect(u).toContain('filter%5BdetectedTimeAfter%5D=2026-06-01T00%3A00%3A00Z');
    expect(u).toContain('filter%5BdetectedTimeBefore%5D=2026-06-17T00%3A00%3A00Z');
    expect(u).toContain('filter%5Bstatus%5D=created');
    expect(u).toContain('filter%5Bseverity%5D=critical');
    expect(u).toContain('sort=-detectedTime');
    expect(u).toContain('tenants=t1');
    expect(u).toContain('page%5Bfirst%5D=100');
    expect(u).toContain('page%5Bafter%5D=CURSOR123');
  });

  it('alerts.list never sends a raw "page" number param', async () => {
    await client().alerts.list({ pageSize: 50 });
    const u = urlOf();
    expect(u).not.toMatch(/[?&]page=/);
  });

  it('alerts.list drops a non-numeric pageSize instead of sending NaN', async () => {
    await client().alerts.list({ pageSize: 'abc' as unknown as number, filter_status: 'created' });
    const u = urlOf();
    expect(u).not.toContain('page%5Bfirst%5D');
    expect(u).not.toContain('NaN');
    expect(u).toContain('filter%5Bstatus%5D=created'); // other params still flow
  });

  it('alerts.list surfaces nextPageAfter extracted from links.next', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'a1', type: 'alertHistory', attributes: { status: 'created' } }],
        links: { next: 'https://auvikapi.us1.my.auvik.com/v1/alert/history/info?page%5Bafter%5D=NEXTCUR' },
        meta: {},
      }),
    );
    const res = await client().alerts.list();
    expect(res.nextPageAfter).toBe('NEXTCUR');
  });

  it('alerts.list omits nextPageAfter when there is no next link', async () => {
    const res = await client().alerts.list();
    expect(res.nextPageAfter).toBeUndefined();
  });

  it('alerts.dismiss -> POST /alert/dismiss/{id}', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 204, contentType: null }));
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

  it('statistics.snmpPoller -> /stat/oid/{statId} (no time window)', async () => {
    await client().statistics.snmpPoller({ statId: 'abc', filter_pollers: 'p1' });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/stat/oid/abc`)).toBe(true);
    expect(u).toContain('filter%5Boid%5D=p1');
    // snmpPoller has no fromTime, so the adapter must not inject a thruTime.
    expect(u).not.toContain('thruTime');
  });

  it('statistics.device defaults thruTime to now when omitted (Auvik requires it)', async () => {
    await client().statistics.device({ statId: 'cpuUtilization', fromTime: 'T1', interval: 'hour', filter_devices: 'd1' });
    const u = urlOf();
    expect(u).toContain('filter%5BfromTime%5D=T1');
    // Caller omitted thruTime; the SDK defaults it to now so the param is present.
    expect(u).toContain('filter%5BthruTime%5D=');
  });

  it('billing.clientUsage -> /billing/usage/client with filter[fromDate]/filter[thruDate]', async () => {
    await client().billing.clientUsage({ fromDate: '2026-01-01', thruDate: '2026-01-31', tenants: 't1' });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/billing/usage/client`)).toBe(true);
    // Auvik billing dates are JSON:API filter[...] params, not plain keys.
    expect(u).toContain('filter%5BfromDate%5D=2026-01-01');
    expect(u).toContain('filter%5BthruDate%5D=2026-01-31');
    expect(u).toContain('tenants=t1'); // tenants stays a plain scope param
  });

  it('billing.deviceUsage -> /billing/usage/device/{id} with filter[fromDate]/filter[thruDate]', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { id: 'dev1', type: 'billingUsage', attributes: { cost: 5 } } }),
    );
    const res = await client().billing.deviceUsage({ deviceId: 'dev1', fromDate: '2026-01-01', thruDate: '2026-01-31' });
    const u = urlOf();
    expect(u.startsWith(`${BASE}/billing/usage/device/dev1`)).toBe(true); // device id in the path
    expect(u).toContain('filter%5BfromDate%5D=2026-01-01');
    expect(res.data.id).toBe('dev1'); // single resource wrapped in { data }
  });

  it('tenants.list -> /tenants', async () => {
    await client().tenants.list();
    expect(urlOf()).toBe(`${BASE}/tenants`);
  });

  it('tenants.get with a non-numeric prefix -> /tenants/detail?tenantDomainPrefix=<prefix> (plain param)', async () => {
    await client().tenants.get('wyretechnologyhq');
    const u = urlOf();
    expect(u.startsWith(`${BASE}/tenants/detail`)).toBe(true);
    // Plain query param, NOT JSON:API filter[tenantDomainPrefix] (which 400s).
    expect(u).toContain('tenantDomainPrefix=wyretechnologyhq');
    expect(u).not.toContain('filter');
  });

  it('tenants.get with a numeric id resolves to the domain prefix via the tenant list', async () => {
    // First fetch (the tenant list) returns the id->domainPrefix mapping.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: '1382977701868441341', type: 'tenant', attributes: { domainPrefix: 'wyretechnologyhq' } }],
        links: {}, meta: {},
      }),
    );
    await client().tenants.get('1382977701868441341');
    expect(urlOf(0)).toBe(`${BASE}/tenants`); // resolution step
    const detailUrl = urlOf(1);
    expect(detailUrl.startsWith(`${BASE}/tenants/detail`)).toBe(true);
    expect(detailUrl).toContain('tenantDomainPrefix=wyretechnologyhq');
  });
});

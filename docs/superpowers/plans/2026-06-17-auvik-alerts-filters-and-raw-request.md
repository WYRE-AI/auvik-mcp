# Auvik Alert Filtering/Pagination + Raw Request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `auvik_alerts_list` support a detected-time window, working status/severity filters, real cursor pagination, and a best-effort sort; and add a generic `auvik_raw_request` escape hatch.

**Architecture:** Three phases across two repos. **Phase 1** (auvik-mcp) fixes the alert list entirely in the adapter layer — no SDK change, so it ships the customer's main pain point independently. **Phase 2** (node-auvik) adds one public passthrough `request()` method and releases a minor version. **Phase 3** (auvik-mcp) bumps the dep and adds the raw tool on top of that method. Phases 2→3 are ordered (3 needs 2 published); Phase 1 is independent and can ship first.

**Tech Stack:** TypeScript (ESM), `@modelcontextprotocol/sdk`, `@wyre-technology/node-auvik`, Vitest, tsup, semantic-release.

**Spec:** `docs/superpowers/specs/2026-06-17-auvik-alerts-filters-and-raw-request-design.md`

**Branch (auvik-mcp):** `feat/auvik-alerts-filters-raw-request` (already created).

---

## File Structure

**Phase 1 + 3 — auvik-mcp:**
- `src/client-factory.ts` — Modify. Add `toAlertListOptions()` + `extractPageAfter()` (Phase 1); add `raw()` to interface + impl (Phase 3).
- `src/tools/alerts.ts` — Modify. Update `alertsListTool` schema (Phase 1).
- `src/tools/raw.ts` — Create. `rawRequestTool` + `handleRawRequest` (Phase 3).
- `src/server.ts` — Modify. Register `auvik_raw_request` (Phase 3).
- `tests/client-factory.test.ts` — Modify. Adapter assertions (Phases 1 & 3).
- `tests/alerts-tool.test.ts` — Create. Schema-shape assertions (Phase 1).
- `tests/raw-tool.test.ts` — Create. Handler method-allowlist assertions (Phase 3).
- `CHANGELOG.md`, `README.md` — Modify (Phases 1 & 3).

**Phase 2 — node-auvik (separate checkout):**
- `src/client.ts` — Modify. Add public `request()`.
- `tests/client.test.ts` — Modify. Test the passthrough.
- `CHANGELOG.md` / `README.md` — Modify.

---

## Phase 1 — auvik-mcp: fix `auvik_alerts_list` (no SDK change)

### Task 1: Adapter mapping + cursor extraction

**Files:**
- Modify: `src/client-factory.ts`
- Test: `tests/client-factory.test.ts`

- [ ] **Step 1: Write failing tests**

Add these cases inside the `describe('createAuvikClient (real SDK adapter)', …)` block in `tests/client-factory.test.ts` (after the existing `alerts.list -> /alert/history/info` test at line ~84):

```ts
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
  expect(u).toContain('tenants=t1');          // plain scope param
  expect(u).toContain('page%5Bfirst%5D=100'); // pageSize -> page[first]
  expect(u).toContain('page%5Bafter%5D=CURSOR123'); // pageAfter -> page[after]
});

it('alerts.list never sends a raw "page" number param', async () => {
  await client().alerts.list({ pageSize: 50 });
  const u = urlOf();
  expect(u).not.toMatch(/[?&]page=/); // no non-functional page-number param
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- client-factory`
Expected: FAIL — current `alerts.list` routes through `toListOptions`, so `filter[...]`/`page[first]` keys are absent and `nextPageAfter` is undefined.

- [ ] **Step 3: Implement the mapping + extraction**

In `src/client-factory.ts`, add these two helpers next to `toStatOptions` (after line ~109):

```ts
// Map alert-list tool args into the SDK's listHistory options. Auvik's
// /alert/history/info endpoint filters via JSON:API filter[...] params and
// paginates by cursor (page[first] + page[after]); `tenants` and `sort` are
// plain scope params. The previous generic toListOptions() dumped every arg in
// verbatim, so filter_status/filter_severity were silently dropped and pageSize
// never became page[first]. This keys each param the way Auvik expects.
function toAlertListOptions(params: Record<string, unknown> = {}): {
  pageSize?: number;
  pageAfter?: string;
  filters: Record<string, string>;
} {
  const filters: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') filters[key] = String(value);
  };
  put('filter[detectedTimeAfter]', params.filter_detectedTimeAfter);
  put('filter[detectedTimeBefore]', params.filter_detectedTimeBefore);
  put('filter[status]', params.filter_status);
  put('filter[severity]', params.filter_severity);
  put('tenants', params.tenants); // plain scope param, not filter[...]
  put('sort', params.sort);       // best-effort passthrough (Auvik-dependent)
  return {
    ...(params.pageSize ? { pageSize: Number(params.pageSize) } : {}),
    ...(params.pageAfter ? { pageAfter: String(params.pageAfter) } : {}),
    filters,
  };
}

// Auvik returns links.next as a full URL carrying the opaque cursor in
// page[after]. Extract it so callers can page forward by passing it back as
// `pageAfter` (no URL parsing by the model). Returns undefined when absent.
function extractPageAfter(nextUrl?: string): string | undefined {
  if (!nextUrl) return undefined;
  try {
    return new URL(nextUrl).searchParams.get('page[after]') ?? undefined;
  } catch {
    return undefined;
  }
}
```

Then replace the `alerts.list` line (currently `list: (params) => sdk.alerts.listHistory(toListOptions(params)),` at line ~178) with:

```ts
    alerts: {
      list: async (params) => {
        const page = await sdk.alerts.listHistory(toAlertListOptions(params));
        const nextPageAfter = extractPageAfter(page.links?.next);
        return nextPageAfter ? { ...page, nextPageAfter } : page;
      },
      get: (alertId) => wrap(sdk.alerts.getHistory(alertId)),
      dismiss: async (alertId) => {
        await sdk.alerts.dismiss(alertId);
        return { dismissed: true };
      },
    },
```

> Note: this places the `nextPageAfter` extraction in the adapter (the wire-format layer) rather than the handler as the spec's §4.3 sketch showed. Same surfaced result, but testable through the existing fetch-stub harness and consistent with the adapter owning wire knowledge.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- client-factory`
Expected: PASS (all new cases + existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/client-factory.ts tests/client-factory.test.ts
git commit -m "fix: auvik_alerts_list maps detected-time/status/severity filters + real cursor pagination"
```

---

### Task 2: Update the `auvik_alerts_list` tool schema

**Files:**
- Modify: `src/tools/alerts.ts:6-20`
- Test: `tests/alerts-tool.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/alerts-tool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { alertsListTool } from '../src/tools/alerts.js';

describe('alertsListTool schema', () => {
  const props = () =>
    (alertsListTool.inputSchema.properties ?? {}) as Record<string, unknown>;

  it('exposes detected-time, sort and cursor params', () => {
    const p = props();
    expect(p.filter_detectedTimeAfter).toBeDefined();
    expect(p.filter_detectedTimeBefore).toBeDefined();
    expect(p.sort).toBeDefined();
    expect(p.pageAfter).toBeDefined();
  });

  it('drops the non-functional page-number param', () => {
    expect(props().page).toBeUndefined();
  });

  it('keeps status and severity filters', () => {
    const p = props();
    expect(p.filter_status).toBeDefined();
    expect(p.filter_severity).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- alerts-tool`
Expected: FAIL — `page` is still present and `filter_detectedTimeAfter`/`pageAfter`/`sort` are missing.

- [ ] **Step 3: Update the schema**

Replace `alertsListTool` (`src/tools/alerts.ts:6-20`) with:

```ts
export const alertsListTool: Tool = {
  name: 'auvik_alerts_list',
  description:
    'List alert history from Auvik monitoring. Scope to a recent window with ' +
    'filter_detectedTimeAfter/Before. Alert history is cursor-paginated: pass ' +
    'pageSize for page size and follow nextPageAfter (returned when more pages ' +
    'exist) via pageAfter. There is no page-number jumping.',
  inputSchema: {
    type: 'object',
    properties: {
      filter_detectedTimeAfter: { type: 'string', description: 'Only alerts detected at/after this time (ISO 8601). Best way to reach recent alerts. (optional)' },
      filter_detectedTimeBefore: { type: 'string', description: 'Only alerts detected at/before this time (ISO 8601). (optional)' },
      filter_status: { type: 'string', enum: ['created', 'acknowledged', 'resolved'], description: 'Filter by alert status (optional)' },
      filter_severity: { type: 'string', enum: ['unknown', 'emergency', 'critical', 'warning', 'info'], description: 'Filter by severity (optional)' },
      sort: { type: 'string', description: 'Best-effort sort passthrough (e.g. "-detectedTime"). Honored only if the Auvik endpoint supports it. (optional)' },
      pageSize: { type: 'number', description: 'Items per page. Auvik enforces its own maximum for alert history (~100); for full coverage, follow nextPageAfter. (optional)' },
      pageAfter: { type: 'string', description: 'Opaque pagination cursor; pass the nextPageAfter value from a previous response to get the next page. (optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    additionalProperties: false,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- alerts-tool`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS (no type errors; all suites green).

- [ ] **Step 6: Commit**

```bash
git add src/tools/alerts.ts tests/alerts-tool.test.ts
git commit -m "feat: expose detected-time filters, sort and cursor paging on auvik_alerts_list; drop dead page param"
```

---

### Task 3: Docs for Phase 1

**Files:**
- Modify: `CHANGELOG.md` (under `## [Unreleased]`)
- Modify: `README.md:46-49`

- [ ] **Step 1: Update CHANGELOG**

In `CHANGELOG.md`, under the existing `## [Unreleased]` heading, add an `### Added` and `### Fixed` block (keep newest-first ordering consistent with the file):

```markdown
### Added
- **`auvik_alerts_list` now scopes by detected time, sorts, and paginates by cursor.** New optional params: `filter_detectedTimeAfter` / `filter_detectedTimeBefore` (ISO 8601 → `filter[detectedTimeAfter]` / `filter[detectedTimeBefore]`) to reach recent alerts without walking the full history; `sort` (best-effort passthrough); and `pageAfter` plus a returned `nextPageAfter` cursor for forward pagination.

### Fixed
- **`auvik_alerts_list` silently ignored `filter_status`, `filter_severity`, and `pageSize`, and exposed a non-functional `page` param.** The adapter dumped args in verbatim, so Auvik never saw `filter[status]`/`filter[severity]`/`page[first]`. The tool now maps each arg to the JSON:API param Auvik expects (`filter[...]`, `page[first]`/`page[after]`), and removes `page` — Auvik alert history is cursor-paginated, so page-number jumping was never possible.
```

- [ ] **Step 2: Update README**

Replace the Alerts section (`README.md:46-49`) with:

```markdown
### Alerts
- `auvik_alerts_list` - List alert history. Scope to recent alerts with `filter_detectedTimeAfter`/`filter_detectedTimeBefore` (ISO 8601); filter by `filter_status`/`filter_severity`; paginate by cursor with `pageSize` + `pageAfter` (follow the returned `nextPageAfter`). `sort` is a best-effort passthrough.
- `auvik_alerts_get` - Get specific alert
- `auvik_alerts_dismiss` - Dismiss/acknowledge alert
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: document alert detected-time filters, cursor paging and the status/severity fix"
```

**Phase 1 is now shippable on its own.** Open a PR for the alert fixes if shipping independently (see Phase 3 / rollout for the combined option):

```bash
git push -u origin feat/auvik-alerts-filters-raw-request
gh pr create --fill --title "fix: auvik_alerts_list detected-time filters, cursor paging + status/severity fix"
```

---

## Phase 2 — node-auvik: add a public `request()` passthrough

> Separate repo: `wyre-technology/node-auvik` (not checked out here). Do this in its own clone/branch/PR. Release a **minor** version (e.g. `1.3.0`) before Phase 3.

### Task 4: Set up the node-auvik branch

- [ ] **Step 1: Clone (if needed) and branch**

```bash
cd ~/work/wyre/engineering/projects/sdk 2>/dev/null || cd ~/work
gh repo clone wyre-technology/node-auvik 2>/dev/null || true
cd node-auvik
git checkout main && git pull
git checkout -b feat/public-raw-request
npm install
```

- [ ] **Step 2: Verify baseline green**

Run: `npm test`
Expected: PASS (existing suite).

---

### Task 5: Add the public `request()` method

**Files:**
- Modify: `src/client.ts` (the `AuvikClient` class)
- Test: `tests/client.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/client.test.ts` inside `describe('AuvikClient', …)`:

```ts
it('request() performs an arbitrary GET against the region base URL with params', async () => {
  const client = new AuvikClient({
    username: 'test@example.com',
    apiKey: 'test-key',
    region: 'us1',
    fetchImpl: mockFetch,
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ data: [], links: {}, meta: {} }),
    headers: new Headers({ 'content-type': 'application/vnd.api+json' }),
  });

  await client.request('/alert/history/info', {
    params: { 'filter[detectedTimeAfter]': '2026-06-01', 'page[first]': 50 },
  });

  const calledUrl = String(mockFetch.mock.calls[0][0]);
  expect(calledUrl.startsWith('https://auvikapi.us1.my.auvik.com/v1/alert/history/info')).toBe(true);
  expect(calledUrl).toContain('filter%5BdetectedTimeAfter%5D=2026-06-01');
  expect(calledUrl).toContain('page%5Bfirst%5D=50');
  expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'GET' });
});

it('request() forwards method and JSON body for POST', async () => {
  const client = new AuvikClient({
    username: 'test@example.com',
    apiKey: 'test-key',
    region: 'us1',
    fetchImpl: mockFetch,
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 204,
    json: async () => ({}),
    headers: new Headers(),
  });

  await client.request('/alert/dismiss/a1', { method: 'POST', body: { reason: 'noise' } });

  expect(String(mockFetch.mock.calls[0][0])).toBe('https://auvikapi.us1.my.auvik.com/v1/alert/dismiss/a1');
  const init = mockFetch.mock.calls[0][1] as { method: string; body?: string };
  expect(init.method).toBe('POST');
  expect(String(init.body)).toContain('reason');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- client`
Expected: FAIL — `client.request is not a function`.

- [ ] **Step 3: Implement the method**

In `src/client.ts`, import the request types and response type at the top alongside the existing imports:

```ts
import { HttpClient, type RequestOptions } from './http.js';
import type { JsonApiResponse } from './types/json-api.js';
```

(The file already imports `HttpClient` — extend that import to add `type RequestOptions`; add the `JsonApiResponse` import line.)

Then add this public method to the `AuvikClient` class, immediately before the existing `private async getHttpClient()`:

```ts
  /**
   * Perform a raw request against the Auvik API using this client's
   * credentials, region/base URL, retry/backoff and JSON:API error mapping.
   * Returns the parsed JSON:API response unmodified (no resource flattening).
   * Intended for callers that need an endpoint or query param the typed
   * resources don't expose yet. `path` is relative to the region base URL.
   */
  async request<T = JsonApiResponse>(path: string, options: RequestOptions = {}): Promise<T> {
    const client = await this.getHttpClient();
    return client.request<T>(path, options);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- client`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite + build**

Run: `npm run build && npm test`
(If the repo uses `npm run typecheck` instead of a build typecheck, run that too.)
Expected: PASS; `request` appears in the generated `dist/index.d.ts` on the `AuvikClient` class.

- [ ] **Step 6: Commit**

```bash
git add src/client.ts tests/client.test.ts
git commit -m "feat: add public AuvikClient.request() raw passthrough"
```

---

### Task 6: node-auvik docs + release

**Files:**
- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Update CHANGELOG + README**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added`:

```markdown
- **`AuvikClient.request(path, options)`** — public raw passthrough returning the unmodified JSON:API response, reusing the client's auth, region resolution, retry/backoff and typed error mapping. For callers that need endpoints or query params the typed resources don't expose.
```

Add a short "Raw requests" subsection to `README.md` with a GET example mirroring the test (path + `params`).

- [ ] **Step 2: Commit, push, PR**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: document AuvikClient.request raw passthrough"
git push -u origin feat/public-raw-request
gh pr create --fill --title "feat: public AuvikClient.request() raw passthrough"
```

- [ ] **Step 3: Merge and confirm the release**

After review/merge, the `feat:` commit drives semantic-release to publish the new minor (e.g. `1.3.0`). Confirm:

```bash
gh release list --repo wyre-technology/node-auvik --limit 3
npm view @wyre-technology/node-auvik version
```
Expected: new minor version published. **Do not start Phase 3 until this version is live on the registry.**

---

## Phase 3 — auvik-mcp: add `auvik_raw_request` (needs Phase 2 published)

> Continue on the auvik-mcp `feat/auvik-alerts-filters-raw-request` branch.

### Task 7: Bump the node-auvik dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the new minor**

```bash
npm install @wyre-technology/node-auvik@^1.3.0
```

- [ ] **Step 2: Verify the method is present and baseline is green**

Run: `node -e "import('@wyre-technology/node-auvik').then(m => console.log(typeof new m.AuvikClient({username:'u',apiKey:'k',region:'us1'}).request))"`
Expected: prints `function`.

Run: `npm test`
Expected: PASS (Phase 1 suites still green).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump @wyre-technology/node-auvik to ^1.3.0 for raw request support"
```

---

### Task 8: Adapter `raw()` method

**Files:**
- Modify: `src/client-factory.ts` (the `AuvikClient` interface + the returned object)
- Test: `tests/client-factory.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/client-factory.test.ts`:

```ts
it('raw -> GET arbitrary path with bracketed query params', async () => {
  await client().raw('GET', '/alert/history/info', {
    'filter[detectedTimeAfter]': '2026-06-01',
    'page[first]': 50,
  });
  const u = urlOf();
  expect(u.startsWith(`${BASE}/alert/history/info`)).toBe(true);
  expect(u).toContain('filter%5BdetectedTimeAfter%5D=2026-06-01');
  expect(u).toContain('page%5Bfirst%5D=50');
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
});

it('raw -> POST forwards method and JSON body', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 204, contentType: null }));
  await client().raw('POST', '/alert/dismiss/a1', undefined, { reason: 'noise' });
  expect(urlOf()).toBe(`${BASE}/alert/dismiss/a1`);
  const init = fetchMock.mock.calls[0][1] as { method: string; body?: string };
  expect(init.method).toBe('POST');
  expect(String(init.body)).toContain('reason');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- client-factory`
Expected: FAIL — `client().raw is not a function`.

- [ ] **Step 3: Implement `raw` on the interface and impl**

In `src/client-factory.ts`, add to the `AuvikClient` interface (after the `billing` block, before the closing brace at line ~71):

```ts
  // Raw passthrough (generic escape hatch)
  raw(method: string, path: string, query?: Record<string, unknown>, body?: unknown): Promise<any>;
```

And add to the returned object in `createAuvikClient` (after the `billing` block, before the final `};` at line ~212):

```ts
    raw: (method, path, query, body) =>
      sdk.request(path, { method, params: query, body }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- client-factory`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/client-factory.ts tests/client-factory.test.ts
git commit -m "feat: add raw passthrough to the Auvik client adapter"
```

---

### Task 9: `auvik_raw_request` tool + handler + registration

**Files:**
- Create: `src/tools/raw.ts`
- Modify: `src/server.ts`
- Test: `tests/raw-tool.test.ts` (create)

- [ ] **Step 1: Write the failing test (method allowlist)**

Create `tests/raw-tool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rawRequestTool, handleRawRequest } from '../src/tools/raw.js';

describe('auvik_raw_request', () => {
  it('schema requires path and allows only GET/POST methods', () => {
    const props = (rawRequestTool.inputSchema.properties ?? {}) as Record<string, any>;
    expect(rawRequestTool.inputSchema.required).toContain('path');
    expect(props.method.enum).toEqual(['GET', 'POST']);
  });

  it('rejects a disallowed method before doing any work', async () => {
    const res = await handleRawRequest({ method: 'DELETE', path: '/alert/history/info' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('method');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- raw-tool`
Expected: FAIL — module `../src/tools/raw.js` does not exist.

- [ ] **Step 3: Implement the tool**

Create `src/tools/raw.ts`:

```ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

// Methods the Auvik public API actually exposes: GET for reads, POST for its
// few actions (e.g. alert dismiss). Auvik has no PUT/PATCH/DELETE surface, so
// the tool allowlists GET/POST. The underlying SDK request() is unrestricted;
// the policy lives here. `path` is scoped to the Auvik base URL and the
// caller's own credentials, so there is no arbitrary-host (SSRF) surface.
const ALLOWED_METHODS = ['GET', 'POST'] as const;

export const rawRequestTool: Tool = {
  name: 'auvik_raw_request',
  description:
    'Make a raw request to any Auvik API endpoint using the configured ' +
    'credentials. Returns the unmodified JSON:API response. Use this for ' +
    'endpoints or query params the typed tools do not expose. Methods: GET ' +
    '(default) or POST. `path` is relative to the Auvik API base (e.g. ' +
    '"/alert/history/info"). `query` keys are exact Auvik param names including ' +
    'brackets (e.g. {"filter[detectedTimeAfter]":"2026-06-01","page[first]":100}).',
  inputSchema: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method (default GET)' },
      path: { type: 'string', description: 'API path relative to the Auvik base URL, e.g. "/alert/history/info"' },
      query: { type: 'object', description: 'Query parameters as exact Auvik names, e.g. {"filter[detectedTimeAfter]":"2026-06-01"} (optional)', additionalProperties: true },
      body: { type: 'object', description: 'JSON request body (POST only, optional)', additionalProperties: true },
    },
    required: ['path'],
    additionalProperties: false,
  },
};

export async function handleRawRequest(args: {
  method?: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
}): Promise<any> {
  try {
    const method = (args.method ?? 'GET').toUpperCase();
    if (!ALLOWED_METHODS.includes(method as (typeof ALLOWED_METHODS)[number])) {
      return {
        content: [{
          type: 'text' as const,
          text: `Unsupported method "${method}". The Auvik API supports: ${ALLOWED_METHODS.join(', ')}.`,
        }],
        isError: true,
      };
    }
    if (!args.path) {
      return {
        content: [{ type: 'text' as const, text: 'A "path" is required (e.g. "/alert/history/info")' }],
        isError: true,
      };
    }

    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.raw(method, args.path, args.query, args.body);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    const mcpError = toMcpError(error);
    return {
      content: [{ type: 'text' as const, text: mcpError.message }],
      isError: true,
    };
  }
}
```

- [ ] **Step 4: Register the tool in `src/server.ts`**

Add the import after the Alert tools import block (`src/server.ts:71`):

```ts
// Raw request tool
import { rawRequestTool, handleRawRequest } from './tools/raw.js';
```

Add `rawRequestTool` to the `TOOLS` array (after `billingDeviceUsageTool`, `src/server.ts:138`):

```ts
  // Raw request
  rawRequestTool,
```

Add the case to the `switch` (after the Billing cases, `src/server.ts:227`):

```ts
        // Raw request
        case 'auvik_raw_request':
          return await handleRawRequest(args);
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- raw-tool && npm run typecheck && npm test`
Expected: PASS (allowlist test passes; full suite + types green).

- [ ] **Step 6: Commit**

```bash
git add src/tools/raw.ts src/server.ts tests/raw-tool.test.ts
git commit -m "feat: add auvik_raw_request generic escape-hatch tool (GET/POST)"
```

---

### Task 10: Docs for Phase 3

**Files:**
- Modify: `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Update CHANGELOG**

Add to `CHANGELOG.md` under `## [Unreleased]` → `### Added`:

```markdown
- **`auvik_raw_request` tool** — a generic escape hatch (parity with `autotask_raw_request`) for any Auvik endpoint/param the typed tools don't expose. Takes `method` (GET/POST), `path`, optional `query` (exact Auvik param names) and `body`, and returns the raw JSON:API response. Backed by the new `AuvikClient.request()` in `@wyre-technology/node-auvik` (so it reuses auth, region, retry and error mapping).
```

- [ ] **Step 2: Update README**

Add after the Billing section (`README.md:59`):

```markdown
### Raw
- `auvik_raw_request` - Make a raw request to any Auvik endpoint (method GET/POST, `path`, optional `query`/`body`). Returns the unmodified JSON:API response. For endpoints or params the typed tools don't expose.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: document auvik_raw_request tool"
```

---

### Task 11: Release + rollout + customer reply

- [ ] **Step 1: Push and open/refresh the PR**

```bash
git push
gh pr create --fill --title "feat: alert detected-time filters + cursor paging + auvik_raw_request" \
  || gh pr view --web
```

- [ ] **Step 2: After merge, confirm the auvik-mcp release**

```bash
gh release list --repo wyre-technology/auvik-mcp --limit 3
```
Expected: semantic-release cut a new version from the `feat:`/`fix:` commits.

- [ ] **Step 3: Gateway pickup**

The customer consumes this via the WYRE MCP gateway. Confirm the gateway picks up the new auvik-mcp image through normal CI; if it must be expedited, use the `wyre-gateway-manual-deploy` skill. Verify with `mcp__msp-mcp-gateway__auvik__auvik_status` and a probe call once live.

- [ ] **Step 4: Reply to the customer** (outline in spec §10)

- Issue 1 ✅ `filter_detectedTimeAfter` / `filter_detectedTimeBefore` added — the recommended way to reach recent alerts fast.
- Issue 2 ⚠️ `sort` added as a best-effort passthrough; Auvik alert history may not honor server-side sort, so lead with the date filter for recency.
- Issue 3 ✅ `pageSize` now maps correctly; `page` removed (alert history is **cursor-only**) and replaced with proper cursor paging (`pageAfter` + returned `nextPageAfter`). Note the real per-page cap (~100).
- Bonus ✅ `filter_status` / `filter_severity` now actually filter (were silently dropped).
- Alternative ✅ `auvik_raw_request` (GET/POST) shipped for building direct skills.

---

## Self-Review (plan vs. spec)

- **Spec §3 (node-auvik request)** → Phase 2 Tasks 4–6. ✓
- **Spec §4.1 (schema: date/status/severity/sort/pageSize/pageAfter; remove page)** → Task 2. ✓
- **Spec §4.2 (`toAlertListOptions`)** → Task 1 Step 3. ✓
- **Spec §4.3 (cursor `nextPageAfter`)** → Task 1 (placed in adapter, not handler — noted). ✓
- **Spec §5 (raw tool: GET+POST allowlist, required path, no path allowlist)** → Tasks 8–9. ✓
- **Spec §7 verification items (status/severity enums, pageSize cap, sort support)** → carried as documented uncertainties in tool descriptions + customer reply (Task 11 Step 4); not silently asserted as fact. ✓
- **Spec §8 (tests assert exact params; `page` absent; nextPageAfter)** → Tasks 1, 2, 5, 8, 9. ✓
- **Spec §9 (rollout: node-auvik release → dep bump → mcp release → gateway → reply)** → Phase ordering + Task 11. ✓

**Type consistency:** `toAlertListOptions` / `extractPageAfter` / `raw(method,path,query,body)` / `handleRawRequest` / `rawRequestTool` / `ALLOWED_METHODS` used identically across tasks. SDK `request<T>(path, {method,params,body})` matches the real `RequestOptions` signature. ✓

**Placeholder scan:** every code step shows complete code; every run step shows the command + expected result. No TBD/TODO. ✓

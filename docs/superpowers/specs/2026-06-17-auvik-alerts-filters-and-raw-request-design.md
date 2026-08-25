# Design: Auvik alert-history filtering/pagination fixes + generic raw-request tool

- **Date:** 2026-06-17
- **Status:** Approved (design); pending written-spec review
- **Repos touched:** `WYRE-AI/auvik-mcp` (primary), `WYRE-AI/node-auvik` (small additive change)
- **Origin:** Customer feedback on the Auvik toolset reporting outdated/irrelevant alert data (3 issues + a suggested alternative).

## 1. Background & problem

A customer using `auvik_alerts_list` (via the WYRE MCP gateway) reported three issues:

1. **No date filter** — can't scope to a recent window; every call walks the full history oldest-first (40+ pages for an 18-month tenant).
2. **No sort control** — recent alerts are always at the tail of a large paginated set.
3. **`pageSize` capped at 100 and `page` non-functional** — only `links.next` cursor paging works.

They also suggested an alternative: an `auvik_raw_request` tool equivalent to `autotask_raw_request`, so they can build skills against any endpoint without waiting on toolset updates.

### Root-cause findings (verified against the code)

All three issues — plus two latent bugs — trace to a single function. `auvik_alerts_list` → adapter `alerts.list` → `toListOptions(params)` (in `src/client-factory.ts`), which dumps **every** arg into a `filters: Record<string,string>` map as-is. The SDK's `AlertsResource.listHistory({ pageSize, pageAfter, filters })` then spreads `filters` **raw** onto the query string — it does **not** lift pagination into `page[first]`/`page[after]`, and does **not** bracket-wrap filter names. The request serializer (`HttpClient.request`) is a plain `URLSearchParams.set(key, value)` pass-through.

Net effect of a call to `/alert/history/info` today:

| Tool param | Sent to Auvik as | Auvik's real param | Result |
|---|---|---|---|
| `page=5` | `page=5` | *(none — cursor only)* | ignored — **Issue 3** (confirmed) |
| `pageSize=1000` | `pageSize=1000` | `page[first]` | ignored → server default (100) — **Issue 3** (confirmed) |
| `filter_status` | `filter_status=…` | `filter[status]` | **silently dropped — latent bug** |
| `filter_severity` | `filter_severity=…` | `filter[severity]` | **silently dropped — latent bug** |
| *(none)* | — | `filter[detectedTimeAfter]` / `Before` | not exposed — **Issue 1** |
| *(none)* | — | `sort` (if supported) | not exposed — **Issue 2** |
| `tenants=…` | `tenants=…` | `tenants` (plain scope) | works |

Confirmed via web search that `filter[detectedTimeAfter]`, `filter[detectedTimeBefore]`, `filter[status]`, `filter[severity]`, `filter[dismissed]` are real Auvik alert params. The official swagger is JS-rendered and the support article is gated, so **exact enum tokens and `sort` support are unverified** (see §7).

The SDK's `listHistory` is fully capable of expressing all of this — the fix is in **how the adapter maps args**, mirroring the existing `toStatOptions` precedent (which already keys `filter[deviceId]` etc.). The recent CHANGELOG migration (`billing`/`statistics` → node-auvik 1.2.4) is the same class of work; alerts simply never got it.

## 2. Goals / non-goals

**Goals**
- `auvik_alerts_list` supports a detected-time window, correct status/severity filtering, real cursor pagination, and a best-effort sort passthrough.
- A generic `auvik_raw_request` tool for power users, reusing the SDK's auth/region/retry/error handling.
- Honest behavior + docs: no parameter that silently does nothing.

**Non-goals**
- Client-side sorting or client-side full-history aggregation (cursor paging is the supported "get everything" path).
- Re-implementing Auvik HTTP/auth in the MCP (the SDK owns the wire format).
- Arbitrary write/delete surface beyond what the Auvik API actually exposes.

## 3. Design — Repo 1: `node-auvik` (minimal, additive)

Add **one public passthrough method** to `AuvikClient`, delegating to the existing (private) `HttpClient`, returning the **raw** JSON:API response (un-flattened):

```ts
// AuvikClient
async request(
  path: string,
  options?: { method?: string; params?: Record<string, unknown>; body?: unknown },
): Promise<JsonApiResponse> {
  const client = await this.getHttpClient();
  return client.request(path, options);
}
```

- Accepts **any** method string — the SDK is the *capability* layer; method **policy** lives in the MCP tool (§5).
- Reuses region base-URL resolution, auth headers, `application/vnd.api+json` parsing, retry/backoff, and typed errors (401/404/429/5xx) for free.
- No change to existing methods. Ships as `feat:` → **minor** release (e.g. `1.3.0`).
- Add a unit test asserting the composed URL/method/params for a sample raw call.

## 4. Design — Repo 2: `auvik_alerts_list` fix

### 4.1 New input schema (`src/tools/alerts.ts`)

```
filter_detectedTimeAfter?  string  ISO 8601 — only alerts detected at/after this time
filter_detectedTimeBefore? string  ISO 8601 — only alerts detected at/before this time
filter_status?             string  (enum — see §7) → filter[status]
filter_severity?           string  (enum — see §7) → filter[severity]
pageSize?                  number  items per page; Auvik enforces its own max (≈100 for alert history)
pageAfter?                 string  opaque cursor — pass the value surfaced as `nextPageAfter`
sort?                      string  best-effort passthrough; documented as Auvik-dependent
tenants?                   string  comma-separated tenant IDs
```

- **Remove `page`** (never functioned). Description states alert history is cursor-paginated; use `pageAfter`.
- `pageSize` is passed through (not clamped in the MCP); the description documents Auvik's observed 100 cap and steers to cursor paging for completeness.

### 4.2 Mapping — `toAlertListOptions` (in `src/client-factory.ts`, next to `toStatOptions`)

```ts
function toAlertListOptions(params: Record<string, unknown> = {}) {
  const filters: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== '') filters[k] = String(v);
  };
  put('filter[detectedTimeAfter]',  params.filter_detectedTimeAfter);
  put('filter[detectedTimeBefore]', params.filter_detectedTimeBefore);
  put('filter[status]',             params.filter_status);
  put('filter[severity]',           params.filter_severity);
  put('tenants',                    params.tenants); // plain scope param, not filter[...]
  put('sort',                       params.sort);    // best-effort passthrough
  return {
    ...(params.pageSize  ? { pageSize: Number(params.pageSize) }   : {}), // → page[first]
    ...(params.pageAfter ? { pageAfter: String(params.pageAfter) } : {}), // → page[after]
    filters,
  };
}
```

Adapter change: `alerts.list: (params) => sdk.alerts.listHistory(toAlertListOptions(params))`.

**Rationale for adapter-side mapping:** consistent with the existing `toStatOptions`, and keeps the node-auvik change limited to the single raw method. (Alternative — push named alert options into the SDK like billing/statistics — is deferred; reversible later if we want the SDK to own this too.)

### 4.3 Cursor ergonomics (`handleAlertsList`)

Auvik returns `links.next` as a full URL with `page[after]=<cursor>` embedded. The handler extracts that cursor and surfaces a clean `nextPageAfter` alongside the response, so the agent can page forward by passing it straight back as `pageAfter` (no URL parsing by the model):

```ts
const next = response.links?.next;
const nextPageAfter = next ? new URL(next).searchParams.get('page[after]') ?? undefined : undefined;
// include { ...response, nextPageAfter } in the JSON text payload
```

## 5. Design — Repo 2: `auvik_raw_request` tool

### 5.1 Schema (`src/tools/alerts.ts` or a new `src/tools/raw.ts`)

```
method? enum ['GET','POST']  default 'GET'   — the methods the Auvik public API exposes
path    string  (required)   e.g. "/alert/history/info"  (relative to the region API base)
query?  object               exact Auvik param names incl. brackets, e.g. {"filter[detectedTimeAfter]":"…","page[first]":100}
body?   object               JSON body (POST only)
```

- **Method policy = GET + POST** — Aaron's directive "whatever the Auvik API supports." Auvik is GET for reads and POST for its few actions (e.g. `/alert/dismiss/{id}`); it exposes no PUT/PATCH/DELETE. Enum is expandable if Auvik adds methods. The SDK `request` itself stays unrestricted; the **tool** enforces the allowlist.
- **No path allowlist needed:** `path` is resolved against the Auvik region base URL using the caller's own credentials, so it can only reach Auvik endpoints those credentials already permit — no SSRF/arbitrary-host surface.
- Returns the **raw** JSON:API response (un-flattened) so callers see exactly what Auvik sent.

### 5.2 Adapter + handler

- Add `raw(method, path, query?, body?)` to the `AuvikClient` interface + impl: `(m, p, q, b) => sdk.request(p, { method: m, params: q, body: b })`.
- `handleRawRequest`: validate `method` ∈ allowlist (reject others with a clear MCP error), require `path`, default GET, pass `query`/`body` through, JSON-stringify the response. Reuse the existing credentials/error patterns.
- Register `auvik_raw_request` in `src/server.ts` (`TOOLS` array + `switch`).

## 6. Data-flow examples (post-fix)

- *Recent alerts, newest-window first:*
  `auvik_alerts_list { filter_detectedTimeAfter: "2026-06-01T00:00:00Z", pageSize: 100 }`
  → `GET /alert/history/info?filter%5BdetectedTimeAfter%5D=2026-06-01T00:00:00Z&page%5Bfirst%5D=100`
  → response includes `nextPageAfter` when more pages exist.
- *Next page:* `auvik_alerts_list { filter_detectedTimeAfter: "…", pageAfter: "<nextPageAfter>" }` → adds `page[after]=<cursor>`.
- *Raw escape hatch:*
  `auvik_raw_request { path: "/alert/history/info", query: { "filter[detectedTimeAfter]": "2026-06-01", "sort": "-detectedTime", "page[first]": 50 } }`.

## 7. Open items / verification (resolve during implementation)

1. **`filter[status]` / `filter[severity]` enum tokens.** Current schema enums (`status`: created/acknowledged/resolved; `severity`: unknown/emergency/critical/warning/info) predate this work and are **unverified**. Verify against the live API (probe with creds) or Auvik OpenAPI. If a token is wrong or the set is broader, either correct the enum or relax to a documented free-form string (the raw tool is the fallback). The *mapping* fix is correct regardless.
2. **`pageSize` real max** for `/alert/history/info` (100 vs higher). Document the verified cap; do not over-promise "up to 1000."
3. **`sort` support.** Unconfirmed that Auvik sorts alert history. Keep it as a documented best-effort passthrough; do not present it as guaranteed. The date filter (Issue 1) is the real workaround for the customer's pain.

## 8. Testing

- **auvik-mcp** (`tests/client-factory.test.ts` — the repo already asserts exact request URLs through adapter→SDK→HTTP): add cases asserting `filter[detectedTimeAfter]`, `filter[detectedTimeBefore]`, `filter[status]`, `filter[severity]`, `page[first]`, `page[after]`, `tenants`, `sort`; assert `page` is no longer emitted; assert `nextPageAfter` extraction from a mocked `links.next`. Add raw-request cases asserting method/path/query serialization and method-allowlist rejection.
- **node-auvik:** unit test for the new public `request` (URL/method/params/body composition).
- `npm run typecheck` + `npm test` green in both repos.

## 9. Rollout (gateway-aware)

The customer consumes this through the gateway, so shipping the npm package is not "done":

1. `node-auvik`: land the `request` method → `feat:` release (≈`1.3.0`).
2. `auvik-mcp`: bump `@wyre-technology/node-auvik` dep, implement §4–5, update tests, **CHANGELOG** (Keep a Changelog) + **README** (new params + raw tool), release.
3. Gateway picks up the new auvik-mcp image (`mcp.wyretechnology.com`) via the normal CI path (or `wyre-gateway-manual-deploy` if expediting).
4. Reply to the customer: confirm all three issues; lead with the date filter as the real fix; be explicit that page-number jumping isn't possible (Auvik alert history is cursor-only) and that `sort` is best-effort; mention the new `auvik_raw_request` escape hatch.

## 10. Customer-reply outline (for step 9.4)

- Issue 1 ✅ added `filter_detectedTimeAfter` / `filter_detectedTimeBefore`.
- Issue 2 ⚠️ added `sort` passthrough, but Auvik alert history may not honor server-side sort; the date filter is the recommended way to get recent data. (Will confirm.)
- Issue 3 ✅ `pageSize` now maps correctly; `page` removed (Auvik alert history is cursor-only) and replaced with proper cursor paging (`pageAfter` + returned `nextPageAfter`). Documented the real per-page cap.
- Bonus: `filter_status`/`filter_severity` now actually filter (were silently ignored).
- Alternative ✅ shipped `auvik_raw_request` (GET/POST) for direct, skill-buildable API access.

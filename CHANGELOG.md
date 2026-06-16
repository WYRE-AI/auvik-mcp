# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **`auvik_tenants_get` / `auvik_tenants_detail` returned `400 tenantDomainPrefix is required`.** Auvik's tenant-detail endpoint is keyed by `tenantDomainPrefix`, not the numeric tenant id. The adapter now resolves the numeric id to its domain prefix (via the tenant list) and queries `/tenants/detail?tenantDomainPrefix=<prefix>` (a non-numeric arg is treated as the prefix directly). Note: this is a **plain** query param, not a JSON:API `filter[tenantDomainPrefix]` param — the bracketed form still returned the 400.

### Fixed
- **Single-resource `get`/`detail`/`statistics` tools returned `-32600: resource not found` (and `tenants_detail` a `tenantDomainPrefix` 400).** Bumped `@wyre-technology/node-auvik` to `^1.2.3`, which corrects the single-tenant (`/tenants/detail/{id}`), device-detail (`/inventory/device/detail/{id}`), and statistics (`/stat/{type}/{statId}`) endpoint paths. Updated the adapter so `auvik_tenants_get`/`auvik_tenants_detail` read the tenant by id, and the statistics tools now take required `statId` + `interval` params (Auvik statistics need a metric id and reporting interval).

### Fixed
- **`auvik_alerts_list` / `_get` / `_dismiss` returned `-32600: Auvik resource not found`.** The alert endpoint paths in `@wyre-technology/node-auvik` were wrong (`/alert/history*` instead of `/alert/history/info`, `/alert/history/info/{id}`, `/alert/dismiss/{id}`). Bumped the SDK to `^1.2.2`, which corrects them. (Updated the adapter integration tests to assert the corrected alert paths.)
- **All `/inventory`, tenant, statistics, and billing tools failed with `Cannot read properties of undefined (reading 'id')`.** Root cause was in `@wyre-technology/node-auvik`: its HTTP client only parsed responses with `content-type: application/json`, but the Auvik API is JSON:API and responds with `application/vnd.api+json`, so every successful response was dropped to `{}` and the resource mappers threw. Bumped the SDK to `^1.2.1`, which matches any JSON content-type.

### Changed
- **Wired in the real `@wyre-technology/node-auvik` SDK, replacing the placeholder client.** The server shipped on a `MockAuvikClient` (hand-rolled `fetch` calls with a standing "replace when node-auvik is ready" TODO that was never closed) — the SDK was a declared dependency but never imported. `createAuvikClient()` now constructs the real SDK and adapts it to the tool-facing interface, so all tools gain the SDK's JSON:API response flattening, cursor pagination, retry/backoff, and typed error mapping (401/404/429/5xx). The single `createAuvikClient` factory was the only call site, so no tool handlers changed. Added an integration test driving the adapter→SDK→HTTP path and asserting every request URL.

### Added
- `us5` Auvik API region option (`auvikapi.us5.my.auvik.com`) for accounts on the US5 cluster. Set `AUVIK_REGION=us5` (env) or send the `x-auvik-region: us5` header in gateway mode.
- Documented `us6` and `lnx` as supported Auvik API regions (`auvikapi.us6.my.auvik.com` / `auvikapi.lnx.my.auvik.com`), both mapping to US East (Ohio). Set `AUVIK_REGION=us6`/`lnx` (env) or send the `x-auvik-region: us6`/`lnx` header in gateway mode.

### Fixed
- **`/inventory/*` and several other tools returned `-32600: Auvik resource not found`.** The placeholder API client used incorrect Auvik API paths for list/detail endpoints — most visibly the list calls hit `/inventory/device` (etc.) instead of `/inventory/device/info`, so every `/inventory/` tool 404'd while `auvik_tenants_list` worked (its `/tenants` path was correct). Corrected all paths to match the real Auvik API and the `@wyre-technology/node-auvik` SDK: device/network/interface list → `…/info`; device details → `/inventory/device/details/{id}`; configuration get → `/inventory/configuration/{id}`; alerts → `/alert/history`, `/alert/history/{id}`, `POST /alert/history/{id}/dismiss`; SNMP poller stats → `/stat/snmpPoller`; tenant detail → `/tenants/detail`. Added a unit test pinning every request path.

### Fixed
- **Gateway mode now actually returns tools.** The HTTP transport served the MCP endpoint at `/messages` on top of Fastify, which broke gateway integration two ways: (1) the gateway proxies to `/mcp` (its default `mcpPath`), so every request 404'd; (2) Fastify pre-parsed and drained the request body before the MCP SDK could read it, so calls that did reach the handler failed with JSON-RPC `-32700` parse errors. Rewrote the transport on the canonical `node:http` pattern used across the WYRE MCP fleet — serving `/mcp` and calling `handleRequest(req, res)` so the SDK reads the raw body itself. `tools/list` now returns all 26 tools (verified without credentials, since tool listing requires none).
- **`mcp-assert` CI (and any stdio client) now works.** A bare `node dist/index.js` defaulted to HTTP transport, so stdio clients — local MCP clients and the `mcp-eval-baseline` CI harness, which spawns the entry and drives it over stdio — received no response and timed out (`MCP initialize failed: transport error: context deadline exceeded`). Flipped the default to stdio (matching the fleet convention and the README's `npm start` usage); HTTP stays opt-in via `MCP_TRANSPORT=http` (set by the Dockerfile and the `gwp-auvik` container app) or the `--http` flag, so the deployed container is unaffected.

### Removed
- Unused `fastify` dependency (the HTTP transport no longer uses it).

## [0.1.0] - 2024-05-21

### Added
- Initial release of Auvik MCP server
- Support for HTTP and stdio transports
- Multi-tenant support with AsyncLocalStorage-based credential injection
- 25+ tools covering all major Auvik API endpoints:
  - Status and navigation tools
  - Tenant management (list, get, detail)
  - Device management (list, get, details, warranty, lifecycle)
  - Network discovery (list, get)
  - Interface management (list)
  - Configuration management (list, get)
  - Entity management (notes, audits)
  - Alert management (list, get, dismiss)
  - Statistics (device, interface, service, SNMP poller)
  - Billing (client usage, device usage)
- Comprehensive error handling with proper MCP error mapping
- Empty-result handling to prevent LLM hallucination
- Docker containerization with multi-stage build
- Health check endpoint for container orchestration
- Type-safe implementation with Zod validation
- OSS hygiene files (README, LICENSE, CONTRIBUTING, etc.)
- GitHub Actions workflows for CI/CD
- Semantic release automation

### Security
- Credentials handled securely via environment variables or request headers
- No credential leakage in health check endpoint
- Proper input validation and sanitization
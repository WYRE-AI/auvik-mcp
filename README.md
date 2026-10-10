# Auvik MCP Server

MCP server for the Auvik network monitoring API. This server provides tools to interact with Auvik's network monitoring platform, allowing you to manage devices, networks, alerts, and more.

## Features

- **Multi-tenant support** - Works in both single-tenant and gateway modes
- **Comprehensive API coverage** - 25+ tools covering all major Auvik API endpoints
- **Transport flexibility** - Supports both HTTP and stdio transports
- **Type-safe** - Built with TypeScript and Zod validation
- **Docker ready** - Available as a containerized solution

## Tools Available

### Status and Navigation
- `auvik_status` - Check server status and configuration
- `auvik_navigate` - Get navigation links to Auvik UI and documentation

### Tenants
- `auvik_tenants_list` - List all accessible tenants
- `auvik_tenants_get` - Get basic tenant information
- `auvik_tenants_detail` - Get detailed tenant information

### Devices
- `auvik_devices_list` - List network devices
- `auvik_devices_get` - Get basic device information
- `auvik_devices_get_details` - Get detailed device information
- `auvik_devices_get_warranty` - Get device warranty information
- `auvik_devices_get_lifecycle` - Get device lifecycle information

### Networks
- `auvik_networks_list` - List discovered networks
- `auvik_networks_get` - Get network information

### Interfaces
- `auvik_interfaces_list` - List network interfaces

### Configurations
- `auvik_configurations_list` - List device configurations
- `auvik_configurations_get` - Get specific configuration

### Entities
- `auvik_entities_list_notes` - List entity notes
- `auvik_entities_list_audits` - List entity audit logs

### Alerts
- `auvik_alerts_list` - List alert history. Scope to recent alerts with `filter_detectedTimeAfter`/`filter_detectedTimeBefore` (ISO 8601); filter by `filter_status`/`filter_severity`; paginate by cursor with `pageSize` + `pageAfter` (follow the returned `nextPageAfter`). `sort` is a best-effort passthrough.
- `auvik_alerts_get` - Get specific alert
- `auvik_alerts_dismiss` - Dismiss/acknowledge alert

### Statistics
- `auvik_statistics_device` - Get device performance metrics
- `auvik_statistics_interface` - Get interface performance metrics
- `auvik_statistics_service` - Get service performance metrics
- `auvik_statistics_snmp_poller` - Get SNMP poller metrics

### Billing
- `auvik_billing_client_usage` - Get client billing usage
- `auvik_billing_device_usage` - Get device billing usage

### Raw
- `auvik_raw_request` - Make a raw request to any Auvik endpoint (`method` GET/POST, `path`, optional `query`/`body`). Returns the unmodified JSON:API response. For endpoints or params the typed tools don't expose.

## Installation

### Environment Variables

#### Single-tenant mode (stdio/direct):
```bash
AUVIK_USERNAME=your_auvik_username
AUVIK_API_KEY=your_auvik_api_key
AUVIK_REGION=us1  # Optional: us1, us2, us3, us4, us5, us6, lnx, eu1, eu2, au1, ca1
```

The stdio transport reads those variables and is not affected by HTTP service-to-service auth.

#### HTTP transport:
`CONDUIT_S2S_SECRET` is required. If it is empty, the HTTP server logs an error and exits non-zero. It never prints the secret. Set `MCP_ALLOW_INSECURE_DEV=1` only for local development to start without the secret; the process logs a loud warning, does not check `X-Gateway-S2S`, and binds `127.0.0.1` only. A non-loopback `MCP_HTTP_HOST` (including `0.0.0.0`) is ignored in that mode and the override is logged.

`MCP_HTTP_HOST` defaults to `127.0.0.1` when unset. Set `0.0.0.0` only when `CONDUIT_S2S_SECRET` is set. The container image does that and sets `AUTH_MODE=gateway`.

#### Gateway mode (`AUTH_MODE=gateway`):
Every `/mcp` request must include:
- `x-auvik-username`
- `x-auvik-api-key`
- `x-auvik-region` (optional)

A request missing the username or API key gets `401` and does not fall back to `AUVIK_USERNAME` / `AUVIK_API_KEY` in the process environment. When `CONDUIT_S2S_SECRET` is set, the request must also include a valid `X-Gateway-S2S` header.

#### Single-tenant HTTP (`AUTH_MODE=env`):
`/mcp` still requires a valid `X-Gateway-S2S` header. Vendor credentials come from the `AUVIK_*` environment variables when the request does not carry `x-auvik-username` and `x-auvik-api-key`.

### Docker

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/wyre-ai/auvik-mcp:latest

# Run with the gateway S2S secret. The image sets AUTH_MODE=gateway and
# MCP_HTTP_HOST=0.0.0.0; publish the port on loopback unless a proxy sits in front.
docker run -d \
  -p 127.0.0.1:8080:8080 \
  -e CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" \
  ghcr.io/wyre-ai/auvik-mcp:latest
```

### Docker Compose

The checked-in Compose service is gateway mode. It does not set `AUVIK_USERNAME` or `AUVIK_API_KEY` and does not use `env_file`, so a project `.env` cannot inject static vendor credentials into the container. Compose still interpolates `CONDUIT_S2S_SECRET` and `AUVIK_REGION` from that file.

```yaml
version: '3.8'
services:
  auvik-mcp:
    image: ghcr.io/wyre-ai/auvik-mcp:latest
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - AUTH_MODE=gateway
      - AUVIK_REGION=${AUVIK_REGION:-us1}
      - CONDUIT_S2S_SECRET=${CONDUIT_S2S_SECRET:?set CONDUIT_S2S_SECRET}
      - MCP_HTTP_HOST=0.0.0.0
```

#### Single-tenant HTTP (`AUTH_MODE=env`) in Docker

Use this only for one tenant whose credentials live in the process environment. It is separate from the gateway Compose service above.

```yaml
services:
  auvik-mcp:
    image: ghcr.io/wyre-ai/auvik-mcp:latest
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      - AUTH_MODE=env
      - AUVIK_USERNAME=${AUVIK_USERNAME:?set AUVIK_USERNAME}
      - AUVIK_API_KEY=${AUVIK_API_KEY:?set AUVIK_API_KEY}
      - AUVIK_REGION=${AUVIK_REGION:-us1}
      - CONDUIT_S2S_SECRET=${CONDUIT_S2S_SECRET:?set CONDUIT_S2S_SECRET}
      - MCP_HTTP_HOST=0.0.0.0
```

### Local Development

```bash
git clone https://github.com/WYRE-AI/auvik-mcp.git
cd auvik-mcp
npm install
npm run build

# Run with stdio transport
npm start

# Run with HTTP transport (refuses to start until CONDUIT_S2S_SECRET is set)
CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" npm run start:http

# Local HTTP only, without a service-to-service secret (always binds 127.0.0.1)
MCP_ALLOW_INSECURE_DEV=1 npm run start:http
```

## Usage

### With MCP Gateway

The server is designed to work with WYRE's MCP Gateway. The gateway handles authentication and routing:

```typescript
// Gateway automatically injects credentials and the X-Gateway-S2S proof
const response = await fetch('http://gateway:8080/mcp', {
  method: 'POST',
  headers: {
    'x-gateway-s2s': '<proof signed with CONDUIT_S2S_SECRET>',
    'x-auvik-username': 'your_username',
    'x-auvik-api-key': 'your_api_key',
    'x-auvik-region': 'us1',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'auvik_devices_list',
      arguments: {}
    }
  })
});
```

### Direct Usage (stdio)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"auvik_status","arguments":{}}}' | npm start
```

## API Regions

Auvik operates in multiple regions. Set the appropriate region:

- `us1` - US East (default)
- `us2` - US West
- `us3` - US Central
- `us4` - US South
- `us5` - United States (newer cluster)
- `us6` - US East (Ohio)
- `lnx` - US East (Ohio)
- `eu1` - Europe West
- `eu2` - Europe Central
- `au1` - Australia
- `ca1` - Canada

## Error Handling

The server implements comprehensive error handling:

- Invalid credentials return 401 errors
- Missing resources return descriptive "not found" messages with `isError: true`
- API rate limits and service errors are properly mapped
- All responses include structured error information

## Health Check

The server exposes a health endpoint at `/health` that always returns 200 OK. This endpoint does not require authentication, does not read vendor credentials, and is suitable for container health checks.

## Development

```bash
# Install dependencies
npm install

# Run in development mode with file watching
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Support

- [GitHub Issues](https://github.com/WYRE-AI/auvik-mcp/issues)
- [Auvik API Documentation](https://api.auvik.com/documentation)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
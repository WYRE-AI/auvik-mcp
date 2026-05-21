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
- `auvik_alerts_list` - List monitoring alerts
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

## Installation

### Environment Variables

#### Single-tenant mode (stdio/direct):
```bash
AUVIK_USERNAME=your_auvik_username
AUVIK_API_KEY=your_auvik_api_key
AUVIK_REGION=us1  # Optional: us1, us2, us3, us4, eu1, eu2, au1, ca1
```

#### Gateway mode (HTTP):
Credentials are provided via request headers:
- `x-auvik-username`
- `x-auvik-api-key`
- `x-auvik-region` (optional)

### Docker

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/wyre-technology/auvik-mcp:latest

# Run with environment variables
docker run -d \
  -p 8080:8080 \
  -e AUVIK_USERNAME=your_username \
  -e AUVIK_API_KEY=your_api_key \
  -e AUVIK_REGION=us1 \
  ghcr.io/wyre-technology/auvik-mcp:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  auvik-mcp:
    image: ghcr.io/wyre-technology/auvik-mcp:latest
    ports:
      - "8080:8080"
    environment:
      - AUVIK_USERNAME=your_username
      - AUVIK_API_KEY=your_api_key
      - AUVIK_REGION=us1
```

### Local Development

```bash
git clone https://github.com/wyre-technology/auvik-mcp.git
cd auvik-mcp
npm install
npm run build

# Run with stdio transport
npm start

# Run with HTTP transport
npm run start:http
```

## Usage

### With MCP Gateway

The server is designed to work with WYRE's MCP Gateway. The gateway handles authentication and routing:

```typescript
// Gateway automatically injects credentials via headers
const response = await fetch('http://gateway:8080/mcp', {
  method: 'POST',
  headers: {
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

The server exposes a health endpoint at `/health` that always returns 200 OK. This endpoint does not require authentication and is suitable for container health checks.

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

- [GitHub Issues](https://github.com/wyre-technology/auvik-mcp/issues)
- [Auvik API Documentation](https://api.auvik.com/documentation)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
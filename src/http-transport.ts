import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { credentialsStorage, type AuvikCredentials } from './credentials.js';
import { verifyS2sHeader, S2S_HEADER } from './s2s-verify.js';

const port = parseInt(process.env.MCP_HTTP_PORT || '8080', 10);
const host = process.env.MCP_HTTP_HOST || '0.0.0.0';
const S2S_SECRET = process.env.CONDUIT_S2S_SECRET || '';

// Uses the raw node:http server (not Fastify) to match the WYRE MCP fleet
// convention. The StreamableHTTPServerTransport reads the request body off the
// raw stream itself; a framework that pre-parses the body (e.g. Fastify) drains
// that stream and the SDK then fails every call with -32700 "Parse error".
export async function startHttpTransport(): Promise<void> {
  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // /health is container LIVENESS, not credential-readiness. In gateway mode
    // credentials arrive per-request via x-auvik-* headers, not at startup, so
    // gating this on credentials would always 503 and the WYRE vendor-monitor
    // would permanently false-red Auvik. Always 200, no auth required.
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // The MCP endpoint MUST be /mcp: the gateway proxies vendor traffic to
    // `${containerUrl}${mcpPath ?? '/mcp'}` and Auvik sets no mcpPath, so it
    // relies on this default. Any other path 404s the gateway and the vendor
    // shows zero tools.
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/mcp', '/health'] }));
      return;
    }

    if (S2S_SECRET && !verifyS2sHeader(req.headers[S2S_HEADER] as string | undefined, S2S_SECRET)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid X-Gateway-S2S header: this endpoint only accepts requests signed by the gateway.' }));
      return;
    }

    // Each request gets a fresh server + transport (stateless: no session id).
    const handle = async () => {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on('close', () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    };

    // Gateway mode: per-request credentials via headers, scoped through
    // AsyncLocalStorage so concurrent requests never cross credentials.
    // Don't reject when absent — tools/list works without credentials.
    const username = req.headers['x-auvik-username'] as string | undefined;
    const apiKey = req.headers['x-auvik-api-key'] as string | undefined;
    const region = req.headers['x-auvik-region'] as string | undefined;

    if (username && apiKey) {
      const credentials: AuvikCredentials = { username, apiKey, region };
      await credentialsStorage.run(credentials, handle);
    } else {
      await handle();
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      console.log(`Auvik MCP HTTP server listening on ${host}:${port}`);
      resolve();
    });
  });
}

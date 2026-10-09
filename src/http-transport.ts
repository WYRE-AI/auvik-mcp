import { createServer as createHttpServer, type Server } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { credentialsStorage, type AuvikCredentials } from './credentials.js';
import { verifyS2sHeader, S2S_HEADER } from './s2s-verify.js';

const MISSING_S2S_SECRET_ERROR =
  'ERROR: Refusing to start the HTTP server because CONDUIT_S2S_SECRET is empty. ' +
  'An empty secret would accept unauthenticated /mcp requests (CWE-306). ' +
  'Set CONDUIT_S2S_SECRET to the gateway-provisioned service-to-service secret, ' +
  'or set MCP_ALLOW_INSECURE_DEV=1 to bypass this check for local development only.';

const INSECURE_DEV_WARNING =
  'WARNING: MCP_ALLOW_INSECURE_DEV=1 is set and CONDUIT_S2S_SECRET is empty. ' +
  'The HTTP server is starting WITHOUT service-to-service authentication. ' +
  'Anyone who can reach this port can call /mcp. ' +
  'Do not use MCP_ALLOW_INSECURE_DEV outside local development.';

const S2S_UNAUTHORIZED = {
  error: 'Missing or invalid X-Gateway-S2S header: this endpoint only accepts requests signed by the gateway.',
};

const GATEWAY_CREDENTIALS_UNAUTHORIZED = {
  jsonrpc: '2.0',
  error: {
    code: -32001,
    message: 'Unauthorized: missing required gateway credential headers x-auvik-username and x-auvik-api-key',
  },
  id: null,
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Fail closed: an empty CONDUIT_S2S_SECRET used to skip X-Gateway-S2S checks.
 * Refuse to listen unless the operator explicitly opts into insecure local dev.
 * Never include the secret value in the log.
 */
function resolveS2sSecret(): string {
  const secret = process.env.CONDUIT_S2S_SECRET || '';
  if (secret) return secret;
  if (process.env.MCP_ALLOW_INSECURE_DEV === '1') {
    console.error('================================================================');
    console.error(INSECURE_DEV_WARNING);
    console.error('================================================================');
    return '';
  }
  console.error(MISSING_S2S_SECRET_ERROR);
  process.exit(1);
}

// Uses the raw node:http server (not Fastify) to match the WYRE MCP fleet
// convention. The StreamableHTTPServerTransport reads the request body off the
// raw stream itself; a framework that pre-parses the body (e.g. Fastify) drains
// that stream and the SDK then fails every call with -32700 "Parse error".
export async function startHttpTransport(): Promise<Server> {
  const s2sSecret = resolveS2sSecret();
  const port = parseInt(process.env.MCP_HTTP_PORT || '8080', 10);
  // Loopback unless the operator opts into a wider bind. The container image
  // sets MCP_HTTP_HOST=0.0.0.0 and is protected by the S2S secret check above.
  const host = process.env.MCP_HTTP_HOST || '127.0.0.1';

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // /health is container LIVENESS, not credential-readiness. In gateway mode
    // credentials arrive per-request via x-auvik-* headers, not at startup, so
    // gating this on credentials would always 503 and the WYRE vendor-monitor
    // would permanently false-red Auvik. Always 200, no auth required, and this
    // handler must not read vendor credentials.
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

    // Empty s2sSecret is only reachable when MCP_ALLOW_INSECURE_DEV=1; startup
    // refuses otherwise. A configured secret is always enforced.
    if (s2sSecret && !verifyS2sHeader(headerValue(req.headers[S2S_HEADER]), s2sSecret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(S2S_UNAUTHORIZED));
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

    const username = headerValue(req.headers['x-auvik-username']);
    const apiKey = headerValue(req.headers['x-auvik-api-key']);
    const region = headerValue(req.headers['x-auvik-region']);

    // Gateway mode: credentials must arrive on every request via the
    // x-auvik-username and x-auvik-api-key headers. Reject explicitly if
    // missing rather than falling through — falling through would resolve
    // credentials from the process environment, which is not request-scoped.
    if (process.env.AUTH_MODE === 'gateway') {
      if (!username || !apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(GATEWAY_CREDENTIALS_UNAUTHORIZED));
        return;
      }

      const credentials: AuvikCredentials = { username, apiKey, region };
      await credentialsStorage.run(credentials, handle);
      return;
    }

    // Env / single-tenant mode: per-request headers when both are present,
    // otherwise tools resolve AUVIK_* from the process environment.
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

  return httpServer;
}

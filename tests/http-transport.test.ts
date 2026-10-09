import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { credentialsStorage } from '../src/credentials.js';
import { startHttpTransport } from '../src/http-transport.js';

const CANARY_API_KEY = 'canary-api-key-do-not-log';
const ENV_USERNAME = 'env-user-should-not-be-used';
const ENV_API_KEY = 'env-key-should-not-be-used';
const S2S_SECRET = 'test-s2s-secret-do-not-log';

function mintHeader(secret: string, unixSeconds = Math.floor(Date.now() / 1000)): string {
  const message = `t=${unixSeconds}`;
  const hex = createHmac('sha256', secret).update(message).digest('hex');
  return `${message},v1=${hex}`;
}

const originalEnv = { ...process.env };
const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

function silenceLogs(): { errors: string[] } {
  const errors: string[] = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });
  return { errors };
}

function assertNoSecrets(logged: string, extra: string[] = []): void {
  expect(logged).not.toContain(CANARY_API_KEY);
  expect(logged).not.toContain(ENV_API_KEY);
  expect(logged).not.toContain(S2S_SECRET);
  for (const value of extra) {
    expect(logged).not.toContain(value);
  }
}

async function listenPort(server: Server): Promise<number> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('expected the HTTP server to bind a TCP port');
  }
  return address.port;
}

function mcpHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...extra,
  };
}

const statusCall = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'auvik_status', arguments: {} },
};

describe('HTTP transport fail-closed auth', () => {
  it('refuses to start when CONDUIT_S2S_SECRET is unset', async () => {
    delete process.env.CONDUIT_S2S_SECRET;
    delete process.env.MCP_ALLOW_INSECURE_DEV;
    process.env.AUVIK_API_KEY = CANARY_API_KEY;
    const { errors } = silenceLogs();
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    });

    await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
    const logged = errors.join('\n');
    expect(logged).toContain('CONDUIT_S2S_SECRET is empty');
    expect(logged).toContain('Refusing to start');
    assertNoSecrets(logged);
  });

  it('refuses to start when CONDUIT_S2S_SECRET is empty', async () => {
    process.env.CONDUIT_S2S_SECRET = '';
    process.env.MCP_ALLOW_INSECURE_DEV = 'true';
    process.env.AUVIK_API_KEY = CANARY_API_KEY;
    const { errors } = silenceLogs();
    vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    });

    await expect(startHttpTransport()).rejects.toThrow('process.exit:1');
    expect(errors.join('\n')).toContain('Refusing to start');
  });

  it('starts with a loud warning when MCP_ALLOW_INSECURE_DEV=1', async () => {
    delete process.env.CONDUIT_S2S_SECRET;
    delete process.env.MCP_HTTP_HOST;
    process.env.MCP_ALLOW_INSECURE_DEV = '1';
    process.env.MCP_HTTP_PORT = '0';
    process.env.AUVIK_API_KEY = CANARY_API_KEY;
    const { errors } = silenceLogs();

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${code}`);
    });

    const server = await startHttpTransport();
    servers.push(server);

    expect(exitSpy).not.toHaveBeenCalled();
    const logged = errors.join('\n');
    expect(logged).toContain('WARNING:');
    expect(logged).toContain('MCP_ALLOW_INSECURE_DEV=1');
    expect(logged).toContain('WITHOUT service-to-service authentication');
    assertNoSecrets(logged);

    const address = server.address();
    expect(address).toMatchObject({ address: '127.0.0.1' });
  });

  it('returns 401 when the S2S header is missing or invalid', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_ALLOW_INSECURE_DEV = '';
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    process.env.MCP_HTTP_PORT = '0';
    process.env.AUTH_MODE = 'gateway';
    process.env.AUVIK_USERNAME = ENV_USERNAME;
    process.env.AUVIK_API_KEY = ENV_API_KEY;
    const { errors } = silenceLogs();

    const server = await startHttpTransport();
    servers.push(server);
    assertNoSecrets(errors.join('\n'));
    const port = await listenPort(server);
    const credentialHeaders = {
      'x-auvik-username': 'header-user',
      'x-auvik-api-key': 'header-key',
    };

    const missing = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(credentialHeaders),
      body: JSON.stringify(statusCall),
    });
    expect(missing.status).toBe(401);
    const missingBody = await missing.json();
    expect(missingBody.error).toContain('X-Gateway-S2S');
    expect(JSON.stringify(missingBody)).not.toContain(ENV_USERNAME);
    expect(JSON.stringify(missingBody)).not.toContain(ENV_API_KEY);

    const invalid = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: mcpHeaders({
        ...credentialHeaders,
        'x-gateway-s2s': mintHeader('wrong-secret'),
      }),
      body: JSON.stringify(statusCall),
    });
    expect(invalid.status).toBe(401);
    expect((await invalid.json()).error).toContain('X-Gateway-S2S');
  });

  it('returns 401 in gateway mode without credential headers and does not use env credentials', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    process.env.MCP_HTTP_PORT = '0';
    process.env.AUTH_MODE = 'gateway';
    process.env.AUVIK_USERNAME = ENV_USERNAME;
    process.env.AUVIK_API_KEY = ENV_API_KEY;
    process.env.AUVIK_REGION = 'us1';
    silenceLogs();

    const runSpy = vi.spyOn(credentialsStorage, 'run');
    const server = await startHttpTransport();
    servers.push(server);
    const port = await listenPort(server);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: mcpHeaders({ 'x-gateway-s2s': mintHeader(S2S_SECRET) }),
      body: JSON.stringify(statusCall),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: missing required gateway credential headers x-auvik-username and x-auvik-api-key',
      },
      id: null,
    });
    expect(JSON.stringify(body)).not.toContain(ENV_USERNAME);
    expect(JSON.stringify(body)).not.toContain(ENV_API_KEY);
    expect(runSpy).not.toHaveBeenCalled();

    const partial = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: mcpHeaders({
        'x-gateway-s2s': mintHeader(S2S_SECRET),
        'x-auvik-username': 'header-user',
      }),
      body: JSON.stringify(statusCall),
    });
    expect(partial.status).toBe(401);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid S2S header plus credential headers and uses those credentials', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    process.env.MCP_HTTP_PORT = '0';
    process.env.AUTH_MODE = 'gateway';
    process.env.AUVIK_USERNAME = ENV_USERNAME;
    process.env.AUVIK_API_KEY = ENV_API_KEY;
    process.env.AUVIK_REGION = 'us1';
    silenceLogs();

    const runSpy = vi.spyOn(credentialsStorage, 'run');
    const server = await startHttpTransport();
    servers.push(server);
    const port = await listenPort(server);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: mcpHeaders({
        'x-gateway-s2s': mintHeader(S2S_SECRET),
        'x-auvik-username': 'header-user',
        'x-auvik-api-key': 'header-key',
        'x-auvik-region': 'eu2',
      }),
      body: JSON.stringify(statusCall),
    });
    const body = await response.json();
    const status = JSON.parse(body.result.content[0].text) as { region: string; hasCredentials: boolean };

    expect(response.status).toBe(200);
    expect(status.region).toBe('eu2');
    expect(status.hasCredentials).toBe(true);
    expect(JSON.stringify(body)).not.toContain(ENV_USERNAME);
    expect(JSON.stringify(body)).not.toContain(ENV_API_KEY);
    expect(runSpy).toHaveBeenCalledWith(
      { username: 'header-user', apiKey: 'header-key', region: 'eu2' },
      expect.any(Function),
    );
  });

  it('serves /health without authentication and without reading credentials', async () => {
    process.env.CONDUIT_S2S_SECRET = S2S_SECRET;
    process.env.MCP_HTTP_HOST = '127.0.0.1';
    process.env.MCP_HTTP_PORT = '0';
    process.env.AUTH_MODE = 'gateway';
    process.env.AUVIK_USERNAME = ENV_USERNAME;
    process.env.AUVIK_API_KEY = ENV_API_KEY;
    silenceLogs();

    const runSpy = vi.spyOn(credentialsStorage, 'run');
    const server = await startHttpTransport();
    servers.push(server);
    const port = await listenPort(server);

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
    expect(JSON.stringify(body)).not.toContain(ENV_USERNAME);
    expect(JSON.stringify(body)).not.toContain(ENV_API_KEY);
    expect(runSpy).not.toHaveBeenCalled();
  });
});

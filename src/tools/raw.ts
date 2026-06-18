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
      path: { type: 'string', minLength: 1, description: 'API path relative to the Auvik base URL, e.g. "/alert/history/info"' },
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
  body?: Record<string, unknown>;
}): Promise<any> {
  try {
    // Default + normalize for direct callers; the schema enum already gates MCP callers.
    const method = (args.method ?? 'GET').toUpperCase();
    // cast required: TS won't accept `string` for ReadonlyArray<'GET'|'POST'>.includes()
    if (!ALLOWED_METHODS.includes(method as (typeof ALLOWED_METHODS)[number])) {
      return {
        content: [{
          type: 'text' as const,
          text: `Unsupported method "${method}". The Auvik API supports: ${ALLOWED_METHODS.join(', ')}.`,
        }],
        isError: true,
      };
    }
    if (!args.path || !args.path.trim()) {
      return {
        content: [{ type: 'text' as const, text: 'A non-empty "path" is required (e.g. "/alert/history/info")' }],
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

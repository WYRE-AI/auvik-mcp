import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';

export const statusTool: Tool = {
  name: 'auvik_status',
  description: 'Check Auvik MCP server status and configuration',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export async function handleStatus(): Promise<any> {
  const credentials = getCredentials();

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ok: true,
        version: '0.1.0',
        region: credentials?.region || 'us1',
        hasCredentials: !!credentials,
        endpoints: {
          tenants: ['list', 'get', 'detail'],
          devices: ['list', 'get', 'details', 'warranty', 'lifecycle'],
          networks: ['list', 'get'],
          interfaces: ['list'],
          configurations: ['list', 'get'],
          entities: ['notes', 'audits'],
          alerts: ['list', 'get', 'dismiss'],
          statistics: ['device', 'interface', 'service', 'snmp_poller'],
          billing: ['client_usage', 'device_usage'],
        },
      }, null, 2),
    }],
  };
}
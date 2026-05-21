import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const networksListTool: Tool = {
  name: 'auvik_networks_list',
  description: 'List networks discovered by Auvik',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_networkType: { type: 'string', description: 'Filter by network type (optional)' },
      filter_modifiedAfter: { type: 'string', description: 'Filter networks modified after this date (ISO 8601, optional)' },
    },
    additionalProperties: false,
  },
};

export const networksGetTool: Tool = {
  name: 'auvik_networks_get',
  description: 'Get information about a specific network',
  inputSchema: {
    type: 'object',
    properties: {
      networkId: { type: 'string', description: 'The Auvik network ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['networkId'],
    additionalProperties: false,
  },
};

export async function handleNetworksList(args: any = {}): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.networks.list(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik networks found for specified criteria' }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
      }],
    };
  } catch (error) {
    const mcpError = toMcpError(error);
    return {
      content: [{ type: 'text' as const, text: mcpError.message }],
      isError: true,
    };
  }
}

export async function handleNetworksGet(args: { networkId: string; tenants?: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.networks.get(args.networkId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik network found with ID: ${args.networkId}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
      }],
    };
  } catch (error) {
    const mcpError = toMcpError(error);
    return {
      content: [{ type: 'text' as const, text: mcpError.message }],
      isError: true,
    };
  }
}
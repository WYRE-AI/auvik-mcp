import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const configurationsListTool: Tool = {
  name: 'auvik_configurations_list',
  description: 'List device configurations managed by Auvik',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_devices: { type: 'string', description: 'Filter by device IDs (optional)' },
    },
    additionalProperties: false,
  },
};

export const configurationsGetTool: Tool = {
  name: 'auvik_configurations_get',
  description: 'Get a specific device configuration',
  inputSchema: {
    type: 'object',
    properties: {
      configId: { type: 'string', description: 'The Auvik configuration ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['configId'],
    additionalProperties: false,
  },
};

export async function handleConfigurationsList(args: any = {}): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.configurations.list(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik configurations found for specified criteria' }],
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

export async function handleConfigurationsGet(args: { configId: string; tenants?: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.configurations.get(args.configId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik configuration found with ID: ${args.configId}` }],
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
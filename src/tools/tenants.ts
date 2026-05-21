import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const tenantsListTool: Tool = {
  name: 'auvik_tenants_list',
  description: 'List all accessible Auvik tenants',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export const tenantsGetTool: Tool = {
  name: 'auvik_tenants_get',
  description: 'Get basic information about a specific tenant',
  inputSchema: {
    type: 'object',
    properties: {
      tenantId: {
        type: 'string',
        description: 'The Auvik tenant ID',
      },
    },
    required: ['tenantId'],
    additionalProperties: false,
  },
};

export const tenantsDetailTool: Tool = {
  name: 'auvik_tenants_detail',
  description: 'Get detailed information about a specific tenant',
  inputSchema: {
    type: 'object',
    properties: {
      tenantId: {
        type: 'string',
        description: 'The Auvik tenant ID',
      },
    },
    required: ['tenantId'],
    additionalProperties: false,
  },
};

export async function handleTenantsList(): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.tenants.list();

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik tenants found' }],
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

export async function handleTenantsGet(args: { tenantId: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.tenants.get(args.tenantId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik tenant found with ID: ${args.tenantId}` }],
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

export async function handleTenantsDetail(args: { tenantId: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.tenants.getDetail(args.tenantId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik tenant detail found with ID: ${args.tenantId}` }],
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
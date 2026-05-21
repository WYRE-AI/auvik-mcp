import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const billingClientUsageTool: Tool = {
  name: 'auvik_billing_client_usage',
  description: 'Get client billing usage information',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime'],
    additionalProperties: false,
  },
};

export const billingDeviceUsageTool: Tool = {
  name: 'auvik_billing_device_usage',
  description: 'Get device billing usage information',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime'],
    additionalProperties: false,
  },
};

export async function handleBillingClientUsage(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.billing.clientUsage(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik billing client usage found for specified criteria' }],
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

export async function handleBillingDeviceUsage(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.billing.deviceUsage(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik billing device usage found for specified criteria' }],
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
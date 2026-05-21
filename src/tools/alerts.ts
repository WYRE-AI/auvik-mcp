import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const alertsListTool: Tool = {
  name: 'auvik_alerts_list',
  description: 'List alerts from Auvik monitoring',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_status: { type: 'string', enum: ['created', 'acknowledged', 'resolved'], description: 'Filter by alert status (optional)' },
      filter_severity: { type: 'string', enum: ['unknown', 'emergency', 'critical', 'warning', 'info'], description: 'Filter by severity (optional)' },
    },
    additionalProperties: false,
  },
};

export const alertsGetTool: Tool = {
  name: 'auvik_alerts_get',
  description: 'Get details about a specific alert',
  inputSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: 'The Auvik alert ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['alertId'],
    additionalProperties: false,
  },
};

export const alertsDismissTool: Tool = {
  name: 'auvik_alerts_dismiss',
  description: 'Dismiss/acknowledge an alert',
  inputSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: 'The Auvik alert ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['alertId'],
    additionalProperties: false,
  },
};

export async function handleAlertsList(args: any = {}): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.alerts.list(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik alerts found for specified criteria' }],
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

export async function handleAlertsGet(args: { alertId: string; tenants?: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.alerts.get(args.alertId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik alert found with ID: ${args.alertId}` }],
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

export async function handleAlertsDismiss(args: { alertId: string; tenants?: string }): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.alerts.dismiss(args.alertId);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          message: `Alert ${args.alertId} has been dismissed`,
          result: response,
        }, null, 2),
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
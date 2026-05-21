import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const entitiesListNotesTool: Tool = {
  name: 'auvik_entities_list_notes',
  description: 'List notes attached to Auvik entities',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_entityId: { type: 'string', description: 'Filter by entity ID (optional)' },
    },
    additionalProperties: false,
  },
};

export const entitiesListAuditsTool: Tool = {
  name: 'auvik_entities_list_audits',
  description: 'List audit logs for Auvik entities',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_entityId: { type: 'string', description: 'Filter by entity ID (optional)' },
    },
    additionalProperties: false,
  },
};

export async function handleEntitiesListNotes(args: any = {}): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.entities.listNotes(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik entity notes found for specified criteria' }],
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

export async function handleEntitiesListAudits(args: any = {}): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.entities.listAudits(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik entity audits found for specified criteria' }],
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
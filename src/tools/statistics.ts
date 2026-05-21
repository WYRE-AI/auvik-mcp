import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';

export const statisticsDeviceTool: Tool = {
  name: 'auvik_statistics_device',
  description: 'Get device statistics and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      filter_devices: { type: 'string', description: 'Filter by device IDs' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime', 'filter_devices'],
    additionalProperties: false,
  },
};

export const statisticsInterfaceTool: Tool = {
  name: 'auvik_statistics_interface',
  description: 'Get interface statistics and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      filter_interfaces: { type: 'string', description: 'Filter by interface IDs' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime', 'filter_interfaces'],
    additionalProperties: false,
  },
};

export const statisticsServiceTool: Tool = {
  name: 'auvik_statistics_service',
  description: 'Get service statistics and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      filter_services: { type: 'string', description: 'Filter by service IDs' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime', 'filter_services'],
    additionalProperties: false,
  },
};

export const statisticsSnmpPollerTool: Tool = {
  name: 'auvik_statistics_snmp_poller',
  description: 'Get SNMP poller statistics and metrics',
  inputSchema: {
    type: 'object',
    properties: {
      fromTime: { type: 'string', description: 'Start time (ISO 8601)' },
      thruTime: { type: 'string', description: 'End time (ISO 8601)' },
      filter_pollers: { type: 'string', description: 'Filter by SNMP poller IDs' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['fromTime', 'thruTime', 'filter_pollers'],
    additionalProperties: false,
  },
};

export async function handleStatisticsDevice(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.statistics.device(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik device statistics found for specified criteria' }],
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

export async function handleStatisticsInterface(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.statistics.interface(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik interface statistics found for specified criteria' }],
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

export async function handleStatisticsService(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.statistics.service(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik service statistics found for specified criteria' }],
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

export async function handleStatisticsSnmpPoller(args: any): Promise<any> {
  try {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.statistics.snmpPoller(args);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik SNMP poller statistics found for specified criteria' }],
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
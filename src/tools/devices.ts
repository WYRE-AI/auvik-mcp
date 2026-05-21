import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials } from '../credentials.js';
import { createAuvikClient } from '../client-factory.js';
import { toMcpError } from '../errors.js';
import { DevicesListSchema, DeviceGetSchema, DeviceDetailsSchema, DeviceWarrantySchema, DeviceLifecycleSchema } from '../schemas/devices.js';

export const devicesListTool: Tool = {
  name: 'auvik_devices_list',
  description: 'List network devices managed by Auvik',
  inputSchema: {
    type: 'object',
    properties: {
      page: { type: 'number', description: 'Page number (optional)' },
      pageSize: { type: 'number', description: 'Number of items per page (1-1000, optional)' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
      filter_deviceType: { type: 'string', description: 'Filter by device type (optional)' },
      filter_modifiedAfter: { type: 'string', description: 'Filter devices modified after this date (ISO 8601, optional)' },
      filter_vendorName: { type: 'string', description: 'Filter by vendor name (optional)' },
      filter_onlineStatus: {
        type: 'string',
        enum: ['online', 'offline', 'unreachable', 'testing', 'unknown', 'dormant', 'notPresent', 'lowerLayerDown'],
        description: 'Filter by online status (optional)'
      },
    },
    additionalProperties: false,
  },
};

export const devicesGetTool: Tool = {
  name: 'auvik_devices_get',
  description: 'Get basic information about a specific device',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'The Auvik device ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['deviceId'],
    additionalProperties: false,
  },
};

export const devicesGetDetailsTool: Tool = {
  name: 'auvik_devices_get_details',
  description: 'Get detailed information about a specific device',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'The Auvik device ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['deviceId'],
    additionalProperties: false,
  },
};

export const devicesGetWarrantyTool: Tool = {
  name: 'auvik_devices_get_warranty',
  description: 'Get warranty information for a specific device',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'The Auvik device ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['deviceId'],
    additionalProperties: false,
  },
};

export const devicesGetLifecycleTool: Tool = {
  name: 'auvik_devices_get_lifecycle',
  description: 'Get lifecycle information for a specific device',
  inputSchema: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', description: 'The Auvik device ID' },
      tenants: { type: 'string', description: 'Comma-separated tenant IDs (optional)' },
    },
    required: ['deviceId'],
    additionalProperties: false,
  },
};

export async function handleDevicesList(args: any = {}): Promise<any> {
  try {
    const parsedArgs = DevicesListSchema.parse(args);
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.devices.list(parsedArgs);

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik devices found for specified criteria' }],
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

export async function handleDevicesGet(args: { deviceId: string; tenants?: string }): Promise<any> {
  try {
    const parsedArgs = DeviceGetSchema.parse(args);
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.devices.get(parsedArgs.deviceId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik device found with ID: ${parsedArgs.deviceId}` }],
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

export async function handleDevicesGetDetails(args: { deviceId: string; tenants?: string }): Promise<any> {
  try {
    const parsedArgs = DeviceDetailsSchema.parse(args);
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.devices.getDetails(parsedArgs.deviceId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik device details found with ID: ${parsedArgs.deviceId}` }],
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

export async function handleDevicesGetWarranty(args: { deviceId: string; tenants?: string }): Promise<any> {
  try {
    const parsedArgs = DeviceWarrantySchema.parse(args);
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.devices.getWarranty(parsedArgs.deviceId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik device warranty found with ID: ${parsedArgs.deviceId}` }],
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

export async function handleDevicesGetLifecycle(args: { deviceId: string; tenants?: string }): Promise<any> {
  try {
    const parsedArgs = DeviceLifecycleSchema.parse(args);
    const credentials = getCredentials();
    if (!credentials) {
      return {
        content: [{ type: 'text' as const, text: 'No Auvik credentials configured' }],
        isError: true,
      };
    }

    const client = createAuvikClient(credentials);
    const response = await client.devices.getLifecycle(parsedArgs.deviceId);

    if (!response.data) {
      return {
        content: [{ type: 'text' as const, text: `No Auvik device lifecycle found with ID: ${parsedArgs.deviceId}` }],
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
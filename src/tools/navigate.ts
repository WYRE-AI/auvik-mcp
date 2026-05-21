import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const navigateTool: Tool = {
  name: 'auvik_navigate',
  description: 'Get navigation links to Auvik UI and documentation',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export async function handleNavigate(): Promise<any> {
  const links = {
    dashboard: 'https://dashboard.auvik.com/',
    devices: 'https://dashboard.auvik.com/devices',
    networks: 'https://dashboard.auvik.com/networks',
    alerts: 'https://dashboard.auvik.com/alerts',
    reports: 'https://dashboard.auvik.com/reports',
    api_docs: 'https://api.auvik.com/documentation',
    help: 'https://support.auvik.com/',
    status: 'https://status.auvik.com/',
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        message: 'Auvik navigation links',
        links,
      }, null, 2),
    }],
  };
}
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toMcpError } from './errors.js';

// Status and navigation tools
import { statusTool, handleStatus } from './tools/status.js';
import { navigateTool, handleNavigate } from './tools/navigate.js';

// Tenant tools
import {
  tenantsListTool,
  tenantsGetTool,
  tenantsDetailTool,
  handleTenantsList,
  handleTenantsGet,
  handleTenantsDetail,
} from './tools/tenants.js';

// Device tools
import {
  devicesListTool,
  devicesGetTool,
  devicesGetDetailsTool,
  devicesGetWarrantyTool,
  devicesGetLifecycleTool,
  handleDevicesList,
  handleDevicesGet,
  handleDevicesGetDetails,
  handleDevicesGetWarranty,
  handleDevicesGetLifecycle,
} from './tools/devices.js';

// Network tools
import {
  networksListTool,
  networksGetTool,
  handleNetworksList,
  handleNetworksGet,
} from './tools/networks.js';

// Interface tools
import {
  interfacesListTool,
  handleInterfacesList,
} from './tools/interfaces.js';

// Configuration tools
import {
  configurationsListTool,
  configurationsGetTool,
  handleConfigurationsList,
  handleConfigurationsGet,
} from './tools/configurations.js';

// Entity tools
import {
  entitiesListNotesTool,
  entitiesListAuditsTool,
  handleEntitiesListNotes,
  handleEntitiesListAudits,
} from './tools/entities.js';

// Alert tools
import {
  alertsListTool,
  alertsGetTool,
  alertsDismissTool,
  handleAlertsList,
  handleAlertsGet,
  handleAlertsDismiss,
} from './tools/alerts.js';

// Statistics tools
import {
  statisticsDeviceTool,
  statisticsInterfaceTool,
  statisticsServiceTool,
  statisticsSnmpPollerTool,
  handleStatisticsDevice,
  handleStatisticsInterface,
  handleStatisticsService,
  handleStatisticsSnmpPoller,
} from './tools/statistics.js';

// Billing tools
import {
  billingClientUsageTool,
  billingDeviceUsageTool,
  handleBillingClientUsage,
  handleBillingDeviceUsage,
} from './tools/billing.js';

const TOOLS = [
  // Status and navigation
  statusTool,
  navigateTool,

  // Tenants
  tenantsListTool,
  tenantsGetTool,
  tenantsDetailTool,

  // Devices
  devicesListTool,
  devicesGetTool,
  devicesGetDetailsTool,
  devicesGetWarrantyTool,
  devicesGetLifecycleTool,

  // Networks
  networksListTool,
  networksGetTool,

  // Interfaces
  interfacesListTool,

  // Configurations
  configurationsListTool,
  configurationsGetTool,

  // Entities
  entitiesListNotesTool,
  entitiesListAuditsTool,

  // Alerts
  alertsListTool,
  alertsGetTool,
  alertsDismissTool,

  // Statistics
  statisticsDeviceTool,
  statisticsInterfaceTool,
  statisticsServiceTool,
  statisticsSnmpPollerTool,

  // Billing
  billingClientUsageTool,
  billingDeviceUsageTool,
];

export function createServer(): Server {
  const server = new Server(
    { name: 'auvik-mcp', version: '0.1.0' },
    { capabilities: { tools: {}, logging: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs = {} } = request.params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = rawArgs as any;

    try {
      switch (name) {
        // Status and navigation
        case 'auvik_status':
          return await handleStatus();
        case 'auvik_navigate':
          return await handleNavigate();

        // Tenants
        case 'auvik_tenants_list':
          return await handleTenantsList();
        case 'auvik_tenants_get':
          return await handleTenantsGet(args);
        case 'auvik_tenants_detail':
          return await handleTenantsDetail(args);

        // Devices
        case 'auvik_devices_list':
          return await handleDevicesList(args);
        case 'auvik_devices_get':
          return await handleDevicesGet(args);
        case 'auvik_devices_get_details':
          return await handleDevicesGetDetails(args);
        case 'auvik_devices_get_warranty':
          return await handleDevicesGetWarranty(args);
        case 'auvik_devices_get_lifecycle':
          return await handleDevicesGetLifecycle(args);

        // Networks
        case 'auvik_networks_list':
          return await handleNetworksList(args);
        case 'auvik_networks_get':
          return await handleNetworksGet(args);

        // Interfaces
        case 'auvik_interfaces_list':
          return await handleInterfacesList(args);

        // Configurations
        case 'auvik_configurations_list':
          return await handleConfigurationsList(args);
        case 'auvik_configurations_get':
          return await handleConfigurationsGet(args);

        // Entities
        case 'auvik_entities_list_notes':
          return await handleEntitiesListNotes(args);
        case 'auvik_entities_list_audits':
          return await handleEntitiesListAudits(args);

        // Alerts
        case 'auvik_alerts_list':
          return await handleAlertsList(args);
        case 'auvik_alerts_get':
          return await handleAlertsGet(args);
        case 'auvik_alerts_dismiss':
          return await handleAlertsDismiss(args);

        // Statistics
        case 'auvik_statistics_device':
          return await handleStatisticsDevice(args);
        case 'auvik_statistics_interface':
          return await handleStatisticsInterface(args);
        case 'auvik_statistics_service':
          return await handleStatisticsService(args);
        case 'auvik_statistics_snmp_poller':
          return await handleStatisticsSnmpPoller(args);

        // Billing
        case 'auvik_billing_client_usage':
          return await handleBillingClientUsage(args);
        case 'auvik_billing_device_usage':
          return await handleBillingDeviceUsage(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const mcpError = toMcpError(error);
      return {
        content: [{ type: 'text' as const, text: mcpError.message }],
        isError: true,
      };
    }
  });

  return server;
}
import { config } from 'dotenv';
import { startHttpTransport } from './http-transport.js';
import { startStdioTransport } from './stdio-transport.js';

// Load environment variables
config();

const transport = process.env.MCP_TRANSPORT || (process.argv.includes('--stdio') ? 'stdio' : 'http');

async function main() {
  try {
    if (transport === 'stdio') {
      console.error('Starting Auvik MCP server (stdio)...');
      await startStdioTransport();
    } else {
      console.error('Starting Auvik MCP server (http)...');
      await startHttpTransport();
    }
  } catch (error) {
    console.error('Failed to start Auvik MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
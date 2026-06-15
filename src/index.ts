import { config } from 'dotenv';
import { startHttpTransport } from './http-transport.js';
import { startStdioTransport } from './stdio-transport.js';

// Load environment variables
config();

// Default to stdio: a bare `node dist/index.js` must speak MCP over stdio, which
// is what local clients and the mcp-eval-baseline CI harness spawn-and-drive.
// HTTP (gateway/container) mode is opt-in via MCP_TRANSPORT=http — which the
// Dockerfile and the gwp-auvik container app both set — or the --http flag.
const transport = process.env.MCP_TRANSPORT || (process.argv.includes('--http') ? 'http' : 'stdio');

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
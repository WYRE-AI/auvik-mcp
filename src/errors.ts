import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Map common Auvik API errors
  if (errorMessage.includes('401')) {
    return new McpError(ErrorCode.InvalidRequest, 'Invalid Auvik credentials');
  }

  if (errorMessage.includes('403')) {
    return new McpError(ErrorCode.InvalidRequest, 'Auvik API access forbidden');
  }

  if (errorMessage.includes('404')) {
    return new McpError(ErrorCode.InvalidRequest, 'Auvik resource not found');
  }

  if (errorMessage.includes('429')) {
    return new McpError(ErrorCode.InvalidRequest, 'Auvik API rate limit exceeded');
  }

  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
    return new McpError(ErrorCode.InternalError, 'Auvik API service error');
  }

  // Generic error
  return new McpError(ErrorCode.InternalError, `Auvik API error: ${errorMessage}`);
}
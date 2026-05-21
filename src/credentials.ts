import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuvikCredentials {
  username: string;
  apiKey: string;
  region?: string;
}

// AsyncLocalStorage for per-request credentials (gateway mode)
export const credentialsStorage = new AsyncLocalStorage<AuvikCredentials>();

export function getCredentials(): AuvikCredentials | null {
  // First try AsyncLocalStorage (gateway mode)
  const asyncCreds = credentialsStorage.getStore();
  if (asyncCreds) {
    return asyncCreds;
  }

  // Fall back to environment variables (single-tenant mode)
  const username = process.env.AUVIK_USERNAME;
  const apiKey = process.env.AUVIK_API_KEY;

  if (!username || !apiKey) {
    return null;
  }

  return {
    username,
    apiKey,
    region: process.env.AUVIK_REGION,
  };
}
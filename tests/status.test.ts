import { describe, it, expect, afterEach } from 'vitest';
import { handleStatus, statusTool } from '../src/tools/status.js';

describe('auvik_status', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('declares the expected tool name', () => {
    expect(statusTool.name).toBe('auvik_status');
  });

  it('reports ok and absent credentials when env is empty', async () => {
    delete process.env.AUVIK_USERNAME;
    delete process.env.AUVIK_API_KEY;
    const result = await handleStatus();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.hasCredentials).toBe(false);
  });

  it('reports credentials present when env is set', async () => {
    process.env.AUVIK_USERNAME = 'user@example.com';
    process.env.AUVIK_API_KEY = 'k';
    process.env.AUVIK_REGION = 'eu1';
    const result = await handleStatus();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.hasCredentials).toBe(true);
    expect(payload.region).toBe('eu1');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { rawRequestTool, handleRawRequest } from '../src/tools/raw.js';

describe('auvik_raw_request', () => {
  it('schema requires path and allows only GET/POST methods', () => {
    const props = (rawRequestTool.inputSchema.properties ?? {}) as Record<string, any>;
    expect(rawRequestTool.inputSchema.required).toContain('path');
    expect(props.method.enum).toEqual(['GET', 'POST']);
  });

  it('rejects a disallowed method before doing any work', async () => {
    const res = await handleRawRequest({ method: 'DELETE', path: '/alert/history/info' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('method');
  });

  it('routes a valid GET through client.raw and returns the serialized body', async () => {
    const prevUser = process.env.AUVIK_USERNAME;
    const prevKey = process.env.AUVIK_API_KEY;
    process.env.AUVIK_USERNAME = 'u@example.com';
    process.env.AUVIK_API_KEY = 'k';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: [{ id: 'a1', type: 'alertHistory', attributes: {} }], links: {}, meta: {} }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await handleRawRequest({ path: '/alert/history/info' });
      expect(res.isError).toBeUndefined();
      expect(String(fetchMock.mock.calls[0][0])).toContain('/alert/history/info');
      const payload = JSON.parse(res.content[0].text);
      expect(payload.data[0].id).toBe('a1');
    } finally {
      vi.unstubAllGlobals();
      process.env.AUVIK_USERNAME = prevUser;
      process.env.AUVIK_API_KEY = prevKey;
    }
  });
});

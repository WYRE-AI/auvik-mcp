import { describe, it, expect } from 'vitest';
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
});

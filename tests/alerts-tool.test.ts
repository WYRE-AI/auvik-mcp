import { describe, it, expect } from 'vitest';
import { alertsListTool } from '../src/tools/alerts.js';

describe('alertsListTool schema', () => {
  const props = () =>
    (alertsListTool.inputSchema.properties ?? {}) as Record<string, any>;

  it('exposes detected-time, sort and cursor params with correct types', () => {
    const p = props();
    expect(p.filter_detectedTimeAfter?.type).toBe('string');
    expect(p.filter_detectedTimeBefore?.type).toBe('string');
    expect(p.sort?.type).toBe('string');
    expect(p.pageAfter?.type).toBe('string');
    expect(p.pageSize?.type).toBe('number'); // cursor size, not an offset
  });

  it('drops the non-functional page-number param', () => {
    expect(props().page).toBeUndefined();
  });

  it('keeps status and severity filters with their enums', () => {
    const p = props();
    expect(p.filter_status?.enum).toContain('resolved');
    expect(p.filter_severity?.enum).toContain('critical');
  });
});

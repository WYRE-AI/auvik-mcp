import { describe, it, expect } from 'vitest';
import { alertsListTool } from '../src/tools/alerts.js';

describe('alertsListTool schema', () => {
  const props = () =>
    (alertsListTool.inputSchema.properties ?? {}) as Record<string, unknown>;

  it('exposes detected-time, sort and cursor params', () => {
    const p = props();
    expect(p.filter_detectedTimeAfter).toBeDefined();
    expect(p.filter_detectedTimeBefore).toBeDefined();
    expect(p.sort).toBeDefined();
    expect(p.pageAfter).toBeDefined();
  });

  it('drops the non-functional page-number param', () => {
    expect(props().page).toBeUndefined();
  });

  it('keeps status and severity filters', () => {
    const p = props();
    expect(p.filter_status).toBeDefined();
    expect(p.filter_severity).toBeDefined();
  });
});

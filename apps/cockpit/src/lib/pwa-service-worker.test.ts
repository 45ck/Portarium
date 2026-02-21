import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('pwa service worker', () => {
  it('contains deterministic caching and update hooks', () => {
    const swPath = resolve(process.cwd(), 'public/sw.js');
    const swSource = readFileSync(swPath, 'utf8');

    expect(swSource).toContain("const VERSION = 'portarium-cockpit-pwa-v1'");
    expect(swSource).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(swSource).toContain('self.clients.claim()');
    expect(swSource).toContain('SELECTED_READ_ENDPOINTS');
    expect(swSource).toContain('approvals|work-items|runs');
    expect(swSource).toContain("cache.match('/index.html')");
  });
});

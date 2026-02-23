import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('pwa manifest', () => {
  it('declares installability-critical fields', () => {
    const manifestPath = resolve(process.cwd(), 'public/site.webmanifest');
    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as Record<string, unknown>;

    expect(manifest['name']).toBe('Portarium Cockpit');
    expect(manifest['short_name']).toBe('Portarium');
    expect(manifest['display']).toBe('standalone');
    // start_url includes ?source=pwa for analytics tracking
    expect(typeof manifest['start_url']).toBe('string');
    expect((manifest['start_url'] as string).startsWith('/')).toBe(true);
    expect(manifest['scope']).toBe('/');
    expect(manifest['theme_color']).toBe('#0B1220');
    expect(Array.isArray(manifest['icons'])).toBe(true);
    expect((manifest['icons'] as Array<unknown>).length).toBeGreaterThanOrEqual(2);
  });
});

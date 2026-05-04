import { describe, expect, it } from 'vitest';

import {
  buildCockpitContentSecurityPolicy,
  hasCockpitContentSecurityPolicy,
  localHttpApiOriginFromUrl,
  normalizeCockpitCspConnectMode,
  replaceCockpitContentSecurityPolicy,
} from './cockpit-csp';

const DEFAULT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.portarium.io wss://events.portarium.io; img-src 'self' data:; font-src 'self'";

describe('Cockpit CSP', () => {
  it('keeps the production default policy tight when no local API origin is configured', () => {
    expect(buildCockpitContentSecurityPolicy()).toBe(DEFAULT_CSP);
    expect(buildCockpitContentSecurityPolicy({ apiBaseUrl: 'https://api.example.test' })).toBe(
      DEFAULT_CSP,
    );
    expect(buildCockpitContentSecurityPolicy({ apiBaseUrl: 'http://api.example.test:8080' })).toBe(
      DEFAULT_CSP,
    );
  });

  it('permits only exact loopback or localhost API origins for live-stack development', () => {
    expect(localHttpApiOriginFromUrl('http://localhost:8080/v1/workspaces')).toBe(
      'http://localhost:8080',
    );
    expect(localHttpApiOriginFromUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    expect(localHttpApiOriginFromUrl('http://api.localhost:8080')).toBe(
      'http://api.localhost:8080',
    );
    expect(localHttpApiOriginFromUrl('http://[::1]:8080')).toBe('http://[::1]:8080');
  });

  it('rejects broad or credential-bearing API origins', () => {
    expect(localHttpApiOriginFromUrl('https://localhost:8080')).toBeNull();
    expect(localHttpApiOriginFromUrl('http://0.0.0.0:8080')).toBeNull();
    expect(localHttpApiOriginFromUrl('http://localhost.evil.test:8080')).toBeNull();
    expect(localHttpApiOriginFromUrl('http://user:pass@localhost:8080')).toBeNull();
    expect(localHttpApiOriginFromUrl('not a url')).toBeNull();
  });

  it('adds the configured local API origin without broadening other directives', () => {
    expect(buildCockpitContentSecurityPolicy({ apiBaseUrl: 'http://localhost:8080' })).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.portarium.io wss://events.portarium.io http://localhost:8080; img-src 'self' data:; font-src 'self'",
    );
  });

  it('supports a live-stack local-only connect-src mode', () => {
    expect(
      buildCockpitContentSecurityPolicy({
        apiBaseUrl: 'http://localhost:8080',
        connectMode: 'local-only',
      }),
    ).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:8080; img-src 'self' data:; font-src 'self'",
    );
  });

  it('rejects unsupported CSP connect modes', () => {
    expect(normalizeCockpitCspConnectMode(undefined)).toBe('production-defaults');
    expect(normalizeCockpitCspConnectMode('local-only')).toBe('local-only');
    expect(() => normalizeCockpitCspConnectMode('localhost-only')).toThrow(
      'Unsupported Cockpit CSP connect mode',
    );
  });

  it('updates the existing CSP meta tag in index.html', () => {
    const html = `<meta
      http-equiv="Content-Security-Policy"
      content="${DEFAULT_CSP}"
    />`;

    expect(
      replaceCockpitContentSecurityPolicy(
        html,
        buildCockpitContentSecurityPolicy({ apiBaseUrl: 'http://localhost:8080' }),
      ),
    ).toContain('http://localhost:8080');
  });

  it('detects whether an HTML shell carries the cockpit CSP meta tag', () => {
    expect(
      hasCockpitContentSecurityPolicy(
        `<meta http-equiv="Content-Security-Policy" content="${DEFAULT_CSP}" />`,
      ),
    ).toBe(true);
    expect(hasCockpitContentSecurityPolicy('<div id="storybook-root"></div>')).toBe(false);
  });
});

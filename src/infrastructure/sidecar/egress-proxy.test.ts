import { describe, expect, it } from 'vitest';

import {
  checkEgressAllowed,
  findBlockedDestinations,
  type EgressProxyConfig,
} from './egress-proxy.js';

function makeConfig(overrides?: Partial<EgressProxyConfig>): EgressProxyConfig {
  return {
    allowlist: [],
    injectTraceContext: true,
    ...overrides,
  };
}

describe('checkEgressAllowed', () => {
  it('denies all when allowlist is empty', () => {
    const result = checkEgressAllowed(makeConfig(), { host: 'api.github.com' });
    expect(result.allowed).toBe(false);
  });

  it('allows exact host match', () => {
    const result = checkEgressAllowed(
      makeConfig({
        allowlist: [{ hostPattern: 'api.github.com' }],
      }),
      { host: 'api.github.com' },
    );
    expect(result.allowed).toBe(true);
  });

  it('denies non-matching host', () => {
    const result = checkEgressAllowed(
      makeConfig({
        allowlist: [{ hostPattern: 'api.github.com' }],
      }),
      { host: 'evil.example.com' },
    );
    expect(result.allowed).toBe(false);
  });

  it('matches wildcard subdomain pattern', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: '*.github.com' }],
    });

    expect(checkEgressAllowed(config, { host: 'api.github.com' }).allowed).toBe(true);
    expect(checkEgressAllowed(config, { host: 'raw.github.com' }).allowed).toBe(true);
    expect(checkEgressAllowed(config, { host: 'github.com' }).allowed).toBe(true);
    expect(checkEgressAllowed(config, { host: 'evil.com' }).allowed).toBe(false);
  });

  it('matches catch-all wildcard', () => {
    const result = checkEgressAllowed(makeConfig({ allowlist: [{ hostPattern: '*' }] }), {
      host: 'anything.example.com',
    });
    expect(result.allowed).toBe(true);
  });

  it('enforces port restriction', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: 'db.internal', port: 5432 }],
    });

    expect(checkEgressAllowed(config, { host: 'db.internal', port: 5432 }).allowed).toBe(true);
    expect(checkEgressAllowed(config, { host: 'db.internal', port: 3306 }).allowed).toBe(false);
  });

  it('enforces method restriction', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: 'api.example.com', allowedMethods: ['GET', 'POST'] }],
    });

    expect(checkEgressAllowed(config, { host: 'api.example.com', method: 'GET' }).allowed).toBe(
      true,
    );
    expect(checkEgressAllowed(config, { host: 'api.example.com', method: 'DELETE' }).allowed).toBe(
      false,
    );
  });

  it('is case-insensitive for host matching', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: 'API.GitHub.COM' }],
    });
    expect(checkEgressAllowed(config, { host: 'api.github.com' }).allowed).toBe(true);
  });
});

describe('findBlockedDestinations', () => {
  it('returns blocked destinations', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: 'api.github.com' }],
    });

    const blocked = findBlockedDestinations(config, [
      { host: 'api.github.com' },
      { host: 'evil.example.com' },
      { host: 'malware.bad.org' },
    ]);

    expect(blocked).toHaveLength(2);
    expect(blocked[0]!.host).toBe('evil.example.com');
    expect(blocked[1]!.host).toBe('malware.bad.org');
  });

  it('returns empty when all destinations are allowed', () => {
    const config = makeConfig({
      allowlist: [{ hostPattern: '*' }],
    });

    const blocked = findBlockedDestinations(config, [{ host: 'any.host.com' }]);

    expect(blocked).toHaveLength(0);
  });
});

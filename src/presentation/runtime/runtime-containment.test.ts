import { describe, expect, it } from 'vitest';

import { readRuntimeContainmentConfigFromEnv } from './runtime-containment.js';

describe('readRuntimeContainmentConfigFromEnv', () => {
  it('returns strict per-tenant defaults when env is empty', () => {
    const config = readRuntimeContainmentConfigFromEnv({});
    expect(config.tenantIsolationMode).toBe('per-tenant-worker');
    expect(config.sandboxAssertions).toBe('strict');
    expect(config.egressAllowlist).toEqual(['https://api.portarium.local']);
  });

  it('parses comma-separated HTTPS egress allowlist', () => {
    const config = readRuntimeContainmentConfigFromEnv({
      PORTARIUM_EGRESS_ALLOWLIST: 'https://a.example, https://b.example',
    });
    expect(config.egressAllowlist).toEqual(['https://a.example', 'https://b.example']);
  });

  it('rejects non-https egress values', () => {
    expect(() =>
      readRuntimeContainmentConfigFromEnv({
        PORTARIUM_EGRESS_ALLOWLIST: 'http://insecure.example',
      }),
    ).toThrow(/egress_allowlist entries must use https urls/i);
  });

  it('rejects weak tenant isolation mode', () => {
    expect(() =>
      readRuntimeContainmentConfigFromEnv({
        PORTARIUM_TENANT_ISOLATION_MODE: 'shared-worker',
      }),
    ).toThrow(/tenant_isolation_mode must be "per-tenant-worker"/i);
  });

  it('rejects unknown sandbox assertion mode', () => {
    expect(() =>
      readRuntimeContainmentConfigFromEnv({
        PORTARIUM_SANDBOX_ASSERTIONS: 'disabled',
      }),
    ).toThrow(/sandbox_assertions must be "strict" or "relaxed"/i);
  });
});

import { describe, expect, it } from 'vitest';
import { checkProductionAuthGuard } from './dev-auth-production-guard.js';

describe('checkProductionAuthGuard', () => {
  // ── Dev/test environments always pass ─────────────────────────────────────

  it('returns safe in development environment regardless of flags', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'development', ENABLE_DEV_AUTH: 'true' },
      jwtSkipVerify: true,
      mtlsDisabled: true,
      jwtAudience: ['http://localhost:3000'],
    });
    expect(result.safe).toBe(true);
  });

  it('returns safe in test environment regardless of flags', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'test', ENABLE_DEV_AUTH: 'true' },
      jwtSkipVerify: true,
      mtlsDisabled: true,
    });
    expect(result.safe).toBe(true);
  });

  // ── Production environment catches violations ─────────────────────────────

  it('returns safe in production when no dev paths are active', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      jwtSkipVerify: false,
      mtlsDisabled: false,
      jwtAudience: ['https://action-api.portarium.io'],
    });
    expect(result.safe).toBe(true);
  });

  it('detects ENABLE_DEV_AUTH=true in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production', ENABLE_DEV_AUTH: 'true' },
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.path).toBe('dev-token');
  });

  it('detects JWT skip-verify in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      jwtSkipVerify: true,
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations[0]!.path).toBe('jwt-skip-verify');
  });

  it('detects mTLS disabled in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      mtlsDisabled: true,
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations[0]!.path).toBe('mtls-skip');
  });

  it('detects localhost audience in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      jwtAudience: ['https://action-api.portarium.io', 'http://localhost:3000'],
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations[0]!.path).toBe('insecure-audience');
    expect(result.violations[0]!.detail).toContain('localhost');
  });

  it('detects dev-audience pattern in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      jwtAudience: ['dev-audience'],
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations[0]!.path).toBe('insecure-audience');
  });

  it('collects multiple violations', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production', ENABLE_DEV_AUTH: 'true' },
      jwtSkipVerify: true,
      mtlsDisabled: true,
      jwtAudience: ['http://localhost:3000'],
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
    const paths = result.violations.map((v) => v.path);
    expect(paths).toContain('dev-token');
    expect(paths).toContain('jwt-skip-verify');
    expect(paths).toContain('mtls-skip');
    expect(paths).toContain('insecure-audience');
  });

  // ── Staging / unknown environments ────────────────────────────────────────

  it('treats staging as production (not dev/test)', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'staging', ENABLE_DEV_AUTH: 'true' },
      jwtSkipVerify: true,
    });
    expect(result.safe).toBe(false);
    if (result.safe) throw new Error('expected unsafe');
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('treats empty NODE_ENV as production', () => {
    const result = checkProductionAuthGuard({
      env: { ENABLE_DEV_AUTH: 'true' },
      jwtSkipVerify: true,
    });
    expect(result.safe).toBe(false);
  });

  // ── Real audience passes in production ────────────────────────────────────

  it('accepts real HTTPS audience in production', () => {
    const result = checkProductionAuthGuard({
      env: { NODE_ENV: 'production' },
      jwtAudience: ['https://action-api.portarium.io', 'https://proxy.portarium.io'],
    });
    expect(result.safe).toBe(true);
  });
});

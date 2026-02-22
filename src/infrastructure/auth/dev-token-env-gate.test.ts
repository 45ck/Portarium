import { describe, expect, it } from 'vitest';
import { checkDevAuthEnvGate } from './dev-token-env-gate.js';

describe('checkDevAuthEnvGate', () => {
  it('returns not-allowed when ENABLE_DEV_AUTH is absent', () => {
    const result = checkDevAuthEnvGate({});
    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected not allowed');
    expect(result.reason).toMatch(/ENABLE_DEV_AUTH/i);
  });

  it('returns not-allowed when ENABLE_DEV_AUTH is "false"', () => {
    const result = checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'false' });
    expect(result.allowed).toBe(false);
  });

  it('returns not-allowed when ENABLE_DEV_AUTH is "1" (not exactly "true")', () => {
    const result = checkDevAuthEnvGate({ ENABLE_DEV_AUTH: '1', NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
  });

  it('returns not-allowed when ENABLE_DEV_AUTH is "TRUE" (case-sensitive)', () => {
    const result = checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'TRUE', NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
  });

  it('returns allowed when ENABLE_DEV_AUTH=true and NODE_ENV=development', () => {
    const result = checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: 'development' });
    expect(result.allowed).toBe(true);
  });

  it('returns allowed when ENABLE_DEV_AUTH=true and NODE_ENV=test', () => {
    const result = checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: 'test' });
    expect(result.allowed).toBe(true);
  });

  it('throws a fatal error when ENABLE_DEV_AUTH=true but NODE_ENV=production', () => {
    expect(() =>
      checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: 'production' }),
    ).toThrow(/FATAL.*production/i);
  });

  it('throws a fatal error when ENABLE_DEV_AUTH=true but NODE_ENV=staging', () => {
    expect(() =>
      checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: 'staging' }),
    ).toThrow(/FATAL/i);
  });

  it('throws a fatal error when ENABLE_DEV_AUTH=true but NODE_ENV is absent', () => {
    expect(() => checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true' })).toThrow(/FATAL/i);
  });

  it('throws a fatal error when ENABLE_DEV_AUTH=true but NODE_ENV is empty string', () => {
    expect(() => checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: '' })).toThrow(/FATAL/i);
  });

  it('error message names the offending NODE_ENV value', () => {
    expect(() =>
      checkDevAuthEnvGate({ ENABLE_DEV_AUTH: 'true', NODE_ENV: 'custom-env' }),
    ).toThrow(/"custom-env"/);
  });
});

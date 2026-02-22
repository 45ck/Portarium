import { describe, expect, it } from 'vitest';
import { checkStoreBootstrapGate } from './store-bootstrap-gate.js';

describe('checkStoreBootstrapGate', () => {
  it('returns not-allowed when DEV_STUB_STORES is absent', () => {
    const result = checkStoreBootstrapGate({});
    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected not allowed');
    expect(result.reason).toMatch(/DEV_STUB_STORES/i);
  });

  it('returns not-allowed when DEV_STUB_STORES is "false"', () => {
    const result = checkStoreBootstrapGate({ DEV_STUB_STORES: 'false' });
    expect(result.allowed).toBe(false);
  });

  it('returns not-allowed when DEV_STUB_STORES is "1" (not exactly "true")', () => {
    const result = checkStoreBootstrapGate({ DEV_STUB_STORES: '1', NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
  });

  it('returns not-allowed when DEV_STUB_STORES is "TRUE" (case-sensitive)', () => {
    const result = checkStoreBootstrapGate({ DEV_STUB_STORES: 'TRUE', NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
  });

  it('returns allowed when DEV_STUB_STORES=true and NODE_ENV=development', () => {
    const result = checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'development' });
    expect(result.allowed).toBe(true);
  });

  it('returns allowed when DEV_STUB_STORES=true and NODE_ENV=test', () => {
    const result = checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'test' });
    expect(result.allowed).toBe(true);
  });

  it('throws a fatal error when DEV_STUB_STORES=true but NODE_ENV=production', () => {
    expect(() =>
      checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'production' }),
    ).toThrow(/FATAL.*production/i);
  });

  it('throws a fatal error when DEV_STUB_STORES=true but NODE_ENV=staging', () => {
    expect(() => checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'staging' })).toThrow(
      /FATAL/i,
    );
  });

  it('throws a fatal error when DEV_STUB_STORES=true but NODE_ENV is absent', () => {
    expect(() => checkStoreBootstrapGate({ DEV_STUB_STORES: 'true' })).toThrow(/FATAL/i);
  });

  it('error message names the offending NODE_ENV value', () => {
    expect(() =>
      checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'custom-env' }),
    ).toThrow(/"custom-env"/);
  });

  it('error message mentions the PORTARIUM_USE_POSTGRES_STORES remedy', () => {
    expect(() =>
      checkStoreBootstrapGate({ DEV_STUB_STORES: 'true', NODE_ENV: 'production' }),
    ).toThrow(/PORTARIUM_USE_POSTGRES_STORES/);
  });
});

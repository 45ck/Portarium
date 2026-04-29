import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildControlPlaneDeps,
  getJoseAuthConfigWarnings,
} from './control-plane-handler.bootstrap.js';

const AUTH_ENV_KEYS = [
  'PORTARIUM_JWKS_URI',
  'PORTARIUM_JWT_ISSUER',
  'PORTARIUM_JWT_AUDIENCE',
  'PORTARIUM_DEV_TOKEN',
  'PORTARIUM_DEV_WORKSPACE_ID',
  'PORTARIUM_DEV_USER_ID',
  'ENABLE_DEV_AUTH',
  'DEV_STUB_STORES',
  'NODE_ENV',
] as const;

let savedEnv: Partial<Record<(typeof AUTH_ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of AUTH_ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of AUTH_ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('getJoseAuthConfigWarnings', () => {
  it('returns no warnings when both issuer and audience are set', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(0);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(warnings[0]).toMatch(/issuer/i);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
    expect(warnings[0]).toMatch(/audience/i);
  });

  it('returns two warnings when both issuer and audience are absent', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings).toHaveLength(2);
    const text = warnings.join('\n');
    expect(text).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(text).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: '   ',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: '  ',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('warnings include guidance on what value to set', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings[0]).toMatch(/Set PORTARIUM_JWT_ISSUER/);
    expect(warnings[1]).toMatch(/Set PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a readonly array', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('buildControlPlaneDeps auth startup gate', () => {
  it('fails startup when no authentication source is configured', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];

    await expect(buildControlPlaneDeps()).rejects.toThrow(/Authentication is not configured/);
  });

  it('fails startup when JWKS auth is configured without issuer or audience validation', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['PORTARIUM_JWKS_URI'] = 'https://auth.example.com/.well-known/jwks.json';

    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_ISSUER/);
    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_AUDIENCE/);
  });
});

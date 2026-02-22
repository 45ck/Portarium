import { describe, expect, it } from 'vitest';
import { getJoseAuthConfigWarnings } from './control-plane-handler.bootstrap.js';

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

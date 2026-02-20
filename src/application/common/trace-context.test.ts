import { describe, expect, it } from 'vitest';

import { normalizeTraceparent, normalizeTracestate } from './trace-context.js';

describe('trace context normalization', () => {
  it('accepts valid W3C traceparent and lowercases it', () => {
    expect(normalizeTraceparent('00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01')).toBe(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
  });

  it('rejects invalid traceparent formats', () => {
    expect(normalizeTraceparent(undefined)).toBeUndefined();
    expect(normalizeTraceparent('')).toBeUndefined();
    expect(normalizeTraceparent('00-not-valid-01')).toBeUndefined();
    expect(
      normalizeTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'),
    ).toBeUndefined();
  });

  it('normalizes tracestate and drops empty values', () => {
    expect(normalizeTracestate(' vendor=value ')).toBe('vendor=value');
    expect(normalizeTracestate('')).toBeUndefined();
    expect(normalizeTracestate(undefined)).toBeUndefined();
  });
});

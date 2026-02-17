import { describe, expect, it } from 'vitest';

import { parseQuotaSemanticsV1 } from './quota-semantics-v1.js';

describe('parseQuotaSemanticsV1: happy path', () => {
  it('parses a minimal QuotaSemanticsV1', () => {
    const quota = parseQuotaSemanticsV1({ schemaVersion: 1 });
    expect(quota.schemaVersion).toBe(1);
    expect(quota.rateLimit).toBeUndefined();
    expect(quota.dailyCap).toBeUndefined();
    expect(quota.batching).toBeUndefined();
    expect(quota.retryAfter).toBeUndefined();
  });

  it('parses rate limit, daily cap, batching, retry-after, and notes', () => {
    const quota = parseQuotaSemanticsV1({
      schemaVersion: 1,
      rateLimit: { requestsPerMinute: 120 },
      dailyCap: { requestsPerDay: 10_000, resetAtUtcHour: 0 },
      batching: { maxBatchSize: 100 },
      retryAfter: { kind: 'RetryAfterSeconds', headerName: 'Retry-After' },
      notes: 'Provider varies by plan tier.',
    });

    expect(quota.rateLimit?.requestsPerMinute).toBe(120);
    expect(quota.dailyCap?.requestsPerDay).toBe(10_000);
    expect(quota.dailyCap?.resetAtUtcHour).toBe(0);
    expect(quota.batching?.maxBatchSize).toBe(100);
    expect(quota.retryAfter).toEqual({ kind: 'RetryAfterSeconds', headerName: 'Retry-After' });
    expect(quota.notes).toMatch(/plan tier/i);
  });

  it('parses retry-after kind "None"', () => {
    const quota = parseQuotaSemanticsV1({
      schemaVersion: 1,
      retryAfter: { kind: 'None' },
    });

    expect(quota.retryAfter).toEqual({ kind: 'None' });
  });
});

describe('parseQuotaSemanticsV1: validation', () => {
  it('rejects invalid top-level values and schema versions', () => {
    expect(() => parseQuotaSemanticsV1('nope')).toThrow(/QuotaSemantics must be an object/i);

    expect(() => parseQuotaSemanticsV1({ schemaVersion: 2 })).toThrow(/schemaVersion/i);
    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1.5 })).toThrow(/schemaVersion/i);
  });

  it('rejects invalid rateLimit shape and values', () => {
    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1, rateLimit: [] })).toThrow(
      /rateLimit must be an object/i,
    );

    expect(() =>
      parseQuotaSemanticsV1({ schemaVersion: 1, rateLimit: { requestsPerMinute: 0 } }),
    ).toThrow(/requestsPerMinute/i);
  });

  it('rejects invalid dailyCap shape and values', () => {
    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1, dailyCap: [] })).toThrow(
      /dailyCap must be an object/i,
    );

    expect(() =>
      parseQuotaSemanticsV1({ schemaVersion: 1, dailyCap: { requestsPerDay: 0 } }),
    ).toThrow(/requestsPerDay/i);

    expect(() =>
      parseQuotaSemanticsV1({
        schemaVersion: 1,
        dailyCap: { requestsPerDay: 100, resetAtUtcHour: 24 },
      }),
    ).toThrow(/resetAtUtcHour/i);
  });

  it('rejects invalid batching shape and values', () => {
    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1, batching: [] })).toThrow(
      /batching must be an object/i,
    );

    expect(() =>
      parseQuotaSemanticsV1({ schemaVersion: 1, batching: { maxBatchSize: 0 } }),
    ).toThrow(/maxBatchSize/i);
  });

  it('rejects invalid retryAfter shape and values', () => {
    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1, retryAfter: [] })).toThrow(
      /retryAfter must be an object/i,
    );

    expect(() => parseQuotaSemanticsV1({ schemaVersion: 1, retryAfter: { kind: 'Nope' } })).toThrow(
      /retryAfter\.kind/i,
    );

    expect(() =>
      parseQuotaSemanticsV1({ schemaVersion: 1, retryAfter: { kind: 'RetryAfterSeconds' } }),
    ).toThrow(/headerName/i);
  });
});

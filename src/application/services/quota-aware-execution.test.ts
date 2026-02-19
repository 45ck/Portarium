import { describe, expect, it, vi } from 'vitest';

import type { MachineInvokerResult } from '../ports/machine-invoker.js';
import {
  invokeMachineWithQuotaRetryV1,
  scheduleQuotaAwareDispatchV1,
  type QuotaUsageSnapshotV1,
} from './quota-aware-execution.js';

function baseUsage(): QuotaUsageSnapshotV1 {
  return {
    minuteWindowStartedAtIso: '2026-02-19T12:00:00.000Z',
    minuteCount: 0,
    dayWindowDateUtc: '2026-02-19',
    dayCount: 0,
  };
}

describe('scheduleQuotaAwareDispatchV1', () => {
  it('dispatches and increments counters under quota limits', () => {
    const decision = scheduleQuotaAwareDispatchV1({
      quota: {
        schemaVersion: 1,
        rateLimit: { requestsPerMinute: 10 },
        dailyCap: { requestsPerDay: 1000, resetAtUtcHour: 0 },
      },
      nowIso: '2026-02-19T12:00:30.000Z',
      usage: baseUsage(),
    });

    expect(decision.kind).toBe('DispatchNow');
    if (decision.kind === 'DispatchNow') {
      expect(decision.nextUsage.minuteCount).toBe(1);
      expect(decision.nextUsage.dayCount).toBe(1);
      expect(decision.nextUsage.minuteWindowStartedAtIso).toBe('2026-02-19T12:00:00.000Z');
      expect(decision.nextUsage.dayWindowDateUtc).toBe('2026-02-19');
    }
  });

  it('defers to next minute when per-minute quota is exhausted', () => {
    const decision = scheduleQuotaAwareDispatchV1({
      quota: {
        schemaVersion: 1,
        rateLimit: { requestsPerMinute: 2 },
      },
      nowIso: '2026-02-19T12:00:45.000Z',
      usage: {
        ...baseUsage(),
        minuteCount: 2,
      },
    });

    expect(decision).toMatchObject({
      kind: 'Deferred',
      reason: 'RateLimit',
      retryAtIso: '2026-02-19T12:01:00.000Z',
    });
  });

  it('enforces burst controls within the same minute window', () => {
    const quota = { schemaVersion: 1 as const, rateLimit: { requestsPerMinute: 2 } };
    const nowIso = '2026-02-19T12:00:45.000Z';

    const first = scheduleQuotaAwareDispatchV1({
      quota,
      nowIso,
      usage: baseUsage(),
    });
    expect(first.kind).toBe('DispatchNow');

    const second = scheduleQuotaAwareDispatchV1({
      quota,
      nowIso,
      usage: first.nextUsage,
    });
    expect(second.kind).toBe('DispatchNow');

    const third = scheduleQuotaAwareDispatchV1({
      quota,
      nowIso,
      usage: second.nextUsage,
    });
    expect(third).toMatchObject({
      kind: 'Deferred',
      reason: 'RateLimit',
      retryAtIso: '2026-02-19T12:01:00.000Z',
    });
  });

  it('defers to reset window when daily cap is exhausted', () => {
    const decision = scheduleQuotaAwareDispatchV1({
      quota: {
        schemaVersion: 1,
        dailyCap: { requestsPerDay: 5, resetAtUtcHour: 3 },
      },
      nowIso: '2026-02-19T12:00:45.000Z',
      usage: {
        ...baseUsage(),
        dayCount: 5,
      },
    });

    expect(decision).toMatchObject({
      kind: 'Deferred',
      reason: 'DailyCap',
      retryAtIso: '2026-02-20T03:00:00.000Z',
    });
  });
});

describe('invokeMachineWithQuotaRetryV1', () => {
  it('retries RateLimited responses with bounded backoff budget', async () => {
    const sleep = vi.fn(async () => undefined);
    const invoke = vi
      .fn<() => Promise<MachineInvokerResult>>()
      .mockResolvedValueOnce({
        ok: false,
        errorKind: 'RateLimited',
        message: '429',
      })
      .mockResolvedValueOnce({
        ok: false,
        errorKind: 'RateLimited',
        message: '429',
      })
      .mockResolvedValueOnce({
        ok: true,
        output: { ok: true },
      });

    const result = await invokeMachineWithQuotaRetryV1({
      invoke,
      maxRetries: 3,
      baseBackoffMs: 100,
      jitterRatio: 0,
      random: () => 0.5,
      sleep,
    });

    expect(result.result).toMatchObject({ ok: true });
    expect(result.attempts).toBe(3);
    expect(result.retryBudgetUsed).toBe(2);
    expect(result.retryBudgetRemaining).toBe(1);
    expect(result.backoffMsHistory).toEqual([100, 200]);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('respects retryAfter override when provided by adapter wrapper', async () => {
    const sleep = vi.fn(async () => undefined);
    const invoke = vi
      .fn<() => Promise<MachineInvokerResult>>()
      .mockResolvedValueOnce({
        ok: false,
        errorKind: 'RateLimited',
        message: '429',
      })
      .mockResolvedValueOnce({
        ok: true,
        output: { ok: true },
      });

    const result = await invokeMachineWithQuotaRetryV1({
      invoke,
      maxRetries: 2,
      baseBackoffMs: 100,
      jitterRatio: 0,
      random: () => 0.5,
      sleep,
      retryAfterMs: () => 750,
    });

    expect(result.backoffMsHistory).toEqual([750]);
    expect(sleep).toHaveBeenCalledWith(750);
  });

  it('stops retrying after maxRetries budget is exhausted', async () => {
    const sleep = vi.fn(async () => undefined);
    const invoke = vi.fn<() => Promise<MachineInvokerResult>>().mockResolvedValue({
      ok: false,
      errorKind: 'RateLimited',
      message: 'still limited',
    });

    const result = await invokeMachineWithQuotaRetryV1({
      invoke,
      maxRetries: 2,
      baseBackoffMs: 50,
      jitterRatio: 0,
      random: () => 0.5,
      sleep,
    });

    expect(result.result).toMatchObject({ ok: false, errorKind: 'RateLimited' });
    expect(result.attempts).toBe(3);
    expect(result.retryBudgetUsed).toBe(2);
    expect(result.retryBudgetRemaining).toBe(0);
    expect(result.backoffMsHistory).toEqual([50, 100]);
  });

  it('does not retry non-rate-limited failures', async () => {
    const sleep = vi.fn(async () => undefined);
    const invoke = vi.fn<() => Promise<MachineInvokerResult>>().mockResolvedValue({
      ok: false,
      errorKind: 'Timeout',
      message: 'timeout',
    });

    const result = await invokeMachineWithQuotaRetryV1({
      invoke,
      maxRetries: 5,
      sleep,
    });

    expect(result.result).toMatchObject({ ok: false, errorKind: 'Timeout' });
    expect(result.attempts).toBe(1);
    expect(result.retryBudgetUsed).toBe(0);
    expect(result.backoffMsHistory).toEqual([]);
    expect(sleep).not.toHaveBeenCalled();
  });
});

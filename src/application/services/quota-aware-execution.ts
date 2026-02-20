import type { QuotaSemanticsV1 } from '../../domain/quota/quota-semantics-v1.js';
import type { MachineInvokerFailure, MachineInvokerResult } from '../ports/machine-invoker.js';

export type QuotaUsageSnapshotV1 = Readonly<{
  minuteWindowStartedAtIso: string;
  minuteCount: number;
  dayWindowDateUtc: string;
  dayCount: number;
}>;

export type QuotaScheduleDecisionV1 =
  | Readonly<{ kind: 'DispatchNow'; nextUsage: QuotaUsageSnapshotV1 }>
  | Readonly<{
      kind: 'Deferred';
      reason: 'RateLimit' | 'DailyCap';
      retryAtIso: string;
      nextUsage: QuotaUsageSnapshotV1;
    }>;

export function scheduleQuotaAwareDispatchV1(params: {
  quota: QuotaSemanticsV1;
  nowIso: string;
  usage: QuotaUsageSnapshotV1;
}): QuotaScheduleDecisionV1 {
  const nowMs = Date.parse(params.nowIso);
  const nowDate = new Date(nowMs);

  const currentMinuteStartIso = toMinuteStartIso(nowDate);
  const currentDayDateUtc = toUtcDate(nowDate);

  const minuteCount =
    params.usage.minuteWindowStartedAtIso === currentMinuteStartIso ? params.usage.minuteCount : 0;
  const dayCount = params.usage.dayWindowDateUtc === currentDayDateUtc ? params.usage.dayCount : 0;

  const nextUsageBase: QuotaUsageSnapshotV1 = {
    minuteWindowStartedAtIso: currentMinuteStartIso,
    minuteCount,
    dayWindowDateUtc: currentDayDateUtc,
    dayCount,
  };

  const rpm = params.quota.rateLimit?.requestsPerMinute;
  if (rpm !== undefined && minuteCount >= rpm) {
    return {
      kind: 'Deferred',
      reason: 'RateLimit',
      retryAtIso: new Date(minuteStartMs(nowMs) + 60_000).toISOString(),
      nextUsage: nextUsageBase,
    };
  }

  const dailyCap = params.quota.dailyCap?.requestsPerDay;
  if (dailyCap !== undefined && dayCount >= dailyCap) {
    return {
      kind: 'Deferred',
      reason: 'DailyCap',
      retryAtIso: computeNextDailyResetIso(params.nowIso, params.quota.dailyCap?.resetAtUtcHour),
      nextUsage: nextUsageBase,
    };
  }

  return {
    kind: 'DispatchNow',
    nextUsage: {
      ...nextUsageBase,
      minuteCount: minuteCount + 1,
      dayCount: dayCount + 1,
    },
  };
}

export type QuotaAwareInvokeResultV1 = Readonly<{
  result: MachineInvokerResult;
  attempts: number;
  retryBudgetUsed: number;
  retryBudgetRemaining: number;
  backoffMsHistory: readonly number[];
}>;

export async function invokeMachineWithQuotaRetryV1(params: {
  invoke: () => Promise<MachineInvokerResult>;
  maxRetries: number;
  retryAfterMs?: (failure: MachineInvokerFailure) => number | undefined;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterRatio?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<QuotaAwareInvokeResultV1> {
  const baseBackoffMs = params.baseBackoffMs ?? 500;
  const maxBackoffMs = params.maxBackoffMs ?? 60_000;
  const jitterRatio = params.jitterRatio ?? 0.2;
  const random = params.random ?? Math.random;
  const sleep = params.sleep ?? defaultSleep;

  const backoffMsHistory: number[] = [];
  let retriesUsed = 0;
  let attempts = 0;

  for (;;) {
    attempts += 1;
    const result = await params.invoke();
    if (result.ok || result.errorKind !== 'RateLimited') {
      return {
        result,
        attempts,
        retryBudgetUsed: retriesUsed,
        retryBudgetRemaining: Math.max(0, params.maxRetries - retriesUsed),
        backoffMsHistory,
      };
    }

    if (retriesUsed >= params.maxRetries) {
      return {
        result,
        attempts,
        retryBudgetUsed: retriesUsed,
        retryBudgetRemaining: 0,
        backoffMsHistory,
      };
    }

    const retryAfter = params.retryAfterMs?.(result);
    const computedBackoff = computeExponentialBackoffMs({
      retryIndex: retriesUsed,
      baseBackoffMs,
      maxBackoffMs,
      jitterRatio,
      random,
    });
    const delayMs = sanitizeDelayMs(retryAfter) ?? computedBackoff;
    backoffMsHistory.push(delayMs);

    retriesUsed += 1;
    await sleep(delayMs);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeDelayMs(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value <= 0) return undefined;
  return Math.floor(value);
}

function computeExponentialBackoffMs(params: {
  retryIndex: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
  random: () => number;
}): number {
  const withoutJitter = Math.min(
    params.maxBackoffMs,
    params.baseBackoffMs * 2 ** params.retryIndex,
  );
  const jitter = (params.random() * 2 - 1) * params.jitterRatio;
  const withJitter = Math.round(withoutJitter * (1 + jitter));
  return Math.max(1, withJitter);
}

function minuteStartMs(nowMs: number): number {
  return nowMs - (nowMs % 60_000);
}

function toMinuteStartIso(value: Date): string {
  return new Date(minuteStartMs(value.getTime())).toISOString();
}

function toUtcDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeNextDailyResetIso(nowIso: string, resetAtUtcHour: number | undefined): string {
  const now = new Date(Date.parse(nowIso));
  const resetHour = resetAtUtcHour ?? 0;

  const nextReset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHour, 0, 0, 0),
  );

  if (nextReset.getTime() <= now.getTime()) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }

  return nextReset.toISOString();
}

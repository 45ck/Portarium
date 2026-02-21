import type { AppContext, DependencyFailure } from '../common/index.js';
import type { IdempotencyKey } from '../ports/idempotency.js';

export function toDependencyFailure(error: unknown, fallback: string): DependencyFailure {
  return { kind: 'DependencyFailure', message: error instanceof Error ? error.message : fallback };
}

export function newCommandKey(
  ctx: AppContext,
  commandName: string,
  requestKey: string,
): IdempotencyKey {
  return { tenantId: ctx.tenantId, commandName, requestKey };
}

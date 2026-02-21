/**
 * Domain model for application-level rate limiting rules.
 *
 * These rules define quotas enforced at the application command layer,
 * distinct from SoR adapter quotas (which are handled by quota-aware execution).
 *
 * Rate limits protect the platform from abuse and ensure fair resource allocation
 * across tenants, users, and action types.
 */

import type { ActionId, TenantId, UserId } from '../primitives/index.js';

/**
 * Scope at which a rate limit is enforced.
 *
 * - Tenant: limit applies to all users in a workspace/tenant
 * - User: limit applies to a specific user across all actions
 * - TenantAction: limit applies to a specific action type within a tenant
 * - UserAction: limit applies to a specific user+action combination
 */
export type RateLimitScope =
  | Readonly<{ kind: 'Tenant'; tenantId: TenantId }>
  | Readonly<{ kind: 'User'; userId: UserId }>
  | Readonly<{ kind: 'TenantAction'; tenantId: TenantId; actionId: ActionId }>
  | Readonly<{ kind: 'UserAction'; userId: UserId; actionId: ActionId }>;

/**
 * Time window for rate limit enforcement.
 *
 * - PerMinute: rolling 60-second window
 * - PerHour: rolling 3600-second window
 * - PerDay: calendar day in UTC
 */
export type RateLimitWindow = 'PerMinute' | 'PerHour' | 'PerDay';

/**
 * A rate limit rule defines quota constraints for a given scope and window.
 *
 * Example: "Tenant acme-corp can make 1000 requests per hour"
 * Example: "User alice can invoke workflow-start 10 times per minute"
 */
export type RateLimitRuleV1 = Readonly<{
  schemaVersion: 1;
  scope: RateLimitScope;
  window: RateLimitWindow;
  maxRequests: number;
  /** Optional burst allowance above maxRequests (token bucket style). */
  burstAllowance?: number;
}>;

/**
 * Current usage snapshot for a rate limit scope.
 */
export type RateLimitUsageV1 = Readonly<{
  scope: RateLimitScope;
  window: RateLimitWindow;
  /** Number of requests consumed in the current window. */
  requestCount: number;
  /** ISO timestamp when the current window started. */
  windowStartedAtIso: string;
  /** ISO timestamp when the window will reset. */
  windowResetsAtIso: string;
}>;

/**
 * Result of a rate limit check.
 *
 * - Allowed: request can proceed
 * - RateLimitExceeded: request exceeds quota, includes retry-after hint
 */
export type RateLimitCheckResultV1 =
  | Readonly<{ allowed: true; usage: RateLimitUsageV1 }>
  | Readonly<{
      allowed: false;
      reason: 'RateLimitExceeded';
      retryAfterSeconds: number;
      usage: RateLimitUsageV1;
    }>;

/**
 * Serializable key for a rate limit scope.
 * Used for storage and caching.
 */
export function serializeRateLimitScope(scope: RateLimitScope): string {
  switch (scope.kind) {
    case 'Tenant':
      return `tenant:${scope.tenantId}`;
    case 'User':
      return `user:${scope.userId}`;
    case 'TenantAction':
      return `tenant-action:${scope.tenantId}:${scope.actionId}`;
    case 'UserAction':
      return `user-action:${scope.userId}:${scope.actionId}`;
  }
}

/**
 * Compute window boundaries for a given timestamp and window type.
 */
export function computeWindowBoundaries(params: {
  nowIso: string;
  window: RateLimitWindow;
}): Readonly<{ windowStartedAtIso: string; windowResetsAtIso: string }> {
  const nowMs = Date.parse(params.nowIso);
  const now = new Date(nowMs);

  switch (params.window) {
    case 'PerMinute': {
      const minuteStartMs = nowMs - (nowMs % 60_000);
      const minuteEndMs = minuteStartMs + 60_000;
      return {
        windowStartedAtIso: new Date(minuteStartMs).toISOString(),
        windowResetsAtIso: new Date(minuteEndMs).toISOString(),
      };
    }
    case 'PerHour': {
      const hourStartMs = nowMs - (nowMs % 3_600_000);
      const hourEndMs = hourStartMs + 3_600_000;
      return {
        windowStartedAtIso: new Date(hourStartMs).toISOString(),
        windowResetsAtIso: new Date(hourEndMs).toISOString(),
      };
    }
    case 'PerDay': {
      const dayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
      );
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      return {
        windowStartedAtIso: dayStart.toISOString(),
        windowResetsAtIso: dayEnd.toISOString(),
      };
    }
  }
}

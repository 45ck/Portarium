import type {
  RateLimitCheckResultV1,
  RateLimitRuleV1,
  RateLimitScope,
  RateLimitUsageV1,
} from '../../domain/rate-limiting/index.js';
import { computeWindowBoundaries } from '../../domain/rate-limiting/index.js';
import type { RateLimitStore } from '../ports/rate-limit-store.js';

/**
 * Application-level rate limiting guard.
 *
 * This service enforces rate limits BEFORE command execution, protecting
 * the platform from abuse and ensuring fair resource allocation.
 *
 * Distinct from quota-aware execution (which handles SoR adapter quotas),
 * this guard operates at the application command layer.
 */

export type RateLimitGuardDeps = Readonly<{
  rateLimitStore: RateLimitStore;
  clock?: () => string;
}>;

/**
 * Check if a request is allowed under rate limit rules.
 *
 * Returns the first violated rule, or allowed if all rules pass.
 */
export async function checkRateLimit(
  deps: RateLimitGuardDeps,
  scope: RateLimitScope,
): Promise<RateLimitCheckResultV1> {
  const nowIso = deps.clock?.() ?? new Date().toISOString();
  const rules = await deps.rateLimitStore.getRulesForScope(scope);

  if (rules.length === 0) {
    // No rules configured - allow by default
    const boundaries = computeWindowBoundaries({ nowIso, window: 'PerMinute' });
    return {
      allowed: true,
      usage: {
        scope,
        window: 'PerMinute',
        requestCount: 0,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      },
    };
  }

  // Check each rule — track the usage returned by the last check so we
  // report the correct (potentially window-reset) usage without re-fetching
  // stale data from the store.
  let lastAllowedUsage = null;
  for (const rule of rules) {
    const result = await checkSingleRule(deps, scope, rule, nowIso);
    if (!result.allowed) {
      // First violated rule determines the response
      return result;
    }
    lastAllowedUsage = result.usage;
  }

  // All rules passed — use the usage captured from the last rule check so that
  // a window reset is reflected in the returned usage (not overwritten by a
  // re-fetch of the stale previous window from the store).
  if (lastAllowedUsage) {
    return { allowed: true, usage: lastAllowedUsage };
  }

  const boundaries = computeWindowBoundaries({ nowIso, window: rules[0]!.window });
  return {
    allowed: true,
    usage: {
      scope,
      window: rules[0]!.window,
      requestCount: 0,
      windowStartedAtIso: boundaries.windowStartedAtIso,
      windowResetsAtIso: boundaries.windowResetsAtIso,
    },
  };
}

async function checkSingleRule(
  deps: RateLimitGuardDeps,
  scope: RateLimitScope,
  rule: RateLimitRuleV1,
  nowIso: string,
): Promise<RateLimitCheckResultV1> {
  const usage = await deps.rateLimitStore.getUsage({
    scope,
    window: rule.window,
  });

  const boundaries = computeWindowBoundaries({ nowIso, window: rule.window });

  // No prior usage or window has reset
  if (!usage || usage.windowStartedAtIso !== boundaries.windowStartedAtIso) {
    return {
      allowed: true,
      usage: {
        scope,
        window: rule.window,
        requestCount: 0,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      },
    };
  }

  const maxAllowed = rule.maxRequests + (rule.burstAllowance ?? 0);

  if (usage.requestCount >= maxAllowed) {
    const nowMs = Date.parse(nowIso);
    const resetMs = Date.parse(usage.windowResetsAtIso);
    const retryAfterSeconds = Math.ceil((resetMs - nowMs) / 1000);

    return {
      allowed: false,
      reason: 'RateLimitExceeded',
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
      usage,
    };
  }

  return {
    allowed: true,
    usage,
  };
}

/**
 * Record a request after it has been allowed.
 *
 * This should be called AFTER checkRateLimit returns allowed=true.
 */
export async function recordRateLimitedRequest(
  deps: RateLimitGuardDeps,
  scope: RateLimitScope,
  rule: RateLimitRuleV1,
): Promise<RateLimitUsageV1> {
  const nowIso = deps.clock?.() ?? new Date().toISOString();
  return deps.rateLimitStore.recordRequest({
    scope,
    window: rule.window,
    nowIso,
  });
}

import type {
  RateLimitRuleV1,
  RateLimitScope,
  RateLimitUsageV1,
} from '../../domain/rate-limiting/index.js';

/**
 * Port for storing and retrieving rate limit rules and usage.
 *
 * Implementations may use in-memory stores, Redis, or persistent databases.
 */
export interface RateLimitStore {
  /**
   * Get the active rate limit rules for a given scope.
   *
   * Multiple rules may apply to the same scope (e.g., per-minute AND per-hour limits).
   * Returns empty array if no rules are configured.
   */
  getRulesForScope(scope: RateLimitScope): Promise<readonly RateLimitRuleV1[]>;

  /**
   * Get current usage for a given scope and window.
   *
   * Returns null if no usage has been recorded yet (first request).
   */
  getUsage(params: {
    scope: RateLimitScope;
    window: Extract<RateLimitUsageV1, unknown>['window'];
  }): Promise<RateLimitUsageV1 | null>;

  /**
   * Record a request against a rate limit scope.
   *
   * Atomically increments the request count and returns the updated usage.
   */
  recordRequest(params: {
    scope: RateLimitScope;
    window: Extract<RateLimitUsageV1, unknown>['window'];
    nowIso: string;
  }): Promise<RateLimitUsageV1>;

  /**
   * Reset usage for a given scope (useful for testing or manual overrides).
   */
  resetUsage(scope: RateLimitScope): Promise<void>;
}

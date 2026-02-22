import type { RateLimitStore } from '../../application/ports/rate-limit-store.js';
import type {
  RateLimitRuleV1,
  RateLimitScope,
  RateLimitUsageV1,
  RateLimitWindow,
} from '../../domain/rate-limiting/index.js';
import {
  computeWindowBoundaries,
  serializeRateLimitScope,
} from '../../domain/rate-limiting/index.js';

/**
 * In-memory implementation of RateLimitStore.
 *
 * Suitable for development, testing, and single-instance deployments.
 * For production multi-instance deployments, use a distributed store (Redis).
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  readonly #rules = new Map<string, RateLimitRuleV1[]>();
  readonly #usage = new Map<string, RateLimitUsageV1>();

  getRulesForScope(scope: RateLimitScope): Promise<readonly RateLimitRuleV1[]> {
    const key = serializeRateLimitScope(scope);
    return Promise.resolve(this.#rules.get(key) ?? []);
  }

  getUsage(params: {
    scope: RateLimitScope;
    window: RateLimitWindow;
  }): Promise<RateLimitUsageV1 | null> {
    const key = this.#serializeUsageKey(params.scope, params.window);
    return Promise.resolve(this.#usage.get(key) ?? null);
  }

  recordRequest(params: {
    scope: RateLimitScope;
    window: RateLimitWindow;
    nowIso: string;
  }): Promise<RateLimitUsageV1> {
    const key = this.#serializeUsageKey(params.scope, params.window);
    const existing = this.#usage.get(key);
    const boundaries = computeWindowBoundaries({ nowIso: params.nowIso, window: params.window });

    // Check if window has reset
    if (existing?.windowStartedAtIso !== boundaries.windowStartedAtIso) {
      const newUsage: RateLimitUsageV1 = {
        scope: params.scope,
        window: params.window,
        requestCount: 1,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      };
      this.#usage.set(key, newUsage);
      return Promise.resolve(newUsage);
    }

    // Increment existing usage
    const updated: RateLimitUsageV1 = {
      ...existing,
      requestCount: existing.requestCount + 1,
    };
    this.#usage.set(key, updated);
    return Promise.resolve(updated);
  }

  resetUsage(scope: RateLimitScope): Promise<void> {
    const prefix = serializeRateLimitScope(scope);
    for (const key of this.#usage.keys()) {
      if (key.startsWith(prefix)) {
        this.#usage.delete(key);
      }
    }
    return Promise.resolve();
  }

  /**
   * Configure rate limit rules for a scope (testing/admin utility).
   */
  setRules(scope: RateLimitScope, rules: RateLimitRuleV1[]): void {
    const key = serializeRateLimitScope(scope);
    this.#rules.set(key, rules);
  }

  /**
   * Clear all rules and usage (testing utility).
   */
  clear(): void {
    this.#rules.clear();
    this.#usage.clear();
  }

  #serializeUsageKey(scope: RateLimitScope, window: RateLimitWindow): string {
    return `${serializeRateLimitScope(scope)}:${window}`;
  }
}

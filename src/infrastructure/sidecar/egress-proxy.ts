/**
 * Egress proxy for the Portarium sidecar.
 *
 * Enforces an allowlist of permitted egress destinations. All outbound
 * requests from the workload must pass through this proxy. Requests to
 * destinations not in the allowlist are rejected.
 *
 * Additionally injects W3C trace-context headers into all proxied requests.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EgressRule = Readonly<{
  /** Host or host:port pattern. Supports trailing wildcard (e.g. *.github.com). */
  hostPattern: string;
  /** Allowed HTTP methods. Empty = all methods. */
  allowedMethods?: readonly string[];
  /** Optional port restriction. Undefined = any port. */
  port?: number;
}>;

export type EgressProxyConfig = Readonly<{
  /** Ordered allowlist rules. First match wins. */
  allowlist: readonly EgressRule[];
  /** Whether to inject traceparent/tracestate into proxied requests. */
  injectTraceContext?: boolean;
}>;

export type EgressCheckResult =
  | Readonly<{ allowed: true; matchedRule: EgressRule }>
  | Readonly<{ allowed: false; reason: string }>;

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function checkEgressAllowed(
  config: EgressProxyConfig,
  request: { host: string; port?: number; method?: string },
): EgressCheckResult {
  const host = request.host.toLowerCase();
  const method = request.method?.toUpperCase();

  for (const rule of config.allowlist) {
    if (!matchesHostPattern(rule.hostPattern, host)) continue;

    if (rule.port !== undefined && request.port !== undefined && request.port !== rule.port) {
      continue;
    }

    if (
      rule.allowedMethods &&
      rule.allowedMethods.length > 0 &&
      method &&
      !rule.allowedMethods.includes(method)
    ) {
      continue;
    }

    return { allowed: true, matchedRule: rule };
  }

  return {
    allowed: false,
    reason: `Egress to ${host}${request.port ? `:${request.port}` : ''} is not in the allowlist.`,
  };
}

/**
 * Given a full list of requested destinations, return which ones are blocked.
 */
export function findBlockedDestinations(
  config: EgressProxyConfig,
  destinations: readonly { host: string; port?: number; method?: string }[],
): readonly { host: string; reason: string }[] {
  const blocked: { host: string; reason: string }[] = [];
  for (const dest of destinations) {
    const result = checkEgressAllowed(config, dest);
    if (!result.allowed) {
      blocked.push({ host: dest.host, reason: result.reason });
    }
  }
  return blocked;
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

function matchesHostPattern(pattern: string, host: string): boolean {
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern === '*') return true;

  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1); // e.g. ".github.com"
    return host === normalizedPattern.slice(2) || host.endsWith(suffix);
  }

  return normalizedPattern === host;
}

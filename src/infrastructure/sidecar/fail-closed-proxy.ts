/**
 * Fail-closed egress proxy wrapper (ADR-0115, bead-0837).
 *
 * Wraps {@link SidecarProxy} with health-aware fail-closed behavior:
 * - When the proxy is degraded or unhealthy, all egress is blocked (503).
 * - Health checks detect upstream/sidecar failures and trigger circuit-open.
 * - Explicit error responses include correlation IDs for debugging.
 * - Recovery is automatic once health checks pass again.
 *
 * Invariant: proxy unavailability NEVER results in direct egress bypass.
 */

import { randomUUID } from 'node:crypto';

import type { EgressAuditSink } from './egress-audit-log.js';
import type { SidecarProxy, ProxiedRequest, ProxiedResponse } from './sidecar-proxy.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Health state of the fail-closed proxy.
 *
 * - 'healthy': proxy is operational, requests are forwarded normally.
 * - 'degraded': proxy is experiencing intermittent failures; requests
 *   are still attempted but monitored for consecutive failures.
 * - 'open': circuit is open — all requests are blocked with 503.
 *   The proxy transitions back to 'half-open' after the recovery window.
 * - 'half-open': a single probe request is allowed through; success
 *   transitions to 'healthy', failure transitions back to 'open'.
 */
export type ProxyHealthState = 'healthy' | 'degraded' | 'open' | 'half-open';

export interface FailClosedConfig {
  /** Number of consecutive failures before circuit opens. Default: 3. */
  failureThreshold: number;
  /** Time in ms before attempting recovery from 'open' state. Default: 30000. */
  recoveryWindowMs: number;
  /** Number of consecutive successes to transition from degraded to healthy. Default: 2. */
  successThreshold: number;
  /** Clock function for testability. */
  now?: () => number;
}

export interface FailClosedStatus {
  healthState: ProxyHealthState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTimestamp: number | undefined;
  circuitOpenedAt: number | undefined;
  totalRequestsBlocked: number;
}

/**
 * Structured error response with correlation ID for explicit error semantics.
 */
export interface EgressErrorEnvelope {
  error: string;
  message: string;
  correlationId: string;
  proxyHealthState: ProxyHealthState;
  timestamp: string;
}

export const DEFAULT_FAIL_CLOSED_CONFIG: FailClosedConfig = {
  failureThreshold: 3,
  recoveryWindowMs: 30_000,
  successThreshold: 2,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class FailClosedProxy {
  readonly #inner: SidecarProxy;
  readonly #config: FailClosedConfig;
  readonly #auditSink: EgressAuditSink | undefined;
  readonly #now: () => number;

  #healthState: ProxyHealthState = 'healthy';
  #consecutiveFailures = 0;
  #consecutiveSuccesses = 0;
  #lastFailureTimestamp: number | undefined;
  #circuitOpenedAt: number | undefined;
  #totalRequestsBlocked = 0;

  public constructor(
    inner: SidecarProxy,
    config?: Partial<FailClosedConfig>,
    auditSink?: EgressAuditSink,
  ) {
    this.#inner = inner;
    this.#config = { ...DEFAULT_FAIL_CLOSED_CONFIG, ...config };
    this.#auditSink = auditSink;
    this.#now = this.#config.now ?? Date.now;
  }

  /** Current health state. */
  public get healthState(): ProxyHealthState {
    return this.#healthState;
  }

  /** Full status snapshot for health endpoints and diagnostics. */
  public status(): FailClosedStatus {
    return {
      healthState: this.#healthState,
      consecutiveFailures: this.#consecutiveFailures,
      consecutiveSuccesses: this.#consecutiveSuccesses,
      lastFailureTimestamp: this.#lastFailureTimestamp,
      circuitOpenedAt: this.#circuitOpenedAt,
      totalRequestsBlocked: this.#totalRequestsBlocked,
    };
  }

  /**
   * Proxy a request through the fail-closed wrapper.
   *
   * When the circuit is open, the request is immediately rejected with 503.
   * When half-open, a single probe is allowed through.
   */
  public async proxy(
    request: ProxiedRequest,
    traceContext?: Readonly<{ traceparent?: string; tracestate?: string }>,
  ): Promise<ProxiedResponse> {
    // Check for circuit state transition (open -> half-open after recovery window).
    this.#maybeTransitionFromOpen();

    if (this.#healthState === 'open') {
      return this.#buildBlockedResponse(request, 'ProxyUnavailable');
    }

    try {
      const response = await this.#inner.proxy(request, traceContext);

      if (isUpstreamFailure(response.status)) {
        this.#recordFailure();
      } else {
        this.#recordSuccess();
      }

      return response;
    } catch {
      this.#recordFailure();
      return this.#buildBlockedResponse(request, 'ProxyInternalError');
    }
  }

  /**
   * Check egress allowlist (delegates to inner proxy).
   * This check is independent of circuit state.
   */
  public checkEgress(targetUrl: string): ReturnType<SidecarProxy['checkEgress']> {
    return this.#inner.checkEgress(targetUrl);
  }

  /** Force the circuit to a specific state (for testing/admin). */
  public forceState(state: ProxyHealthState): void {
    this.#healthState = state;
    if (state === 'open') {
      this.#circuitOpenedAt = this.#now();
    }
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  #recordFailure(): void {
    this.#consecutiveFailures++;
    this.#consecutiveSuccesses = 0;
    this.#lastFailureTimestamp = this.#now();

    if (this.#healthState === 'half-open') {
      // Probe failed — reopen circuit.
      this.#transitionTo('open');
      return;
    }

    if (this.#consecutiveFailures >= this.#config.failureThreshold) {
      this.#transitionTo('open');
    } else if (this.#healthState === 'healthy') {
      this.#transitionTo('degraded');
    }
  }

  #recordSuccess(): void {
    this.#consecutiveSuccesses++;
    this.#consecutiveFailures = 0;

    if (this.#healthState === 'half-open') {
      this.#transitionTo('healthy');
      return;
    }

    if (
      this.#healthState === 'degraded' &&
      this.#consecutiveSuccesses >= this.#config.successThreshold
    ) {
      this.#transitionTo('healthy');
    }
  }

  #transitionTo(newState: ProxyHealthState): void {
    this.#healthState = newState;
    if (newState === 'open') {
      this.#circuitOpenedAt = this.#now();
    }
    if (newState === 'healthy') {
      this.#circuitOpenedAt = undefined;
      this.#consecutiveFailures = 0;
    }
  }

  #maybeTransitionFromOpen(): void {
    if (this.#healthState !== 'open' || !this.#circuitOpenedAt) return;

    const elapsed = this.#now() - this.#circuitOpenedAt;
    if (elapsed >= this.#config.recoveryWindowMs) {
      this.#healthState = 'half-open';
    }
  }

  #buildBlockedResponse(request: ProxiedRequest, errorType: string): ProxiedResponse {
    this.#totalRequestsBlocked++;

    const correlationId = randomUUID();
    const envelope: EgressErrorEnvelope = {
      error: errorType,
      message:
        this.#healthState === 'open'
          ? 'Egress proxy circuit is open — all outbound requests are blocked to prevent bypass.'
          : 'Egress proxy encountered an internal error — request blocked (fail-closed).',
      correlationId,
      proxyHealthState: this.#healthState,
      timestamp: new Date(this.#now()).toISOString(),
    };

    this.#emitBlockedAudit(request, errorType, correlationId);

    return {
      status: 503,
      headers: {
        'content-type': 'application/json',
        'x-portarium-correlation-id': correlationId,
        'retry-after': String(Math.ceil(this.#config.recoveryWindowMs / 1000)),
      },
      body: JSON.stringify(envelope),
    };
  }

  #emitBlockedAudit(request: ProxiedRequest, errorType: string, correlationId: string): void {
    if (!this.#auditSink) return;
    this.#auditSink.emit({
      timestamp: this.#now(),
      enforcementMode: 'enforce',
      policyDecision: 'deny',
      destinationHost: safeHostname(request.url),
      destinationPort: undefined,
      httpMethod: request.method,
      httpPath: safePathname(request.url),
      responseStatus: 503,
      policyReason: `${errorType}: proxy health=${this.#healthState}, correlationId=${correlationId}`,
      latencyMs: 0,
      tenantId: undefined,
      workflowRunId: undefined,
      agentSpiffeId: undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUpstreamFailure(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

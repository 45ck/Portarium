/**
 * Agent side-effect logger -- middleware that tags and logs all outbound
 * HTTP calls from agent processes.
 *
 * Each call is classified as:
 *   - "control-plane-routed" -- sent through the Portarium control plane.
 *   - "direct-sor-call" -- sent directly to a system of record.
 *
 * Emits W3C Trace Context headers (traceparent, tracestate) on every
 * outbound request for distributed tracing.
 *
 * Designed for Migration Phase 1 (Visibility): instrument first,
 * enforce later.
 */

import { randomUUID } from 'node:crypto';

// -- Types -------------------------------------------------------------------

export type CallClassification = 'control-plane-routed' | 'direct-sor-call';

export interface SideEffectLogEntry {
  readonly timestamp: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly method: string;
  readonly url: string;
  readonly classification: CallClassification;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly agentId?: string;
  readonly workspaceId?: string;
}

export interface SideEffectLogSink {
  write(entry: SideEffectLogEntry): void;
}

export interface AgentSideEffectLoggerOptions {
  /** Base URLs of the Portarium control plane (used for classification). */
  controlPlaneBaseUrls: readonly string[];
  /** Optional agent identifier for log entries. */
  agentId?: string;
  /** Optional workspace identifier for log entries. */
  workspaceId?: string;
  /** Log sink (defaults to console JSON). */
  sink?: SideEffectLogSink;
}

// -- Trace ID helpers --------------------------------------------------------

function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export function buildTraceparent(traceId: string, spanId: string): string {
  return `00-${traceId}-${spanId}-01`;
}

// -- Classification ----------------------------------------------------------

export function classifyUrl(
  url: string,
  controlPlaneBaseUrls: readonly string[],
): CallClassification {
  const normalized = url.toLowerCase();
  for (const base of controlPlaneBaseUrls) {
    if (normalized.startsWith(base.toLowerCase())) {
      return 'control-plane-routed';
    }
  }
  return 'direct-sor-call';
}

// -- Default sink ------------------------------------------------------------

export class ConsoleSideEffectLogSink implements SideEffectLogSink {
  write(entry: SideEffectLogEntry): void {
    const line = JSON.stringify({
      level: entry.classification === 'direct-sor-call' ? 'warn' : 'info',
      msg: `${entry.classification}: ${entry.method} ${entry.url}`,
      ...entry,
    });
    console.log(line);
  }
}

// -- Logger middleware -------------------------------------------------------

export class AgentSideEffectLogger {
  readonly #controlPlaneBaseUrls: readonly string[];
  readonly #agentId: string | undefined;
  readonly #workspaceId: string | undefined;
  readonly #sink: SideEffectLogSink;
  readonly #entries: SideEffectLogEntry[] = [];

  public constructor(options: AgentSideEffectLoggerOptions) {
    this.#controlPlaneBaseUrls = options.controlPlaneBaseUrls;
    this.#agentId = options.agentId;
    this.#workspaceId = options.workspaceId;
    this.#sink = options.sink ?? new ConsoleSideEffectLogSink();
  }

  /**
   * Wrap a fetch call to classify, inject trace headers, and log.
   *
   * Use this as a drop-in replacement for `fetch` in agent code:
   *
   *   const response = await logger.instrumentedFetch(url, init);
   */
  public async instrumentedFetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method?.toUpperCase() ?? 'GET';
    const classification = classifyUrl(url, this.#controlPlaneBaseUrls);

    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const traceparent = buildTraceparent(traceId, spanId);

    // Inject W3C Trace Context headers.
    const headers = new Headers(init?.headers);
    if (!headers.has('traceparent')) {
      headers.set('traceparent', traceparent);
    }

    const start = performance.now();
    let statusCode: number | undefined;
    try {
      const response = await fetch(input, { ...init, headers });
      statusCode = response.status;
      return response;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const entry: SideEffectLogEntry = {
        timestamp: new Date().toISOString(),
        traceId,
        spanId,
        method,
        url,
        classification,
        durationMs,
        ...(statusCode !== undefined ? { statusCode } : {}),
        ...(this.#agentId !== undefined ? { agentId: this.#agentId } : {}),
        ...(this.#workspaceId !== undefined ? { workspaceId: this.#workspaceId } : {}),
      };
      this.#entries.push(entry);
      this.#sink.write(entry);
    }
  }

  /** Get all recorded entries (useful for testing and auditing). */
  public getEntries(): readonly SideEffectLogEntry[] {
    return [...this.#entries];
  }

  /** Count entries by classification. */
  public getCounts(): Record<CallClassification, number> {
    let routed = 0;
    let direct = 0;
    for (const entry of this.#entries) {
      if (entry.classification === 'control-plane-routed') routed++;
      else direct++;
    }
    return { 'control-plane-routed': routed, 'direct-sor-call': direct };
  }

  /** Calculate the routing compliance percentage. */
  public getRoutingCompliancePercent(): number {
    const total = this.#entries.length;
    if (total === 0) return 100;
    const routed = this.#entries.filter((e) => e.classification === 'control-plane-routed').length;
    return Math.round((routed / total) * 100);
  }

  /** Reset recorded entries. */
  public reset(): void {
    this.#entries.length = 0;
  }
}

/**
 * Egress observability: structured logging, metrics, trace propagation,
 * and evidence chain linking for gateway and sidecar (ADR-0115).
 *
 * Provides a unified telemetry layer that:
 * 1. Emits structured log records with workspace, run, subject, and correlation IDs.
 * 2. Propagates W3C trace context across agent → gateway → sidecar → connector hops.
 * 3. Tracks Prometheus-compatible metrics: allow/deny counts, latency, errors, cert expiry.
 * 4. Links egress calls to originating action/run via evidence entry descriptors.
 *
 * Bead: bead-0838
 */

import type { EgressAuditRecord } from './egress-audit-log.js';

// ---------------------------------------------------------------------------
// Structured egress log record
// ---------------------------------------------------------------------------

/**
 * Structured log record for egress decisions.
 * Includes all identifiers required for cross-hop correlation.
 */
export type EgressLogRecord = Readonly<{
  level: 'info' | 'warn' | 'error';
  msg: string;
  component: 'sidecar' | 'gateway' | 'connector';
  timestamp: string;
  // Correlation context
  workspaceId: string | undefined;
  runId: string | undefined;
  actionId: string | undefined;
  correlationId: string | undefined;
  subject: string | undefined;
  // Trace context
  traceparent: string | undefined;
  tracestate: string | undefined;
  // Egress details
  destinationHost: string;
  httpMethod: string;
  httpPath: string;
  policyDecision: 'allow' | 'deny';
  responseStatus: number | undefined;
  latencyMs: number;
  // Additional context
  enforcementMode: 'enforce' | 'monitor';
  errorDetail: string | undefined;
  agentSpiffeId: string | undefined;
}>;

/**
 * Sink for structured egress log records.
 */
export interface EgressLogSink {
  write(record: EgressLogRecord): void;
}

// ---------------------------------------------------------------------------
// Egress correlation context
// ---------------------------------------------------------------------------

/**
 * Full correlation context for an egress call, combining identity,
 * trace, and run context from all hops in the call chain.
 */
export type EgressCorrelationContext = Readonly<{
  workspaceId?: string;
  runId?: string;
  actionId?: string;
  correlationId?: string;
  subject?: string;
  traceparent?: string;
  tracestate?: string;
  agentSpiffeId?: string;
}>;

// ---------------------------------------------------------------------------
// Egress metrics
// ---------------------------------------------------------------------------

/**
 * Egress metrics collector.
 * Tracks allow/deny counts, latency, errors, and cert/token expiry.
 */
export interface EgressMetrics {
  /** Increment allow/deny counter. */
  recordDecision(labels: {
    decision: 'allow' | 'deny';
    component: 'sidecar' | 'gateway';
    destinationHost: string;
    enforcementMode: 'enforce' | 'monitor';
  }): void;

  /** Record egress request latency in seconds. */
  recordLatency(
    latencySeconds: number,
    labels: {
      component: 'sidecar' | 'gateway';
      destinationHost: string;
      status: string;
    },
  ): void;

  /** Increment error counter. */
  recordError(labels: {
    component: 'sidecar' | 'gateway' | 'connector';
    errorType: string;
    destinationHost: string;
  }): void;

  /** Record certificate expiry gauge (seconds until expiry). */
  recordCertExpiry(labels: {
    certType: 'svid' | 'token';
    spiffeId: string;
    remainingSeconds: number;
  }): void;
}

// ---------------------------------------------------------------------------
// Evidence entry descriptor
// ---------------------------------------------------------------------------

/**
 * Descriptor for an evidence entry that links an external egress call
 * to the originating action/run. This is used by the orchestration layer
 * to record evidence entries in the Evidence Log.
 */
export type EgressEvidenceDescriptor = Readonly<{
  category: 'Action';
  summary: string;
  correlationId: string | undefined;
  links: {
    runId: string | undefined;
    actionId: string | undefined;
  };
  egressDetail: {
    destinationHost: string;
    httpMethod: string;
    httpPath: string;
    policyDecision: 'allow' | 'deny';
    responseStatus: number | undefined;
    latencyMs: number;
    component: 'sidecar' | 'gateway' | 'connector';
  };
}>;

// ---------------------------------------------------------------------------
// Trace context propagation
// ---------------------------------------------------------------------------

/**
 * Extract trace context headers from an inbound request
 * for propagation to the next hop.
 */
export function extractTraceContext(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): { traceparent: string | undefined; tracestate: string | undefined } {
  return {
    traceparent: normalizeSingleHeader(headers['traceparent']),
    tracestate: normalizeSingleHeader(headers['tracestate']),
  };
}

/**
 * Build outbound headers with trace context, identity, and correlation
 * for propagation across agent → gateway → sidecar → connector hops.
 */
export function buildPropagationHeaders(ctx: EgressCorrelationContext): Record<string, string> {
  const headers: Record<string, string> = {};

  if (ctx.traceparent) headers['traceparent'] = ctx.traceparent;
  if (ctx.tracestate) headers['tracestate'] = ctx.tracestate;
  if (ctx.workspaceId) headers['x-portarium-workspace-id'] = ctx.workspaceId;
  if (ctx.runId) headers['x-portarium-run-id'] = ctx.runId;
  if (ctx.actionId) headers['x-portarium-action-id'] = ctx.actionId;
  if (ctx.correlationId) headers['x-correlation-id'] = ctx.correlationId;
  if (ctx.subject) headers['x-portarium-subject'] = ctx.subject;
  if (ctx.agentSpiffeId) headers['x-portarium-agent-spiffe-id'] = ctx.agentSpiffeId;

  return headers;
}

/**
 * Extract correlation context from inbound headers.
 * Used by downstream hops (gateway, sidecar, connector) to reconstruct
 * the full correlation context from upstream propagation headers.
 */
export function extractCorrelationContext(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): EgressCorrelationContext {
  const ctx: Record<string, string> = {};

  const mappings: [string, string][] = [
    ['x-portarium-workspace-id', 'workspaceId'],
    ['x-portarium-run-id', 'runId'],
    ['x-portarium-action-id', 'actionId'],
    ['x-correlation-id', 'correlationId'],
    ['x-portarium-subject', 'subject'],
    ['traceparent', 'traceparent'],
    ['tracestate', 'tracestate'],
    ['x-portarium-agent-spiffe-id', 'agentSpiffeId'],
  ];

  for (const [header, key] of mappings) {
    const value = normalizeSingleHeader(headers[header]);
    if (value) ctx[key] = value;
  }

  return ctx as EgressCorrelationContext;
}

// ---------------------------------------------------------------------------
// Audit record → structured log + metrics + evidence
// ---------------------------------------------------------------------------

/**
 * Convert an EgressAuditRecord into a structured log record,
 * enriched with correlation context.
 */
export function auditToLogRecord(
  audit: EgressAuditRecord,
  ctx: EgressCorrelationContext,
  component: 'sidecar' | 'gateway' | 'connector',
): EgressLogRecord {
  const level =
    audit.policyDecision === 'deny'
      ? 'warn'
      : audit.responseStatus && audit.responseStatus >= 500
        ? 'error'
        : 'info';

  const msg =
    audit.policyDecision === 'deny'
      ? `Egress denied: ${audit.destinationHost} (${audit.policyReason ?? 'no reason'})`
      : `Egress allowed: ${audit.httpMethod} ${audit.destinationHost}${audit.httpPath} → ${audit.responseStatus ?? 'pending'}`;

  return {
    level,
    msg,
    component,
    timestamp: new Date(audit.timestamp).toISOString(),
    workspaceId: ctx.workspaceId ?? audit.tenantId,
    runId: ctx.runId ?? audit.workflowRunId,
    actionId: ctx.actionId,
    correlationId: ctx.correlationId,
    subject: ctx.subject,
    traceparent: ctx.traceparent,
    tracestate: ctx.tracestate,
    destinationHost: audit.destinationHost,
    httpMethod: audit.httpMethod,
    httpPath: audit.httpPath,
    policyDecision: audit.policyDecision,
    responseStatus: audit.responseStatus,
    latencyMs: audit.latencyMs,
    enforcementMode: audit.enforcementMode,
    errorDetail: audit.policyReason,
    agentSpiffeId: ctx.agentSpiffeId ?? audit.agentSpiffeId,
  };
}

/**
 * Emit metrics from an EgressAuditRecord.
 */
export function auditToMetrics(
  audit: EgressAuditRecord,
  metrics: EgressMetrics,
  component: 'sidecar' | 'gateway',
): void {
  metrics.recordDecision({
    decision: audit.policyDecision,
    component,
    destinationHost: audit.destinationHost,
    enforcementMode: audit.enforcementMode,
  });

  metrics.recordLatency(audit.latencyMs / 1000, {
    component,
    destinationHost: audit.destinationHost,
    status: String(audit.responseStatus ?? 'none'),
  });

  if (audit.responseStatus && audit.responseStatus >= 500) {
    metrics.recordError({
      component,
      errorType: `http_${audit.responseStatus}`,
      destinationHost: audit.destinationHost,
    });
  }
}

/**
 * Build an evidence descriptor from an EgressAuditRecord,
 * linking the external call to the originating action/run.
 */
export function auditToEvidenceDescriptor(
  audit: EgressAuditRecord,
  ctx: EgressCorrelationContext,
  component: 'sidecar' | 'gateway' | 'connector',
): EgressEvidenceDescriptor {
  const verb = audit.policyDecision === 'allow' ? 'completed' : 'denied';
  const status = audit.responseStatus ? ` (HTTP ${audit.responseStatus})` : '';

  return {
    category: 'Action',
    summary: `Egress ${verb}: ${audit.httpMethod} ${audit.destinationHost}${audit.httpPath}${status}`,
    correlationId: ctx.correlationId,
    links: {
      runId: ctx.runId ?? audit.workflowRunId,
      actionId: ctx.actionId,
    },
    egressDetail: {
      destinationHost: audit.destinationHost,
      httpMethod: audit.httpMethod,
      httpPath: audit.httpPath,
      policyDecision: audit.policyDecision,
      responseStatus: audit.responseStatus,
      latencyMs: audit.latencyMs,
      component,
    },
  };
}

// ---------------------------------------------------------------------------
// Observable audit sink (combines logging + metrics + evidence)
// ---------------------------------------------------------------------------

/**
 * An EgressAuditSink implementation that emits structured logs,
 * metrics, and evidence descriptors from audit records.
 */
export class ObservableEgressAuditSink {
  readonly #logSink: EgressLogSink | undefined;
  readonly #metrics: EgressMetrics | undefined;
  readonly #evidenceCollector: ((descriptor: EgressEvidenceDescriptor) => void) | undefined;
  readonly #component: 'sidecar' | 'gateway' | 'connector';
  #correlationContext: EgressCorrelationContext = {};

  public constructor(options: {
    component: 'sidecar' | 'gateway' | 'connector';
    logSink?: EgressLogSink;
    metrics?: EgressMetrics;
    evidenceCollector?: (descriptor: EgressEvidenceDescriptor) => void;
  }) {
    this.#component = options.component;
    this.#logSink = options.logSink;
    this.#metrics = options.metrics;
    this.#evidenceCollector = options.evidenceCollector;
  }

  public setCorrelationContext(ctx: EgressCorrelationContext): void {
    this.#correlationContext = ctx;
  }

  public emit(record: EgressAuditRecord): void {
    if (this.#logSink) {
      this.#logSink.write(auditToLogRecord(record, this.#correlationContext, this.#component));
    }

    if (this.#metrics && (this.#component === 'sidecar' || this.#component === 'gateway')) {
      auditToMetrics(record, this.#metrics, this.#component);
    }

    if (this.#evidenceCollector) {
      this.#evidenceCollector(
        auditToEvidenceDescriptor(record, this.#correlationContext, this.#component),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSingleHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

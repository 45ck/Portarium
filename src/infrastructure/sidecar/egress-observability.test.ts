/**
 * Tests for egress observability: structured logging, metrics, trace propagation,
 * and evidence chain linking (bead-0838).
 *
 * Acceptance criteria:
 * - AC1: Structured logs include workspace, run, subject, and correlation identifiers.
 * - AC2: Trace context is propagated across agent, gateway, sidecar, and connector hops.
 * - AC3: Metrics cover allow/deny counts, latency, errors, and token/cert expiry.
 * - AC4: Evidence entries can link external calls to the originating action/run.
 */

import { describe, expect, it, vi } from 'vitest';

import type { EgressAuditRecord } from './egress-audit-log.js';
import {
  auditToEvidenceDescriptor,
  auditToLogRecord,
  auditToMetrics,
  buildPropagationHeaders,
  extractCorrelationContext,
  extractTraceContext,
  ObservableEgressAuditSink,
  type EgressCorrelationContext,
  type EgressLogRecord,
  type EgressLogSink,
  type EgressMetrics,
} from './egress-observability.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXED_TS = 1709373600000; // 2024-03-02T10:00:00.000Z

function makeAuditRecord(overrides?: Partial<EgressAuditRecord>): EgressAuditRecord {
  return {
    timestamp: FIXED_TS,
    enforcementMode: 'enforce',
    policyDecision: 'allow',
    destinationHost: 'api.example.com',
    destinationPort: 443,
    httpMethod: 'POST',
    httpPath: '/v1/data',
    responseStatus: 200,
    policyReason: undefined,
    latencyMs: 45,
    tenantId: 'tenant-obs-001',
    workflowRunId: 'run-obs-001',
    agentSpiffeId: 'spiffe://portarium/agent/scanner',
    ...overrides,
  };
}

function makeContext(overrides?: Partial<EgressCorrelationContext>): EgressCorrelationContext {
  return {
    workspaceId: 'ws-obs-001',
    runId: 'run-obs-001',
    actionId: 'action-obs-001',
    correlationId: 'corr-obs-001',
    subject: 'user-operator',
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    tracestate: 'portarium=obs-test',
    agentSpiffeId: 'spiffe://portarium/agent/scanner',
    ...overrides,
  };
}

function makeMetrics(): EgressMetrics & {
  decisions: unknown[];
  latencies: unknown[];
  errors: unknown[];
  certExpiries: unknown[];
} {
  const decisions: unknown[] = [];
  const latencies: unknown[] = [];
  const errors: unknown[] = [];
  const certExpiries: unknown[] = [];
  return {
    decisions,
    latencies,
    errors,
    certExpiries,
    recordDecision: vi.fn((labels) => decisions.push(labels)),
    recordLatency: vi.fn((value, labels) => latencies.push({ value, ...labels })),
    recordError: vi.fn((labels) => errors.push(labels)),
    recordCertExpiry: vi.fn((labels) => certExpiries.push(labels)),
  };
}

// ---------------------------------------------------------------------------
// AC1: Structured logs include workspace, run, subject, and correlation IDs
// ---------------------------------------------------------------------------

describe('AC1: Structured egress log records', () => {
  it('allowed egress produces info-level log with all correlation identifiers', () => {
    const audit = makeAuditRecord();
    const ctx = makeContext();

    const log = auditToLogRecord(audit, ctx, 'sidecar');

    expect(log.level).toBe('info');
    expect(log.component).toBe('sidecar');
    expect(log.workspaceId).toBe('ws-obs-001');
    expect(log.runId).toBe('run-obs-001');
    expect(log.actionId).toBe('action-obs-001');
    expect(log.correlationId).toBe('corr-obs-001');
    expect(log.subject).toBe('user-operator');
    expect(log.agentSpiffeId).toBe('spiffe://portarium/agent/scanner');
    expect(log.msg).toContain('Egress allowed');
    expect(log.msg).toContain('api.example.com');
  });

  it('denied egress produces warn-level log with policy reason', () => {
    const audit = makeAuditRecord({
      policyDecision: 'deny',
      policyReason: 'Host "evil.com" not in egress allowlist',
      responseStatus: undefined,
      destinationHost: 'evil.com',
    });
    const ctx = makeContext();

    const log = auditToLogRecord(audit, ctx, 'sidecar');

    expect(log.level).toBe('warn');
    expect(log.policyDecision).toBe('deny');
    expect(log.msg).toContain('Egress denied');
    expect(log.msg).toContain('evil.com');
    expect(log.errorDetail).toContain('not in egress allowlist');
  });

  it('upstream 500 error produces error-level log', () => {
    const audit = makeAuditRecord({ responseStatus: 502 });
    const ctx = makeContext();

    const log = auditToLogRecord(audit, ctx, 'gateway');

    expect(log.level).toBe('error');
    expect(log.component).toBe('gateway');
    expect(log.responseStatus).toBe(502);
  });

  it('falls back to audit record tenantId/runId when context is empty', () => {
    const audit = makeAuditRecord({
      tenantId: 'tenant-fallback',
      workflowRunId: 'run-fallback',
    });
    const emptyCtx: EgressCorrelationContext = {};

    const log = auditToLogRecord(audit, emptyCtx, 'connector');

    expect(log.workspaceId).toBe('tenant-fallback');
    expect(log.runId).toBe('run-fallback');
  });

  it('log record contains ISO timestamp', () => {
    const audit = makeAuditRecord();
    const ctx = makeContext();

    const log = auditToLogRecord(audit, ctx, 'sidecar');

    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('ObservableEgressAuditSink writes structured log when logSink is provided', () => {
    const records: EgressLogRecord[] = [];
    const logSink: EgressLogSink = { write: (r) => records.push(r) };

    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      logSink,
    });
    sink.setCorrelationContext(makeContext());
    sink.emit(makeAuditRecord());

    expect(records).toHaveLength(1);
    expect(records[0]!.workspaceId).toBe('ws-obs-001');
    expect(records[0]!.correlationId).toBe('corr-obs-001');
  });
});

// ---------------------------------------------------------------------------
// AC2: Trace context propagation across hops
// ---------------------------------------------------------------------------

describe('AC2: Trace context propagation', () => {
  it('extractTraceContext extracts traceparent and tracestate from headers', () => {
    const headers = {
      traceparent: '00-aabbccdd11223344aabbccdd11223344-1122334455667788-01',
      tracestate: 'portarium=abc',
    };

    const trace = extractTraceContext(headers);

    expect(trace.traceparent).toBe('00-aabbccdd11223344aabbccdd11223344-1122334455667788-01');
    expect(trace.tracestate).toBe('portarium=abc');
  });

  it('extractTraceContext handles array headers (first value)', () => {
    const headers = {
      traceparent: ['00-first-trace-id-1122334455667788-01', '00-second-trace-id-00'],
      tracestate: ['portarium=first'],
    };

    const trace = extractTraceContext(headers);

    expect(trace.traceparent).toBe('00-first-trace-id-1122334455667788-01');
    expect(trace.tracestate).toBe('portarium=first');
  });

  it('extractTraceContext returns undefined for missing headers', () => {
    const trace = extractTraceContext({});

    expect(trace.traceparent).toBeUndefined();
    expect(trace.tracestate).toBeUndefined();
  });

  it('buildPropagationHeaders includes trace and correlation context', () => {
    const ctx = makeContext();

    const headers = buildPropagationHeaders(ctx);

    expect(headers['traceparent']).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(headers['tracestate']).toBe('portarium=obs-test');
    expect(headers['x-portarium-workspace-id']).toBe('ws-obs-001');
    expect(headers['x-portarium-run-id']).toBe('run-obs-001');
    expect(headers['x-portarium-action-id']).toBe('action-obs-001');
    expect(headers['x-correlation-id']).toBe('corr-obs-001');
    expect(headers['x-portarium-subject']).toBe('user-operator');
    expect(headers['x-portarium-agent-spiffe-id']).toBe('spiffe://portarium/agent/scanner');
  });

  it('buildPropagationHeaders omits undefined fields', () => {
    const ctx: EgressCorrelationContext = { workspaceId: 'ws-only' };

    const headers = buildPropagationHeaders(ctx);

    expect(headers['x-portarium-workspace-id']).toBe('ws-only');
    expect(headers['traceparent']).toBeUndefined();
    expect(headers['x-portarium-run-id']).toBeUndefined();
  });

  it('extractCorrelationContext round-trips with buildPropagationHeaders', () => {
    const original = makeContext();

    const headers = buildPropagationHeaders(original);
    const extracted = extractCorrelationContext(headers);

    expect(extracted.workspaceId).toBe(original.workspaceId);
    expect(extracted.runId).toBe(original.runId);
    expect(extracted.actionId).toBe(original.actionId);
    expect(extracted.correlationId).toBe(original.correlationId);
    expect(extracted.subject).toBe(original.subject);
    expect(extracted.traceparent).toBe(original.traceparent);
    expect(extracted.tracestate).toBe(original.tracestate);
    expect(extracted.agentSpiffeId).toBe(original.agentSpiffeId);
  });

  it('log record carries traceparent and tracestate for cross-hop correlation', () => {
    const audit = makeAuditRecord();
    const ctx = makeContext();

    const log = auditToLogRecord(audit, ctx, 'sidecar');

    expect(log.traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(log.tracestate).toBe('portarium=obs-test');
  });
});

// ---------------------------------------------------------------------------
// AC3: Metrics cover allow/deny counts, latency, errors, cert expiry
// ---------------------------------------------------------------------------

describe('AC3: Egress metrics', () => {
  it('auditToMetrics records allow decision and latency', () => {
    const metrics = makeMetrics();
    const audit = makeAuditRecord({ policyDecision: 'allow', latencyMs: 45, responseStatus: 200 });

    auditToMetrics(audit, metrics, 'sidecar');

    expect(metrics.decisions).toHaveLength(1);
    expect(metrics.decisions[0]).toEqual({
      decision: 'allow',
      component: 'sidecar',
      destinationHost: 'api.example.com',
      enforcementMode: 'enforce',
    });

    expect(metrics.latencies).toHaveLength(1);
    expect(metrics.latencies[0]).toMatchObject({
      value: 0.045,
      component: 'sidecar',
      status: '200',
    });
  });

  it('auditToMetrics records deny decision', () => {
    const metrics = makeMetrics();
    const audit = makeAuditRecord({ policyDecision: 'deny', responseStatus: undefined });

    auditToMetrics(audit, metrics, 'gateway');

    expect(metrics.decisions[0]).toMatchObject({
      decision: 'deny',
      component: 'gateway',
    });
  });

  it('auditToMetrics records error for 5xx responses', () => {
    const metrics = makeMetrics();
    const audit = makeAuditRecord({ responseStatus: 502 });

    auditToMetrics(audit, metrics, 'sidecar');

    expect(metrics.errors).toHaveLength(1);
    expect(metrics.errors[0]).toMatchObject({
      component: 'sidecar',
      errorType: 'http_502',
      destinationHost: 'api.example.com',
    });
  });

  it('auditToMetrics does not record error for 2xx/4xx responses', () => {
    const metrics = makeMetrics();

    auditToMetrics(makeAuditRecord({ responseStatus: 200 }), metrics, 'sidecar');
    auditToMetrics(makeAuditRecord({ responseStatus: 404 }), metrics, 'sidecar');

    expect(metrics.errors).toHaveLength(0);
  });

  it('metrics recordCertExpiry tracks certificate expiry gauge', () => {
    const metrics = makeMetrics();

    metrics.recordCertExpiry({
      certType: 'svid',
      spiffeId: 'spiffe://portarium/agent/scanner',
      remainingSeconds: 240,
    });

    expect(metrics.certExpiries).toHaveLength(1);
    expect(metrics.certExpiries[0]).toMatchObject({
      certType: 'svid',
      remainingSeconds: 240,
    });
  });

  it('metrics recordCertExpiry tracks token expiry', () => {
    const metrics = makeMetrics();

    metrics.recordCertExpiry({
      certType: 'token',
      spiffeId: 'n/a',
      remainingSeconds: 3600,
    });

    expect(metrics.certExpiries).toHaveLength(1);
    expect(metrics.certExpiries[0]).toMatchObject({
      certType: 'token',
      remainingSeconds: 3600,
    });
  });

  it('ObservableEgressAuditSink emits metrics when metrics collector is provided', () => {
    const metrics = makeMetrics();
    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      metrics,
    });
    sink.setCorrelationContext(makeContext());

    sink.emit(makeAuditRecord());

    expect(metrics.decisions).toHaveLength(1);
    expect(metrics.latencies).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC4: Evidence entries link external calls to originating action/run
// ---------------------------------------------------------------------------

describe('AC4: Evidence entries link to action/run', () => {
  it('allowed egress produces evidence descriptor with run and action links', () => {
    const audit = makeAuditRecord({ policyDecision: 'allow', responseStatus: 200 });
    const ctx = makeContext();

    const evidence = auditToEvidenceDescriptor(audit, ctx, 'sidecar');

    expect(evidence.category).toBe('Action');
    expect(evidence.summary).toContain('Egress completed');
    expect(evidence.summary).toContain('POST');
    expect(evidence.summary).toContain('api.example.com');
    expect(evidence.summary).toContain('HTTP 200');
    expect(evidence.correlationId).toBe('corr-obs-001');
    expect(evidence.links.runId).toBe('run-obs-001');
    expect(evidence.links.actionId).toBe('action-obs-001');
    expect(evidence.egressDetail.component).toBe('sidecar');
    expect(evidence.egressDetail.latencyMs).toBe(45);
  });

  it('denied egress produces evidence descriptor with denial summary', () => {
    const audit = makeAuditRecord({
      policyDecision: 'deny',
      destinationHost: 'blocked.com',
      responseStatus: undefined,
    });
    const ctx = makeContext();

    const evidence = auditToEvidenceDescriptor(audit, ctx, 'gateway');

    expect(evidence.summary).toContain('Egress denied');
    expect(evidence.summary).toContain('blocked.com');
    expect(evidence.egressDetail.policyDecision).toBe('deny');
    expect(evidence.egressDetail.component).toBe('gateway');
  });

  it('evidence descriptor falls back to audit workflowRunId when context has no runId', () => {
    const audit = makeAuditRecord({ workflowRunId: 'run-from-audit' });
    const ctx: EgressCorrelationContext = { correlationId: 'corr-only' };

    const evidence = auditToEvidenceDescriptor(audit, ctx, 'connector');

    expect(evidence.links.runId).toBe('run-from-audit');
    expect(evidence.correlationId).toBe('corr-only');
  });

  it('ObservableEgressAuditSink collects evidence descriptors', () => {
    const collected: unknown[] = [];
    const sink = new ObservableEgressAuditSink({
      component: 'gateway',
      evidenceCollector: (d) => collected.push(d),
    });
    sink.setCorrelationContext(makeContext());

    sink.emit(makeAuditRecord());

    expect(collected).toHaveLength(1);
    const desc = collected[0] as Record<string, unknown>;
    expect(desc['category']).toBe('Action');
    expect((desc['links'] as Record<string, unknown>)['runId']).toBe('run-obs-001');
  });

  it('multiple egress calls produce separate evidence descriptors', () => {
    const collected: unknown[] = [];
    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      evidenceCollector: (d) => collected.push(d),
    });
    sink.setCorrelationContext(makeContext());

    sink.emit(makeAuditRecord({ destinationHost: 'service-a.com' }));
    sink.emit(makeAuditRecord({ destinationHost: 'service-b.com', policyDecision: 'deny' }));
    sink.emit(makeAuditRecord({ destinationHost: 'service-c.com', responseStatus: 500 }));

    expect(collected).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Integration: ObservableEgressAuditSink combines all three concerns
// ---------------------------------------------------------------------------

describe('ObservableEgressAuditSink: integrated observability', () => {
  it('single emit produces log, metrics, and evidence simultaneously', () => {
    const logs: EgressLogRecord[] = [];
    const metrics = makeMetrics();
    const evidence: unknown[] = [];

    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      logSink: { write: (r) => logs.push(r) },
      metrics,
      evidenceCollector: (d) => evidence.push(d),
    });
    sink.setCorrelationContext(makeContext());

    sink.emit(makeAuditRecord());

    // All three outputs produced
    expect(logs).toHaveLength(1);
    expect(metrics.decisions).toHaveLength(1);
    expect(evidence).toHaveLength(1);

    // All share the same correlation context
    expect(logs[0]!.correlationId).toBe('corr-obs-001');
    expect((evidence[0] as Record<string, unknown>)['correlationId']).toBe('corr-obs-001');
  });

  it('works with no sinks configured (no-op)', () => {
    const sink = new ObservableEgressAuditSink({ component: 'connector' });

    // Should not throw
    sink.emit(makeAuditRecord());
  });

  it('correlation context can be updated between emits', () => {
    const logs: EgressLogRecord[] = [];
    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      logSink: { write: (r) => logs.push(r) },
    });

    sink.setCorrelationContext({ runId: 'run-1', correlationId: 'corr-1' });
    sink.emit(makeAuditRecord());

    sink.setCorrelationContext({ runId: 'run-2', correlationId: 'corr-2' });
    sink.emit(makeAuditRecord());

    expect(logs[0]!.runId).toBe('run-1');
    expect(logs[0]!.correlationId).toBe('corr-1');
    expect(logs[1]!.runId).toBe('run-2');
    expect(logs[1]!.correlationId).toBe('corr-2');
  });
});

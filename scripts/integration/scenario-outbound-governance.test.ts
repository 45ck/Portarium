/**
 * Scenario: Outbound-governance invariants — bypass and policy tests.
 *
 * Proves that only policy-governed outbound access is possible by exercising
 * the full sidecar proxy stack (SidecarProxy + FailClosedProxy +
 * ObservableEgressAuditSink) in an integration-style test.
 *
 * Acceptance criteria:
 * AC1: Allowed destination calls succeed via gateway/sidecar path.
 * AC2: Direct egress attempts are blocked and auditable.
 * AC3: Threat scenarios — metadata endpoint access and raw socket-style bypass.
 * AC4: CI gate fails when bypass or missing audit fields are detected.
 *
 * Bead: bead-0839
 */

import { describe, expect, it, vi } from 'vitest';

import {
  SidecarProxy,
  type ProxiedRequest,
} from '../../src/infrastructure/sidecar/sidecar-proxy.js';
import type { SidecarConfigV1 } from '../../src/infrastructure/sidecar/sidecar-config-v1.js';
import type {
  EgressAuditRecord,
  EgressAuditSink,
} from '../../src/infrastructure/sidecar/egress-audit-log.js';
import { FailClosedProxy } from '../../src/infrastructure/sidecar/fail-closed-proxy.js';
import {
  ObservableEgressAuditSink,
  auditToLogRecord,
  auditToMetrics,
  auditToEvidenceDescriptor,
  extractTraceContext,
  buildPropagationHeaders,
  extractCorrelationContext,
  type EgressLogRecord,
  type EgressLogSink,
  type EgressMetrics,
  type EgressEvidenceDescriptor,
  type EgressCorrelationContext,
} from '../../src/infrastructure/sidecar/egress-observability.js';
import {
  buildIdentityHeaders,
  extractIdentityFromHeaders,
  type IdentityPropagationContext,
} from '../../src/infrastructure/identity/identity-propagation-context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<SidecarConfigV1> = {}): SidecarConfigV1 {
  return {
    upstreamUrl: 'http://localhost:3000',
    egressAllowlist: ['api.example.com', '*.internal.io'],
    tokenRefreshIntervalMs: 300_000,
    listenPort: 15001,
    enforcementMode: 'enforce',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ProxiedRequest> = {}): ProxiedRequest {
  return {
    method: 'GET',
    url: 'https://api.example.com/v1/data',
    headers: {},
    ...overrides,
  };
}

function makeAuditSink(): EgressAuditSink & { records: EgressAuditRecord[] } {
  const records: EgressAuditRecord[] = [];
  return { records, emit: (r) => records.push(r) };
}

function makeLogSink(): EgressLogSink & { logs: EgressLogRecord[] } {
  const logs: EgressLogRecord[] = [];
  return { logs, write: (r) => logs.push(r) };
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
    recordDecision: (labels) => decisions.push(labels),
    recordLatency: (latencySeconds, labels) => latencies.push({ latencySeconds, ...labels }),
    recordError: (labels) => errors.push(labels),
    recordCertExpiry: (labels) => certExpiries.push(labels),
  };
}

function successFetch(): typeof fetch {
  return vi.fn<typeof fetch>(
    async () =>
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

function failFetch(): typeof fetch {
  return vi.fn<typeof fetch>(async () => {
    throw new Error('connection refused');
  });
}

// Required audit fields per ADR-0115.
const REQUIRED_AUDIT_FIELDS: (keyof EgressAuditRecord)[] = [
  'timestamp',
  'enforcementMode',
  'policyDecision',
  'destinationHost',
  'httpMethod',
  'httpPath',
  'latencyMs',
];

// ---------------------------------------------------------------------------
// AC1: Allowed destination calls succeed via gateway/sidecar path
// ---------------------------------------------------------------------------

describe('AC1: Allowed destination calls succeed via governed path', () => {
  it('allows exact-match host through sidecar with audit record', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);
    proxy.setToken('bearer-token');
    proxy.setIdentity({
      tenantId: 'tenant-gov',
      workflowRunId: 'run-gov-001',
      agentSpiffeId: 'spiffe://portarium.io/ns/agents/sa/gov-agent/tenant/tenant-gov',
    });

    const result = await proxy.proxy(
      makeRequest({ method: 'POST', url: 'https://api.example.com/v1/data' }),
      { traceparent: '00-aabbccdd-11223344-01' },
    );

    expect(result.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]!.policyDecision).toBe('allow');
    expect(sink.records[0]!.destinationHost).toBe('api.example.com');
    expect(sink.records[0]!.tenantId).toBe('tenant-gov');
  });

  it('allows wildcard-match host through sidecar', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);

    const result = await proxy.proxy(makeRequest({ url: 'https://svc.internal.io/api/health' }));

    expect(result.status).toBe(200);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]!.policyDecision).toBe('allow');
  });

  it('injects identity and trace headers on governed path', async () => {
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl);
    proxy.setToken('gov-token');
    proxy.setIdentity({
      tenantId: 'tenant-id-123',
      workflowRunId: 'run-456',
      agentSpiffeId: 'spiffe://portarium.io/test',
    });

    await proxy.proxy(makeRequest(), {
      traceparent: '00-traceid-spanid-01',
      tracestate: 'portarium=v1',
    });

    const headers = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers['authorization']).toBe('Bearer gov-token');
    expect(headers['x-portarium-tenant-id']).toBe('tenant-id-123');
    expect(headers['x-portarium-workflow-run-id']).toBe('run-456');
    expect(headers['x-portarium-agent-spiffe-id']).toBe('spiffe://portarium.io/test');
    expect(headers['traceparent']).toBe('00-traceid-spanid-01');
    expect(headers['tracestate']).toBe('portarium=v1');
  });

  it('FailClosedProxy delegates to sidecar when healthy', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const inner = new SidecarProxy(makeConfig(), fetchImpl, sink);
    const proxy = new FailClosedProxy(inner);

    const result = await proxy.proxy(makeRequest());

    expect(result.status).toBe(200);
    expect(proxy.healthState).toBe('healthy');
  });

  it('ObservableEgressAuditSink emits log, metrics, and evidence for allowed call', () => {
    const logSink = makeLogSink();
    const metrics = makeMetrics();
    const evidence: EgressEvidenceDescriptor[] = [];
    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      logSink,
      metrics,
      evidenceCollector: (d) => evidence.push(d),
    });
    sink.setCorrelationContext({
      workspaceId: 'ws-1',
      runId: 'run-1',
      correlationId: 'corr-1',
    });

    const audit: EgressAuditRecord = {
      timestamp: Date.now(),
      enforcementMode: 'enforce',
      policyDecision: 'allow',
      destinationHost: 'api.example.com',
      destinationPort: 443,
      httpMethod: 'GET',
      httpPath: '/v1/data',
      responseStatus: 200,
      policyReason: undefined,
      latencyMs: 42,
      tenantId: 'ws-1',
      workflowRunId: 'run-1',
      agentSpiffeId: undefined,
    };
    sink.emit(audit);

    expect(logSink.logs).toHaveLength(1);
    expect(logSink.logs[0]!.policyDecision).toBe('allow');
    expect(logSink.logs[0]!.workspaceId).toBe('ws-1');
    expect(metrics.decisions).toHaveLength(1);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.links.runId).toBe('run-1');
  });
});

// ---------------------------------------------------------------------------
// AC2: Direct egress attempts are blocked and auditable
// ---------------------------------------------------------------------------

describe('AC2: Direct egress attempts are blocked and auditable', () => {
  it('denies non-allowlisted host with 403 and audit record', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);

    const result = await proxy.proxy(makeRequest({ url: 'https://evil.example.org/exfiltrate' }));

    expect(result.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
    const body = JSON.parse(result.body) as { error: string };
    expect(body.error).toBe('EgressDenied');

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]!.policyDecision).toBe('deny');
    expect(sink.records[0]!.destinationHost).toBe('evil.example.org');
    expect(sink.records[0]!.responseStatus).toBe(403);
  });

  it('denies when allowlist is empty (default-deny)', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig({ egressAllowlist: [] }), fetchImpl, sink);

    const result = await proxy.proxy(makeRequest());

    expect(result.status).toBe(403);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]!.policyDecision).toBe('deny');
    expect(sink.records[0]!.policyReason).toContain('default-deny');
  });

  it('audit record for denied request includes all required fields', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);
    proxy.setIdentity({
      tenantId: 'tenant-audit',
      workflowRunId: 'run-audit',
      agentSpiffeId: 'spiffe://portarium.io/test-audit',
    });

    await proxy.proxy(makeRequest({ method: 'POST', url: 'https://blocked.host/path' }));

    expect(sink.records).toHaveLength(1);
    const record = sink.records[0]!;

    for (const field of REQUIRED_AUDIT_FIELDS) {
      expect(record[field], `audit record missing required field: ${field}`).toBeDefined();
    }
    expect(record.tenantId).toBe('tenant-audit');
    expect(record.workflowRunId).toBe('run-audit');
    expect(record.agentSpiffeId).toContain('spiffe://');
  });

  it('FailClosedProxy blocks all egress when circuit is open', async () => {
    const inner = new SidecarProxy(makeConfig(), successFetch());
    const proxy = new FailClosedProxy(inner);
    proxy.forceState('open');

    const result = await proxy.proxy(makeRequest());

    expect(result.status).toBe(503);
    const body = JSON.parse(result.body) as { error: string };
    expect(body.error).toBe('ProxyUnavailable');
    expect(proxy.status().totalRequestsBlocked).toBe(1);
  });

  it('denied egress produces evidence descriptor linking to run', () => {
    const audit: EgressAuditRecord = {
      timestamp: Date.now(),
      enforcementMode: 'enforce',
      policyDecision: 'deny',
      destinationHost: 'blocked.host',
      destinationPort: 443,
      httpMethod: 'POST',
      httpPath: '/secret',
      responseStatus: 403,
      policyReason: 'Host "blocked.host" not in egress allowlist',
      latencyMs: 1,
      tenantId: 'tenant-ev',
      workflowRunId: 'run-ev',
      agentSpiffeId: undefined,
    };
    const ctx: EgressCorrelationContext = {
      runId: 'run-ev',
      actionId: 'action-ev',
      correlationId: 'corr-ev',
    };

    const descriptor = auditToEvidenceDescriptor(audit, ctx, 'sidecar');

    expect(descriptor.category).toBe('Action');
    expect(descriptor.summary).toContain('denied');
    expect(descriptor.links.runId).toBe('run-ev');
    expect(descriptor.links.actionId).toBe('action-ev');
    expect(descriptor.correlationId).toBe('corr-ev');
    expect(descriptor.egressDetail.policyDecision).toBe('deny');
  });
});

// ---------------------------------------------------------------------------
// AC3: Threat scenarios — metadata endpoint and bypass attempts
// ---------------------------------------------------------------------------

describe('AC3: Threat scenarios — metadata endpoint and bypass attempts', () => {
  it('blocks cloud metadata endpoint 169.254.169.254', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(
      makeRequest({ url: 'http://169.254.169.254/latest/meta-data/' }),
    );

    expect(result.status).toBe(403);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]!.policyDecision).toBe('deny');
    expect(sink.records[0]!.destinationHost).toBe('169.254.169.254');
  });

  it('blocks GCP metadata endpoint metadata.google.internal', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(
      makeRequest({ url: 'http://metadata.google.internal/computeMetadata/v1/' }),
    );

    expect(result.status).toBe(403);
    expect(sink.records[0]!.destinationHost).toBe('metadata.google.internal');
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks Azure IMDS endpoint 169.254.169.254 with Metadata header', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(
      makeRequest({
        url: 'http://169.254.169.254/metadata/instance?api-version=2021-02-01',
        headers: { Metadata: 'true' },
      }),
    );

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks link-local addresses (169.254.x.x)', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(makeRequest({ url: 'http://169.254.1.1/probe' }));

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks localhost bypass attempt', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(makeRequest({ url: 'http://localhost:8080/admin' }));

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks 127.0.0.1 loopback bypass', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(makeRequest({ url: 'http://127.0.0.1:9090/metrics' }));

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks IPv6 loopback [::1] bypass', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(makeRequest({ url: 'http://[::1]:8080/internal' }));

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks direct IP address bypass (10.0.0.1)', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(makeRequest({ url: 'http://10.0.0.1:3000/api' }));

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks Kubernetes service DNS bypass (svc.cluster.local)', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const result = await proxy.proxy(
      makeRequest({ url: 'http://my-service.default.svc.cluster.local/api' }),
    );

    expect(result.status).toBe(403);
    expect(sink.records[0]!.policyDecision).toBe('deny');
  });

  it('blocks invalid URL (raw socket-style bypass attempt)', async () => {
    const proxy = new SidecarProxy(makeConfig());
    const check = proxy.checkEgress('tcp://10.0.0.1:22');

    expect(check.allowed).toBe(false);
  });

  it('every blocked threat scenario produces an audit record with deny decision', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);

    const threatUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://localhost:8080/admin',
      'http://127.0.0.1:9090/metrics',
      'http://10.0.0.1:3000/api',
      'http://my-service.default.svc.cluster.local/api',
    ];

    for (const url of threatUrls) {
      await proxy.proxy(makeRequest({ url }));
    }

    expect(sink.records).toHaveLength(threatUrls.length);
    for (const record of sink.records) {
      expect(record.policyDecision).toBe('deny');
      expect(record.enforcementMode).toBe('enforce');
      expect(record.responseStatus).toBe(403);
    }
  });

  it('FailClosedProxy blocks even allowed hosts when circuit is open', async () => {
    const inner = new SidecarProxy(makeConfig(), successFetch());
    const proxy = new FailClosedProxy(inner);
    proxy.forceState('open');

    // api.example.com is in the allowlist, but circuit is open
    const result = await proxy.proxy(makeRequest({ url: 'https://api.example.com/v1/data' }));

    expect(result.status).toBe(503);
    const body = JSON.parse(result.body) as { error: string; message: string };
    expect(body.error).toBe('ProxyUnavailable');
    expect(body.message).toContain('blocked');
  });
});

// ---------------------------------------------------------------------------
// AC4: CI gate — audit field completeness validation
// ---------------------------------------------------------------------------

describe('AC4: CI gate — audit field completeness and bypass detection', () => {
  it('audit record for allowed request has all required fields', async () => {
    const sink = makeAuditSink();
    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);
    proxy.setIdentity({
      tenantId: 'tenant-ci',
      workflowRunId: 'run-ci',
      agentSpiffeId: 'spiffe://portarium.io/ci-agent',
    });

    await proxy.proxy(makeRequest({ method: 'PUT', url: 'https://api.example.com/v1/update' }));

    expect(sink.records).toHaveLength(1);
    const record = sink.records[0]!;

    for (const field of REQUIRED_AUDIT_FIELDS) {
      expect(record[field], `missing required audit field: ${field}`).toBeDefined();
    }
    expect(record.destinationPort).toBeDefined();
    expect(record.tenantId).toBe('tenant-ci');
    expect(record.workflowRunId).toBe('run-ci');
    expect(record.agentSpiffeId).toContain('spiffe://');
  });

  it('audit record for denied request has all required fields', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), successFetch(), sink);
    proxy.setIdentity({
      tenantId: 'tenant-ci-deny',
      workflowRunId: 'run-ci-deny',
      agentSpiffeId: 'spiffe://portarium.io/ci-deny',
    });

    await proxy.proxy(makeRequest({ url: 'https://not-allowed.example.org/data' }));

    const record = sink.records[0]!;
    for (const field of REQUIRED_AUDIT_FIELDS) {
      expect(record[field], `missing required audit field: ${field}`).toBeDefined();
    }
    expect(record.policyReason).toBeDefined();
    expect(record.policyReason).toContain('not in egress allowlist');
  });

  it('audit record for upstream failure has all required fields', async () => {
    const sink = makeAuditSink();
    const proxy = new SidecarProxy(makeConfig(), failFetch(), sink);

    await proxy.proxy(makeRequest());

    const record = sink.records[0]!;
    for (const field of REQUIRED_AUDIT_FIELDS) {
      expect(record[field], `missing required audit field: ${field}`).toBeDefined();
    }
    expect(record.responseStatus).toBe(502);
  });

  it('structured log record includes workspace, run, subject, and correlationId', () => {
    const audit: EgressAuditRecord = {
      timestamp: 1709337600000,
      enforcementMode: 'enforce',
      policyDecision: 'allow',
      destinationHost: 'api.example.com',
      destinationPort: 443,
      httpMethod: 'GET',
      httpPath: '/v1/check',
      responseStatus: 200,
      policyReason: undefined,
      latencyMs: 15,
      tenantId: 'tenant-log',
      workflowRunId: 'run-log',
      agentSpiffeId: 'spiffe://portarium.io/log-agent',
    };
    const ctx: EgressCorrelationContext = {
      workspaceId: 'ws-log',
      runId: 'run-log',
      actionId: 'action-log',
      correlationId: 'corr-log',
      subject: 'user:alice@portarium.io',
    };

    const logRecord = auditToLogRecord(audit, ctx, 'sidecar');

    expect(logRecord.workspaceId).toBe('ws-log');
    expect(logRecord.runId).toBe('run-log');
    expect(logRecord.subject).toBe('user:alice@portarium.io');
    expect(logRecord.correlationId).toBe('corr-log');
    expect(logRecord.actionId).toBe('action-log');
    expect(logRecord.agentSpiffeId).toBe('spiffe://portarium.io/log-agent');
  });

  it('metrics record both allow and deny decisions', () => {
    const metrics = makeMetrics();
    const allowAudit: EgressAuditRecord = {
      timestamp: Date.now(),
      enforcementMode: 'enforce',
      policyDecision: 'allow',
      destinationHost: 'good.host',
      destinationPort: 443,
      httpMethod: 'GET',
      httpPath: '/',
      responseStatus: 200,
      policyReason: undefined,
      latencyMs: 10,
      tenantId: undefined,
      workflowRunId: undefined,
      agentSpiffeId: undefined,
    };
    const denyAudit: EgressAuditRecord = {
      ...allowAudit,
      policyDecision: 'deny',
      destinationHost: 'bad.host',
      responseStatus: 403,
      policyReason: 'not allowed',
    };

    auditToMetrics(allowAudit, metrics, 'sidecar');
    auditToMetrics(denyAudit, metrics, 'sidecar');

    expect(metrics.decisions).toHaveLength(2);
    const allowDecision = metrics.decisions[0] as { decision: string };
    const denyDecision = metrics.decisions[1] as { decision: string };
    expect(allowDecision.decision).toBe('allow');
    expect(denyDecision.decision).toBe('deny');
    expect(metrics.latencies).toHaveLength(2);
  });

  it('identity propagation round-trips through headers', () => {
    const identity: IdentityPropagationContext = {
      subject: 'agent:test-agent',
      workspaceId: 'ws-roundtrip',
      tenantId: 'tenant-roundtrip',
      agentSpiffeId: 'spiffe://portarium.io/roundtrip',
      workflowRunId: 'run-roundtrip',
      scopes: ['egress:read', 'egress:write'],
      correlationId: 'corr-roundtrip',
      traceparent: '00-aabb-ccdd-01',
      tracestate: 'portarium=test',
    };

    const headers = buildIdentityHeaders(identity);
    const extracted = extractIdentityFromHeaders(headers);

    expect(extracted).toBeDefined();
    expect(extracted!.subject).toBe(identity.subject);
    expect(extracted!.workspaceId).toBe(identity.workspaceId);
    expect(extracted!.tenantId).toBe(identity.tenantId);
    expect(extracted!.agentSpiffeId).toBe(identity.agentSpiffeId);
    expect(extracted!.workflowRunId).toBe(identity.workflowRunId);
    expect(extracted!.scopes).toEqual(['egress:read', 'egress:write']);
    expect(extracted!.correlationId).toBe(identity.correlationId);
    expect(extracted!.traceparent).toBe(identity.traceparent);
    expect(extracted!.tracestate).toBe(identity.tracestate);
  });

  it('trace context propagation round-trips through headers', () => {
    const ctx: EgressCorrelationContext = {
      traceparent: '00-12345678-abcdef01-01',
      tracestate: 'portarium=v2',
      workspaceId: 'ws-trace',
      correlationId: 'corr-trace',
    };

    const headers = buildPropagationHeaders(ctx);
    const extracted = extractCorrelationContext(headers);

    expect(extracted.traceparent).toBe(ctx.traceparent);
    expect(extracted.tracestate).toBe(ctx.tracestate);
    expect(extracted.workspaceId).toBe(ctx.workspaceId);
    expect(extracted.correlationId).toBe(ctx.correlationId);
  });

  it('trace context extracted from inbound request headers', () => {
    const inbound = {
      traceparent: '00-deadbeef-cafebabe-01',
      tracestate: 'vendor=value',
    };

    const trace = extractTraceContext(inbound);

    expect(trace.traceparent).toBe('00-deadbeef-cafebabe-01');
    expect(trace.tracestate).toBe('vendor=value');
  });

  it('missing identity headers yield undefined from extractIdentityFromHeaders', () => {
    const result = extractIdentityFromHeaders({});
    expect(result).toBeUndefined();
  });

  it('end-to-end: governed egress produces complete observable telemetry chain', async () => {
    const logSink = makeLogSink();
    const metrics = makeMetrics();
    const evidence: EgressEvidenceDescriptor[] = [];
    const sink = new ObservableEgressAuditSink({
      component: 'sidecar',
      logSink,
      metrics,
      evidenceCollector: (d) => evidence.push(d),
    });
    sink.setCorrelationContext({
      workspaceId: 'ws-e2e',
      runId: 'run-e2e',
      actionId: 'action-e2e',
      correlationId: 'corr-e2e',
      subject: 'agent:e2e-agent',
      traceparent: '00-e2e-trace-01',
      agentSpiffeId: 'spiffe://portarium.io/e2e',
    });

    const fetchImpl = successFetch();
    const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);
    proxy.setToken('e2e-token');
    proxy.setIdentity({
      tenantId: 'ws-e2e',
      workflowRunId: 'run-e2e',
      agentSpiffeId: 'spiffe://portarium.io/e2e',
    });

    // Allowed request
    const allowResult = await proxy.proxy(
      makeRequest({ method: 'POST', url: 'https://api.example.com/v1/action' }),
      { traceparent: '00-e2e-trace-01' },
    );
    expect(allowResult.status).toBe(200);

    // Denied request
    const denyResult = await proxy.proxy(
      makeRequest({ url: 'https://exfiltration.evil.org/steal' }),
    );
    expect(denyResult.status).toBe(403);

    // Verify complete telemetry chain
    expect(logSink.logs).toHaveLength(2);
    expect(logSink.logs[0]!.policyDecision).toBe('allow');
    expect(logSink.logs[0]!.workspaceId).toBe('ws-e2e');
    expect(logSink.logs[0]!.correlationId).toBe('corr-e2e');
    expect(logSink.logs[1]!.policyDecision).toBe('deny');

    expect(metrics.decisions).toHaveLength(2);
    expect(metrics.latencies).toHaveLength(2);

    expect(evidence).toHaveLength(2);
    expect(evidence[0]!.links.runId).toBe('run-e2e');
    expect(evidence[0]!.links.actionId).toBe('action-e2e');
    expect(evidence[1]!.summary).toContain('denied');
    expect(evidence[1]!.egressDetail.policyDecision).toBe('deny');
  });
});

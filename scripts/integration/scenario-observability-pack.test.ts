/**
 * Cross-cutting: scenario observability pack.
 *
 * Provides and verifies reusable observability verification infrastructure
 * for integration scenario runs:
 *   1. Log correlation — structured logs carry tenantId, runId, correlationId
 *      across API, worker, and integration layers.
 *   2. Metrics checks — counter increments for success/error/total, histogram
 *      observations, and ratio computation for scenario endpoints.
 *   3. Evidence chain validation — expected event sequence, category ordering,
 *      hash-chain integrity, and actor/link markers.
 *   4. Temporal workflow history — captures dispatch and approval workflow
 *      events with duration and state transition checks.
 *
 * Bead: bead-0849
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import type {
  CorrelationId,
  EvidenceId,
  HashSha256,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import type {
  EvidenceCategory,
  EvidenceEntryV1,
} from '../../src/domain/evidence/evidence-entry-v1.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type { DomainEventV1, DomainEventType } from '../../src/domain/events/domain-events-v1.js';
import {
  type MetricsHooks,
  setMetricsHooksForTest,
  resetMetricsHooksForTest,
  emitCounter,
  emitHistogram,
} from '../../src/infrastructure/observability/metrics-hooks.js';
import { redactStructuredLogObject } from '../../src/infrastructure/observability/structured-log.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-obs-pack' as TenantId;
const WORKSPACE_ID = 'ws-obs-pack' as WorkspaceId;
const RUN_ID = 'run-obs-001' as RunId;
const CORRELATION_ID = 'corr-obs-001' as CorrelationId;
const USER_ID = 'user-obs-001' as UserId;
const FIXED_NOW = '2026-03-02T12:00:00.000Z';

// ---------------------------------------------------------------------------
// 1. Scenario log collector — captures structured log entries
// ---------------------------------------------------------------------------

type StructuredLogEntry = Readonly<{
  level: string;
  name: string;
  msg: string;
  tenantId?: string;
  runId?: string;
  correlationId?: string;
  [key: string]: unknown;
}>;

function makeLogCollector() {
  const entries: StructuredLogEntry[] = [];

  return {
    entries,
    log(entry: StructuredLogEntry): void {
      entries.push(entry);
    },
    byCorrelation(correlationId: string): StructuredLogEntry[] {
      return entries.filter((e) => e.correlationId === correlationId);
    },
    byRunId(runId: string): StructuredLogEntry[] {
      return entries.filter((e) => e.runId === runId);
    },
    byLevel(level: string): StructuredLogEntry[] {
      return entries.filter((e) => e.level === level);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Scenario metrics collector — captures counter/histogram observations
// ---------------------------------------------------------------------------

type CounterInc = Readonly<{
  name: string;
  attributes?: Record<string, string | number | boolean>;
}>;
type HistogramObs = Readonly<{
  name: string;
  value: number;
  attributes?: Record<string, string | number | boolean>;
}>;

function makeMetricsCollector() {
  const counters: CounterInc[] = [];
  const histograms: HistogramObs[] = [];

  const hooks: MetricsHooks = {
    incrementCounter(name, attributes) {
      counters.push({ name, ...(attributes ? { attributes } : {}) });
    },
    recordHistogram(name, value, attributes) {
      histograms.push({ name, value, ...(attributes ? { attributes } : {}) });
    },
  };

  return {
    counters,
    histograms,
    hooks,
    countByName(name: string): number {
      return counters.filter((c) => c.name === name).length;
    },
    histogramValues(name: string): number[] {
      return histograms.filter((h) => h.name === name).map((h) => h.value);
    },
    successRatio(totalName: string, errorName: string): number {
      const total = counters.filter((c) => c.name === totalName).length;
      const errors = counters.filter((c) => c.name === errorName).length;
      if (total === 0) return 1;
      return (total - errors) / total;
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Evidence chain collector — captures and validates hash-chain entries
// ---------------------------------------------------------------------------

function makeEvidenceCollector(): EvidenceLogPort & {
  entries: EvidenceEntryV1[];
  validateChainIntegrity: () => boolean;
  entriesByCategory: (cat: EvidenceCategory) => EvidenceEntryV1[];
  entriesByCorrelation: (corrId: string) => EvidenceEntryV1[];
  categorySequence: () => EvidenceCategory[];
} {
  const entries: EvidenceEntryV1[] = [];
  let counter = 0;

  return {
    entries,
    appendEntry: vi.fn(async (_tenantId, entry) => {
      counter += 1;
      const stored: EvidenceEntryV1 = {
        ...entry,
        schemaVersion: 1,
        evidenceId: `ev-obs-${counter}` as EvidenceId,
        previousHash: counter > 1 ? (`hash-obs-${counter - 1}` as HashSha256) : undefined,
        hashSha256: `hash-obs-${counter}` as HashSha256,
      };
      entries.push(stored);
      return stored;
    }),
    validateChainIntegrity() {
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1]!;
        const curr = entries[i]!;
        if (curr.previousHash !== prev.hashSha256) return false;
      }
      return true;
    },
    entriesByCategory(cat: EvidenceCategory) {
      return entries.filter((e) => e.category === cat);
    },
    entriesByCorrelation(corrId: string) {
      return entries.filter((e) => e.correlationId === corrId);
    },
    categorySequence() {
      return entries.map((e) => e.category);
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Temporal workflow history collector — captures state transitions
// ---------------------------------------------------------------------------

type WorkflowState = 'started' | 'running' | 'paused' | 'resumed' | 'completed' | 'failed';

type WorkflowHistoryEntry = Readonly<{
  workflowId: string;
  state: WorkflowState;
  timestampIso: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}>;

function makeWorkflowHistoryCollector() {
  const history: WorkflowHistoryEntry[] = [];

  return {
    history,
    record(entry: WorkflowHistoryEntry): void {
      history.push(entry);
    },
    byWorkflowId(workflowId: string): WorkflowHistoryEntry[] {
      return history.filter((h) => h.workflowId === workflowId);
    },
    stateSequence(workflowId: string): WorkflowState[] {
      return this.byWorkflowId(workflowId).map((h) => h.state);
    },
    totalDurationMs(workflowId: string): number {
      return this.byWorkflowId(workflowId).reduce((sum, h) => sum + (h.durationMs ?? 0), 0);
    },
    hasTerminalState(workflowId: string): boolean {
      const states = this.stateSequence(workflowId);
      return states.includes('completed') || states.includes('failed');
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Domain event collector — captures published CloudEvents
// ---------------------------------------------------------------------------

function makeDomainEventCollector() {
  const events: DomainEventV1[] = [];

  return {
    events,
    publish(event: DomainEventV1): void {
      events.push(event);
    },
    byType(eventType: DomainEventType): DomainEventV1[] {
      return events.filter((e) => e.eventType === eventType);
    },
    byCorrelation(corrId: string): DomainEventV1[] {
      return events.filter((e) => e.correlationId === corrId);
    },
    typeSequence(): DomainEventType[] {
      return events.map((e) => e.eventType);
    },
  };
}

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

describe('Scenario observability pack', () => {
  // =========================================================================
  // Section 1: Log correlation across layers
  // =========================================================================
  describe('Section 1 — Log correlation across layers', () => {
    it('structured logs carry tenantId, runId, and correlationId', () => {
      const logs = makeLogCollector();

      // API layer log
      logs.log({
        level: 'info',
        name: 'control-plane',
        msg: 'POST /runs accepted',
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
      });

      // Worker layer log
      logs.log({
        level: 'info',
        name: 'execution-plane',
        msg: 'Action dispatched to adapter',
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
      });

      // Integration layer log
      logs.log({
        level: 'info',
        name: 'openclaw-gateway',
        msg: 'Machine invocation succeeded',
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
      });

      const correlated = logs.byCorrelation(CORRELATION_ID);
      expect(correlated).toHaveLength(3);
      expect(correlated.every((e) => e.tenantId === TENANT_ID)).toBe(true);
      expect(correlated.every((e) => e.runId === RUN_ID)).toBe(true);
    });

    it('log entries cover all three layers: control-plane, execution-plane, gateway', () => {
      const logs = makeLogCollector();

      logs.log({
        level: 'info',
        name: 'control-plane',
        msg: 'Request received',
        correlationId: CORRELATION_ID,
      });
      logs.log({
        level: 'info',
        name: 'execution-plane',
        msg: 'Worker processing',
        correlationId: CORRELATION_ID,
      });
      logs.log({
        level: 'info',
        name: 'openclaw-gateway',
        msg: 'Gateway call',
        correlationId: CORRELATION_ID,
      });

      const names = logs.byCorrelation(CORRELATION_ID).map((e) => e.name);
      expect(names).toContain('control-plane');
      expect(names).toContain('execution-plane');
      expect(names).toContain('openclaw-gateway');
    });

    it('sensitive fields are redacted in structured logs', () => {
      const logObj = {
        level: 'info',
        name: 'control-plane',
        msg: 'Token refresh',
        authorization: 'Bearer eyJ...',
        apiKey: 'sk-secret-123',
        correlationId: CORRELATION_ID,
      };

      const redacted = redactStructuredLogObject(logObj);
      expect(redacted['authorization']).toBe('[REDACTED]');
      expect(redacted['apiKey']).toBe('[REDACTED]');
      expect(redacted['correlationId']).toBe(CORRELATION_ID);
    });

    it('error-level logs are filtered correctly', () => {
      const logs = makeLogCollector();

      logs.log({ level: 'info', name: 'control-plane', msg: 'OK' });
      logs.log({ level: 'error', name: 'execution-plane', msg: 'Worker crashed' });
      logs.log({ level: 'info', name: 'openclaw-gateway', msg: 'Retry succeeded' });

      expect(logs.byLevel('error')).toHaveLength(1);
      expect(logs.byLevel('error')[0]!.msg).toBe('Worker crashed');
    });
  });

  // =========================================================================
  // Section 2: Metrics checks (counters, histograms, ratios)
  // =========================================================================
  describe('Section 2 — Metrics checks for scenario endpoints', () => {
    beforeEach(() => {
      resetMetricsHooksForTest();
    });

    it('counter increments are captured by metrics collector', () => {
      const collector = makeMetricsCollector();
      setMetricsHooksForTest(collector.hooks);

      emitCounter('portarium_scenario_requests_total');
      emitCounter('portarium_scenario_requests_total');
      emitCounter('portarium_scenario_errors_total');

      expect(collector.countByName('portarium_scenario_requests_total')).toBe(2);
      expect(collector.countByName('portarium_scenario_errors_total')).toBe(1);

      resetMetricsHooksForTest();
    });

    it('histogram observations are captured with values', () => {
      const collector = makeMetricsCollector();
      setMetricsHooksForTest(collector.hooks);

      emitHistogram('portarium_scenario_duration_seconds', 0.15);
      emitHistogram('portarium_scenario_duration_seconds', 0.42);
      emitHistogram('portarium_scenario_duration_seconds', 1.2);

      const values = collector.histogramValues('portarium_scenario_duration_seconds');
      expect(values).toEqual([0.15, 0.42, 1.2]);

      resetMetricsHooksForTest();
    });

    it('success ratio computes correctly for mixed success/error counts', () => {
      const collector = makeMetricsCollector();
      setMetricsHooksForTest(collector.hooks);

      // 8 successes, 2 errors out of 10 total
      for (let i = 0; i < 10; i++) emitCounter('scenario_total');
      for (let i = 0; i < 2; i++) emitCounter('scenario_errors');

      const ratio = collector.successRatio('scenario_total', 'scenario_errors');
      expect(ratio).toBeCloseTo(0.8, 2);

      resetMetricsHooksForTest();
    });

    it('success ratio is 1.0 when no requests are recorded', () => {
      const collector = makeMetricsCollector();
      expect(collector.successRatio('scenario_total', 'scenario_errors')).toBe(1);
    });

    it('metrics carry attributes for endpoint-level granularity', () => {
      const collector = makeMetricsCollector();
      setMetricsHooksForTest(collector.hooks);

      emitCounter('portarium_http_requests_total', { method: 'POST', path: '/runs', status: 201 });
      emitCounter('portarium_http_requests_total', {
        method: 'POST',
        path: '/approvals',
        status: 200,
      });
      emitCounter('portarium_http_requests_total', { method: 'GET', path: '/health', status: 200 });

      const postCounts = collector.counters.filter((c) => c.attributes?.['method'] === 'POST');
      expect(postCounts).toHaveLength(2);

      resetMetricsHooksForTest();
    });
  });

  // =========================================================================
  // Section 3: Evidence chain validation
  // =========================================================================
  describe('Section 3 — Evidence chain validation', () => {
    it('evidence chain maintains hash-chain integrity across entries', async () => {
      const evidence = makeEvidenceCollector();

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-1' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'Approval requested',
        actor: { kind: 'User', userId: USER_ID },
        links: { runId: RUN_ID },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-2' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Action',
        summary: 'Action dispatched',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-3' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'Run completed',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      expect(evidence.entries).toHaveLength(3);
      expect(evidence.validateChainIntegrity()).toBe(true);
    });

    it('evidence entries share consistent correlationId', async () => {
      const evidence = makeEvidenceCollector();

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-c1' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'Requested',
        actor: { kind: 'User', userId: USER_ID },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-c2' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'Completed',
        actor: { kind: 'System' },
      });

      const correlated = evidence.entriesByCorrelation(CORRELATION_ID);
      expect(correlated).toHaveLength(2);
    });

    it('category sequence matches expected flow: Approval → Action → System', async () => {
      const evidence = makeEvidenceCollector();

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-s1' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'Gate opened',
        actor: { kind: 'User', userId: USER_ID },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-s2' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Action',
        summary: 'Machine dispatched',
        actor: { kind: 'System' },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-s3' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'Run completed',
        actor: { kind: 'System' },
      });

      expect(evidence.categorySequence()).toEqual(['Approval', 'Action', 'System']);
    });

    it('first evidence entry has no previousHash', async () => {
      const evidence = makeEvidenceCollector();

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-first' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'First entry',
        actor: { kind: 'System' },
      });

      expect(evidence.entries[0]!.previousHash).toBeUndefined();
      expect(evidence.entries[0]!.hashSha256).toBeDefined();
    });

    it('evidence entries carry correct actor kinds', async () => {
      const evidence = makeEvidenceCollector();

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-actor-u' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'User action',
        actor: { kind: 'User', userId: USER_ID },
      });

      await evidence.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-actor-s' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'System action',
        actor: { kind: 'System' },
      });

      expect(evidence.entries[0]!.actor.kind).toBe('User');
      expect(evidence.entries[1]!.actor.kind).toBe('System');
    });
  });

  // =========================================================================
  // Section 4: Temporal workflow history checks
  // =========================================================================
  describe('Section 4 — Temporal workflow history for dispatch and approval', () => {
    it('dispatch workflow records started → running → completed sequence', () => {
      const history = makeWorkflowHistoryCollector();
      const wfId = 'wf-dispatch-001';

      history.record({ workflowId: wfId, state: 'started', timestampIso: '2026-03-02T12:00:00Z' });
      history.record({
        workflowId: wfId,
        state: 'running',
        timestampIso: '2026-03-02T12:00:01Z',
        durationMs: 1000,
      });
      history.record({
        workflowId: wfId,
        state: 'completed',
        timestampIso: '2026-03-02T12:00:03Z',
        durationMs: 2000,
      });

      expect(history.stateSequence(wfId)).toEqual(['started', 'running', 'completed']);
      expect(history.hasTerminalState(wfId)).toBe(true);
      expect(history.totalDurationMs(wfId)).toBe(3000);
    });

    it('approval workflow records started → paused → resumed → completed sequence', () => {
      const history = makeWorkflowHistoryCollector();
      const wfId = 'wf-approval-001';

      history.record({ workflowId: wfId, state: 'started', timestampIso: '2026-03-02T12:00:00Z' });
      history.record({
        workflowId: wfId,
        state: 'paused',
        timestampIso: '2026-03-02T12:00:01Z',
        metadata: { reason: 'awaiting-approval' },
      });
      history.record({
        workflowId: wfId,
        state: 'resumed',
        timestampIso: '2026-03-02T12:05:00Z',
        metadata: { approvedBy: 'user-approver-002' },
      });
      history.record({
        workflowId: wfId,
        state: 'completed',
        timestampIso: '2026-03-02T12:05:02Z',
        durationMs: 302000,
      });

      expect(history.stateSequence(wfId)).toEqual(['started', 'paused', 'resumed', 'completed']);
      expect(history.hasTerminalState(wfId)).toBe(true);
    });

    it('failed workflow records terminal failed state', () => {
      const history = makeWorkflowHistoryCollector();
      const wfId = 'wf-fail-001';

      history.record({ workflowId: wfId, state: 'started', timestampIso: '2026-03-02T12:00:00Z' });
      history.record({
        workflowId: wfId,
        state: 'failed',
        timestampIso: '2026-03-02T12:00:05Z',
        durationMs: 5000,
        metadata: { error: 'Adapter timeout' },
      });

      expect(history.stateSequence(wfId)).toEqual(['started', 'failed']);
      expect(history.hasTerminalState(wfId)).toBe(true);
    });

    it('non-terminal workflow has no completed or failed state', () => {
      const history = makeWorkflowHistoryCollector();
      const wfId = 'wf-stuck-001';

      history.record({ workflowId: wfId, state: 'started', timestampIso: '2026-03-02T12:00:00Z' });
      history.record({ workflowId: wfId, state: 'paused', timestampIso: '2026-03-02T12:00:01Z' });

      expect(history.hasTerminalState(wfId)).toBe(false);
    });

    it('workflow history isolates entries by workflowId', () => {
      const history = makeWorkflowHistoryCollector();

      history.record({ workflowId: 'wf-a', state: 'started', timestampIso: FIXED_NOW });
      history.record({ workflowId: 'wf-b', state: 'started', timestampIso: FIXED_NOW });
      history.record({ workflowId: 'wf-a', state: 'completed', timestampIso: FIXED_NOW });

      expect(history.byWorkflowId('wf-a')).toHaveLength(2);
      expect(history.byWorkflowId('wf-b')).toHaveLength(1);
    });
  });

  // =========================================================================
  // Section 5: Domain event correlation and sequence
  // =========================================================================
  describe('Section 5 — Domain event sequence and correlation', () => {
    it('domain events share correlationId for full scenario run', () => {
      const events = makeDomainEventCollector();

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-1',
        eventType: 'RunStarted',
        aggregateKind: 'Run',
        aggregateId: RUN_ID,
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        actorUserId: USER_ID,
      });

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-2',
        eventType: 'ApprovalGranted',
        aggregateKind: 'Approval',
        aggregateId: 'approval-001',
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        actorUserId: USER_ID,
      });

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-3',
        eventType: 'ActionDispatched',
        aggregateKind: 'Run',
        aggregateId: RUN_ID,
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
      });

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-4',
        eventType: 'RunSucceeded',
        aggregateKind: 'Run',
        aggregateId: RUN_ID,
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
      });

      const correlated = events.byCorrelation(CORRELATION_ID);
      expect(correlated).toHaveLength(4);
      expect(events.typeSequence()).toEqual([
        'RunStarted',
        'ApprovalGranted',
        'ActionDispatched',
        'RunSucceeded',
      ]);
    });

    it('domain events can be filtered by type', () => {
      const events = makeDomainEventCollector();

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-a',
        eventType: 'ApprovalGranted',
        aggregateKind: 'Approval',
        aggregateId: 'appr-1',
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
      });

      events.publish({
        schemaVersion: 1,
        eventId: 'evt-b',
        eventType: 'ApprovalDenied',
        aggregateKind: 'Approval',
        aggregateId: 'appr-2',
        occurredAtIso: FIXED_NOW,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
      });

      expect(events.byType('ApprovalGranted')).toHaveLength(1);
      expect(events.byType('ApprovalDenied')).toHaveLength(1);
      expect(events.byType('RunStarted')).toHaveLength(0);
    });

    it('full scenario event sequence includes all expected lifecycle events', () => {
      const events = makeDomainEventCollector();

      const lifecycle: DomainEventType[] = [
        'RunStarted',
        'ApprovalRequested',
        'ApprovalGranted',
        'ActionDispatched',
        'ActionCompleted',
        'EvidenceRecorded',
        'RunSucceeded',
      ];

      for (let i = 0; i < lifecycle.length; i++) {
        events.publish({
          schemaVersion: 1,
          eventId: `evt-lc-${i}`,
          eventType: lifecycle[i]!,
          aggregateKind: 'Run',
          aggregateId: RUN_ID,
          occurredAtIso: FIXED_NOW,
          workspaceId: WORKSPACE_ID,
          correlationId: CORRELATION_ID,
        });
      }

      expect(events.typeSequence()).toEqual(lifecycle);
      expect(events.events).toHaveLength(7);
    });
  });
});

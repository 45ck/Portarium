import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { verifyEvidenceChainV1 } from '../../domain/evidence/evidence-chain-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';

import {
  __test,
  completeRunActivity,
  resetTemporalTelemetryHooksForTest,
  setTemporalTelemetryHooksForTest,
  startRunActivity,
} from './activities.js';
import {
  resetMetricsHooksForTest,
  setMetricsHooksForTest,
} from '../observability/metrics-hooks.js';

const WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'tenant-1',
  name: 'stub',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    {
      actionId: 'act-1',
      order: 1,
      portFamily: 'ItsmItOps',
      operation: 'workflow:noop',
    },
  ],
});

describe('Temporal activities (in-memory execution loop)', () => {
  beforeEach(() => {
    __test.reset();
  });

  afterEach(() => {
    resetMetricsHooksForTest();
    resetTemporalTelemetryHooksForTest();
  });

  it('reaches Succeeded and writes a valid evidence hash chain', async () => {
    await startRunActivity({
      runId: 'run-1',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-1',
      executionTier: 'Auto',
    });

    await completeRunActivity({
      runId: 'run-1',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-1',
    });

    expect(__test.getRunStatus('tenant-1', 'run-1')).toBe('Succeeded');

    const evidence = __test.getEvidence('tenant-1', 'run-1');
    expect(evidence.length).toBeGreaterThanOrEqual(3);

    const verify = verifyEvidenceChainV1(evidence, new NodeCryptoEvidenceHasher());
    expect(verify).toEqual({ ok: true });

    const plan = __test.getPlan('tenant-1', 'run-1');
    expect(plan?.plannedEffects.length).toBe(1);

    const diff = __test.getDiff('tenant-1', 'run-1');
    expect(diff?.isClean).toBe(true);
  });

  it('emits metrics hooks for run start and success', async () => {
    const incrementCounter = vi.fn();
    const recordHistogram = vi.fn();
    setMetricsHooksForTest({ incrementCounter, recordHistogram });

    await startRunActivity({
      runId: 'run-2',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-2',
      packId: 'scm.change-management',
      packVersion: '1.2.3',
      executionTier: 'Auto',
    });

    await completeRunActivity({
      runId: 'run-2',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-2',
      packId: 'scm.change-management',
      packVersion: '1.2.3',
    });

    expect(incrementCounter).toHaveBeenCalledWith('portarium.run.started', {
      'pack.id': 'scm.change-management',
      'pack.version': '1.2.3',
      'workflow.execution_tier': 'Auto',
      'telemetry.pii_safe': true,
    });
    expect(incrementCounter).toHaveBeenCalledWith('portarium.action.succeeded', {
      'pack.id': 'scm.change-management',
      'pack.version': '1.2.3',
      'workflow.execution_tier': 'Auto',
      'action.id': 'act-1',
      'action.operation': 'workflow:noop',
      'action.port_family': 'ItsmItOps',
      'telemetry.pii_safe': true,
    });
    expect(incrementCounter).toHaveBeenCalledWith('portarium.run.succeeded', {
      'pack.id': 'scm.change-management',
      'pack.version': '1.2.3',
      'workflow.execution_tier': 'Auto',
      'telemetry.pii_safe': true,
    });

    expect(recordHistogram).toHaveBeenCalledWith(
      'portarium.action.duration.ms',
      expect.any(Number),
      expect.objectContaining({
        'pack.id': 'scm.change-management',
        'pack.version': '1.2.3',
        'action.outcome': 'succeeded',
      }),
    );
    expect(recordHistogram).toHaveBeenCalledWith(
      'portarium.run.duration.ms',
      expect.any(Number),
      expect.objectContaining({
        'pack.id': 'scm.change-management',
        'pack.version': '1.2.3',
        'run.outcome': 'succeeded',
      }),
    );
  });

  it('emits workflow and action spans with pack telemetry attributes only', async () => {
    const onSpanStart = vi.fn();
    const onSpanEnd = vi.fn();
    setTemporalTelemetryHooksForTest({ onSpanStart, onSpanEnd });

    await startRunActivity({
      runId: 'run-3',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-3',
      executionTier: 'Auto',
      packId: 'scm.change-management',
      packVersion: '1.2.3',
    });

    await completeRunActivity({
      runId: 'run-3',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-3',
      packId: 'scm.change-management',
      packVersion: '1.2.3',
    });

    expect(onSpanStart).toHaveBeenCalledWith(
      'workflow.run.start',
      expect.objectContaining({
        'pack.id': 'scm.change-management',
        'pack.version': '1.2.3',
      }),
    );
    expect(onSpanStart).toHaveBeenCalledWith(
      'workflow.run.complete',
      expect.objectContaining({
        'pack.id': 'scm.change-management',
        'pack.version': '1.2.3',
      }),
    );
    expect(onSpanStart).toHaveBeenCalledWith(
      'workflow.action.execute',
      expect.objectContaining({
        'pack.id': 'scm.change-management',
        'pack.version': '1.2.3',
      }),
    );

    const actionSpanStartAttributes = onSpanStart.mock.calls.find(
      (call) => call[0] === 'workflow.action.execute',
    )?.[1] as Record<string, unknown>;
    expect(Object.keys(actionSpanStartAttributes)).toContain('pack.id');
    expect(actionSpanStartAttributes).not.toHaveProperty('tenantId');
    expect(actionSpanStartAttributes).not.toHaveProperty('initiatedByUserId');
    expect(actionSpanStartAttributes).not.toHaveProperty('correlationId');

    expect(onSpanEnd).toHaveBeenCalledWith(
      'workflow.action.execute',
      'ok',
      expect.any(Number),
      expect.objectContaining({
        'pack.id': 'scm.change-management',
      }),
    );
  });
});

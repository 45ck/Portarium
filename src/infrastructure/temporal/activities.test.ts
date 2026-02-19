import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { verifyEvidenceChainV1 } from '../../domain/evidence/evidence-chain-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';

import { __test, completeRunActivity, startRunActivity } from './activities.js';
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
    setMetricsHooksForTest({ incrementCounter });

    await startRunActivity({
      runId: 'run-2',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-2',
      executionTier: 'Auto',
    });

    await completeRunActivity({
      runId: 'run-2',
      tenantId: 'tenant-1',
      workflowId: 'wf-1',
      workflow: WORKFLOW,
      initiatedByUserId: 'user-1',
      correlationId: 'corr-2',
    });

    expect(incrementCounter).toHaveBeenCalledWith('portarium.run.started', {
      executionTier: 'Auto',
    });
    expect(incrementCounter).toHaveBeenCalledWith('portarium.run.succeeded');
  });
});

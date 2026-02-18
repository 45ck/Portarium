import { describe, expect, it, vi } from 'vitest';

import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';

const hoisted = vi.hoisted(() => ({
  logInfo: vi.fn<(...args: unknown[]) => unknown>(),
  startRunActivity: vi.fn<(input: unknown) => Promise<void>>(async () => undefined),
  completeRunActivity: vi.fn<(input: unknown) => Promise<void>>(async () => undefined),
  approvalHandler: undefined as ((payload: unknown) => void) | undefined,
  nextDecision: 'Approved' as 'Approved' | 'Denied' | 'RequestChanges',
}));

vi.mock('@temporalio/workflow', () => ({
  log: {
    info: (...args: unknown[]) => hoisted.logInfo(...args),
  },
  defineSignal: (name: string) => ({ name }),
  setHandler: (_signal: unknown, handler: (payload: unknown) => void) => {
    hoisted.approvalHandler = handler;
  },
  condition: async (predicate: () => boolean) => {
    // Simulate an external signal arriving after the workflow begins waiting.
    if (hoisted.approvalHandler) {
      hoisted.approvalHandler({ decision: hoisted.nextDecision, approvalId: 'approval-1' });
    }
    if (!predicate()) throw new Error('condition predicate did not become true');
  },
  proxyActivities: () => ({
    startRunActivity: hoisted.startRunActivity,
    completeRunActivity: hoisted.completeRunActivity,
  }),
}));

import { portariumRun } from './workflows.js';

const STUB_WORKFLOW_AUTO = parseWorkflowV1({
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

const STUB_WORKFLOW_HUMAN = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-2',
  workspaceId: 'tenant-1',
  name: 'stub',
  version: 1,
  active: true,
  executionTier: 'HumanApprove',
  actions: [
    {
      actionId: 'act-1',
      order: 1,
      portFamily: 'ItsmItOps',
      operation: 'workflow:noop',
    },
  ],
});

describe('portariumRun workflow', () => {
  it('runs start/complete activities for Auto tier', async () => {
    hoisted.startRunActivity.mockClear();
    hoisted.completeRunActivity.mockClear();
    hoisted.nextDecision = 'Approved';

    await expect(
      portariumRun({
        runId: 'run-1',
        tenantId: 'tenant-1',
        workflowId: 'wf-1',
        workflow: STUB_WORKFLOW_AUTO,
        initiatedByUserId: 'user-1',
        correlationId: 'corr-1',
        executionTier: 'Auto',
      }),
    ).resolves.toBeUndefined();

    expect(hoisted.startRunActivity).toHaveBeenCalledTimes(1);
    expect(hoisted.completeRunActivity).toHaveBeenCalledTimes(1);
  });

  it('waits for approval decision signal for HumanApprove tier', async () => {
    hoisted.startRunActivity.mockClear();
    hoisted.completeRunActivity.mockClear();
    hoisted.approvalHandler = undefined;
    hoisted.nextDecision = 'Approved';

    await expect(
      portariumRun({
        runId: 'run-2',
        tenantId: 'tenant-1',
        workflowId: 'wf-2',
        workflow: STUB_WORKFLOW_HUMAN,
        initiatedByUserId: 'user-1',
        correlationId: 'corr-2',
        executionTier: 'HumanApprove',
      }),
    ).resolves.toBeUndefined();

    expect(hoisted.startRunActivity).toHaveBeenCalledTimes(1);
    expect(hoisted.completeRunActivity).toHaveBeenCalledTimes(1);
  });

  it('returns early for Denied decision (does not execute completeRunActivity)', async () => {
    hoisted.startRunActivity.mockClear();
    hoisted.completeRunActivity.mockClear();
    hoisted.approvalHandler = undefined;
    hoisted.nextDecision = 'Denied';

    await expect(
      portariumRun({
        runId: 'run-3',
        tenantId: 'tenant-1',
        workflowId: 'wf-3',
        workflow: STUB_WORKFLOW_HUMAN,
        initiatedByUserId: 'user-1',
        correlationId: 'corr-3',
        executionTier: 'HumanApprove',
      }),
    ).resolves.toBeUndefined();

    expect(hoisted.startRunActivity).toHaveBeenCalledTimes(1);
    expect(hoisted.completeRunActivity).toHaveBeenCalledTimes(0);
  });
});

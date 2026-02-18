import { describe, expect, it, vi } from 'vitest';

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
        initiatedByUserId: 'user-1',
        correlationId: 'corr-3',
        executionTier: 'HumanApprove',
      }),
    ).resolves.toBeUndefined();

    expect(hoisted.startRunActivity).toHaveBeenCalledTimes(1);
    expect(hoisted.completeRunActivity).toHaveBeenCalledTimes(0);
  });
});

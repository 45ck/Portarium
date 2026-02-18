import { describe, expect, it, vi } from 'vitest';

// NOTE: vi.mock(...) is hoisted above runtime initializers in ESM.
// Use `var` so the mock factory can safely assign mocks before tests run.
// eslint-disable-next-line no-var
var logInfo: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>> | undefined;
// eslint-disable-next-line no-var
var startRunActivity: ReturnType<typeof vi.fn<(input: unknown) => Promise<void>>> | undefined;
// eslint-disable-next-line no-var
var completeRunActivity: ReturnType<typeof vi.fn<(input: unknown) => Promise<void>>> | undefined;
// eslint-disable-next-line no-var
var approvalHandler: ((payload: unknown) => void) | undefined;
// eslint-disable-next-line no-var
var nextDecision: 'Approved' | 'Denied' | 'RequestChanges' = 'Approved';

vi.mock('@temporalio/workflow', () => ({
  log: {
    info: (...args: unknown[]) => {
      if (!logInfo) logInfo = vi.fn<(...args: unknown[]) => unknown>();
      return logInfo(...args);
    },
  },
  defineSignal: (name: string) => ({ name }),
  setHandler: (_signal: unknown, handler: (payload: unknown) => void) => {
    approvalHandler = handler;
  },
  condition: async (predicate: () => boolean) => {
    // Simulate an external signal arriving after the workflow begins waiting.
    if (approvalHandler) {
      approvalHandler({ decision: nextDecision, approvalId: 'approval-1' });
    }
    if (!predicate()) throw new Error('condition predicate did not become true');
  },
  proxyActivities: () => ({
    startRunActivity: (startRunActivity ??= vi.fn(async () => undefined)),
    completeRunActivity: (completeRunActivity ??= vi.fn(async () => undefined)),
  }),
}));

import { portariumRun } from './workflows.js';

describe('portariumRun workflow', () => {
  it('runs start/complete activities for Auto tier', async () => {
    startRunActivity!.mockClear();
    completeRunActivity!.mockClear();
    nextDecision = 'Approved';
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

    expect(startRunActivity).toHaveBeenCalledTimes(1);
    expect(completeRunActivity).toHaveBeenCalledTimes(1);
  });

  it('waits for approval decision signal for HumanApprove tier', async () => {
    startRunActivity!.mockClear();
    completeRunActivity!.mockClear();
    approvalHandler = undefined;
    nextDecision = 'Approved';

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

    expect(startRunActivity).toHaveBeenCalledTimes(1);
    expect(completeRunActivity).toHaveBeenCalledTimes(1);
  });

  it('returns early for Denied decision (does not execute completeRunActivity)', async () => {
    startRunActivity!.mockClear();
    completeRunActivity!.mockClear();
    approvalHandler = undefined;
    nextDecision = 'Denied';

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

    expect(startRunActivity).toHaveBeenCalledTimes(1);
    expect(completeRunActivity).toHaveBeenCalledTimes(0);
  });
});

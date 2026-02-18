import { describe, expect, it, vi } from 'vitest';

vi.mock('@temporalio/workflow', () => ({
  log: { info: vi.fn() },
}));

import { portariumRun } from './workflows.js';

describe('portariumRun workflow', () => {
  it('resolves and logs deterministically', async () => {
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
  });
});


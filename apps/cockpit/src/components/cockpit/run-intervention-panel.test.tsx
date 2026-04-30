// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunSummary } from '@portarium/cockpit-types';
import { RunInterventionPanel } from './run-intervention-panel';

const runningRun: RunSummary = {
  schemaVersion: 1,
  runId: 'run-1',
  workspaceId: 'ws-1',
  workflowId: 'wf-1',
  correlationId: 'corr-1',
  executionTier: 'HumanApprove',
  initiatedByUserId: 'user-1',
  status: 'Running',
  createdAtIso: '2026-04-30T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
});

describe('RunInterventionPanel', () => {
  it('records a typed current-run steering input with rationale', async () => {
    const onSubmit = vi.fn();
    render(
      <RunInterventionPanel
        run={runningRun}
        workforceMembers={[]}
        workforceQueues={[]}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /record pause/i }).hasAttribute('disabled')).toBe(
      true,
    );
    await userEvent.type(
      screen.getByLabelText(/rationale/i),
      'Need invoice evidence before the agent continues.',
    );
    await userEvent.click(screen.getByRole('button', { name: /record pause/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      interventionType: 'pause',
      rationale: 'Need invoice evidence before the agent continues.',
      effect: 'current-run-effect',
    });
  });

  it('defaults paused runs to resume', () => {
    render(
      <RunInterventionPanel
        run={{ ...runningRun, status: 'Paused' }}
        workforceMembers={[]}
        workforceQueues={[]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /record resume/i })).toBeTruthy();
  });
});

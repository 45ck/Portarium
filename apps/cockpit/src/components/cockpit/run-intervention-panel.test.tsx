// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

async function selectAction(label: RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: /action/i }));
  await userEvent.click(screen.getByRole('option', { name: label }));
}

function setRationale(value: string) {
  fireEvent.change(screen.getByLabelText(/rationale/i), { target: { value } });
}

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
    setRationale('Need invoice evidence before the agent continues.');
    await userEvent.click(screen.getByRole('button', { name: /record pause/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      interventionType: 'pause',
      rationale: 'Need invoice evidence before the agent continues.',
      surface: 'steering',
      authoritySource: 'run-charter',
      effect: 'current-run-effect',
      consequence: 'Stops the current Run at the next safe boundary and records why.',
      evidenceRequired: true,
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

  it('separates request-more-evidence from generic steering actions', async () => {
    const onSubmit = vi.fn();
    render(
      <RunInterventionPanel
        run={runningRun}
        workforceMembers={[]}
        workforceQueues={[]}
        onSubmit={onSubmit}
      />,
    );

    await selectAction(/request more evidence/i);

    expect(screen.getByText('Approval')).toBeTruthy();
    expect(screen.getByText('Approval Gate')).toBeTruthy();
    expect(screen.getByText('Policy rule')).toBeTruthy();

    setRationale('Need source invoice and vendor match before approval.');
    await userEvent.click(screen.getByRole('button', { name: /record request more evidence/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      interventionType: 'request-more-evidence',
      rationale: 'Need source invoice and vendor match before approval.',
      surface: 'approval',
      authoritySource: 'policy-rule',
      effect: 'approval-gate-effect',
      consequence: 'Blocks the decision path until the missing evidence is supplied.',
      evidenceRequired: true,
    });
  });

  it('requires a target for handoff and records ownership transfer metadata', async () => {
    const onSubmit = vi.fn();
    render(
      <RunInterventionPanel
        run={runningRun}
        workforceMembers={[
          {
            schemaVersion: 1,
            workforceMemberId: 'wm-1',
            linkedUserId: 'user-asha',
            displayName: 'Asha Patel',
            capabilities: ['operations.dispatch'],
            availabilityStatus: 'available',
            queueMemberships: [],
            tenantId: 'tenant-1',
            createdAtIso: '2026-04-30T00:00:00.000Z',
          },
        ]}
        workforceQueues={[]}
        onSubmit={onSubmit}
      />,
    );

    await selectAction(/handoff/i);
    setRationale('Finance operator should own this.');

    const submit = screen.getByRole('button', { name: /record handoff/i });
    expect(submit.hasAttribute('disabled')).toBe(true);

    await userEvent.click(screen.getByRole('combobox', { name: /target/i }));
    await userEvent.click(screen.getByRole('option', { name: /person: asha patel/i }));
    await userEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        interventionType: 'handoff',
        target: 'member:wm-1',
        surface: 'steering',
        authoritySource: 'delegated-role',
        evidenceRequired: true,
      }),
    );
  });

  it('requires acknowledgement for emergency disable before submitting break-glass authority', async () => {
    const onSubmit = vi.fn();
    render(
      <RunInterventionPanel
        run={runningRun}
        workforceMembers={[]}
        workforceQueues={[]}
        onSubmit={onSubmit}
      />,
    );

    await selectAction(/emergency disable/i);
    setRationale('Potential credential compromise across active automation.');

    const submit = screen.getByRole('button', { name: /record emergency disable/i });
    expect(submit.hasAttribute('disabled')).toBe(true);

    const acknowledgement = screen.getByLabelText(/non-routine intervention/i);
    await userEvent.click(acknowledgement);
    await userEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      interventionType: 'emergency-disable',
      rationale: 'Potential credential compromise across active automation.',
      surface: 'emergency',
      authoritySource: 'incident-break-glass',
      effect: 'workspace-safety-effect',
      consequence:
        'Break-glass action: disables the active automation path and requires incident review.',
      evidenceRequired: true,
    });
  });

  it('does not allow effectful steering after a terminal run', async () => {
    render(
      <RunInterventionPanel
        run={{ ...runningRun, status: 'Succeeded' }}
        workforceMembers={[]}
        workforceQueues={[]}
        onSubmit={vi.fn()}
      />,
    );

    await selectAction(/freeze/i);

    const panel = screen.getByTestId('run-intervention-panel');
    expect(within(panel).getByText(/unavailable for a succeeded run/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /record freeze/i }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

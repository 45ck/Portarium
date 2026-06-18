// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { ApprovalGatePanel } from './approval-gate-panel';

const BASE_APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-1',
  workspaceId: 'ws-default',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve production deployment',
  status: 'Pending',
  requestedAtIso: '2026-02-21T00:00:00.000Z',
  requestedByUserId: 'user-requestor',
};

describe('ApprovalGatePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('blocks approve action when SoD state is blocked-self', async () => {
    const onDecide = vi.fn();
    const user = userEvent.setup();

    render(
      <ApprovalGatePanel
        approval={{
          ...BASE_APPROVAL,
          sodEvaluation: {
            state: 'blocked-self',
            requestorId: 'user-requestor',
            ruleId: 'sod-1',
            rolesRequired: ['approver'],
          },
        }}
        onDecide={onDecide}
      />,
    );

    const approveButton = screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement;
    expect(approveButton.disabled).toBe(true);

    await user.click(approveButton);
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('requires rationale before deny action', async () => {
    const onDecide = vi.fn();
    const user = userEvent.setup();

    render(<ApprovalGatePanel approval={BASE_APPROVAL} onDecide={onDecide} />);

    await user.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'A rationale is required when denying an approval.',
    );

    await user.type(screen.getByPlaceholderText(/Decision rationale/i), 'Insufficient evidence');
    await user.click(screen.getByRole('button', { name: 'Deny' }));

    expect(onDecide).toHaveBeenCalledWith('Denied', 'Insufficient evidence');
  });

  it('renders unclassified agent-action category instead of raw Unknown', () => {
    render(
      <ApprovalGatePanel
        approval={{
          ...BASE_APPROVAL,
          agentActionProposal: {
            proposalId: 'prop-1',
            agentId: 'agent-1',
            toolName: 'tool.snapshot.review',
            toolCategory: 'Unknown',
            blastRadiusTier: 'HumanApprove',
            rationale: 'Review snapshot-backed proposal before action.',
          },
        }}
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByText('Unclassified')).toBeTruthy();
    expect(screen.queryByText('Unknown')).toBeNull();
  });

  it('renders recovered monitor title instead of object placeholder prompt', () => {
    render(
      <ApprovalGatePanel
        approval={{
          ...BASE_APPROVAL,
          prompt: 'Review monitor item: [object Object]',
          approvalPacket: {
            schemaVersion: 1,
            packetId: 'packet-monitor-proof',
            artifacts: [],
            reviewDocs: [],
            requestedCapabilities: [],
            planScope: {
              planId: 'plan-monitor-proof',
              summary:
                'Review latest standing-read monitor attention item: Tenant learning admin signal.',
              actionIds: ['action-monitor-proof'],
              plannedEffectIds: ['effect-monitor-proof'],
            },
          },
        }}
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByText('Review monitor item: Tenant learning admin signal')).toBeTruthy();
    expect(screen.queryByText(/\[object Object\]/i)).toBeNull();
  });
});

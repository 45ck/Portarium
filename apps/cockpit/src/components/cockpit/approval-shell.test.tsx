// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { ApprovalShell } from './approval-shell';

const BASE_APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-shell-1',
  workspaceId: 'ws-default',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Deploy marketing campaign to production',
  status: 'Pending',
  requestedAtIso: '2026-02-23T10:00:00.000Z',
  requestedByUserId: 'user-alice',
};

describe('ApprovalShell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the approval prompt', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()}>
        <p>payload content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText('Deploy marketing campaign to production')).toBeTruthy();
  });

  it('renders the approval ID', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()}>
        <p>payload content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText('appr-shell-1')).toBeTruthy();
  });

  it('renders the requestor', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()}>
        <p>payload content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText('user-alice')).toBeTruthy();
  });

  it('renders children in the content area', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()}>
        <p data-testid="custom-payload">Custom renderer output</p>
      </ApprovalShell>,
    );

    expect(screen.getByTestId('custom-payload')).toBeTruthy();
    expect(screen.getByText('Custom renderer output')).toBeTruthy();
  });

  it('shows action buttons for pending approvals', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()}>
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByRole('button', { name: /approve/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /deny/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /request changes/i })).toBeTruthy();
  });

  it('blocks approve when SoD state is blocked-self', () => {
    render(
      <ApprovalShell
        approval={{
          ...BASE_APPROVAL,
          sodEvaluation: {
            state: 'blocked-self',
            requestorId: 'user-alice',
            ruleId: 'sod-1',
            rolesRequired: ['approver'],
          },
        }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    const approveBtn = screen.getByRole('button', { name: /approve/i }) as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
  });

  it('requires rationale for deny', async () => {
    const onDecide = vi.fn();
    const user = userEvent.setup();

    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={onDecide}>
        <p>content</p>
      </ApprovalShell>,
    );

    await user.click(screen.getByRole('button', { name: /deny/i }));
    expect(onDecide).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText(/rationale/i), 'Not ready');
    await user.click(screen.getByRole('button', { name: /deny/i }));
    expect(onDecide).toHaveBeenCalledWith('Denied', 'Not ready');
  });

  it('calls onDecide with Approved and rationale on approve click', async () => {
    const onDecide = vi.fn();
    const user = userEvent.setup();

    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={onDecide}>
        <p>content</p>
      </ApprovalShell>,
    );

    await user.type(screen.getByPlaceholderText(/rationale/i), 'Looks good');
    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(onDecide).toHaveBeenCalledWith('Approved', 'Looks good');
  });

  it('hides action bar for decided approvals and shows decision', () => {
    render(
      <ApprovalShell
        approval={{
          ...BASE_APPROVAL,
          status: 'Approved',
          decidedByUserId: 'user-bob',
          decidedAtIso: '2026-02-23T12:00:00.000Z',
          rationale: 'Verified and approved',
        }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.getByText(/user-bob/)).toBeTruthy();
    expect(screen.getByText('Verified and approved')).toBeTruthy();
  });

  it('renders assignee when present', () => {
    render(
      <ApprovalShell
        approval={{ ...BASE_APPROVAL, assigneeUserId: 'user-reviewer' }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText('user-reviewer')).toBeTruthy();
  });

  it('renders due date when present and not overdue', () => {
    // Use a far-future date; format(new Date(...), 'MMM d') renders in local TZ
    const dueDate = new Date(2099, 5, 15, 12, 0, 0); // Jun 15 2099 local
    render(
      <ApprovalShell
        approval={{ ...BASE_APPROVAL, dueAtIso: dueDate.toISOString() }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText(/Jun 15/)).toBeTruthy();
  });

  it('shows overdue indicator when past due', () => {
    render(
      <ApprovalShell
        approval={{ ...BASE_APPROVAL, dueAtIso: '2025-01-01T00:00:00.000Z' }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText(/Overdue/)).toBeTruthy();
  });

  it('renders decision history when present', () => {
    render(
      <ApprovalShell
        approval={{
          ...BASE_APPROVAL,
          decisionHistory: [
            {
              type: 'changes_requested',
              actor: 'user-carol',
              message: 'Fix the title',
              timestamp: '2026-02-22T15:00:00.000Z',
            },
            {
              type: 'resubmitted',
              actor: 'user-alice',
              message: 'Title updated',
              timestamp: '2026-02-22T16:00:00.000Z',
            },
          ],
        }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText('Fix the title')).toBeTruthy();
    expect(screen.getByText('Title updated')).toBeTruthy();
  });

  it('renders SoD banner for blocked-self in pending state', () => {
    render(
      <ApprovalShell
        approval={{
          ...BASE_APPROVAL,
          sodEvaluation: {
            state: 'blocked-self',
            requestorId: 'user-alice',
            ruleId: 'sod-1',
            rolesRequired: ['approver'],
          },
        }}
        onDecide={vi.fn()}
      >
        <p>content</p>
      </ApprovalShell>,
    );

    expect(screen.getByText(/cannot approve/i)).toBeTruthy();
  });

  it('applies loading state to action buttons', () => {
    render(
      <ApprovalShell approval={BASE_APPROVAL} onDecide={vi.fn()} loading>
        <p>content</p>
      </ApprovalShell>,
    );

    const approveBtn = screen.getByRole('button', { name: /approve/i }) as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TriageDecisionArea } from './triage-decision-area';

const defaultProps = {
  approvalId: 'appr-1',
  rationale: '',
  onRationaleChange: vi.fn(),
  requestChangesMode: false,
  requestChangesMsg: '',
  onRequestChangesMsgChange: vi.fn(),
  onCancelRequestChanges: vi.fn(),
  onAction: vi.fn(),
  loading: false,
  isBlocked: false,
  denyAttempted: false,
  onDenyAttempted: vi.fn(),
  shouldShakeApprove: false,
  shouldShakeRationale: false,
  onRationaleFocus: vi.fn(),
  onRationaleBlur: vi.fn(),
  reviewFriction: {
    requireExpansion: false,
    requireRationale: false,
    requireSecondConfirm: false,
    escalationLock: false,
  },
  approveAttempted: false,
  approveConfirmArmed: false,
};

describe('TriageDecisionArea', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders all four action buttons', () => {
    render(<TriageDecisionArea {...defaultProps} />);
    expect(screen.getByTitle('Approve (A)')).toBeTruthy();
    expect(screen.getByTitle('Deny (D)')).toBeTruthy();
    expect(screen.getByTitle('Request changes (R)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeTruthy();
    expect(screen.getByTitle('Skip (S)')).toBeTruthy();
  });

  it('disables approve button when blocked', () => {
    render(<TriageDecisionArea {...defaultProps} isBlocked={true} />);
    const btn = screen.getByTitle('Approve (A)') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables approve button when escalation locked', () => {
    render(
      <TriageDecisionArea
        {...defaultProps}
        reviewFriction={{
          requireExpansion: true,
          requireRationale: true,
          requireSecondConfirm: false,
          escalationLock: true,
          lockReason: 'Manual-only Actions must be escalated',
        }}
      />,
    );
    const btn = screen.getByTitle('Manual-only Actions must be escalated') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows deny validation alert when denyAttempted with no rationale', () => {
    render(<TriageDecisionArea {...defaultProps} denyAttempted={true} rationale="" />);
    expect(screen.getByRole('alert').textContent).toContain(
      'A rationale is required when denying an approval.',
    );
  });

  it('shows high-risk approval rationale requirement', () => {
    render(
      <TriageDecisionArea
        {...defaultProps}
        approveAttempted={true}
        reviewFriction={{
          requireExpansion: true,
          requireRationale: true,
          requireSecondConfirm: true,
          escalationLock: false,
        }}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'A rationale is required when approving high-risk Actions.',
    );
  });

  it('labels armed high-risk approval as confirmation', () => {
    render(
      <TriageDecisionArea
        {...defaultProps}
        rationale="Reviewed evidence and blast radius"
        approveConfirmArmed={true}
        reviewFriction={{
          requireExpansion: true,
          requireRationale: true,
          requireSecondConfirm: true,
          escalationLock: false,
        }}
      />,
    );
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Press Confirm');
  });

  it('shows rationale provided message when rationale has text', () => {
    render(<TriageDecisionArea {...defaultProps} rationale="Looks good" />);
    expect(screen.getByText('Rationale provided')).toBeTruthy();
  });

  it('calls onDenyAttempted when denying without rationale', async () => {
    const onDenyAttempted = vi.fn();
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <TriageDecisionArea
        {...defaultProps}
        onAction={onAction}
        onDenyAttempted={onDenyAttempted}
      />,
    );
    await user.click(screen.getByTitle('Deny (D)'));
    expect(onDenyAttempted).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('calls onAction(Denied) when denying with rationale', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<TriageDecisionArea {...defaultProps} rationale="Not ready" onAction={onAction} />);
    await user.click(screen.getByTitle('Deny (D)'));
    expect(onAction).toHaveBeenCalledWith('Denied');
  });

  it('renders request changes form when in requestChangesMode', () => {
    render(<TriageDecisionArea {...defaultProps} requestChangesMode={true} />);
    expect(screen.getByText(/what needs to change/i)).toBeTruthy();
  });

  it('has aria-label on rationale textarea', () => {
    render(<TriageDecisionArea {...defaultProps} />);
    expect(screen.getByLabelText('Decision rationale for approval appr-1')).toBeTruthy();
  });
});

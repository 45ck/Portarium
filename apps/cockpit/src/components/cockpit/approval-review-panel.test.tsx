// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApprovalReviewPanel, type PolicyEvaluationDisplay } from './approval-review-panel';
import type { ApprovalSummary, PlanEffect, EvidenceEntry } from '@portarium/cockpit-types';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeApproval(overrides?: Partial<ApprovalSummary>): ApprovalSummary {
  return {
    schemaVersion: 1,
    approvalId: 'appr-review-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    planId: 'plan-1',
    prompt: 'Deploy database migration to production',
    status: 'Pending',
    requestedAtIso: '2026-02-23T10:00:00Z',
    requestedByUserId: 'usr-alice',
    ...overrides,
  };
}

function makeEvidenceEntry(overrides?: Partial<EvidenceEntry>): EvidenceEntry {
  return {
    schemaVersion: 1,
    evidenceId: 'evi-1',
    workspaceId: 'ws-1',
    occurredAtIso: '2026-02-23T10:00:00Z',
    category: 'Approval',
    summary: 'Approval request opened',
    actor: { kind: 'User', userId: 'usr-alice' },
    hashSha256: 'sha256-abcdef1234567890abcdef',
    ...overrides,
  };
}

function makePlanEffect(overrides?: Partial<PlanEffect>): PlanEffect {
  return {
    effectId: 'eff-1',
    operation: 'Update',
    target: {
      sorName: 'Salesforce',
      portFamily: 'CrmSales',
      externalId: 'ext-123',
      externalType: 'Account',
    },
    summary: 'Update 50 account records',
    ...overrides,
  };
}

function makePolicyEval(overrides?: Partial<PolicyEvaluationDisplay>): PolicyEvaluationDisplay {
  return {
    policyId: 'pol-sod-1',
    policyName: 'SoD Production Policy',
    outcome: 'needs_human',
    explanation: 'Policy requires human approval due to SoD constraints.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — rendering', () => {
  it('renders the approval prompt and ID', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    expect(screen.getByText('Deploy database migration to production')).toBeTruthy();
    expect(screen.getByText('appr-review-1')).toBeTruthy();
  });

  it('renders the requestor in the header', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    // Use getAllByText since requestor appears in header; just confirm at least one exists
    const matches = screen.getAllByText('usr-alice');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the assignee when present', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval({ assigneeUserId: 'usr-bob' })}
        onDecide={onDecide}
      />,
    );

    expect(screen.getByText('usr-bob')).toBeTruthy();
  });

  it('renders the review panel container', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    expect(screen.getByTestId('approval-review-panel')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — tabs', () => {
  it('renders all four tab buttons', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('shows evidence tab selected by default', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} evidenceEntries={[]} />,
    );

    const tablist = screen.getByRole('tablist');
    const evidenceTab = within(tablist).getAllByRole('tab')[0]!;
    expect(evidenceTab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows empty state when no evidence entries', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} evidenceEntries={[]} />,
    );

    expect(screen.getByText(/No evidence entries/i)).toBeTruthy();
  });

  it('switches to policy tab on click', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} policyEvaluations={[]} />,
    );

    const tablist = screen.getByRole('tablist');
    const policyTab = within(tablist).getAllByRole('tab')[1]!;
    await user.click(policyTab);

    expect(policyTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/No policy evaluations/i)).toBeTruthy();
  });

  it('switches to effects tab and shows effects list', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        plannedEffects={[makePlanEffect()]}
      />,
    );

    const tablist = screen.getByRole('tablist');
    const effectsTab = within(tablist).getAllByRole('tab')[2]!;
    await user.click(effectsTab);

    expect(screen.getByText('Update 50 account records')).toBeTruthy();
    expect(screen.getByText(/1 effect planned/)).toBeTruthy();
  });

  it('respects initialTab prop', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        initialTab="policy"
        policyEvaluations={[]}
      />,
    );

    const tablist = screen.getByRole('tablist');
    const policyTab = within(tablist).getAllByRole('tab')[1]!;
    expect(policyTab.getAttribute('aria-selected')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Evidence tab
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — evidence content', () => {
  it('renders evidence entries with summaries', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        evidenceEntries={[
          makeEvidenceEntry({ summary: 'Approval opened by requestor' }),
          makeEvidenceEntry({
            evidenceId: 'evi-2',
            category: 'Policy',
            summary: 'Policy engine evaluated all rules',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Approval opened by requestor')).toBeTruthy();
    expect(screen.getByText('Policy engine evaluated all rules')).toBeTruthy();
  });

  it('shows hash chain links', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        evidenceEntries={[
          makeEvidenceEntry({
            hashSha256: 'sha256-1234567890abcdef1234567890abcdef',
            previousHash: 'sha256-prev000000abcdef0000000000abcdef',
          }),
        ]}
      />,
    );

    // Should show truncated hashes
    expect(screen.getByText(/sha256-12345678/)).toBeTruthy();
    expect(screen.getByText(/sha256-prev0000/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Policy tab
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — policy content', () => {
  it('renders policy evaluation with outcome', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        initialTab="policy"
        policyEvaluations={[makePolicyEval()]}
      />,
    );

    expect(screen.getByText('SoD Production Policy')).toBeTruthy();
    expect(screen.getByText('needs_human')).toBeTruthy();
    expect(screen.getByText(/requires human approval/)).toBeTruthy();
  });

  it('renders rule traces when present', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        initialTab="policy"
        policyEvaluations={[
          makePolicyEval({
            ruleTraces: [
              {
                ruleId: 'rule-1',
                condition: 'riskTags contains "high-impact"',
                effect: 'Deny',
                outcome: 'matched',
                explanation: 'Condition evaluated to true.',
              },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText('Rule Traces')).toBeTruthy();
    expect(screen.getByText('rule-1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Effects tab
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — effects content', () => {
  it('shows operation badges and target info', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        initialTab="effects"
        plannedEffects={[
          makePlanEffect({ operation: 'Create', summary: 'Create new user account' }),
          makePlanEffect({
            effectId: 'eff-2',
            operation: 'Delete',
            summary: 'Remove stale cache entry',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Create new user account')).toBeTruthy();
    expect(screen.getByText('Remove stale cache entry')).toBeTruthy();
    expect(screen.getByText(/2 effects planned/)).toBeTruthy();
  });

  it('shows external link when deepLinkUrl present', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval()}
        onDecide={onDecide}
        initialTab="effects"
        plannedEffects={[
          makePlanEffect({
            target: {
              sorName: 'Salesforce',
              portFamily: 'CrmSales',
              externalId: 'ext-123',
              externalType: 'Account',
              deepLinkUrl: 'https://example.com/account/123',
            },
          }),
        ]}
      />,
    );

    const viewLink = screen.getByText('View');
    expect(viewLink).toBeTruthy();
    expect(viewLink.closest('a')?.getAttribute('href')).toBe('https://example.com/account/123');
  });
});

// ---------------------------------------------------------------------------
// Discussion tab
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — discussion content', () => {
  it('renders decision history entries', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel
        approval={makeApproval({
          decisionHistory: [
            {
              timestamp: '2026-02-23T09:00:00Z',
              type: 'changes_requested',
              actor: 'usr-carol',
              message: 'Please update blast radius analysis',
            },
          ],
        })}
        onDecide={onDecide}
        initialTab="discussion"
      />,
    );

    expect(screen.getByText('usr-carol')).toBeTruthy();
    expect(screen.getByText('Please update blast radius analysis')).toBeTruthy();
    expect(screen.getByText('Changes Requested')).toBeTruthy();
  });

  it('shows empty state when no discussion', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} initialTab="discussion" />,
    );

    expect(screen.getByText(/No prior decisions/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Decision actions
// ---------------------------------------------------------------------------

describe('ApprovalReviewPanel — actions', () => {
  it('renders approve, deny, request changes buttons for pending approval', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    expect(screen.getByRole('button', { name: /Approve/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Deny/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Request Changes/i })).toBeTruthy();
  });

  it('calls onDecide with Approved when approve button clicked', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    await user.click(screen.getByRole('button', { name: /Approve/i }));

    expect(onDecide).toHaveBeenCalledWith('Approved', '');
  });

  it('calls onDecide with Denied when deny button clicked', async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} />);

    await user.click(screen.getByRole('button', { name: /Deny/i }));

    expect(onDecide).toHaveBeenCalledWith('Denied', '');
  });

  it('hides action bar for decided approvals', () => {
    const onDecide = vi.fn();
    render(
      <ApprovalReviewPanel approval={makeApproval({ status: 'Approved' })} onDecide={onDecide} />,
    );

    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Deny$/i })).toBeNull();
  });

  it('disables buttons when loading', () => {
    const onDecide = vi.fn();
    render(<ApprovalReviewPanel approval={makeApproval()} onDecide={onDecide} loading={true} />);

    const buttons = screen
      .getAllByRole('button')
      .filter(
        (btn) =>
          btn.textContent?.includes('Approve') ||
          btn.textContent?.includes('Deny') ||
          btn.textContent?.includes('Request Changes'),
      );

    for (const btn of buttons) {
      expect(btn.hasAttribute('disabled')).toBe(true);
    }
  });
});

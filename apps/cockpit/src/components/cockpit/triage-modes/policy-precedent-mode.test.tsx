// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
} from '@portarium/cockpit-types';
import { PolicyPrecedentMode } from './policy-precedent-mode';

afterEach(() => {
  cleanup();
});

function makeApproval(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    schemaVersion: 1,
    approvalId: 'appr-precedent-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    planId: 'plan-1',
    prompt: 'Approve production CRM update',
    status: 'Pending',
    requestedAtIso: '2026-02-23T10:00:00Z',
    requestedByUserId: 'usr-alice',
    policyRule: {
      ruleId: 'pol-crm-prod',
      trigger: 'CrmSales production update',
      tier: 'HumanApprove',
      blastRadius: ['Salesforce', '10 records'],
      irreversibility: 'partial',
    },
    ...overrides,
  };
}

function makeEffect(overrides: Partial<PlanEffect> = {}): PlanEffect {
  return {
    effectId: 'eff-1',
    operation: 'Update',
    target: {
      sorName: 'Salesforce',
      portFamily: 'CrmSales',
      externalId: 'acct-1',
      externalType: 'Account',
    },
    summary: 'Update account',
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    schemaVersion: 1,
    evidenceId: 'ev-1',
    workspaceId: 'ws-1',
    occurredAtIso: '2026-02-23T10:00:00Z',
    category: 'Approval',
    summary: 'Approval opened',
    actor: { kind: 'System' },
    hashSha256: 'hash-1',
    ...overrides,
  };
}

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    schemaVersion: 1,
    runId: 'run-1',
    workspaceId: 'ws-1',
    workflowId: 'wf-1',
    correlationId: 'corr-1',
    executionTier: 'HumanApprove',
    initiatedByUserId: 'usr-alice',
    status: 'WaitingForApproval',
    createdAtIso: '2026-02-23T09:59:00Z',
    ...overrides,
  };
}

describe('PolicyPrecedentMode', () => {
  it('renders one-off decision actions by default', () => {
    render(
      <PolicyPrecedentMode
        approval={makeApproval()}
        plannedEffects={[makeEffect()]}
        evidenceEntries={[makeEvidence()]}
        run={makeRun()}
      />,
    );

    expect(screen.getByTestId('policy-precedent-mode')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve once' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deny once' })).toBeTruthy();
    expect(screen.getByText('One-off decision')).toBeTruthy();
    expect(screen.getByText('Approval decision remains scoped to the current Run.')).toBeTruthy();
  });

  it('switches to future policy mutations with audit and replay context', async () => {
    const user = userEvent.setup();
    render(
      <PolicyPrecedentMode
        approval={makeApproval()}
        plannedEffects={[makeEffect()]}
        evidenceEntries={[makeEvidence()]}
        run={makeRun()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Future similar cases' }));
    await user.click(screen.getByRole('button', { name: 'Deny and create rule' }));

    expect(screen.getByText('Policy mutation')).toBeTruthy();
    expect(screen.getByText(/THEN DENY/)).toBeTruthy();
    expect(screen.getByText('policy simulation input')).toBeTruthy();
    expect(screen.getByText('approval replay compatible')).toBeTruthy();
    expect(screen.getByText('Matching future Actions should be policy-blocked')).toBeTruthy();
    expect(screen.getByText('appr-precedent-1')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Stage policy proposal' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('stages a future policy proposal with approval and evidence linkage', async () => {
    const user = userEvent.setup();
    render(
      <PolicyPrecedentMode
        approval={makeApproval()}
        plannedEffects={[makeEffect()]}
        evidenceEntries={[makeEvidence()]}
        run={makeRun()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Future similar cases' }));
    await user.click(screen.getByRole('button', { name: 'Stage policy proposal' }));

    expect(
      screen.getByText('Policy proposal staged for simulation before activation.'),
    ).toBeTruthy();
    expect(screen.getByText(/Linked to approval appr-precedent-1, Run run-1/)).toBeTruthy();
  });

  it('prefills and updates rationale used by the staged proposal', async () => {
    const user = userEvent.setup();
    render(
      <PolicyPrecedentMode
        approval={makeApproval({ rationale: 'Initial reviewer note' })}
        plannedEffects={[makeEffect()]}
        evidenceEntries={[]}
      />,
    );

    const rationale = screen.getByLabelText('Rationale');
    expect(rationale).toHaveProperty('value', 'Initial reviewer note');

    await user.clear(rationale);
    await user.type(rationale, 'Escalate future production updates.');
    await user.click(screen.getByRole('button', { name: 'Future similar cases' }));
    await user.click(screen.getByRole('button', { name: 'Escalate this Action class' }));

    expect(screen.getByText('Escalate future production updates.')).toBeTruthy();
  });
});

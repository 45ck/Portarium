import { describe, expect, it } from 'vitest';
import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
} from '@portarium/cockpit-types';
import {
  buildApprovalPolicyConversionProposal,
  defaultApprovalPolicyConversionScope,
} from './approval-policy-conversion';

function makeApproval(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    schemaVersion: 1,
    approvalId: 'appr-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    planId: 'plan-1',
    workItemId: 'work-item-1',
    prompt: 'Approve production CRM account update',
    status: 'Pending',
    requestedAtIso: '2026-02-23T10:00:00Z',
    requestedByUserId: 'usr-alice',
    policyRule: {
      ruleId: 'pol-crm-prod',
      trigger: 'CrmSales account update in production',
      tier: 'HumanApprove',
      blastRadius: ['Salesforce', '25 records'],
      irreversibility: 'partial',
    },
    sodEvaluation: {
      state: 'eligible',
      requestorId: 'usr-alice',
      ruleId: 'sod-1',
      rolesRequired: ['sales-ops-approver'],
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
    summary: 'Update CRM account status',
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

describe('approval policy conversion proposal', () => {
  it('keeps approve once scoped to the current Run without a policy mutation', () => {
    const proposal = buildApprovalPolicyConversionProposal({
      approval: makeApproval(),
      plannedEffects: [makeEffect()],
      evidenceEntries: [makeEvidence()],
      run: makeRun(),
      action: 'approve-once',
      rationale: 'Acceptable for this incident window.',
    });

    expect(proposal.scope).toBe('CurrentRunOnly');
    expect(proposal.decision).toBe('Approved');
    expect(proposal.policyMutation).toBe(false);
    expect(proposal.diff[0]).toMatchObject({
      field: 'runEffect',
      toValue: 'Current Run decision only',
    });
    expect(proposal.feedbackReasons).toContainEqual(
      expect.objectContaining({
        code: 'runtime-decision.current-run-only',
        dimension: 'environment',
      }),
    );
    expect(proposal.auditLink).toMatchObject({
      approvalId: 'appr-1',
      runId: 'run-1',
      planId: 'plan-1',
      workItemId: 'work-item-1',
      evidenceIds: ['ev-1'],
    });
  });

  it('builds a deny-and-create-rule proposal that can be replayed as a blocking policy', () => {
    const proposal = buildApprovalPolicyConversionProposal({
      approval: makeApproval(),
      plannedEffects: [makeEffect()],
      evidenceEntries: [makeEvidence()],
      run: makeRun(),
      action: 'deny-and-create-rule',
      rationale: 'Near miss: production blast radius exceeded normal bounds.',
    });

    expect(proposal.scope).toBe('FutureSimilarCases');
    expect(proposal.decision).toBe('Denied');
    expect(proposal.policyMutation).toBe(true);
    expect(proposal.policyBlocked).toBe(true);
    expect(proposal.ruleText).toContain('THEN DENY');
    expect(proposal.feedbackReasons).toContainEqual(
      expect.objectContaining({
        code: 'policy.block-matching-actions',
        dimension: 'capability',
      }),
    );
    expect(proposal.simulation).toMatchObject({
      policyId: 'pol-crm-prod',
      triggerAction: 'CrmSales',
      triggerCondition: 'environment = "production"',
      policyBlocked: true,
      replaySubjectIds: ['appr-1', 'run-1'],
    });
  });

  it('prefills evidence requirements from the approval context', () => {
    const proposal = buildApprovalPolicyConversionProposal({
      approval: makeApproval(),
      evidenceEntries: [makeEvidence({ evidenceId: 'ev-1' }), makeEvidence({ evidenceId: 'ev-2' })],
      action: 'require-more-evidence-next-time',
    });

    expect(proposal.decision).toBe('RequestChanges');
    expect(proposal.suggestedDimension).toBe('evidence');
    expect(proposal.requiredEvidenceCount).toBe(3);
    expect(proposal.ruleText).toContain('evidence.count >= 3');
    expect(proposal.diff).toContainEqual(
      expect.objectContaining({
        field: 'evidence.count',
        fromValue: '2',
        toValue: '3',
      }),
    );
    expect(proposal.feedbackReasons).toContainEqual(
      expect.objectContaining({
        code: 'evidence.minimum-count',
        dimension: 'evidence',
      }),
    );
  });

  it('documents the default scope for every decision action', () => {
    expect(defaultApprovalPolicyConversionScope('approve-once')).toBe('CurrentRunOnly');
    expect(defaultApprovalPolicyConversionScope('deny-once')).toBe('CurrentRunOnly');
    expect(defaultApprovalPolicyConversionScope('approve-and-loosen-rule')).toBe(
      'FutureSimilarCases',
    );
    expect(defaultApprovalPolicyConversionScope('escalate-action-class')).toBe(
      'FutureSimilarCases',
    );
  });
});

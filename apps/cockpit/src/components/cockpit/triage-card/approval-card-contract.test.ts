import { describe, expect, it } from 'vitest';
import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { APPROVAL_CARD_CONTRACT_NAME, buildApprovalCardContract } from './approval-card-contract';

const APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Send the customer a corrected invoice',
  status: 'Pending',
  requestedAtIso: '2026-04-01T10:00:00.000Z',
  requestedByUserId: 'user-requestor',
  policyRule: {
    ruleId: 'rule-assisted',
    trigger: 'billing-update',
    tier: 'Assisted',
    blastRadius: ['Odoo', '1 record'],
    irreversibility: 'none',
  },
  agentActionProposal: {
    proposalId: 'proposal-1',
    agentId: 'agent-1',
    toolName: 'update_invoice',
    toolCategory: 'Mutation',
    blastRadiusTier: 'Assisted',
    rationale: 'Invoice total must match the approved credit note.',
  },
};

const EFFECT: PlanEffect = {
  effectId: 'effect-1',
  operation: 'Update',
  summary: 'Update invoice INV-1001 total',
  target: {
    sorName: 'Odoo',
    portFamily: 'FinanceAccounting',
    externalId: 'INV-1001',
    externalType: 'Invoice',
    displayLabel: 'INV-1001',
  },
};

const RUN: RunSummary = {
  schemaVersion: 1,
  runId: 'run-1',
  workspaceId: 'ws-1',
  workflowId: 'wf-1',
  correlationId: 'corr-1',
  executionTier: 'Assisted',
  initiatedByUserId: 'user-requestor',
  status: 'WaitingForApproval',
  createdAtIso: '2026-04-01T09:59:00.000Z',
};

const WORKFLOW: WorkflowSummary = {
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Correct invoice',
  description: 'Correct a customer invoice after finance review.',
  version: 1,
  active: true,
  executionTier: 'Assisted',
  actions: [
    {
      actionId: 'action-1',
      order: 1,
      portFamily: 'FinanceAccounting',
      operation: 'UpdateInvoice',
    },
  ],
};

function evidence(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    schemaVersion: 1,
    evidenceId: 'ev-1',
    workspaceId: 'ws-1',
    occurredAtIso: '2026-04-01T10:01:00.000Z',
    category: 'Plan',
    summary: 'Plan approved by finance constraints',
    actor: { kind: 'System' },
    hashSha256: 'hash-1',
    ...overrides,
  };
}

describe('buildApprovalCardContract', () => {
  it('names the shared approval card contract and keeps low-risk approvals in fast triage', () => {
    const contract = buildApprovalCardContract({
      approval: APPROVAL,
      plannedEffects: [EFFECT],
      evidenceEntries: [evidence()],
      run: RUN,
      workflow: WORKFLOW,
    });

    expect(contract.contractName).toBe(APPROVAL_CARD_CONTRACT_NAME);
    expect(contract.riskTier).toBe('low');
    expect(contract.reviewDepth).toBe('fast-triage');
    expect(contract.friction.requireRationale).toBe(false);
    expect(contract.fields.proposedAction.value).toContain('Update invoice INV-1001 total');
    expect(contract.fields.intent.value).toBe('Correct a customer invoice after finance review.');
    expect(contract.fields.systemsTouched.value).toContain('Odoo');
    expect(contract.fields.policyResult.value).toContain('Assisted');
    expect(contract.fields.reversibility.value).toBe('Reversible');
    expect(contract.fields.evidence.value).toContain('chain verified');
  });

  it('escalates irreversible or dangerous approvals into high-risk deep review friction', () => {
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        policyRule: {
          ruleId: 'rule-dangerous',
          trigger: 'bulk-delete',
          tier: 'HumanApprove',
          blastRadius: ['Odoo', 'Salesforce', '25 records'],
          irreversibility: 'full',
        },
        agentActionProposal: {
          ...APPROVAL.agentActionProposal!,
          toolCategory: 'Dangerous',
          blastRadiusTier: 'HumanApprove',
        },
      },
      plannedEffects: [
        EFFECT,
        {
          ...EFFECT,
          effectId: 'effect-2',
          operation: 'Delete',
          summary: 'Delete stale opportunity',
          target: { ...EFFECT.target, sorName: 'Salesforce', externalType: 'Opportunity' },
        },
      ],
      evidenceEntries: [evidence()],
      run: { ...RUN, executionTier: 'HumanApprove' },
      workflow: WORKFLOW,
    });

    expect(contract.riskTier).toBe('high');
    expect(contract.reviewDepth).toBe('deep-review');
    expect(contract.friction.requireExpansion).toBe(true);
    expect(contract.friction.requireRationale).toBe(true);
    expect(contract.friction.requireSecondConfirm).toBe(true);
    expect(contract.escalationReasons).toEqual(
      expect.arrayContaining([
        'Irreversible Action',
        'Delete effect',
        'Dangerous tool',
        'Multiple systems touched',
      ]),
    );
  });

  it('locks approval for manual-only review without adding backend fields', () => {
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        policyRule: {
          ruleId: 'rule-manual',
          trigger: 'manual-handoff',
          tier: 'ManualOnly',
          blastRadius: ['Gmail', '1 record'],
          irreversibility: 'partial',
        },
      },
      plannedEffects: [EFFECT],
      evidenceEntries: [evidence()],
      run: { ...RUN, executionTier: 'ManualOnly' },
      workflow: WORKFLOW,
    });

    expect(contract.reviewDepth).toBe('escalation-lock');
    expect(contract.friction.escalationLock).toBe(true);
    expect(contract.friction.lockReason).toContain('Manual-only');
  });

  it('derives prior related Actions from evidence and decision history', () => {
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        decisionHistory: [
          {
            timestamp: '2026-04-01T09:58:00.000Z',
            type: 'changes_requested',
            actor: 'user-reviewer',
            message: 'Attach the signed credit note.',
          },
        ],
      },
      plannedEffects: [EFFECT],
      evidenceEntries: [
        evidence({
          evidenceId: 'ev-action',
          category: 'Action',
          summary: 'Validated invoice diff against credit note.',
        }),
      ],
      run: RUN,
      workflow: WORKFLOW,
    });

    expect(contract.fields.priorRelatedActions.value).toContain(
      'Validated invoice diff against credit note.',
    );
    expect(contract.fields.priorRelatedActions.value).toContain(
      'changes_requested: Attach the signed credit note.',
    );
  });
});

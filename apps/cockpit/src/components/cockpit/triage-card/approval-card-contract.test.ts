import { describe, expect, it } from 'vitest';
import type {
  ApprovalSummary,
  EvidenceEntry,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import {
  APPROVAL_CARD_CONTRACT_NAME,
  buildApprovalCardContract,
  summarizeApprovalPrompt,
  summarizeApprovalTitle,
} from './approval-card-contract';

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

  it('keeps packet-only OpenClaw approval cards compact and avoids duplicate intent', () => {
    const prompt =
      'OpenClaw approval required: email_query on email-tenant:tenant-account-alert-watch. authority A3. environment hosted-private. proposal standing-read-attention-review-tenant-account-alert-watch-attention-5dcf004b298556ae. Review latest standing-read monitor attention item: Tenant mailbox account/security signal. Severity: medium. Reason: Bounded standing-read query matched 4 visible redacted/hashable signals. Required review: Review the scoped redacted result through OpenClaw/Portarium before drafting any action proposal.';
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        prompt,
        agentActionProposal: undefined,
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-openclaw-1',
          artifacts: [
            {
              artifactId: 'artifact-openclaw-1',
              title: 'OpenClaw approval request',
              mimeType: 'application/json',
              role: 'primary',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'openclaw.email_query',
              reason: 'Review redacted monitor signal before any follow-up proposal.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-openclaw-1',
            summary: prompt,
            actionIds: ['action-openclaw-1'],
            plannedEffectIds: ['effect-openclaw-1'],
          },
        },
      },
      plannedEffects: [],
      evidenceEntries: [evidence()],
    });

    expect(contract.fields.proposedAction.value).toBe(
      'Review monitor item: Tenant mailbox account/security signal',
    );
    expect(contract.fields.intent.value).toBe(
      'Review packet scope and decide operator intent only.',
    );
  });

  it('uses a distinct approval packet plan scope as the intent fallback', () => {
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        prompt: 'Review monitor item: Tenant mailbox account/security signal',
        agentActionProposal: undefined,
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-openclaw-2',
          artifacts: [
            {
              artifactId: 'artifact-openclaw-2',
              title: 'OpenClaw approval request',
              mimeType: 'application/json',
              role: 'primary',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'openclaw.email_query',
              reason: 'Review redacted monitor signal before any follow-up proposal.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-openclaw-2',
            summary:
              'Decide whether OpenClaw may review the redacted tenant signal and draft bounded follow-up proposals only.',
            actionIds: ['action-openclaw-2'],
            plannedEffectIds: ['effect-openclaw-2'],
          },
        },
      },
      plannedEffects: [],
      evidenceEntries: [evidence()],
    });

    expect(contract.fields.intent.value).toBe(
      'Decide whether OpenClaw may review the redacted tenant signal and draft bounded follow-up proposals only.',
    );
    expect(contract.fields.intent.evidenceSource).toBe('ApprovalPacket');
  });

  it('uses approval packet metadata to fill sparse OpenClaw summary fields', () => {
    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        prompt: 'Review cloud browser query: provider notifications page visual proof',
        policyRule: undefined,
        agentActionProposal: undefined,
        rationale: undefined,
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-provider-proof',
          operatorBrief: {
            schemaVersion: 1,
            action: 'Open only the provider notifications page and store one private screenshot.',
            whyGated: 'This uses a VM-private browser profile for a live provider account.',
            whatApprovingAllows: ['Open the exact notifications URL.'],
            whatApprovingDoesNotAllow: ['No messages, applications, uploads, or raw screenshot return.'],
            risk: 'Sensitive read with private visual evidence.',
            rollback: 'Let the approval expire or deny it in Cockpit.',
            recommendation: 'Approve only if the exact URL and screenshot scope match the test.',
            userVisibleConsequence: 'Approval records intent only.',
            authority: 'A3 hosted-private cloud-browser read',
          },
          artifacts: [
            {
              artifactId: 'artifact-card',
              title: 'OpenClaw approval request',
              mimeType: 'application/json',
              role: 'primary',
            },
            {
              artifactId: 'planned-visual',
              title: 'Expected VM-private visual evidence after approval',
              mimeType: 'application/vnd.portarium.visual-evidence-plan+json',
              role: 'decision-evidence',
              sourceFamily: 'tenant-private-cloud-browser',
              sourceId: 'provider-notifications',
              displayPolicy: 'metadata-only',
            },
          ],
          visualEvidenceTimeline: [
            {
              artifactId: 'planned-visual',
              title: 'Expected VM-private visual evidence after approval',
              mimeType: 'application/vnd.portarium.visual-evidence-plan+json',
              role: 'decision-evidence',
              sourceFamily: 'tenant-private-cloud-browser',
              sourceId: 'provider-notifications',
              displayPolicy: 'metadata-only',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'openclaw.cloud_browser_query',
              reason: 'Exact LinkedIn notifications proof after approval.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-provider-proof',
            summary: 'Review the exact provider notifications visual proof scope.',
            actionIds: ['action-provider-proof'],
            plannedEffectIds: ['effect-provider-proof'],
          },
        },
      },
      plannedEffects: [],
      evidenceEntries: [],
    });

    expect(contract.fields.systemsTouched.value).toContain(
      'tenant-private-cloud-browser:provider-notifications',
    );
    expect(contract.fields.systemsTouched.value).toContain('openclaw.cloud_browser_query');
    expect(contract.fields.policyResult.value).toBe(
      'Approval packet authority: A3 hosted-private cloud-browser read',
    );
    expect(contract.fields.blastRadius.value).toContain('1 planned Action, 1 planned effect');
    expect(contract.fields.reversibility.value).toContain('Let the approval expire');
    expect(contract.fields.evidence.value).toBe('1 packet artifact(s); 1 visual timeline item(s)');
    expect(contract.fields.rationale.value).toBe(
      'Approve only if the exact URL and screenshot scope match the test.',
    );
  });

  it('summarizes repeated OpenClaw rationale text instead of rendering an essay tile', () => {
    const longRationale =
      'OpenClaw approval required: email_query on email-tenant:tenant-account-alert-watch. authority A3. environment hosted-private. proposal standing-read-attention-review-tenant-account-alert-watch-attention-5dcf004b298556ae. Review latest standing-read monitor attention item: Tenant mailbox account/security signal. Severity: medium. Reason: Bounded standing-read query matched 4 visible redacted/hashable signals. Required review: Review the scoped redacted result through OpenClaw/Portarium before drafting any action proposal.';

    const contract = buildApprovalCardContract({
      approval: {
        ...APPROVAL,
        prompt: longRationale,
        rationale: longRationale,
        agentActionProposal: undefined,
      },
      plannedEffects: [],
      evidenceEntries: [evidence()],
    });

    expect(contract.fields.rationale.value).toBe(
      'Review monitor item: Tenant mailbox account/security signal',
    );
  });

  it('does not render object placeholders in monitor approval summaries', () => {
    expect(
      summarizeApprovalPrompt(
        'Review latest standing-read monitor attention item: [object Object]. Severity: medium.',
      ),
    ).toBe('Review monitor attention item');
    expect(summarizeApprovalPrompt('Review monitor item: [object Object]')).toBe(
      'Review monitor attention item',
    );
  });

  it('summarizes object-shaped approval text by its real label', () => {
    expect(
      summarizeApprovalPrompt({
        label: 'Tenant finance cashflow/bills signal',
        source: 'tenant-finance-cashflow-watch',
      }),
    ).toBe('Tenant finance cashflow/bills signal');
  });

  it('uses approval packet summary to recover real monitor names for stale prompt titles', () => {
    expect(
      summarizeApprovalTitle({
        ...APPROVAL,
        prompt: 'Review monitor item: [object Object]',
        agentActionProposal: undefined,
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-openclaw-stale',
          artifacts: [
            {
              artifactId: 'artifact-openclaw-stale',
              title: 'OpenClaw approval request',
              mimeType: 'application/json',
              role: 'primary',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'openclaw.email_query',
              reason: 'Review redacted monitor signal before any follow-up proposal.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-openclaw-stale',
            summary:
              'OpenClaw approval required: email_query on tenant-finance:cashflow-watch. Review latest standing-read monitor attention item: Tenant finance cashflow/bills signal. Severity: medium.',
            actionIds: ['action-openclaw-stale'],
            plannedEffectIds: ['effect-openclaw-stale'],
          },
        },
      }),
    ).toBe('Review monitor item: Tenant finance cashflow/bills signal');
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

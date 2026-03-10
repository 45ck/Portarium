import { describe, expect, it } from 'vitest';
import type { ApprovalSummary, EvidenceEntry, RunSummary } from '@portarium/cockpit-types';
import {
  buildAgentActionPanelSummary,
  buildEvidencePanelSummary,
  buildPolicyPanelSummary,
  buildRunTimelinePanelSummary,
} from './approval-context-panels-summary';

const BASE_APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve release',
  status: 'Pending',
  requestedAtIso: '2026-02-21T00:00:00.000Z',
  requestedByUserId: 'user-1',
  policyRule: {
    ruleId: 'rule-1',
    trigger: 'prod.change',
    tier: 'HumanApprove',
    blastRadius: ['erp', '3-records'],
    irreversibility: 'partial',
  },
  sodEvaluation: {
    state: 'eligible',
    requestorId: 'user-1',
    ruleId: 'sod-1',
    rolesRequired: ['approver'],
  },
};

function mkEvidence(id: string, occurredAtIso: string, previousHash?: string): EvidenceEntry {
  return {
    schemaVersion: 1,
    evidenceId: id,
    workspaceId: 'ws-1',
    occurredAtIso,
    category: 'Action',
    summary: id,
    actor: { kind: 'System' },
    hashSha256: `${id}-hash`,
    previousHash,
    payloadRefs: [],
  };
}

describe('approval context panel summary helpers', () => {
  it('builds policy summary from approval policy and SoD state', () => {
    const summary = buildPolicyPanelSummary(BASE_APPROVAL);
    expect(summary.tierLabel).toBe('HumanApprove');
    expect(summary.triggerLabel).toBe('prod.change');
    expect(summary.irreversibilityLabel).toBe('Partially reversible');
    expect(summary.sodLabel).toBe('Eligible');
  });

  it('detects verified evidence chain and latest timestamp', () => {
    const one = mkEvidence('ev-1', '2026-02-21T00:01:00.000Z');
    const two = mkEvidence('ev-2', '2026-02-21T00:02:00.000Z', one.hashSha256);
    const summary = buildEvidencePanelSummary([one, two]);

    expect(summary.entryCount).toBe(2);
    expect(summary.chainStatus).toBe('verified');
    expect(summary.latestOccurredAtIso).toBe('2026-02-21T00:02:00.000Z');
  });

  it('detects broken evidence chain when hashes do not line up', () => {
    const one = mkEvidence('ev-1', '2026-02-21T00:01:00.000Z');
    const two = mkEvidence('ev-2', '2026-02-21T00:02:00.000Z', 'wrong-hash');
    const summary = buildEvidencePanelSummary([one, two]);
    expect(summary.chainStatus).toBe('broken');
  });

  it('builds run timeline summary with cycle count and overdue flag', () => {
    const approval: ApprovalSummary = {
      ...BASE_APPROVAL,
      dueAtIso: '2001-01-01T00:00:00.000Z',
      decisionHistory: [
        {
          timestamp: '2026-02-21T01:00:00.000Z',
          type: 'changes_requested',
          actor: 'approver-1',
          message: 'Need rollback plan',
        },
        {
          timestamp: '2026-02-21T01:05:00.000Z',
          type: 'resubmitted',
          actor: 'requestor-1',
          message: 'Updated',
        },
      ],
    };
    const run: RunSummary = {
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-1',
      status: 'WaitingForApproval',
      createdAtIso: '2026-02-21T00:00:00.000Z',
    };

    const summary = buildRunTimelinePanelSummary(approval, run);
    expect(summary.runStatusLabel).toBe('WaitingForApproval');
    expect(summary.executionTierLabel).toBe('HumanApprove');
    expect(summary.cycleCount).toBe(2);
    expect(summary.isOverdue).toBe(true);
  });

  describe('buildAgentActionPanelSummary', () => {
    it('returns null when agentActionProposal is absent', () => {
      const result = buildAgentActionPanelSummary(BASE_APPROVAL);
      expect(result).toBeNull();
    });

    it('correctly maps ReadOnly toolCategory', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-1',
          agentId: 'agent-1',
          toolName: 'read_file',
          toolCategory: 'ReadOnly',
          blastRadiusTier: 'Auto',
          rationale: 'Reading config',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.categoryLabel).toBe('Read-only');
      expect(result.categoryVariant).toBe('secondary');
    });

    it('correctly maps Mutation toolCategory', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-2',
          agentId: 'agent-1',
          toolName: 'update_record',
          toolCategory: 'Mutation',
          blastRadiusTier: 'HumanApprove',
          rationale: 'Updating a record',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.categoryLabel).toBe('Mutation');
      expect(result.categoryVariant).toBe('warning');
    });

    it('correctly maps Dangerous toolCategory', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-3',
          agentId: 'agent-1',
          toolName: 'delete_all',
          toolCategory: 'Dangerous',
          blastRadiusTier: 'ManualOnly',
          rationale: 'Deleting everything',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.categoryLabel).toBe('Dangerous');
      expect(result.categoryVariant).toBe('destructive');
    });

    it('correctly maps Unknown toolCategory', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-4',
          agentId: 'agent-1',
          toolName: 'custom_tool',
          toolCategory: 'Unknown',
          blastRadiusTier: 'Auto',
          rationale: 'Unknown tool usage',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.categoryLabel).toBe('Unknown');
      expect(result.categoryVariant).toBe('outline');
    });

    it('correctly maps Auto blastRadiusTier', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-5',
          agentId: 'agent-1',
          toolName: 'read_file',
          toolCategory: 'ReadOnly',
          blastRadiusTier: 'Auto',
          rationale: 'Reading',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.tierLabel).toBe('Auto');
    });

    it('correctly maps Assisted blastRadiusTier', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-6',
          agentId: 'agent-1',
          toolName: 'suggest_fix',
          toolCategory: 'Mutation',
          blastRadiusTier: 'Assisted',
          rationale: 'Suggesting a fix',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.tierLabel).toBe('Assisted');
    });

    it('correctly maps HumanApprove blastRadiusTier', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-7',
          agentId: 'agent-1',
          toolName: 'send_email',
          toolCategory: 'Mutation',
          blastRadiusTier: 'HumanApprove',
          rationale: 'Sending email',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.tierLabel).toBe('Human Approve');
    });

    it('correctly maps ManualOnly blastRadiusTier', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-8',
          agentId: 'agent-1',
          toolName: 'delete_all',
          toolCategory: 'Dangerous',
          blastRadiusTier: 'ManualOnly',
          rationale: 'Deleting everything',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.tierLabel).toBe('Manual Only');
    });

    it('populates toolName, agentId, and rationale from the proposal', () => {
      const approval: ApprovalSummary = {
        ...BASE_APPROVAL,
        agentActionProposal: {
          proposalId: 'prop-9',
          agentId: 'agent-42',
          toolName: 'run_query',
          toolCategory: 'ReadOnly',
          blastRadiusTier: 'Auto',
          rationale: 'Running a diagnostic query',
        },
      };
      const result = buildAgentActionPanelSummary(approval)!;
      expect(result.toolName).toBe('run_query');
      expect(result.agentId).toBe('agent-42');
      expect(result.rationale).toBe('Running a diagnostic query');
    });
  });
});

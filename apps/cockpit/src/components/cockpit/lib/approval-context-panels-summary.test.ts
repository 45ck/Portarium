import { describe, expect, it } from 'vitest';
import type { ApprovalSummary, EvidenceEntry, RunSummary } from '@portarium/cockpit-types';
import {
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
});

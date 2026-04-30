import { describe, expect, it } from 'vitest';

import {
  ApprovalId,
  EvidenceId,
  PlanId,
  PolicyId,
  RunId,
  WorkspaceId,
} from '../primitives/index.js';

import {
  assessDecisionContextSufficiency,
  validateDecisionContextPacket,
  type DecisionContextPacketV1,
} from './decision-context-packet-v1.js';

function makePacket(overrides: Partial<DecisionContextPacketV1> = {}): DecisionContextPacketV1 {
  return {
    schemaVersion: 1,
    packetId: 'packet-1',
    workspaceId: WorkspaceId('ws-1'),
    surface: 'approval',
    target: {
      runId: RunId('run-1'),
      approvalId: ApprovalId('approval-1'),
      planId: PlanId('plan-1'),
    },
    declaredGoal: 'Reconcile the monthly invoice batch.',
    scopeBoundary: 'Only invoices under AUD 5,000 are in scope.',
    currentStep: 'Agent proposed invoice updates.',
    nextStepPreview: 'If approved, the billing adapter writes three updates.',
    proposedChange: {
      kind: 'action',
      summary: 'Update three invoice records.',
      blastRadius: ['billing', 'finance'],
      reversibility: 'partial',
    },
    policy: {
      policyIds: [PolicyId('policy-1')],
      rationale: 'Mutation in billing requires HumanApprove.',
      executionTier: 'HumanApprove',
      budgetImpact: 'AUD 1,200 maximum exposure.',
      complianceImplications: ['finance-review'],
    },
    evidence: {
      requirements: [
        {
          requirementId: 'invoice-diff',
          label: 'Invoice diff',
          required: true,
          satisfiedByEvidenceIds: [EvidenceId('evi-1')],
        },
      ],
      artifacts: [
        {
          evidenceId: EvidenceId('evi-1'),
          summary: 'Planned invoice diff.',
          category: 'Plan',
        },
      ],
      consultedEvidenceIds: [EvidenceId('evi-1')],
      missingEvidenceSignals: [],
    },
    uncertainty: {
      confidenceScore: 0.82,
      anomalyFlags: [],
      unknowns: [],
    },
    provenance: {
      agentOutputRefs: [EvidenceId('evi-1')],
      materialInputSummaries: ['Agent matched invoice IDs from billing export.'],
    },
    allowedDecisions: ['approve', 'deny', 'request-changes', 'request-more-evidence'],
    assembledAtIso: '2026-04-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('decision context packet v1', () => {
  it('marks a complete approval packet as sufficient', () => {
    const result = assessDecisionContextSufficiency(makePacket());

    expect(result.status).toBe('sufficient');
    expect(result.canSubmitDecision).toBe(true);
    expect(result.missingEvidence).toEqual([]);
    expect(result.recommendedNextActions).toContain('approve');
  });

  it('makes missing evidence a first-class insufficient state', () => {
    const result = assessDecisionContextSufficiency(
      makePacket({
        evidence: {
          requirements: [
            {
              requirementId: 'reversibility-proof',
              label: 'Reversibility proof',
              required: true,
              satisfiedByEvidenceIds: [],
            },
          ],
          artifacts: [],
          consultedEvidenceIds: [],
          missingEvidenceSignals: ['No rollback evidence attached.'],
        },
      }),
    );

    expect(result.status).toBe('insufficient');
    expect(result.canSubmitDecision).toBe(false);
    expect(result.canRequestMoreEvidence).toBe(true);
    expect(result.missingEvidence).toEqual([
      'Reversibility proof',
      'No rollback evidence attached.',
    ]);
    expect(result.recommendedNextActions).toEqual([
      'request-more-evidence',
      'escalate',
      'annotate',
    ]);
  });

  it('blocks when policy rationale or provenance is absent', () => {
    const result = assessDecisionContextSufficiency(
      makePacket({
        policy: {
          policyIds: [PolicyId('policy-1')],
          rationale: '',
          executionTier: 'HumanApprove',
          budgetImpact: 'Unknown.',
          complianceImplications: [],
        },
        provenance: {
          agentOutputRefs: [],
          materialInputSummaries: [],
        },
      }),
    );

    expect(result.status).toBe('blocked');
    expect(result.canSubmitDecision).toBe(false);
    expect(result.blockingReasons).toEqual([
      'Policy rationale is missing.',
      'Material input provenance is missing.',
    ]);
  });

  it('supports steering and policy-change surfaces with the same shape', () => {
    const steering = assessDecisionContextSufficiency(
      makePacket({
        surface: 'steering',
        proposedChange: {
          kind: 'steering',
          summary: 'Narrow scope to invoices under AUD 2,000.',
          blastRadius: ['billing'],
          reversibility: 'full',
        },
        allowedDecisions: ['steer', 'request-more-evidence', 'escalate'],
      }),
    );
    const policyChange = assessDecisionContextSufficiency(
      makePacket({
        surface: 'policy-change',
        target: { policyId: PolicyId('policy-1'), policyVersion: '7' },
        proposedChange: {
          kind: 'policy-change',
          summary: 'Raise evidence requirement for high-risk billing writes.',
          blastRadius: ['billing', 'policy'],
          reversibility: 'partial',
        },
        allowedDecisions: ['approve', 'deny', 'request-more-evidence'],
      }),
    );

    expect(steering.status).toBe('sufficient');
    expect(steering.recommendedNextActions).toContain('steer');
    expect(policyChange.status).toBe('sufficient');
    expect(policyChange.recommendedNextActions).toContain('approve');
  });

  it('rejects packets without a target', () => {
    expect(() => validateDecisionContextPacket(makePacket({ target: {} }))).toThrow(/target/i);
  });

  it('rejects out-of-range confidence', () => {
    expect(() =>
      validateDecisionContextPacket(
        makePacket({
          uncertainty: { confidenceScore: 2, anomalyFlags: [], unknowns: [] },
        }),
      ),
    ).toThrow(/confidenceScore/i);
  });
});

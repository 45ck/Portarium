import { describe, expect, it } from 'vitest';

import { ApprovalId, HashSha256, UserId, WorkspaceId } from '../primitives/index.js';

import {
  createDecisionRecord,
  DecisionRecordValidationError,
  hasDecisiveEvidence,
  hasFailingPolicies,
  humanAgreedWithAi,
  summarizeDecision,
  type DecisionRecordInput,
} from './approval-decision-record-v1.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseInput: DecisionRecordInput = {
  approvalId: ApprovalId('apr-001'),
  workspaceId: WorkspaceId('ws-001'),
  decision: 'Approved',
  method: 'manual',
  rationale: 'Reviewed all evidence and policy outcomes. Approved.',
  decidedAtIso: '2026-01-15T14:30:00Z',
  decidedByUserId: UserId('user-alice'),
  riskLevel: 'low',
};

// ---------------------------------------------------------------------------
// createDecisionRecord
// ---------------------------------------------------------------------------

describe('createDecisionRecord', () => {
  it('creates an immutable record with required fields', () => {
    const record = createDecisionRecord(baseInput);

    expect(record.schemaVersion).toBe(1);
    expect(record.approvalId).toBe('apr-001');
    expect(record.decision).toBe('Approved');
    expect(record.method).toBe('manual');
    expect(record.rationale).toBe('Reviewed all evidence and policy outcomes. Approved.');
    expect(record.decidedAtIso).toBe('2026-01-15T14:30:00Z');
    expect(record.decidedByUserId).toBe('user-alice');
    expect(record.riskLevel).toBe('low');
    expect(record.policyEvaluations).toEqual([]);
    expect(record.evidenceRefs).toEqual([]);
    expect(record.conditions).toEqual([]);
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('includes policy evaluations when provided', () => {
    const record = createDecisionRecord({
      ...baseInput,
      policyEvaluations: [
        { policyId: 'pol-1', outcome: 'Pass', traceEntryCount: 3 },
        { policyId: 'pol-2', outcome: 'NeedsHuman', traceEntryCount: 1 },
      ],
    });

    expect(record.policyEvaluations).toHaveLength(2);
    expect(record.policyEvaluations[0]!.policyId).toBe('pol-1');
    expect(record.policyEvaluations[1]!.outcome).toBe('NeedsHuman');
  });

  it('includes evidence refs when provided', () => {
    const record = createDecisionRecord({
      ...baseInput,
      evidenceRefs: [
        { evidenceId: 'ev-1', summary: 'Test report passed', decisive: true },
        { evidenceId: 'ev-2', summary: 'Config diff reviewed', decisive: false },
      ],
    });

    expect(record.evidenceRefs).toHaveLength(2);
    expect(record.evidenceRefs[0]!.decisive).toBe(true);
  });

  it('includes AI context for ai_assisted decisions', () => {
    const record = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      aiContext: {
        modelId: 'claude-sonnet-4-6',
        recommendation: 'Approved',
        confidenceScore: 0.92,
        humanAgreedWithAi: true,
        summaryHash: HashSha256('a'.repeat(64)),
      },
    });

    expect(record.aiContext).toBeDefined();
    expect(record.aiContext!.modelId).toBe('claude-sonnet-4-6');
    expect(record.aiContext!.confidenceScore).toBe(0.92);
    expect(record.aiContext!.humanAgreedWithAi).toBe(true);
  });

  it('includes snapshot binding hash when provided', () => {
    const hash = HashSha256('b'.repeat(64));
    const record = createDecisionRecord({
      ...baseInput,
      snapshotBindingHash: hash,
    });

    expect(record.snapshotBindingHash).toBe(hash);
  });

  it('includes conditions when provided', () => {
    const record = createDecisionRecord({
      ...baseInput,
      conditions: ['Must deploy during maintenance window', 'Rollback plan verified'],
    });

    expect(record.conditions).toHaveLength(2);
    expect(record.conditions[0]).toBe('Must deploy during maintenance window');
  });

  it('trims rationale whitespace', () => {
    const record = createDecisionRecord({
      ...baseInput,
      rationale: '  Approved with conditions.  ',
    });

    expect(record.rationale).toBe('Approved with conditions.');
  });

  it('rejects empty rationale', () => {
    expect(() => createDecisionRecord({ ...baseInput, rationale: '' })).toThrow(
      DecisionRecordValidationError,
    );
  });

  it('rejects whitespace-only rationale', () => {
    expect(() => createDecisionRecord({ ...baseInput, rationale: '   ' })).toThrow(
      DecisionRecordValidationError,
    );
  });

  it('rejects empty decidedAtIso', () => {
    expect(() => createDecisionRecord({ ...baseInput, decidedAtIso: '' })).toThrow(
      DecisionRecordValidationError,
    );
  });

  it('rejects ai_assisted without aiContext', () => {
    expect(() => createDecisionRecord({ ...baseInput, method: 'ai_assisted' })).toThrow(
      DecisionRecordValidationError,
    );
    expect(() => createDecisionRecord({ ...baseInput, method: 'ai_assisted' })).toThrow(
      'aiContext is required',
    );
  });

  it('rejects AI confidence score below 0', () => {
    expect(() =>
      createDecisionRecord({
        ...baseInput,
        method: 'ai_assisted',
        aiContext: {
          modelId: 'test',
          recommendation: 'Approved',
          confidenceScore: -0.1,
          humanAgreedWithAi: true,
        },
      }),
    ).toThrow('confidenceScore must be between 0 and 1');
  });

  it('rejects AI confidence score above 1', () => {
    expect(() =>
      createDecisionRecord({
        ...baseInput,
        method: 'ai_assisted',
        aiContext: {
          modelId: 'test',
          recommendation: 'Approved',
          confidenceScore: 1.5,
          humanAgreedWithAi: true,
        },
      }),
    ).toThrow('confidenceScore must be between 0 and 1');
  });

  it('accepts boundary AI confidence scores (0 and 1)', () => {
    const record = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      aiContext: {
        modelId: 'test',
        recommendation: 'Approved',
        confidenceScore: 0,
        humanAgreedWithAi: false,
      },
    });
    expect(record.aiContext!.confidenceScore).toBe(0);

    const record2 = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      aiContext: {
        modelId: 'test',
        recommendation: 'Denied',
        confidenceScore: 1,
        humanAgreedWithAi: true,
      },
    });
    expect(record2.aiContext!.confidenceScore).toBe(1);
  });

  it('supports all decision types', () => {
    for (const decision of ['Approved', 'Denied', 'RequestChanges'] as const) {
      const record = createDecisionRecord({ ...baseInput, decision });
      expect(record.decision).toBe(decision);
    }
  });

  it('supports all method types', () => {
    for (const method of ['manual', 'auto_approved', 'delegation'] as const) {
      const record = createDecisionRecord({ ...baseInput, method });
      expect(record.method).toBe(method);
    }
  });

  it('supports all risk levels', () => {
    for (const riskLevel of ['low', 'medium', 'high', 'critical'] as const) {
      const record = createDecisionRecord({ ...baseInput, riskLevel });
      expect(record.riskLevel).toBe(riskLevel);
    }
  });

  it('deeply freezes nested arrays', () => {
    const record = createDecisionRecord({
      ...baseInput,
      policyEvaluations: [{ policyId: 'p', outcome: 'Pass', traceEntryCount: 1 }],
      evidenceRefs: [{ evidenceId: 'e', summary: 's', decisive: true }],
      conditions: ['cond'],
    });

    expect(Object.isFrozen(record.policyEvaluations)).toBe(true);
    expect(Object.isFrozen(record.evidenceRefs)).toBe(true);
    expect(Object.isFrozen(record.conditions)).toBe(true);
  });

  it('omits optional fields when not provided', () => {
    const record = createDecisionRecord(baseInput);

    expect('snapshotBindingHash' in record).toBe(false);
    expect('aiContext' in record).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

describe('hasFailingPolicies', () => {
  it('returns true when a policy failed', () => {
    const record = createDecisionRecord({
      ...baseInput,
      policyEvaluations: [{ policyId: 'p', outcome: 'Fail', traceEntryCount: 2 }],
    });
    expect(hasFailingPolicies(record)).toBe(true);
  });

  it('returns false when all policies pass', () => {
    const record = createDecisionRecord({
      ...baseInput,
      policyEvaluations: [
        { policyId: 'p1', outcome: 'Pass', traceEntryCount: 1 },
        { policyId: 'p2', outcome: 'NeedsHuman', traceEntryCount: 1 },
      ],
    });
    expect(hasFailingPolicies(record)).toBe(false);
  });

  it('returns false when no policies evaluated', () => {
    const record = createDecisionRecord(baseInput);
    expect(hasFailingPolicies(record)).toBe(false);
  });
});

describe('hasDecisiveEvidence', () => {
  it('returns true when decisive evidence exists', () => {
    const record = createDecisionRecord({
      ...baseInput,
      evidenceRefs: [{ evidenceId: 'e', summary: 's', decisive: true }],
    });
    expect(hasDecisiveEvidence(record)).toBe(true);
  });

  it('returns false when no decisive evidence', () => {
    const record = createDecisionRecord({
      ...baseInput,
      evidenceRefs: [{ evidenceId: 'e', summary: 's', decisive: false }],
    });
    expect(hasDecisiveEvidence(record)).toBe(false);
  });
});

describe('humanAgreedWithAi', () => {
  it('returns true when human agreed', () => {
    const record = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      aiContext: {
        modelId: 'test',
        recommendation: 'Approved',
        confidenceScore: 0.9,
        humanAgreedWithAi: true,
      },
    });
    expect(humanAgreedWithAi(record)).toBe(true);
  });

  it('returns false when human disagreed', () => {
    const record = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      aiContext: {
        modelId: 'test',
        recommendation: 'Denied',
        confidenceScore: 0.7,
        humanAgreedWithAi: false,
      },
    });
    expect(humanAgreedWithAi(record)).toBe(false);
  });

  it('returns null for non-AI decisions', () => {
    const record = createDecisionRecord(baseInput);
    expect(humanAgreedWithAi(record)).toBeNull();
  });
});

describe('summarizeDecision', () => {
  it('produces a summary with all components', () => {
    const record = createDecisionRecord({
      ...baseInput,
      method: 'ai_assisted',
      riskLevel: 'high',
      policyEvaluations: [
        { policyId: 'p1', outcome: 'Pass', traceEntryCount: 1 },
        { policyId: 'p2', outcome: 'Fail', traceEntryCount: 2 },
      ],
      evidenceRefs: [{ evidenceId: 'e', summary: 's', decisive: true }],
      aiContext: {
        modelId: 'test',
        recommendation: 'Approved',
        confidenceScore: 0.85,
        humanAgreedWithAi: true,
      },
      conditions: ['Deploy during window'],
    });

    const summary = summarizeDecision(record);
    expect(summary).toContain('Decision: Approved');
    expect(summary).toContain('Method: ai_assisted');
    expect(summary).toContain('Risk: high');
    expect(summary).toContain('Policies: 1/2 passing');
    expect(summary).toContain('Evidence: 1 items');
    expect(summary).toContain('AI confidence: 85%');
    expect(summary).toContain('Conditions: 1');
  });

  it('produces a minimal summary for simple decisions', () => {
    const record = createDecisionRecord(baseInput);
    const summary = summarizeDecision(record);
    expect(summary).toContain('Decision: Approved');
    expect(summary).toContain('Method: manual');
    expect(summary).toContain('Risk: low');
    expect(summary).not.toContain('Policies:');
    expect(summary).not.toContain('Evidence:');
  });
});

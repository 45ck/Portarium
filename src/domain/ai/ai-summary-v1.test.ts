import { describe, expect, it } from 'vitest';

import {
  buildAiApprovalSummary,
  buildSummaryContext,
  serializeSummaryContext,
  type AiSummarySectionV1,
} from './ai-summary-v1.js';
import { ApprovalId, CorrelationId, HashSha256, UserId, WorkspaceId } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS = WorkspaceId('ws-1');
const APPROVAL = ApprovalId('appr-sum-1');
const CORRELATION = CorrelationId('corr-1');
const USER = UserId('usr-operator');
const PAYLOAD_HASH = HashSha256('sha256-payload-abc');
const NOW = '2026-02-23T14:00:00Z';

function makeSection(overrides?: Partial<AiSummarySectionV1>): AiSummarySectionV1 {
  return {
    sectionType: 'risk_assessment',
    content: 'This approval carries moderate risk due to production impact.',
    sectionConfidence: 'medium',
    sourceRefIds: ['evi-1'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildAiApprovalSummary
// ---------------------------------------------------------------------------

describe('buildAiApprovalSummary', () => {
  it('builds a frozen summary with all required fields', () => {
    const summary = buildAiApprovalSummary({
      summaryId: 'sum-1',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      overallSummary: 'Database migration with moderate risk. Recommend approval with monitoring.',
      sections: [makeSection()],
      recommendation: 'approve',
      confidenceScore: 0.85,
      inputPiiRedacted: false,
      outputPiiRedacted: false,
      modelId: 'claude-sonnet-4-6',
      modelVersion: '2026-02',
      generatedAtIso: NOW,
      requestedByUserId: USER,
      approvalPayloadHash: PAYLOAD_HASH,
    });

    expect(summary.schemaVersion).toBe(1);
    expect(summary.summaryId).toBe('sum-1');
    expect(summary.approvalId).toBe(APPROVAL);
    expect(summary.confidence).toBe('high');
    expect(summary.confidenceScore).toBe(0.85);
    expect(summary.recommendation).toBe('approve');
    expect(summary.sections).toHaveLength(1);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.sections)).toBe(true);
  });

  it('maps confidence score to correct band', () => {
    const lowSummary = buildAiApprovalSummary({
      summaryId: 'sum-low',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      overallSummary: 'Insufficient data for accurate assessment.',
      sections: [makeSection({ sectionConfidence: 'insufficient_data' })],
      recommendation: 'insufficient_data',
      confidenceScore: 0.15,
      inputPiiRedacted: false,
      outputPiiRedacted: false,
      modelId: 'test-model',
      modelVersion: '1',
      generatedAtIso: NOW,
      requestedByUserId: USER,
      approvalPayloadHash: PAYLOAD_HASH,
    });

    expect(lowSummary.confidence).toBe('insufficient_data');
  });

  it('throws for empty overallSummary', () => {
    expect(() =>
      buildAiApprovalSummary({
        summaryId: 'sum-bad',
        workspaceId: WS,
        approvalId: APPROVAL,
        correlationId: CORRELATION,
        overallSummary: '   ',
        sections: [makeSection()],
        recommendation: 'approve',
        confidenceScore: 0.8,
        inputPiiRedacted: false,
        outputPiiRedacted: false,
        modelId: 'test',
        modelVersion: '1',
        generatedAtIso: NOW,
        requestedByUserId: USER,
        approvalPayloadHash: PAYLOAD_HASH,
      }),
    ).toThrow(/empty/);
  });

  it('throws for empty sections array', () => {
    expect(() =>
      buildAiApprovalSummary({
        summaryId: 'sum-bad2',
        workspaceId: WS,
        approvalId: APPROVAL,
        correlationId: CORRELATION,
        overallSummary: 'Valid summary',
        sections: [],
        recommendation: 'approve',
        confidenceScore: 0.8,
        inputPiiRedacted: false,
        outputPiiRedacted: false,
        modelId: 'test',
        modelVersion: '1',
        generatedAtIso: NOW,
        requestedByUserId: USER,
        approvalPayloadHash: PAYLOAD_HASH,
      }),
    ).toThrow(/section/);
  });

  it('throws for invalid confidence score', () => {
    expect(() =>
      buildAiApprovalSummary({
        summaryId: 'sum-bad3',
        workspaceId: WS,
        approvalId: APPROVAL,
        correlationId: CORRELATION,
        overallSummary: 'Valid',
        sections: [makeSection()],
        recommendation: 'approve',
        confidenceScore: 1.5,
        inputPiiRedacted: false,
        outputPiiRedacted: false,
        modelId: 'test',
        modelVersion: '1',
        generatedAtIso: NOW,
        requestedByUserId: USER,
        approvalPayloadHash: PAYLOAD_HASH,
      }),
    ).toThrow(/between 0 and 1/);
  });

  it('records PII redaction state', () => {
    const summary = buildAiApprovalSummary({
      summaryId: 'sum-pii',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      overallSummary: 'Summary after PII redaction.',
      sections: [makeSection()],
      recommendation: 'approve',
      confidenceScore: 0.75,
      inputPiiRedacted: true,
      outputPiiRedacted: true,
      modelId: 'test',
      modelVersion: '1',
      generatedAtIso: NOW,
      requestedByUserId: USER,
      approvalPayloadHash: PAYLOAD_HASH,
    });

    expect(summary.inputPiiRedacted).toBe(true);
    expect(summary.outputPiiRedacted).toBe(true);
  });

  it('supports all section types', () => {
    const sections: AiSummarySectionV1[] = [
      makeSection({ sectionType: 'risk_assessment' }),
      makeSection({ sectionType: 'blast_radius', content: '50 accounts affected' }),
      makeSection({ sectionType: 'recommendation', content: 'Approve with monitoring' }),
      makeSection({ sectionType: 'key_facts', content: 'First deployment to production' }),
      makeSection({ sectionType: 'compliance_notes', content: 'SOX compliance verified' }),
      makeSection({
        sectionType: 'historical_context',
        content: 'Similar approval was approved 2 weeks ago',
      }),
    ];

    const summary = buildAiApprovalSummary({
      summaryId: 'sum-all',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      overallSummary: 'Comprehensive summary.',
      sections,
      recommendation: 'approve',
      confidenceScore: 0.9,
      inputPiiRedacted: false,
      outputPiiRedacted: false,
      modelId: 'test',
      modelVersion: '1',
      generatedAtIso: NOW,
      requestedByUserId: USER,
      approvalPayloadHash: PAYLOAD_HASH,
    });

    expect(summary.sections).toHaveLength(6);
  });

  it('supports all recommendation types', () => {
    for (const rec of [
      'approve',
      'deny',
      'request_changes',
      'escalate',
      'insufficient_data',
    ] as const) {
      const summary = buildAiApprovalSummary({
        summaryId: `sum-${rec}`,
        workspaceId: WS,
        approvalId: APPROVAL,
        correlationId: CORRELATION,
        overallSummary: `Recommendation: ${rec}`,
        sections: [makeSection()],
        recommendation: rec,
        confidenceScore: 0.7,
        inputPiiRedacted: false,
        outputPiiRedacted: false,
        modelId: 'test',
        modelVersion: '1',
        generatedAtIso: NOW,
        requestedByUserId: USER,
        approvalPayloadHash: PAYLOAD_HASH,
      });

      expect(summary.recommendation).toBe(rec);
    }
  });
});

// ---------------------------------------------------------------------------
// buildSummaryContext
// ---------------------------------------------------------------------------

describe('buildSummaryContext', () => {
  it('builds a frozen context with all fields', () => {
    const context = buildSummaryContext({
      approvalId: APPROVAL,
      workspaceId: WS,
      prompt: 'Deploy database migration to production',
      requestedByUserId: USER,
      riskLevel: 'high',
      plannedEffectsSummaries: ['Update 50 account records', 'Create 3 new indexes'],
      policyOutcomes: [
        {
          policyName: 'SoD Production Policy',
          outcome: 'needs_human',
          explanation: 'Requires human approval due to SoD constraints',
        },
      ],
      evidenceSummaries: ['Approval opened by requestor', 'Policy evaluated'],
      priorDecisionCount: 1,
    });

    expect(context.approvalId).toBe(APPROVAL);
    expect(context.riskLevel).toBe('high');
    expect(context.plannedEffectsSummaries).toHaveLength(2);
    expect(context.policyOutcomes).toHaveLength(1);
    expect(context.evidenceSummaries).toHaveLength(2);
    expect(context.priorDecisionCount).toBe(1);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.plannedEffectsSummaries)).toBe(true);
    expect(Object.isFrozen(context.policyOutcomes)).toBe(true);
  });

  it('handles empty arrays', () => {
    const context = buildSummaryContext({
      approvalId: APPROVAL,
      workspaceId: WS,
      prompt: 'Simple change',
      requestedByUserId: USER,
      riskLevel: 'low',
      plannedEffectsSummaries: [],
      policyOutcomes: [],
      evidenceSummaries: [],
      priorDecisionCount: 0,
    });

    expect(context.plannedEffectsSummaries).toHaveLength(0);
    expect(context.policyOutcomes).toHaveLength(0);
    expect(context.evidenceSummaries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// serializeSummaryContext
// ---------------------------------------------------------------------------

describe('serializeSummaryContext', () => {
  it('produces deterministic JSON string', () => {
    const context = buildSummaryContext({
      approvalId: APPROVAL,
      workspaceId: WS,
      prompt: 'Test',
      requestedByUserId: USER,
      riskLevel: 'low',
      plannedEffectsSummaries: [],
      policyOutcomes: [],
      evidenceSummaries: [],
      priorDecisionCount: 0,
    });

    const serialized = serializeSummaryContext(context);
    const parsed = JSON.parse(serialized);

    expect(parsed.approvalId).toBe('appr-sum-1');
    expect(parsed.riskLevel).toBe('low');
  });

  it('produces identical output for identical inputs', () => {
    const makeCtx = () =>
      buildSummaryContext({
        approvalId: APPROVAL,
        workspaceId: WS,
        prompt: 'Deploy',
        requestedByUserId: USER,
        riskLevel: 'medium',
        plannedEffectsSummaries: ['Effect A'],
        policyOutcomes: [{ policyName: 'P1', outcome: 'pass', explanation: 'OK' }],
        evidenceSummaries: ['Evidence A'],
        priorDecisionCount: 2,
      });

    expect(serializeSummaryContext(makeCtx())).toBe(serializeSummaryContext(makeCtx()));
  });

  it('includes all context fields in the serialized output', () => {
    const context = buildSummaryContext({
      approvalId: APPROVAL,
      workspaceId: WS,
      prompt: 'Test prompt',
      requestedByUserId: USER,
      riskLevel: 'high',
      plannedEffectsSummaries: ['effect'],
      policyOutcomes: [{ policyName: 'P', outcome: 'fail', explanation: 'X' }],
      evidenceSummaries: ['ev'],
      priorDecisionCount: 3,
    });

    const serialized = serializeSummaryContext(context);

    expect(serialized).toContain('approvalId');
    expect(serialized).toContain('workspaceId');
    expect(serialized).toContain('prompt');
    expect(serialized).toContain('riskLevel');
    expect(serialized).toContain('plannedEffectsSummaries');
    expect(serialized).toContain('policyOutcomes');
    expect(serialized).toContain('evidenceSummaries');
    expect(serialized).toContain('priorDecisionCount');
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildAiExplanation,
  buildAiInteractionAudit,
  scanForPii,
  toConfidenceBand,
  validateAgencyBoundary,
  type AiAgencyBoundaryV1,
  type AiReasoningStepV1,
  type AiSourceAttributionV1,
  type PiiScanResultV1,
} from './responsible-ai-v1.js';
import { ApprovalId, CorrelationId, HashSha256, UserId, WorkspaceId } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS = WorkspaceId('ws-1');
const APPROVAL = ApprovalId('appr-ai-1');
const CORRELATION = CorrelationId('corr-1');
const USER = UserId('usr-operator');
const PROMPT_HASH = HashSha256('sha256-prompt-abc');
const RESPONSE_HASH = HashSha256('sha256-response-xyz');
const NOW = '2026-02-23T14:00:00Z';

function makeCleanScan(): PiiScanResultV1 {
  return {
    schemaVersion: 1,
    originalLength: 10,
    redactedText: 'clean text',
    detections: [],
    containsPii: false,
  };
}

// ---------------------------------------------------------------------------
// scanForPii
// ---------------------------------------------------------------------------

describe('scanForPii', () => {
  it('returns clean result for text without PII', () => {
    const result = scanForPii('This is a clean text without personal data');

    expect(result.containsPii).toBe(false);
    expect(result.detections).toHaveLength(0);
    expect(result.redactedText).toBe('This is a clean text without personal data');
    expect(result.schemaVersion).toBe(1);
  });

  it('detects and redacts email addresses', () => {
    const result = scanForPii('Contact alice@example.com for details');

    expect(result.containsPii).toBe(true);
    expect(result.detections).toHaveLength(1);
    expect(result.detections[0]!.category).toBe('email');
    expect(result.redactedText).toBe('Contact [EMAIL-1] for details');
  });

  it('detects multiple emails with incrementing tokens', () => {
    const result = scanForPii('From: a@b.com To: c@d.com');

    expect(result.detections).toHaveLength(2);
    expect(result.redactedText).toContain('[EMAIL-1]');
    expect(result.redactedText).toContain('[EMAIL-2]');
  });

  it('detects SSN patterns', () => {
    const result = scanForPii('SSN: 123-45-6789');

    expect(result.containsPii).toBe(true);
    expect(result.detections[0]!.category).toBe('ssn');
    expect(result.redactedText).toContain('[SSN-1]');
  });

  it('detects credit card patterns', () => {
    const result = scanForPii('Card: 4111-1111-1111-1111');

    expect(result.containsPii).toBe(true);
    expect(result.detections[0]!.category).toBe('credit_card');
    expect(result.redactedText).toContain('[CC-1]');
  });

  it('detects IP addresses', () => {
    const result = scanForPii('Server at 192.168.1.100');

    expect(result.containsPii).toBe(true);
    expect(result.detections[0]!.category).toBe('ip_address');
    expect(result.redactedText).toContain('[IP-1]');
  });

  it('handles mixed PII types in one text', () => {
    const result = scanForPii('Email: bob@co.com SSN: 111-22-3333');

    expect(result.containsPii).toBe(true);
    expect(result.detections.length).toBeGreaterThanOrEqual(2);
    expect(result.redactedText).toContain('[EMAIL-1]');
    expect(result.redactedText).toContain('[SSN-1]');
  });

  it('returns a frozen result', () => {
    const result = scanForPii('hello');

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.detections)).toBe(true);
  });

  it('preserves original length', () => {
    const text = 'Contact alice@example.com now';
    const result = scanForPii(text);

    expect(result.originalLength).toBe(text.length);
  });

  it('records correct offsets for detections', () => {
    const result = scanForPii('Hi alice@example.com end');

    expect(result.detections[0]!.startOffset).toBe(3);
    expect(result.detections[0]!.endOffset).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// toConfidenceBand
// ---------------------------------------------------------------------------

describe('toConfidenceBand', () => {
  it.each([
    [0.95, 'high'],
    [0.8, 'high'],
    [0.79, 'medium'],
    [0.5, 'medium'],
    [0.49, 'low'],
    [0.2, 'low'],
    [0.19, 'insufficient_data'],
    [0.0, 'insufficient_data'],
  ] as const)('maps %f to %s', (score, expected) => {
    expect(toConfidenceBand(score)).toBe(expected);
  });

  it('throws for score > 1', () => {
    expect(() => toConfidenceBand(1.1)).toThrow(/between 0 and 1/);
  });

  it('throws for negative score', () => {
    expect(() => toConfidenceBand(-0.1)).toThrow(/between 0 and 1/);
  });

  it('accepts exact boundary 1.0', () => {
    expect(toConfidenceBand(1.0)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// buildAiInteractionAudit
// ---------------------------------------------------------------------------

describe('buildAiInteractionAudit', () => {
  it('builds a frozen audit entry with clean scans', () => {
    const audit = buildAiInteractionAudit({
      interactionId: 'int-1',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      purpose: 'approval_summary',
      modelId: 'claude-sonnet-4-6',
      modelVersion: '2026-02-01',
      promptHash: PROMPT_HASH,
      responseHash: RESPONSE_HASH,
      inputScan: makeCleanScan(),
      outputScan: makeCleanScan(),
      latencyMs: 350,
      occurredAtIso: NOW,
      triggeredByUserId: USER,
    });

    expect(audit.schemaVersion).toBe(1);
    expect(audit.interactionId).toBe('int-1');
    expect(audit.purpose).toBe('approval_summary');
    expect(audit.inputPiiRedacted).toBe(false);
    expect(audit.inputPiiCount).toBe(0);
    expect(audit.outputPiiDetected).toBe(false);
    expect(audit.outputPiiCount).toBe(0);
    expect(audit.latencyMs).toBe(350);
    expect(Object.isFrozen(audit)).toBe(true);
  });

  it('reflects PII scan results in audit entry', () => {
    const inputScan = scanForPii('User: alice@example.com');
    const outputScan = scanForPii('Summary for 192.168.1.1');

    const audit = buildAiInteractionAudit({
      interactionId: 'int-2',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      purpose: 'risk_assessment',
      modelId: 'gpt-4',
      modelVersion: '2026-01',
      promptHash: PROMPT_HASH,
      responseHash: RESPONSE_HASH,
      inputScan,
      outputScan,
      latencyMs: 500,
      occurredAtIso: NOW,
      triggeredByUserId: USER,
    });

    expect(audit.inputPiiRedacted).toBe(true);
    expect(audit.inputPiiCount).toBe(1);
    expect(audit.outputPiiDetected).toBe(true);
    expect(audit.outputPiiCount).toBe(1);
  });

  it('includes optional token counts when provided', () => {
    const audit = buildAiInteractionAudit({
      interactionId: 'int-3',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      purpose: 'evidence_synthesis',
      modelId: 'claude-sonnet-4-6',
      modelVersion: '2026-02',
      promptHash: PROMPT_HASH,
      responseHash: RESPONSE_HASH,
      inputScan: makeCleanScan(),
      outputScan: makeCleanScan(),
      latencyMs: 200,
      occurredAtIso: NOW,
      triggeredByUserId: USER,
      promptTokens: 1500,
      responseTokens: 800,
    });

    expect(audit.promptTokens).toBe(1500);
    expect(audit.responseTokens).toBe(800);
  });

  it('omits token counts when not provided', () => {
    const audit = buildAiInteractionAudit({
      interactionId: 'int-4',
      workspaceId: WS,
      approvalId: APPROVAL,
      correlationId: CORRELATION,
      purpose: 'policy_explanation',
      modelId: 'claude-sonnet-4-6',
      modelVersion: '2026-02',
      promptHash: PROMPT_HASH,
      responseHash: RESPONSE_HASH,
      inputScan: makeCleanScan(),
      outputScan: makeCleanScan(),
      latencyMs: 100,
      occurredAtIso: NOW,
      triggeredByUserId: USER,
    });

    expect('promptTokens' in audit).toBe(false);
    expect('responseTokens' in audit).toBe(false);
  });

  it('throws for negative latencyMs', () => {
    expect(() =>
      buildAiInteractionAudit({
        interactionId: 'int-bad',
        workspaceId: WS,
        approvalId: APPROVAL,
        correlationId: CORRELATION,
        purpose: 'approval_summary',
        modelId: 'test',
        modelVersion: '1',
        promptHash: PROMPT_HASH,
        responseHash: RESPONSE_HASH,
        inputScan: makeCleanScan(),
        outputScan: makeCleanScan(),
        latencyMs: -10,
        occurredAtIso: NOW,
        triggeredByUserId: USER,
      }),
    ).toThrow(/non-negative/);
  });
});

// ---------------------------------------------------------------------------
// buildAiExplanation
// ---------------------------------------------------------------------------

describe('buildAiExplanation', () => {
  it('builds a frozen explanation with all fields', () => {
    const sources: AiSourceAttributionV1[] = [
      {
        sourceLabel: 'Evidence #1',
        sourceType: 'evidence_entry',
        sourceRefId: 'evi-1',
        relevanceScore: 0.9,
        excerpt: 'Approval was opened by admin',
      },
    ];

    const steps: AiReasoningStepV1[] = [
      {
        stepNumber: 1,
        description: 'Reviewed evidence chain for approval context',
        supportingSources: ['evi-1'],
      },
      {
        stepNumber: 2,
        description: 'Assessed risk level based on planned effects',
        supportingSources: [],
      },
    ];

    const explanation = buildAiExplanation({
      explanationId: 'exp-1',
      interactionId: 'int-1',
      purpose: 'approval_summary',
      confidenceScore: 0.85,
      sourceAttributions: sources,
      reasoningChain: steps,
      caveats: ['Limited historical data for this approval type'],
      requiresHumanVerification: true,
    });

    expect(explanation.schemaVersion).toBe(1);
    expect(explanation.confidence).toBe('high');
    expect(explanation.confidenceScore).toBe(0.85);
    expect(explanation.sourceAttributions).toHaveLength(1);
    expect(explanation.reasoningChain).toHaveLength(2);
    expect(explanation.caveats).toHaveLength(1);
    expect(explanation.requiresHumanVerification).toBe(true);
    expect(Object.isFrozen(explanation)).toBe(true);
    expect(Object.isFrozen(explanation.sourceAttributions)).toBe(true);
    expect(Object.isFrozen(explanation.reasoningChain)).toBe(true);
    expect(Object.isFrozen(explanation.caveats)).toBe(true);
  });

  it('throws for invalid confidence score', () => {
    expect(() =>
      buildAiExplanation({
        explanationId: 'exp-bad',
        interactionId: 'int-1',
        purpose: 'risk_assessment',
        confidenceScore: 1.5,
        sourceAttributions: [],
        reasoningChain: [],
        caveats: [],
        requiresHumanVerification: false,
      }),
    ).toThrow(/between 0 and 1/);
  });

  it('throws for non-sequential reasoning chain', () => {
    expect(() =>
      buildAiExplanation({
        explanationId: 'exp-bad2',
        interactionId: 'int-1',
        purpose: 'blast_radius_analysis',
        confidenceScore: 0.7,
        sourceAttributions: [],
        reasoningChain: [
          { stepNumber: 1, description: 'Step 1', supportingSources: [] },
          { stepNumber: 3, description: 'Wrong step', supportingSources: [] },
        ],
        caveats: [],
        requiresHumanVerification: false,
      }),
    ).toThrow(/sequential/);
  });

  it('throws for invalid source attribution relevance score', () => {
    expect(() =>
      buildAiExplanation({
        explanationId: 'exp-bad3',
        interactionId: 'int-1',
        purpose: 'evidence_synthesis',
        confidenceScore: 0.5,
        sourceAttributions: [
          {
            sourceLabel: 'Bad',
            sourceType: 'evidence_entry',
            sourceRefId: 'evi-1',
            relevanceScore: 1.5,
          },
        ],
        reasoningChain: [],
        caveats: [],
        requiresHumanVerification: false,
      }),
    ).toThrow(/relevanceScore/);
  });

  it('maps confidence score to correct band', () => {
    const lowConfidence = buildAiExplanation({
      explanationId: 'exp-low',
      interactionId: 'int-1',
      purpose: 'approval_summary',
      confidenceScore: 0.3,
      sourceAttributions: [],
      reasoningChain: [],
      caveats: [],
      requiresHumanVerification: true,
    });

    expect(lowConfidence.confidence).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// validateAgencyBoundary
// ---------------------------------------------------------------------------

describe('validateAgencyBoundary', () => {
  const permissiveBoundary: AiAgencyBoundaryV1 = {
    schemaVersion: 1,
    canGenerateSummaries: true,
    canSuggestDecision: true,
    canAutoApprove: true,
    autoApproveMinConfidence: 'high',
    suppressedRiskLevels: [],
    requireAiDisclosure: true,
  };

  const restrictiveBoundary: AiAgencyBoundaryV1 = {
    schemaVersion: 1,
    canGenerateSummaries: true,
    canSuggestDecision: false,
    canAutoApprove: false,
    autoApproveMinConfidence: 'high',
    suppressedRiskLevels: ['critical', 'high'],
    requireAiDisclosure: true,
  };

  it('allows summary generation when permitted', () => {
    const result = validateAgencyBoundary(permissiveBoundary, {
      type: 'generate_summary',
    });

    expect(result.allowed).toBe(true);
  });

  it('denies summary generation for suppressed risk level', () => {
    const result = validateAgencyBoundary(restrictiveBoundary, {
      type: 'generate_summary',
      riskLevel: 'critical',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('suppressed');
  });

  it('allows decision suggestion when permitted', () => {
    const result = validateAgencyBoundary(permissiveBoundary, {
      type: 'suggest_decision',
    });

    expect(result.allowed).toBe(true);
  });

  it('denies decision suggestion when not permitted', () => {
    const result = validateAgencyBoundary(restrictiveBoundary, {
      type: 'suggest_decision',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not permitted');
  });

  it('allows auto-approve when confidence meets threshold', () => {
    const result = validateAgencyBoundary(permissiveBoundary, {
      type: 'auto_approve',
      confidenceBand: 'high',
    });

    expect(result.allowed).toBe(true);
  });

  it('denies auto-approve when confidence is below threshold', () => {
    const result = validateAgencyBoundary(permissiveBoundary, {
      type: 'auto_approve',
      confidenceBand: 'medium',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('confidence');
  });

  it('denies auto-approve when not permitted', () => {
    const result = validateAgencyBoundary(restrictiveBoundary, {
      type: 'auto_approve',
      confidenceBand: 'high',
    });

    expect(result.allowed).toBe(false);
  });

  it('denies auto-approve without confidence band', () => {
    const result = validateAgencyBoundary(permissiveBoundary, {
      type: 'auto_approve',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('requires a confidence band');
  });

  it('risk suppression takes precedence over permission', () => {
    const result = validateAgencyBoundary(restrictiveBoundary, {
      type: 'generate_summary',
      riskLevel: 'high',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('suppressed');
  });
});

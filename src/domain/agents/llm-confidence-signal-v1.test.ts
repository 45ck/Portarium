/**
 * Tests for LLM confidence signal and overreliance guardrails (bead-tz6c).
 *
 * Verifies band mapping, signal validation, factory behaviour, and
 * the forced-acknowledgement invariant for low-confidence recommendations.
 *
 * Bead: bead-tz6c
 */

import { describe, expect, it } from 'vitest';
import {
  toConfidenceBand,
  validateConfidenceSignal,
  buildConfidenceSignal,
  isUncertaintyReason,
  type ConfidenceSignal,
} from './llm-confidence-signal-v1.js';

// ── toConfidenceBand ────────────────────────────────────────────────────────

describe('toConfidenceBand', () => {
  it.each([
    [1.0, 'High'],
    [0.95, 'High'],
    [0.8, 'High'],
    [0.79, 'Medium'],
    [0.5, 'Medium'],
    [0.49, 'Low'],
    [0.2, 'Low'],
    [0.19, 'VeryLow'],
    [0.0, 'VeryLow'],
  ] as const)('maps score %f to band %s', (score, expected) => {
    expect(toConfidenceBand(score)).toBe(expected);
  });
});

// ── validateConfidenceSignal ────────────────────────────────────────────────

describe('validateConfidenceSignal', () => {
  const validHighSignal: ConfidenceSignal = {
    score: 0.92,
    band: 'High',
    uncertaintyReasons: [],
    requiresAcknowledgement: false,
    explanation: 'All evidence supports this recommendation.',
  };

  it('accepts a valid high-confidence signal', () => {
    expect(validateConfidenceSignal(validHighSignal)).toEqual({ valid: true });
  });

  it('rejects score below 0', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, score: -0.1 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('score');
  });

  it('rejects score above 1', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, score: 1.1 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('score');
  });

  it('rejects NaN score', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, score: NaN });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('finite');
  });

  it('rejects Infinity score', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, score: Infinity });
    expect(result.valid).toBe(false);
  });

  it('rejects band mismatch (score says High, band says Low)', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, band: 'Low' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('mismatch');
  });

  it('rejects empty explanation', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, explanation: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('explanation');
  });

  it('rejects whitespace-only explanation', () => {
    const result = validateConfidenceSignal({ ...validHighSignal, explanation: '   ' });
    expect(result.valid).toBe(false);
  });

  it('rejects VeryLow without requiresAcknowledgement', () => {
    const signal: ConfidenceSignal = {
      score: 0.1,
      band: 'VeryLow',
      uncertaintyReasons: ['InsufficientEvidence'],
      requiresAcknowledgement: false,
      explanation: 'Not enough data.',
    };
    const result = validateConfidenceSignal(signal);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('acknowledgement');
  });

  it('accepts VeryLow with requiresAcknowledgement', () => {
    const signal: ConfidenceSignal = {
      score: 0.1,
      band: 'VeryLow',
      uncertaintyReasons: ['InsufficientEvidence'],
      requiresAcknowledgement: true,
      explanation: 'Insufficient evidence for this decision.',
    };
    expect(validateConfidenceSignal(signal)).toEqual({ valid: true });
  });
});

// ── buildConfidenceSignal ───────────────────────────────────────────────────

describe('buildConfidenceSignal', () => {
  it('builds a high-confidence signal without acknowledgement', () => {
    const signal = buildConfidenceSignal(0.95, 'Strong evidence.');
    expect(signal.band).toBe('High');
    expect(signal.requiresAcknowledgement).toBe(false);
    expect(signal.uncertaintyReasons).toEqual([]);
  });

  it('builds a medium-confidence signal without acknowledgement', () => {
    const signal = buildConfidenceSignal(0.6, 'Moderate evidence.', ['ConflictingSignals']);
    expect(signal.band).toBe('Medium');
    expect(signal.requiresAcknowledgement).toBe(false);
    expect(signal.uncertaintyReasons).toEqual(['ConflictingSignals']);
  });

  it('builds a low-confidence signal with acknowledgement required', () => {
    const signal = buildConfidenceSignal(0.3, 'Limited data.', ['InsufficientEvidence']);
    expect(signal.band).toBe('Low');
    expect(signal.requiresAcknowledgement).toBe(true);
  });

  it('builds a very-low-confidence signal with acknowledgement required', () => {
    const signal = buildConfidenceSignal(0.05, 'No data.', [
      'InsufficientEvidence',
      'OutOfDistribution',
    ]);
    expect(signal.band).toBe('VeryLow');
    expect(signal.requiresAcknowledgement).toBe(true);
  });

  it('produces a signal that passes validation', () => {
    const signal = buildConfidenceSignal(0.75, 'Good evidence.', ['AmbiguousContext']);
    expect(validateConfidenceSignal(signal)).toEqual({ valid: true });
  });
});

// ── isUncertaintyReason ─────────────────────────────────────────────────────

describe('isUncertaintyReason', () => {
  it.each([
    'InsufficientEvidence',
    'ConflictingSignals',
    'OutOfDistribution',
    'HighStakesDecision',
    'AmbiguousContext',
  ])('accepts valid reason "%s"', (reason) => {
    expect(isUncertaintyReason(reason)).toBe(true);
  });

  it.each(['Unknown', 'invalid', '', 'HIGH_STAKES'])('rejects invalid reason "%s"', (reason) => {
    expect(isUncertaintyReason(reason)).toBe(false);
  });
});

// ── Overreliance guardrail invariants ───────────────────────────────────────

describe('overreliance guardrail invariants', () => {
  it('every VeryLow signal from factory requires acknowledgement', () => {
    for (let score = 0; score < 0.2; score += 0.05) {
      const signal = buildConfidenceSignal(score, 'Test.');
      expect(signal.requiresAcknowledgement).toBe(true);
    }
  });

  it('every Low signal from factory requires acknowledgement', () => {
    for (let score = 0.2; score < 0.5; score += 0.05) {
      const signal = buildConfidenceSignal(score, 'Test.');
      expect(signal.requiresAcknowledgement).toBe(true);
    }
  });

  it('Medium and High signals from factory do not require acknowledgement', () => {
    for (let score = 0.5; score <= 1.0; score += 0.1) {
      const signal = buildConfidenceSignal(score, 'Test.');
      expect(signal.requiresAcknowledgement).toBe(false);
    }
  });
});

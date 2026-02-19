import { describe, expect, it } from 'vitest';
import {
  hasConstraintType,
  parseSafetyCaseV1,
  parseSafetyConstraintV1,
} from './safety-constraint-v1.js';

describe('parseSafetyConstraintV1', () => {
  it('parses a valid safety constraint', () => {
    const parsed = parseSafetyConstraintV1({
      constraintType: 'SpeedLimit',
      value: '1.2mps',
      enforcedBy: 'edge',
      severity: 'Enforced',
    });

    expect(parsed.constraintType).toBe('SpeedLimit');
    expect(parsed.severity).toBe('Enforced');
  });
});

describe('parseSafetyCaseV1', () => {
  const base = {
    schemaVersion: 1,
    robotId: 'robot-001',
    appliedConstraints: [
      {
        constraintType: 'OperatorRequired',
        value: 'true',
        enforcedBy: 'policy',
        severity: 'Enforced',
      },
      {
        constraintType: 'Geofence',
        value: 'zone-a',
        enforcedBy: 'edge',
        severity: 'Advisory',
      },
    ],
    riskAssessmentRef: 'risk:2026:site-a',
    lastReviewedAt: '2026-02-19T09:00:00.000Z',
    approvedBy: 'user-approver-1',
  } as const;

  it('parses a valid safety case', () => {
    const parsed = parseSafetyCaseV1(base);
    expect(parsed.appliedConstraints).toHaveLength(2);
    expect(parsed.riskAssessmentRef).toContain('risk:2026');
  });

  it('rejects empty constraints', () => {
    expect(() => parseSafetyCaseV1({ ...base, appliedConstraints: [] })).toThrow(
      /non-empty array/i,
    );
  });

  it('supports constraint lookup helper', () => {
    const parsed = parseSafetyCaseV1(base);
    expect(hasConstraintType(parsed, 'OperatorRequired')).toBe(true);
    expect(hasConstraintType(parsed, 'PayloadLimit')).toBe(false);
  });
});

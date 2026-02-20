import { describe, expect, it } from 'vitest';

import {
  parseIntentCommandV1,
  parseExecutionEvidenceV1,
  IntentCommandParseError,
  ExecutionEvidenceParseError,
} from './robot-intent-command-v1.js';

const VALID_INTENT_WAYPOINT: unknown = {
  schemaVersion: 1,
  intentId: 'intent-1',
  commandType: 'navigate',
  targetParams: { kind: 'waypoint', waypointId: 'wp-dock-a' },
  safetyConstraints: {
    maxVelocityMps: 1.5,
    collisionAvoidance: true,
    geofenceBoundary: 'zone-a',
  },
  requiredApprovalTier: 'Auto',
  issuedAtIso: '2026-02-21T10:00:00.000Z',
  issuedBy: 'operator-1',
  description: 'Navigate to dock A',
};

const VALID_INTENT_COORDINATES: unknown = {
  schemaVersion: 1,
  intentId: 'intent-2',
  commandType: 'pick',
  targetParams: { kind: 'coordinates', x: 10.5, y: 20.3, z: 0 },
  safetyConstraints: {
    collisionAvoidance: true,
  },
  requiredApprovalTier: 'HumanApprove',
  issuedAtIso: '2026-02-21T11:00:00.000Z',
  issuedBy: 'operator-2',
};

const VALID_EVIDENCE: unknown = {
  schemaVersion: 1,
  evidenceId: 'evi-1',
  intentId: 'intent-1',
  executionStatus: 'completed',
  telemetrySnapshot: {
    batteryPercent: 85,
    positionX: 10.5,
    positionY: 20.3,
    velocityMps: 0,
  },
  completedAtIso: '2026-02-21T10:05:00.000Z',
  recordedAtIso: '2026-02-21T10:05:01.000Z',
};

describe('parseIntentCommandV1', () => {
  it('parses a valid intent command with waypoint target', () => {
    const result = parseIntentCommandV1(VALID_INTENT_WAYPOINT);
    expect(result.schemaVersion).toBe(1);
    expect(String(result.intentId)).toBe('intent-1');
    expect(result.commandType).toBe('navigate');
    expect(result.targetParams.kind).toBe('waypoint');
    if (result.targetParams.kind === 'waypoint') {
      expect(result.targetParams.waypointId).toBe('wp-dock-a');
    }
    expect(result.safetyConstraints.collisionAvoidance).toBe(true);
    expect(result.safetyConstraints.maxVelocityMps).toBe(1.5);
    expect(result.safetyConstraints.geofenceBoundary).toBe('zone-a');
    expect(result.requiredApprovalTier).toBe('Auto');
    expect(result.issuedBy).toBe('operator-1');
    expect(result.description).toBe('Navigate to dock A');
  });

  it('parses a valid intent command with coordinates target', () => {
    const result = parseIntentCommandV1(VALID_INTENT_COORDINATES);
    expect(result.schemaVersion).toBe(1);
    expect(String(result.intentId)).toBe('intent-2');
    expect(result.commandType).toBe('pick');
    expect(result.targetParams.kind).toBe('coordinates');
    if (result.targetParams.kind === 'coordinates') {
      expect(result.targetParams.x).toBe(10.5);
      expect(result.targetParams.y).toBe(20.3);
      expect(result.targetParams.z).toBe(0);
    }
    expect(result.requiredApprovalTier).toBe('HumanApprove');
    expect(result.description).toBeUndefined();
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parseIntentCommandV1({ ...VALID_INTENT_WAYPOINT as Record<string, unknown>, schemaVersion: 2 }),
    ).toThrow(IntentCommandParseError);
  });

  it('rejects invalid commandType', () => {
    expect(() =>
      parseIntentCommandV1({ ...VALID_INTENT_WAYPOINT as Record<string, unknown>, commandType: 'fly' }),
    ).toThrow(IntentCommandParseError);
  });

  it('accepts all valid commandTypes', () => {
    for (const commandType of ['navigate', 'pick', 'place', 'inspect', 'dock']) {
      const result = parseIntentCommandV1({
        ...VALID_INTENT_WAYPOINT as Record<string, unknown>,
        commandType,
      });
      expect(result.commandType).toBe(commandType);
    }
  });

  it('rejects invalid targetParams kind', () => {
    expect(() =>
      parseIntentCommandV1({
        ...VALID_INTENT_WAYPOINT as Record<string, unknown>,
        targetParams: { kind: 'gps', lat: 0, lon: 0 },
      }),
    ).toThrow(IntentCommandParseError);
  });

  it('rejects non-positive maxVelocityMps', () => {
    expect(() =>
      parseIntentCommandV1({
        ...VALID_INTENT_WAYPOINT as Record<string, unknown>,
        safetyConstraints: { maxVelocityMps: -1, collisionAvoidance: true },
      }),
    ).toThrow(IntentCommandParseError);
  });

  it('rejects missing collisionAvoidance', () => {
    expect(() =>
      parseIntentCommandV1({
        ...VALID_INTENT_WAYPOINT as Record<string, unknown>,
        safetyConstraints: { maxVelocityMps: 1.0 },
      }),
    ).toThrow(IntentCommandParseError);
  });

  it('rejects invalid requiredApprovalTier', () => {
    expect(() =>
      parseIntentCommandV1({
        ...VALID_INTENT_WAYPOINT as Record<string, unknown>,
        requiredApprovalTier: 'SuperAuto',
      }),
    ).toThrow(IntentCommandParseError);
  });

  it('rejects non-object input', () => {
    expect(() => parseIntentCommandV1('not-an-object')).toThrow(IntentCommandParseError);
    expect(() => parseIntentCommandV1(null)).toThrow(IntentCommandParseError);
    expect(() => parseIntentCommandV1(undefined)).toThrow(IntentCommandParseError);
  });

  it('rejects missing required fields', () => {
    expect(() => parseIntentCommandV1({ schemaVersion: 1 })).toThrow(IntentCommandParseError);
  });
});

describe('parseExecutionEvidenceV1', () => {
  it('parses valid execution evidence with telemetry', () => {
    const result = parseExecutionEvidenceV1(VALID_EVIDENCE);
    expect(result.schemaVersion).toBe(1);
    expect(String(result.evidenceId)).toBe('evi-1');
    expect(String(result.intentId)).toBe('intent-1');
    expect(result.executionStatus).toBe('completed');
    expect(result.telemetrySnapshot).toEqual({
      batteryPercent: 85,
      positionX: 10.5,
      positionY: 20.3,
      velocityMps: 0,
    });
    expect(result.completedAtIso).toBe('2026-02-21T10:05:00.000Z');
    expect(result.recordedAtIso).toBe('2026-02-21T10:05:01.000Z');
  });

  it('parses evidence without optional fields', () => {
    const result = parseExecutionEvidenceV1({
      schemaVersion: 1,
      evidenceId: 'evi-2',
      intentId: 'intent-2',
      executionStatus: 'dispatched',
      recordedAtIso: '2026-02-21T10:00:00.000Z',
    });
    expect(result.executionStatus).toBe('dispatched');
    expect(result.telemetrySnapshot).toBeUndefined();
    expect(result.completedAtIso).toBeUndefined();
  });

  it('accepts all valid execution statuses', () => {
    for (const executionStatus of ['dispatched', 'executing', 'completed', 'failed', 'aborted']) {
      const result = parseExecutionEvidenceV1({
        ...VALID_EVIDENCE as Record<string, unknown>,
        executionStatus,
      });
      expect(result.executionStatus).toBe(executionStatus);
    }
  });

  it('rejects invalid executionStatus', () => {
    expect(() =>
      parseExecutionEvidenceV1({
        ...VALID_EVIDENCE as Record<string, unknown>,
        executionStatus: 'paused',
      }),
    ).toThrow(ExecutionEvidenceParseError);
  });

  it('rejects batteryPercent out of range', () => {
    expect(() =>
      parseExecutionEvidenceV1({
        ...VALID_EVIDENCE as Record<string, unknown>,
        telemetrySnapshot: { batteryPercent: 150 },
      }),
    ).toThrow(ExecutionEvidenceParseError);

    expect(() =>
      parseExecutionEvidenceV1({
        ...VALID_EVIDENCE as Record<string, unknown>,
        telemetrySnapshot: { batteryPercent: -5 },
      }),
    ).toThrow(ExecutionEvidenceParseError);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parseExecutionEvidenceV1({ ...VALID_EVIDENCE as Record<string, unknown>, schemaVersion: 99 }),
    ).toThrow(ExecutionEvidenceParseError);
  });

  it('rejects non-object input', () => {
    expect(() => parseExecutionEvidenceV1('not-an-object')).toThrow(ExecutionEvidenceParseError);
    expect(() => parseExecutionEvidenceV1(null)).toThrow(ExecutionEvidenceParseError);
  });
});

/**
 * Contract gate: agent agency boundary evaluator (bead-tz6c).
 *
 * Pins the evaluation semantics of `evaluateAgencyBoundary` and the parser
 * invariants of `parseAgencyBoundaryV1`.
 */

import { describe, expect, it } from 'vitest';

import {
  AgencyBoundaryParseError,
  PRIVILEGED_AGENT_BOUNDARY,
  READ_ONLY_BOUNDARY,
  STANDARD_AGENT_BOUNDARY,
  evaluateAgencyBoundary,
  parseAgencyBoundaryV1,
  type AgencyBoundaryV1,
} from './agent-agency-boundary-v1.js';

// ---------------------------------------------------------------------------
// evaluateAgencyBoundary — tier defaults
// ---------------------------------------------------------------------------

describe('evaluateAgencyBoundary — ReadOnly tier', () => {
  it('allows read-evidence', () => {
    expect(evaluateAgencyBoundary('read-evidence', READ_ONLY_BOUNDARY)).toBeNull();
  });

  it('denies submit-approval', () => {
    const v = evaluateAgencyBoundary('submit-approval', READ_ONLY_BOUNDARY);
    expect(v).toMatchObject({ action: 'submit-approval', tier: 'ReadOnly' });
    expect(v?.reason).toContain('ReadOnly');
  });

  it('denies start-workflow', () => {
    expect(evaluateAgencyBoundary('start-workflow', READ_ONLY_BOUNDARY)).not.toBeNull();
  });

  it('denies submit-map-command', () => {
    expect(evaluateAgencyBoundary('submit-map-command', READ_ONLY_BOUNDARY)).not.toBeNull();
  });

  it('denies escalate-task', () => {
    expect(evaluateAgencyBoundary('escalate-task', READ_ONLY_BOUNDARY)).not.toBeNull();
  });
});

describe('evaluateAgencyBoundary — Standard tier', () => {
  it('allows submit-approval', () => {
    expect(evaluateAgencyBoundary('submit-approval', STANDARD_AGENT_BOUNDARY)).toBeNull();
  });

  it('allows read-evidence', () => {
    expect(evaluateAgencyBoundary('read-evidence', STANDARD_AGENT_BOUNDARY)).toBeNull();
  });

  it('allows escalate-task', () => {
    expect(evaluateAgencyBoundary('escalate-task', STANDARD_AGENT_BOUNDARY)).toBeNull();
  });

  it('denies start-workflow', () => {
    expect(evaluateAgencyBoundary('start-workflow', STANDARD_AGENT_BOUNDARY)).not.toBeNull();
  });

  it('denies submit-map-command', () => {
    expect(evaluateAgencyBoundary('submit-map-command', STANDARD_AGENT_BOUNDARY)).not.toBeNull();
  });
});

describe('evaluateAgencyBoundary — Privileged tier', () => {
  it('allows all actions', () => {
    const actions = [
      'submit-approval',
      'start-workflow',
      'submit-map-command',
      'read-evidence',
      'escalate-task',
    ] as const;
    for (const action of actions) {
      expect(evaluateAgencyBoundary(action, PRIVILEGED_AGENT_BOUNDARY)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// evaluateAgencyBoundary — explicit overrides
// ---------------------------------------------------------------------------

describe('evaluateAgencyBoundary — allowedActions override', () => {
  it('grants start-workflow to a Standard agent when explicitly allowed', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'Standard',
      allowedActions: ['start-workflow'],
    };
    expect(evaluateAgencyBoundary('start-workflow', boundary)).toBeNull();
  });
});

describe('evaluateAgencyBoundary — deniedActions override', () => {
  it('blocks read-evidence for a Privileged agent when explicitly denied', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'Privileged',
      deniedActions: ['read-evidence'],
    };
    const v = evaluateAgencyBoundary('read-evidence', boundary);
    expect(v).not.toBeNull();
    expect(v?.reason).toContain('explicitly denied');
  });

  it('deny overrides allowedActions for the same action', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'ReadOnly',
      allowedActions: ['start-workflow'],
      deniedActions: ['start-workflow'],
    };
    // deny wins over allowedActions
    expect(evaluateAgencyBoundary('start-workflow', boundary)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAgencyBoundaryV1
// ---------------------------------------------------------------------------

describe('parseAgencyBoundaryV1', () => {
  it('parses a minimal ReadOnly boundary', () => {
    const result = parseAgencyBoundaryV1({ schemaVersion: 1, tier: 'ReadOnly' });
    expect(result).toMatchObject({ schemaVersion: 1, tier: 'ReadOnly' });
    expect(result.allowedActions).toBeUndefined();
    expect(result.deniedActions).toBeUndefined();
  });

  it('parses a boundary with overrides', () => {
    const result = parseAgencyBoundaryV1({
      schemaVersion: 1,
      tier: 'Standard',
      allowedActions: ['start-workflow'],
      deniedActions: ['escalate-task'],
    });
    expect(result.allowedActions).toEqual(['start-workflow']);
    expect(result.deniedActions).toEqual(['escalate-task']);
  });

  it('throws AgencyBoundaryParseError for unknown schemaVersion', () => {
    expect(() => parseAgencyBoundaryV1({ schemaVersion: 99, tier: 'Standard' })).toThrow(
      AgencyBoundaryParseError,
    );
  });

  it('throws AgencyBoundaryParseError for unknown tier', () => {
    expect(() => parseAgencyBoundaryV1({ schemaVersion: 1, tier: 'SuperAdmin' })).toThrow(
      AgencyBoundaryParseError,
    );
  });

  it('throws AgencyBoundaryParseError for unknown action in allowedActions', () => {
    expect(() =>
      parseAgencyBoundaryV1({ schemaVersion: 1, tier: 'Standard', allowedActions: ['fly'] }),
    ).toThrow(AgencyBoundaryParseError);
  });

  it('throws AgencyBoundaryParseError when allowedActions is not an array', () => {
    expect(() =>
      parseAgencyBoundaryV1({
        schemaVersion: 1,
        tier: 'Standard',
        allowedActions: 'submit-approval',
      }),
    ).toThrow(AgencyBoundaryParseError);
  });
});

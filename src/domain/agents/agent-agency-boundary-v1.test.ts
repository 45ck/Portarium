/**
 * Tests for agent agency boundary model.
 *
 * Verifies the least-privilege tier ladder, explicit allow/deny overrides,
 * deny-always-wins semantics, parser validation, and canonical defaults.
 *
 * Bead: bead-tz6c
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateAgencyBoundary,
  parseAgencyBoundaryV1,
  AgencyBoundaryParseError,
  READ_ONLY_BOUNDARY,
  STANDARD_AGENT_BOUNDARY,
  PRIVILEGED_AGENT_BOUNDARY,
  type AgencyBoundaryV1,
  type AgentAction,
} from './agent-agency-boundary-v1.js';

// ── Tier defaults ───────────────────────────────────────────────────────────

describe('evaluateAgencyBoundary — tier defaults', () => {
  it('ReadOnly tier allows read-evidence', () => {
    expect(evaluateAgencyBoundary('read-evidence', READ_ONLY_BOUNDARY)).toBeNull();
  });

  it.each(['submit-approval', 'start-workflow', 'submit-map-command', 'escalate-task'] as const)(
    'ReadOnly tier denies %s',
    (action) => {
      const violation = evaluateAgencyBoundary(action, READ_ONLY_BOUNDARY);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('ReadOnly');
      expect(violation?.action).toBe(action);
    },
  );

  it.each(['submit-approval', 'read-evidence', 'escalate-task'] as const)(
    'Standard tier allows %s',
    (action) => {
      expect(evaluateAgencyBoundary(action, STANDARD_AGENT_BOUNDARY)).toBeNull();
    },
  );

  it.each(['start-workflow', 'submit-map-command'] as const)(
    'Standard tier denies %s',
    (action) => {
      const violation = evaluateAgencyBoundary(action, STANDARD_AGENT_BOUNDARY);
      expect(violation).not.toBeNull();
      expect(violation?.tier).toBe('Standard');
    },
  );

  it.each([
    'submit-approval',
    'start-workflow',
    'submit-map-command',
    'read-evidence',
    'escalate-task',
  ] as const)('Privileged tier allows %s', (action) => {
    expect(evaluateAgencyBoundary(action, PRIVILEGED_AGENT_BOUNDARY)).toBeNull();
  });
});

// ── Explicit overrides ──────────────────────────────────────────────────────

describe('evaluateAgencyBoundary — overrides', () => {
  it('allowedActions grants an action not in the tier default', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'ReadOnly',
      allowedActions: ['escalate-task'],
    };
    expect(evaluateAgencyBoundary('escalate-task', boundary)).toBeNull();
  });

  it('deniedActions blocks an action that the tier normally allows', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'Standard',
      deniedActions: ['submit-approval'],
    };
    const violation = evaluateAgencyBoundary('submit-approval', boundary);
    expect(violation).not.toBeNull();
    expect(violation?.reason).toContain('explicitly denied');
  });

  it('deny always wins over allow for the same action', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'ReadOnly',
      allowedActions: ['start-workflow'],
      deniedActions: ['start-workflow'],
    };
    const violation = evaluateAgencyBoundary('start-workflow', boundary);
    expect(violation).not.toBeNull();
    expect(violation?.reason).toContain('explicitly denied');
  });

  it('deny overrides tier default for privileged tier', () => {
    const boundary: AgencyBoundaryV1 = {
      schemaVersion: 1,
      tier: 'Privileged',
      deniedActions: ['submit-map-command'],
    };
    const violation = evaluateAgencyBoundary('submit-map-command', boundary);
    expect(violation).not.toBeNull();
  });
});

// ── Parser ──────────────────────────────────────────────────────────────────

describe('parseAgencyBoundaryV1', () => {
  it('parses a minimal valid boundary', () => {
    const result = parseAgencyBoundaryV1({ schemaVersion: 1, tier: 'Standard' });
    expect(result).toEqual({ schemaVersion: 1, tier: 'Standard' });
  });

  it('parses boundary with allowed and denied actions', () => {
    const result = parseAgencyBoundaryV1({
      schemaVersion: 1,
      tier: 'ReadOnly',
      allowedActions: ['escalate-task'],
      deniedActions: ['submit-approval'],
    });
    expect(result.allowedActions).toEqual(['escalate-task']);
    expect(result.deniedActions).toEqual(['submit-approval']);
  });

  it('throws on unsupported schema version', () => {
    expect(() => parseAgencyBoundaryV1({ schemaVersion: 2, tier: 'Standard' })).toThrow(
      AgencyBoundaryParseError,
    );
  });

  it('throws on invalid tier', () => {
    expect(() => parseAgencyBoundaryV1({ schemaVersion: 1, tier: 'SuperAdmin' })).toThrow(
      AgencyBoundaryParseError,
    );
  });

  it('throws on non-object input', () => {
    expect(() => parseAgencyBoundaryV1('not-an-object')).toThrow(AgencyBoundaryParseError);
  });

  it('throws on unknown action in allowedActions', () => {
    expect(() =>
      parseAgencyBoundaryV1({
        schemaVersion: 1,
        tier: 'Standard',
        allowedActions: ['launch-missiles'],
      }),
    ).toThrow(AgencyBoundaryParseError);
  });

  it('throws on non-array allowedActions', () => {
    expect(() =>
      parseAgencyBoundaryV1({
        schemaVersion: 1,
        tier: 'Standard',
        allowedActions: 'read-evidence',
      }),
    ).toThrow(AgencyBoundaryParseError);
  });
});

// ── AI advisor recommend-only invariant ─────────────────────────────────────

describe('AI advisor recommend-only boundary', () => {
  const AI_ADVISOR_BOUNDARY: AgencyBoundaryV1 = {
    schemaVersion: 1,
    tier: 'ReadOnly',
    allowedActions: ['escalate-task'],
  };

  it('AI advisor can read evidence', () => {
    expect(evaluateAgencyBoundary('read-evidence', AI_ADVISOR_BOUNDARY)).toBeNull();
  });

  it('AI advisor can escalate tasks (recommend to human)', () => {
    expect(evaluateAgencyBoundary('escalate-task', AI_ADVISOR_BOUNDARY)).toBeNull();
  });

  const mutatingActions: AgentAction[] = [
    'submit-approval',
    'start-workflow',
    'submit-map-command',
  ];
  it.each(mutatingActions)('AI advisor cannot %s (never auto-approve)', (action) => {
    const violation = evaluateAgencyBoundary(action, AI_ADVISOR_BOUNDARY);
    expect(violation).not.toBeNull();
  });
});

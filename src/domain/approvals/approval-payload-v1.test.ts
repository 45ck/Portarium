/**
 * Contract tests for the immutable ApprovalPayloadV1 domain model (bead-8w3q).
 *
 * Covers:
 *   - createApprovalPayload factory (valid & invalid inputs)
 *   - parseApprovalPayloadV1 (happy path + error cases)
 *   - Deep immutability invariants (Object.freeze behaviour)
 *   - EscalationChain validation (ordering, duplicates, field constraints)
 */

import { describe, expect, it } from 'vitest';

import {
  ApprovalPayloadValidationError,
  createApprovalPayload,
  parseApprovalPayloadV1,
  type ApprovalPayloadInput,
  type ApprovalPayloadV1,
} from './approval-payload-v1.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_INPUT: ApprovalPayloadInput = {
  prompt: 'Approve deployment to production.',
};

function makePayload(overrides: Partial<ApprovalPayloadInput> = {}): ApprovalPayloadV1 {
  return createApprovalPayload({ ...MINIMAL_INPUT, ...overrides });
}

// ---------------------------------------------------------------------------
// createApprovalPayload — happy path
// ---------------------------------------------------------------------------

describe('createApprovalPayload — happy path', () => {
  it('creates a minimal payload with only a prompt', () => {
    const payload = makePayload();
    expect(payload.schemaVersion).toBe(1);
    expect(payload.prompt).toBe('Approve deployment to production.');
    expect(payload.workItemId).toBeUndefined();
    expect(payload.assigneeUserId).toBeUndefined();
    expect(payload.dueAtIso).toBeUndefined();
    expect(payload.escalationChain).toBeUndefined();
  });

  it('trims leading/trailing whitespace from prompt', () => {
    const payload = makePayload({ prompt: '  Review risk assessment.  ' });
    expect(payload.prompt).toBe('Review risk assessment.');
  });

  it('creates a fully-populated payload', () => {
    const payload = makePayload({
      prompt: 'Approve data deletion request.',
      workItemId: 'wi-42',
      assigneeUserId: 'user-legal',
      dueAtIso: '2026-03-01T00:00:00.000Z',
      escalationChain: [
        { stepOrder: 1, escalateToUserId: 'user-manager', afterHours: 24 },
        { stepOrder: 2, escalateToUserId: 'user-vp', afterHours: 48 },
      ],
    });

    expect(payload.prompt).toBe('Approve data deletion request.');
    expect(payload.workItemId).toBe('wi-42');
    expect(payload.assigneeUserId).toBe('user-legal');
    expect(payload.dueAtIso).toBe('2026-03-01T00:00:00.000Z');
    expect(payload.escalationChain).toHaveLength(2);
    expect(payload.escalationChain?.[0]?.stepOrder).toBe(1);
    expect(payload.escalationChain?.[1]?.escalateToUserId).toBe('user-vp');
  });

  it('preserves branded workItemId and assigneeUserId types at runtime', () => {
    const payload = makePayload({ workItemId: 'wi-1', assigneeUserId: 'u-1' });
    expect(typeof payload.workItemId).toBe('string');
    expect(typeof payload.assigneeUserId).toBe('string');
    expect(payload.workItemId).toBe('wi-1');
    expect(payload.assigneeUserId).toBe('u-1');
  });
});

// ---------------------------------------------------------------------------
// createApprovalPayload — immutability invariants
// ---------------------------------------------------------------------------

describe('createApprovalPayload — immutability', () => {
  it('the returned object is frozen', () => {
    const payload = makePayload();
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it('the escalationChain array is frozen', () => {
    const payload = makePayload({
      escalationChain: [{ stepOrder: 1, escalateToUserId: 'u-1', afterHours: 8 }],
    });
    expect(Object.isFrozen(payload.escalationChain)).toBe(true);
  });

  it('each escalation step object is frozen', () => {
    const payload = makePayload({
      escalationChain: [
        { stepOrder: 1, escalateToUserId: 'u-1', afterHours: 8 },
        { stepOrder: 2, escalateToUserId: 'u-2', afterHours: 24 },
      ],
    });
    for (const step of payload.escalationChain!) {
      expect(Object.isFrozen(step)).toBe(true);
    }
  });

  it('mutation attempt on frozen payload throws in strict mode (or is silently ignored)', () => {
    const payload = makePayload();
    // In strict mode (which vitest uses) this throws TypeError.
    expect(() => {
      'use strict';
      // @ts-expect-error — intentional mutation attempt
      payload.prompt = 'MUTATED';
    }).toThrow();
  });

  it('mutation attempt on escalationChain array throws in strict mode', () => {
    const payload = makePayload({
      escalationChain: [{ stepOrder: 1, escalateToUserId: 'u', afterHours: 1 }],
    });
    expect(() => {
      'use strict';
      // @ts-expect-error — intentional mutation attempt
      payload.escalationChain!.push({ stepOrder: 2, escalateToUserId: 'x', afterHours: 2 });
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// createApprovalPayload — validation errors
// ---------------------------------------------------------------------------

describe('createApprovalPayload — validation errors (prompt)', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['tab-only', '\t'],
  ])('rejects prompt: %s', (_label, prompt) => {
    expect(() => makePayload({ prompt })).toThrow(ApprovalPayloadValidationError);
  });
});

describe('createApprovalPayload — validation errors (optional IDs)', () => {
  it('rejects empty workItemId', () => {
    expect(() => makePayload({ workItemId: '' })).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects whitespace-only workItemId', () => {
    expect(() => makePayload({ workItemId: '   ' })).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects empty assigneeUserId', () => {
    expect(() => makePayload({ assigneeUserId: '' })).toThrow(ApprovalPayloadValidationError);
  });
});

describe('createApprovalPayload — validation errors (dueAtIso)', () => {
  it('rejects an invalid ISO date string', () => {
    expect(() => makePayload({ dueAtIso: 'not-a-date' })).toThrow(ApprovalPayloadValidationError);
  });

  it('accepts a date-only ISO string (new Date() parses it)', () => {
    // parseIsoDate uses new Date() which accepts date-only strings.
    expect(() => makePayload({ dueAtIso: '2026-03-01' })).not.toThrow();
  });

  it('accepts a valid ISO-8601 UTC string', () => {
    expect(() => makePayload({ dueAtIso: '2026-03-01T00:00:00.000Z' })).not.toThrow();
  });
});

describe('createApprovalPayload — validation errors (escalationChain)', () => {
  it('rejects an empty escalation chain array', () => {
    expect(() => makePayload({ escalationChain: [] })).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with stepOrder < 1', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: 0, escalateToUserId: 'u', afterHours: 1 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with stepOrder = 0', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: 0, escalateToUserId: 'u', afterHours: 1 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with negative stepOrder', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: -1, escalateToUserId: 'u', afterHours: 1 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with afterHours = 0', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: 1, escalateToUserId: 'u', afterHours: 0 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with negative afterHours', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: 1, escalateToUserId: 'u', afterHours: -5 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects a step with empty escalateToUserId', () => {
    expect(() =>
      makePayload({
        escalationChain: [{ stepOrder: 1, escalateToUserId: '', afterHours: 1 }],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects steps not in strictly ascending stepOrder', () => {
    expect(() =>
      makePayload({
        escalationChain: [
          { stepOrder: 2, escalateToUserId: 'u1', afterHours: 4 },
          { stepOrder: 1, escalateToUserId: 'u2', afterHours: 8 },
        ],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects duplicate stepOrder values', () => {
    expect(() =>
      makePayload({
        escalationChain: [
          { stepOrder: 1, escalateToUserId: 'u1', afterHours: 4 },
          { stepOrder: 1, escalateToUserId: 'u2', afterHours: 8 },
        ],
      }),
    ).toThrow(ApprovalPayloadValidationError);
  });

  it('accepts steps with non-consecutive but ascending stepOrder values', () => {
    expect(() =>
      makePayload({
        escalationChain: [
          { stepOrder: 1, escalateToUserId: 'u1', afterHours: 4 },
          { stepOrder: 5, escalateToUserId: 'u2', afterHours: 24 },
          { stepOrder: 10, escalateToUserId: 'u3', afterHours: 72 },
        ],
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseApprovalPayloadV1 — happy path
// ---------------------------------------------------------------------------

describe('parseApprovalPayloadV1 — happy path', () => {
  it('parses a minimal JSON object', () => {
    const payload = parseApprovalPayloadV1({
      schemaVersion: 1,
      prompt: 'Deploy to staging.',
    });
    expect(payload.schemaVersion).toBe(1);
    expect(payload.prompt).toBe('Deploy to staging.');
  });

  it('parses a fully-populated JSON object', () => {
    const raw = {
      schemaVersion: 1,
      prompt: 'Review SLA breach.',
      workItemId: 'wi-99',
      assigneeUserId: 'user-sre',
      dueAtIso: '2026-04-01T00:00:00.000Z',
      escalationChain: [{ stepOrder: 1, escalateToUserId: 'u-lead', afterHours: 8 }],
    };
    const payload = parseApprovalPayloadV1(raw);
    expect(payload.prompt).toBe('Review SLA breach.');
    expect(payload.workItemId).toBe('wi-99');
    expect(payload.assigneeUserId).toBe('user-sre');
    expect(payload.dueAtIso).toBe('2026-04-01T00:00:00.000Z');
    expect(payload.escalationChain?.[0]?.stepOrder).toBe(1);
  });

  it('returns a frozen object', () => {
    const payload = parseApprovalPayloadV1({ schemaVersion: 1, prompt: 'Test.' });
    expect(Object.isFrozen(payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseApprovalPayloadV1 — error cases
// ---------------------------------------------------------------------------

describe('parseApprovalPayloadV1 — error cases', () => {
  it('rejects a non-object (string)', () => {
    expect(() => parseApprovalPayloadV1('invalid')).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects null', () => {
    expect(() => parseApprovalPayloadV1(null)).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects an array', () => {
    expect(() => parseApprovalPayloadV1([])).toThrow(ApprovalPayloadValidationError);
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(() => parseApprovalPayloadV1({ schemaVersion: 2, prompt: 'Test.' })).toThrow(
      ApprovalPayloadValidationError,
    );
  });

  it('rejects a missing schemaVersion', () => {
    expect(() => parseApprovalPayloadV1({ prompt: 'Test.' })).toThrow(
      ApprovalPayloadValidationError,
    );
  });

  it('rejects an empty prompt', () => {
    expect(() => parseApprovalPayloadV1({ schemaVersion: 1, prompt: '' })).toThrow(
      ApprovalPayloadValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// ApprovalPayloadValidationError shape
// ---------------------------------------------------------------------------

describe('ApprovalPayloadValidationError', () => {
  it('has the correct name', () => {
    const err = new ApprovalPayloadValidationError('test');
    expect(err.name).toBe('ApprovalPayloadValidationError');
  });

  it('is an instance of Error', () => {
    const err = new ApprovalPayloadValidationError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('factory throws an ApprovalPayloadValidationError (not a generic Error)', () => {
    expect(() => makePayload({ prompt: '' })).toThrow(ApprovalPayloadValidationError);
  });
});

// ---------------------------------------------------------------------------
// Value object semantics
// ---------------------------------------------------------------------------

describe('value object semantics', () => {
  it('two payloads with same fields have deeply equal structures', () => {
    const a = makePayload({ prompt: 'Identical prompt.' });
    const b = makePayload({ prompt: 'Identical prompt.' });
    expect(a.prompt).toBe(b.prompt);
    expect(a.schemaVersion).toBe(b.schemaVersion);
  });

  it('payload with optional fields omits them from the object (no undefined properties)', () => {
    const payload = makePayload();
    expect('workItemId' in payload).toBe(false);
    expect('assigneeUserId' in payload).toBe(false);
    expect('dueAtIso' in payload).toBe(false);
    expect('escalationChain' in payload).toBe(false);
  });
});

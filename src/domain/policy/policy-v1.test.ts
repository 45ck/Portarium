import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from './policy-v1.js';

describe('parsePolicyV1: happy path', () => {
  it('parses a minimal PolicyV1', () => {
    const policy = parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
    });

    expect(policy.schemaVersion).toBe(1);
    expect(policy.policyId).toBe('pol-1');
    expect(policy.sodConstraints).toBeUndefined();
  });

  it('parses SoD constraints when provided', () => {
    const policy = parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-2',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      sodConstraints: [{ kind: 'MakerChecker' }],
    });

    expect(policy.sodConstraints?.[0]?.kind).toBe('MakerChecker');
  });
});

describe('parsePolicyV1: validation', () => {
  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parsePolicyV1('nope')).toThrow(/Policy must be an object/i);

    expect(() =>
      parsePolicyV1({
        schemaVersion: 2,
        policyId: 'pol-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
      }),
    ).toThrow(/schemaVersion/i);

    expect(() =>
      parsePolicyV1({
        schemaVersion: 1.5,
        policyId: 'pol-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects invalid required strings and sodConstraints shapes', () => {
    expect(() =>
      parsePolicyV1({
        schemaVersion: 1,
        policyId: '   ',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
      }),
    ).toThrow(/policyId/i);

    expect(() =>
      parsePolicyV1({
        schemaVersion: 1,
        policyId: 'pol-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        sodConstraints: {},
      }),
    ).toThrow(/sodConstraints must be an array/i);
  });
});

import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from './policy-v1.js';

const VALID_POLICY = {
  schemaVersion: 1,
  policyId: 'pol-1',
  workspaceId: 'ws-1',
  name: 'Test Policy',
  description: 'A test policy',
  active: true,
  priority: 1,
  version: 1,
  createdAtIso: '2026-02-16T00:00:00.000Z',
  createdByUserId: 'user-1',
};

describe('parsePolicyV1: happy path', () => {
  it('parses a minimal PolicyV1', () => {
    const policy = parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-1',
      workspaceId: 'ws-1',
      name: 'Test Policy',
      description: 'A test policy',
      active: true,
      priority: 1,
      version: 1,
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
    });

    expect(policy.schemaVersion).toBe(1);
    expect(policy.policyId).toBe('pol-1');
    expect(policy.name).toBe('Test Policy');
    expect(policy.description).toBe('A test policy');
    expect(policy.active).toBe(true);
    expect(policy.priority).toBe(1);
    expect(policy.version).toBe(1);
    expect(policy.sodConstraints).toBeUndefined();
  });

  it('parses SoD constraints when provided', () => {
    const policy = parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-2',
      workspaceId: 'ws-1',
      name: 'Test Policy',
      description: 'A test policy',
      active: true,
      priority: 1,
      version: 1,
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      sodConstraints: [{ kind: 'MakerChecker' }],
    });

    expect(policy.sodConstraints?.[0]?.kind).toBe('MakerChecker');
  });

  it('parses when optional description is omitted', () => {
    const policy = parsePolicyV1({ ...VALID_POLICY, description: undefined });

    expect(policy.description).toBeUndefined();
    expect(policy.name).toBe('Test Policy');
  });
});

describe('parsePolicyV1: validation', () => {
  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parsePolicyV1('nope')).toThrow(/Policy must be an object/i);

    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        schemaVersion: 2,
      }),
    ).toThrow(/schemaVersion/i);

    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        schemaVersion: 1.5,
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects invalid required strings and sodConstraints shapes', () => {
    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        policyId: '   ',
      }),
    ).toThrow(/policyId/i);

    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        sodConstraints: {},
      }),
    ).toThrow(/sodConstraints must be an array/i);
  });

  it('rejects missing name', () => {
    expect(() => parsePolicyV1({ ...VALID_POLICY, name: undefined })).toThrow(
      /name must be a non-empty string/i,
    );
  });

  it('rejects non-boolean active', () => {
    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        active: 'yes',
      }),
    ).toThrow(/active must be a boolean/i);
  });

  it('rejects non-integer priority', () => {
    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        priority: 1.5,
      }),
    ).toThrow(/priority must be an integer/i);
  });

  it('rejects non-integer version', () => {
    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        version: 0.5,
      }),
    ).toThrow(/version must be an integer/i);
  });

  it('rejects invalid ISO timestamp for createdAtIso', () => {
    expect(() =>
      parsePolicyV1({
        ...VALID_POLICY,
        createdAtIso: 'not-a-date',
      }),
    ).toThrow(/createdAtIso must be a valid ISO timestamp/);
  });
});

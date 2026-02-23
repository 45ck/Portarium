import { describe, expect, it } from 'vitest';

import { UserId, WorkspaceId } from '../primitives/index.js';

import {
  createDelegationGrant,
  DelegationValidationError,
  findApplicableDelegations,
  getDelegationGrantStatus,
  isDelegationApplicable,
  revokeDelegationGrant,
  type DelegationGrantInput,
} from './approval-delegation-v1.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseInput: DelegationGrantInput = {
  grantId: 'grant-001',
  delegatorUserId: UserId('user-alice'),
  delegateUserId: UserId('user-bob'),
  startsAtIso: '2026-01-15T00:00:00Z',
  expiresAtIso: '2026-01-22T00:00:00Z',
  reason: 'Alice on vacation',
  createdAtIso: '2026-01-14T10:00:00Z',
};

// ---------------------------------------------------------------------------
// createDelegationGrant
// ---------------------------------------------------------------------------

describe('createDelegationGrant', () => {
  it('creates an immutable grant with required fields', () => {
    const grant = createDelegationGrant(baseInput);

    expect(grant.schemaVersion).toBe(1);
    expect(grant.grantId).toBe('grant-001');
    expect(grant.delegatorUserId).toBe('user-alice');
    expect(grant.delegateUserId).toBe('user-bob');
    expect(grant.startsAtIso).toBe('2026-01-15T00:00:00Z');
    expect(grant.expiresAtIso).toBe('2026-01-22T00:00:00Z');
    expect(grant.reason).toBe('Alice on vacation');
    expect(grant.revocation).toBeUndefined();
    expect(Object.isFrozen(grant)).toBe(true);
  });

  it('defaults scope to empty object when not provided', () => {
    const grant = createDelegationGrant(baseInput);
    expect(grant.scope).toEqual({});
  });

  it('includes scope constraints when provided', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: {
        workspaceId: WorkspaceId('ws-001'),
        maxRiskLevel: 'medium',
        allowedSubjectKinds: ['deployment_config', 'code_diff'],
      },
    });

    expect(grant.scope.workspaceId).toBe('ws-001');
    expect(grant.scope.maxRiskLevel).toBe('medium');
    expect(grant.scope.allowedSubjectKinds).toEqual(['deployment_config', 'code_diff']);
  });

  it('trims grantId and reason whitespace', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      grantId: '  grant-002  ',
      reason: '  Out of office  ',
    });

    expect(grant.grantId).toBe('grant-002');
    expect(grant.reason).toBe('Out of office');
  });

  it('rejects self-delegation', () => {
    expect(() =>
      createDelegationGrant({
        ...baseInput,
        delegateUserId: UserId('user-alice'),
      }),
    ).toThrow(DelegationValidationError);
    expect(() =>
      createDelegationGrant({
        ...baseInput,
        delegateUserId: UserId('user-alice'),
      }),
    ).toThrow('different users');
  });

  it('rejects empty grantId', () => {
    expect(() => createDelegationGrant({ ...baseInput, grantId: '' })).toThrow(
      DelegationValidationError,
    );
  });

  it('rejects whitespace-only grantId', () => {
    expect(() => createDelegationGrant({ ...baseInput, grantId: '   ' })).toThrow('non-empty');
  });

  it('rejects empty reason', () => {
    expect(() => createDelegationGrant({ ...baseInput, reason: '' })).toThrow(
      DelegationValidationError,
    );
  });

  it('rejects expiresAtIso not after startsAtIso', () => {
    expect(() =>
      createDelegationGrant({
        ...baseInput,
        startsAtIso: '2026-01-15T00:00:00Z',
        expiresAtIso: '2026-01-15T00:00:00Z',
      }),
    ).toThrow('after startsAtIso');
  });

  it('rejects expiresAtIso before startsAtIso', () => {
    expect(() =>
      createDelegationGrant({
        ...baseInput,
        startsAtIso: '2026-01-15T00:00:00Z',
        expiresAtIso: '2026-01-14T00:00:00Z',
      }),
    ).toThrow(DelegationValidationError);
  });

  it('deeply freezes the scope', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { maxRiskLevel: 'high' },
    });
    expect(Object.isFrozen(grant.scope)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// revokeDelegationGrant
// ---------------------------------------------------------------------------

describe('revokeDelegationGrant', () => {
  it('returns a new grant with revocation details', () => {
    const grant = createDelegationGrant(baseInput);
    const revoked = revokeDelegationGrant(grant, {
      revokedByUserId: UserId('user-admin'),
      revokedAtIso: '2026-01-16T12:00:00Z',
      reason: 'Alice returned early',
    });

    expect(revoked.revocation).toBeDefined();
    expect(revoked.revocation!.revokedByUserId).toBe('user-admin');
    expect(revoked.revocation!.revokedAtIso).toBe('2026-01-16T12:00:00Z');
    expect(revoked.revocation!.reason).toBe('Alice returned early');
    expect(Object.isFrozen(revoked)).toBe(true);
    expect(Object.isFrozen(revoked.revocation)).toBe(true);
  });

  it('preserves original grant fields', () => {
    const grant = createDelegationGrant(baseInput);
    const revoked = revokeDelegationGrant(grant, {
      revokedByUserId: UserId('user-admin'),
      revokedAtIso: '2026-01-16T12:00:00Z',
      reason: 'Revoked',
    });

    expect(revoked.grantId).toBe(grant.grantId);
    expect(revoked.delegatorUserId).toBe(grant.delegatorUserId);
    expect(revoked.delegateUserId).toBe(grant.delegateUserId);
  });

  it('rejects revoking an already-revoked grant', () => {
    const grant = createDelegationGrant(baseInput);
    const revoked = revokeDelegationGrant(grant, {
      revokedByUserId: UserId('user-admin'),
      revokedAtIso: '2026-01-16T12:00:00Z',
      reason: 'First revocation',
    });

    expect(() =>
      revokeDelegationGrant(revoked, {
        revokedByUserId: UserId('user-admin'),
        revokedAtIso: '2026-01-17T12:00:00Z',
        reason: 'Second revocation',
      }),
    ).toThrow('already revoked');
  });

  it('rejects empty revocation reason', () => {
    const grant = createDelegationGrant(baseInput);
    expect(() =>
      revokeDelegationGrant(grant, {
        revokedByUserId: UserId('user-admin'),
        revokedAtIso: '2026-01-16T12:00:00Z',
        reason: '',
      }),
    ).toThrow('non-empty');
  });
});

// ---------------------------------------------------------------------------
// getDelegationGrantStatus
// ---------------------------------------------------------------------------

describe('getDelegationGrantStatus', () => {
  it('returns active when within the time window', () => {
    const grant = createDelegationGrant(baseInput);
    expect(getDelegationGrantStatus(grant, '2026-01-17T12:00:00Z')).toBe('active');
  });

  it('returns active at exact start time', () => {
    const grant = createDelegationGrant(baseInput);
    expect(getDelegationGrantStatus(grant, '2026-01-15T00:00:00Z')).toBe('active');
  });

  it('returns expired at exact expiry time', () => {
    const grant = createDelegationGrant(baseInput);
    expect(getDelegationGrantStatus(grant, '2026-01-22T00:00:00Z')).toBe('expired');
  });

  it('returns expired after expiry time', () => {
    const grant = createDelegationGrant(baseInput);
    expect(getDelegationGrantStatus(grant, '2026-02-01T00:00:00Z')).toBe('expired');
  });

  it('returns expired before start time', () => {
    const grant = createDelegationGrant(baseInput);
    expect(getDelegationGrantStatus(grant, '2026-01-14T00:00:00Z')).toBe('expired');
  });

  it('returns revoked regardless of time when revoked', () => {
    const grant = createDelegationGrant(baseInput);
    const revoked = revokeDelegationGrant(grant, {
      revokedByUserId: UserId('user-admin'),
      revokedAtIso: '2026-01-16T12:00:00Z',
      reason: 'Revoked',
    });

    // Even within the active window, status is revoked
    expect(getDelegationGrantStatus(revoked, '2026-01-17T12:00:00Z')).toBe('revoked');
  });
});

// ---------------------------------------------------------------------------
// isDelegationApplicable
// ---------------------------------------------------------------------------

describe('isDelegationApplicable', () => {
  it('returns true for active grant with no scope restrictions', () => {
    const grant = createDelegationGrant(baseInput);
    expect(isDelegationApplicable(grant, { atIso: '2026-01-17T12:00:00Z' })).toBe(true);
  });

  it('returns false for expired grant', () => {
    const grant = createDelegationGrant(baseInput);
    expect(isDelegationApplicable(grant, { atIso: '2026-02-01T00:00:00Z' })).toBe(false);
  });

  it('returns false when workspace does not match', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { workspaceId: WorkspaceId('ws-001') },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        workspaceId: WorkspaceId('ws-002'),
      }),
    ).toBe(false);
  });

  it('returns true when workspace matches', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { workspaceId: WorkspaceId('ws-001') },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        workspaceId: WorkspaceId('ws-001'),
      }),
    ).toBe(true);
  });

  it('returns false when risk level exceeds max', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { maxRiskLevel: 'medium' },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        riskLevel: 'high',
      }),
    ).toBe(false);
  });

  it('returns true when risk level is at max', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { maxRiskLevel: 'medium' },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        riskLevel: 'medium',
      }),
    ).toBe(true);
  });

  it('returns true when risk level is below max', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { maxRiskLevel: 'high' },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        riskLevel: 'low',
      }),
    ).toBe(true);
  });

  it('returns false when subject kind is not allowed', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { allowedSubjectKinds: ['deployment_config'] },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        subjectKind: 'code_diff',
      }),
    ).toBe(false);
  });

  it('returns true when subject kind is allowed', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: { allowedSubjectKinds: ['deployment_config', 'code_diff'] },
    });
    expect(
      isDelegationApplicable(grant, {
        atIso: '2026-01-17T12:00:00Z',
        subjectKind: 'code_diff',
      }),
    ).toBe(true);
  });

  it('ignores scope fields when context does not provide them', () => {
    const grant = createDelegationGrant({
      ...baseInput,
      scope: {
        workspaceId: WorkspaceId('ws-001'),
        maxRiskLevel: 'medium',
        allowedSubjectKinds: ['deployment_config'],
      },
    });
    // No workspace/risk/subject in context — scope check is skipped
    expect(isDelegationApplicable(grant, { atIso: '2026-01-17T12:00:00Z' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findApplicableDelegations
// ---------------------------------------------------------------------------

describe('findApplicableDelegations', () => {
  it('returns matching grants for the delegate', () => {
    const g1 = createDelegationGrant(baseInput);
    const g2 = createDelegationGrant({
      ...baseInput,
      grantId: 'grant-002',
      delegateUserId: UserId('user-charlie'),
    });

    const results = findApplicableDelegations([g1, g2], {
      delegateUserId: UserId('user-bob'),
      atIso: '2026-01-17T12:00:00Z',
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.grantId).toBe('grant-001');
  });

  it('returns empty for non-matching delegate', () => {
    const g1 = createDelegationGrant(baseInput);
    const results = findApplicableDelegations([g1], {
      delegateUserId: UserId('user-charlie'),
      atIso: '2026-01-17T12:00:00Z',
    });
    expect(results).toHaveLength(0);
  });

  it('filters out expired grants', () => {
    const g1 = createDelegationGrant(baseInput);
    const results = findApplicableDelegations([g1], {
      delegateUserId: UserId('user-bob'),
      atIso: '2026-02-01T00:00:00Z',
    });
    expect(results).toHaveLength(0);
  });

  it('filters by scope constraints', () => {
    const g1 = createDelegationGrant({
      ...baseInput,
      scope: { maxRiskLevel: 'low' },
    });
    const results = findApplicableDelegations([g1], {
      delegateUserId: UserId('user-bob'),
      atIso: '2026-01-17T12:00:00Z',
      riskLevel: 'critical',
    });
    expect(results).toHaveLength(0);
  });

  it('returns multiple matching grants', () => {
    const g1 = createDelegationGrant(baseInput);
    const g2 = createDelegationGrant({
      ...baseInput,
      grantId: 'grant-003',
    });

    const results = findApplicableDelegations([g1, g2], {
      delegateUserId: UserId('user-bob'),
      atIso: '2026-01-17T12:00:00Z',
    });
    expect(results).toHaveLength(2);
  });
});

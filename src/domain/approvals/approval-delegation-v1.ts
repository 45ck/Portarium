/**
 * Approval Delegation Model (bead-0813).
 *
 * Defines how approval authority can be delegated from one user to another.
 * Supports time-bounded, scope-limited delegations with revocation tracking.
 *
 * A delegation grant allows a delegate to act on behalf of the delegator
 * for approvals matching the grant's scope. The decision record captures
 * `method: 'delegation'` when a delegated approval is exercised.
 *
 * Security invariants:
 *   - A user cannot delegate to themselves.
 *   - Delegations have mandatory expiry (no permanent delegations).
 *   - Revoked delegations cannot be un-revoked; create a new grant instead.
 *   - Scope constraints are conjunctive (all must match).
 *
 * This is a domain value object module — no side effects, no external deps.
 */

import type { UserId as UserIdType, WorkspaceId as WorkspaceIdType } from '../primitives/index.js';

import type { PolicyRiskLevel } from './approval-policy-rules-v1.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Status of a delegation grant. */
export type DelegationGrantStatus = 'active' | 'expired' | 'revoked';

/**
 * Scope constraints that limit what approvals a delegate can decide.
 * All specified constraints must match (conjunctive/AND).
 * Omitted constraints are unrestricted.
 */
export type DelegationScopeV1 = Readonly<{
  /** Limit to a specific workspace. */
  workspaceId?: WorkspaceIdType;
  /** Maximum risk level the delegate can approve (inclusive). */
  maxRiskLevel?: PolicyRiskLevel;
  /** Approval subject kinds the delegate can handle. */
  allowedSubjectKinds?: readonly string[];
}>;

/**
 * An immutable delegation grant record.
 *
 * Created when a user (delegator) grants approval authority to another
 * user (delegate) for a bounded scope and time period.
 */
export type ApprovalDelegationGrantV1 = Readonly<{
  schemaVersion: 1;
  /** Unique identifier for this grant. */
  grantId: string;
  /** The user granting delegation authority. */
  delegatorUserId: UserIdType;
  /** The user receiving delegation authority. */
  delegateUserId: UserIdType;
  /** Scope constraints for the delegation. */
  scope: DelegationScopeV1;
  /** ISO-8601 timestamp when the delegation becomes active. */
  startsAtIso: string;
  /** ISO-8601 timestamp when the delegation expires. */
  expiresAtIso: string;
  /** Human-readable reason for the delegation. */
  reason: string;
  /** ISO-8601 timestamp when the grant was created. */
  createdAtIso: string;
  /** Revocation info, if revoked. */
  revocation?: DelegationRevocationV1;
}>;

/** Revocation details for a delegation grant. */
export type DelegationRevocationV1 = Readonly<{
  /** Who revoked the delegation. */
  revokedByUserId: UserIdType;
  /** ISO-8601 timestamp when the delegation was revoked. */
  revokedAtIso: string;
  /** Reason for revocation. */
  reason: string;
}>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DelegationValidationError extends Error {
  public override readonly name = 'DelegationValidationError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

/** Input for creating a delegation grant. */
export interface DelegationGrantInput {
  grantId: string;
  delegatorUserId: UserIdType;
  delegateUserId: UserIdType;
  scope?: DelegationScopeV1;
  startsAtIso: string;
  expiresAtIso: string;
  reason: string;
  createdAtIso: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an immutable delegation grant.
 *
 * Validates invariants and freezes the result.
 *
 * Invariants:
 *   - delegator and delegate must be different users
 *   - expiresAtIso must be after startsAtIso
 *   - reason must be non-empty
 *   - grantId must be non-empty
 */
export function createDelegationGrant(input: DelegationGrantInput): ApprovalDelegationGrantV1 {
  if (!input.grantId || input.grantId.trim().length === 0) {
    throw new DelegationValidationError('grantId must be non-empty');
  }

  if (input.delegatorUserId === input.delegateUserId) {
    throw new DelegationValidationError('delegator and delegate must be different users');
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new DelegationValidationError('reason must be non-empty');
  }

  const starts = new Date(input.startsAtIso).getTime();
  const expires = new Date(input.expiresAtIso).getTime();
  if (expires <= starts) {
    throw new DelegationValidationError('expiresAtIso must be after startsAtIso');
  }

  const grant: ApprovalDelegationGrantV1 = {
    schemaVersion: 1,
    grantId: input.grantId.trim(),
    delegatorUserId: input.delegatorUserId,
    delegateUserId: input.delegateUserId,
    scope: input.scope ?? {},
    startsAtIso: input.startsAtIso,
    expiresAtIso: input.expiresAtIso,
    reason: input.reason.trim(),
    createdAtIso: input.createdAtIso,
  };

  return deepFreeze(grant);
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

/**
 * Revoke a delegation grant.
 *
 * Returns a new immutable grant with the revocation attached.
 * A revoked grant cannot be un-revoked.
 */
export function revokeDelegationGrant(
  grant: ApprovalDelegationGrantV1,
  revocation: {
    revokedByUserId: UserIdType;
    revokedAtIso: string;
    reason: string;
  },
): ApprovalDelegationGrantV1 {
  if (grant.revocation) {
    throw new DelegationValidationError('delegation grant is already revoked');
  }

  if (!revocation.reason || revocation.reason.trim().length === 0) {
    throw new DelegationValidationError('revocation reason must be non-empty');
  }

  return deepFreeze({
    ...grant,
    revocation: {
      revokedByUserId: revocation.revokedByUserId,
      revokedAtIso: revocation.revokedAtIso,
      reason: revocation.reason.trim(),
    },
  });
}

// ---------------------------------------------------------------------------
// Status queries
// ---------------------------------------------------------------------------

/**
 * Determine the current status of a delegation grant at a given point in time.
 */
export function getDelegationGrantStatus(
  grant: ApprovalDelegationGrantV1,
  atIso: string,
): DelegationGrantStatus {
  if (grant.revocation) {
    return 'revoked';
  }

  const at = new Date(atIso).getTime();
  const expires = new Date(grant.expiresAtIso).getTime();

  if (at >= expires) {
    return 'expired';
  }

  const starts = new Date(grant.startsAtIso).getTime();
  if (at < starts) {
    // Not yet active — treat as expired (not yet started)
    return 'expired';
  }

  return 'active';
}

/**
 * Check whether a delegation grant is currently active and covers the
 * given approval context.
 */
export function isDelegationApplicable(
  grant: ApprovalDelegationGrantV1,
  context: {
    atIso: string;
    workspaceId?: WorkspaceIdType;
    riskLevel?: PolicyRiskLevel;
    subjectKind?: string;
  },
): boolean {
  // Must be active
  if (getDelegationGrantStatus(grant, context.atIso) !== 'active') {
    return false;
  }

  // Check workspace scope
  if (grant.scope.workspaceId && context.workspaceId) {
    if (grant.scope.workspaceId !== context.workspaceId) {
      return false;
    }
  }

  // Check risk level scope
  if (grant.scope.maxRiskLevel && context.riskLevel) {
    const riskOrder: Record<PolicyRiskLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    if (riskOrder[context.riskLevel] > riskOrder[grant.scope.maxRiskLevel]) {
      return false;
    }
  }

  // Check subject kind scope
  if (grant.scope.allowedSubjectKinds && context.subjectKind) {
    if (!grant.scope.allowedSubjectKinds.includes(context.subjectKind)) {
      return false;
    }
  }

  return true;
}

/**
 * Find all applicable delegation grants from a list for a given context.
 * Returns only active grants whose scope covers the context.
 */
export function findApplicableDelegations(
  grants: readonly ApprovalDelegationGrantV1[],
  context: {
    delegateUserId: UserIdType;
    atIso: string;
    workspaceId?: WorkspaceIdType;
    riskLevel?: PolicyRiskLevel;
    subjectKind?: string;
  },
): readonly ApprovalDelegationGrantV1[] {
  return grants.filter(
    (g) => g.delegateUserId === context.delegateUserId && isDelegationApplicable(g, context),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}

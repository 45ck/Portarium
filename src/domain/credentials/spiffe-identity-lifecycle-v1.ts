/**
 * SPIFFE/SPIRE identity lifecycle domain model.
 *
 * Models the lifecycle of workload identities: issuance, rotation,
 * revocation, and workspace boundary enforcement. Pure domain logic
 * with no infrastructure dependencies.
 *
 * Bead: bead-08gp
 * ADR: ADR-0076 (SPIRE workload identity)
 */

import type { WorkspaceId } from '../primitives/index.js';

// ── SPIFFE ID structure ─────────────────────────────────────────────────────

const SPIFFE_ID_PATTERN = /^spiffe:\/\/([^/]+)\/(.+)$/;

export type SpiffeIdComponents = Readonly<{
  trustDomain: string;
  workloadPath: string;
}>;

export class SpiffeIdParseError extends Error {
  public override readonly name = 'SpiffeIdParseError';
}

/**
 * Parse a SPIFFE ID string into its trust domain and workload path.
 * Format: spiffe://<trust-domain>/<workload-path>
 */
export function parseSpiffeId(spiffeId: string): SpiffeIdComponents {
  const match = SPIFFE_ID_PATTERN.exec(spiffeId);
  if (!match?.[1] || !match?.[2]) {
    throw new SpiffeIdParseError(
      `Invalid SPIFFE ID: '${spiffeId}'. Expected format: spiffe://<trust-domain>/<path>`,
    );
  }
  return { trustDomain: match[1], workloadPath: match[2] };
}

// ── Identity lifecycle states ───────────────────────────────────────────────

const IDENTITY_STATES = ['Pending', 'Active', 'Rotating', 'Revoked', 'Expired'] as const;

export type IdentityState = (typeof IDENTITY_STATES)[number];

export function isIdentityState(value: string): value is IdentityState {
  return (IDENTITY_STATES as readonly string[]).includes(value);
}

// ── SVID lifecycle record ───────────────────────────────────────────────────

export type SvidLifecycleRecord = Readonly<{
  spiffeId: string;
  state: IdentityState;
  workspaceId: WorkspaceId;
  issuedAt: string;
  expiresAt: string;
  rotationWindowStartsAt: string;
  lastRotatedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  serialNumber: string;
}>;

// ── Lifecycle validation ────────────────────────────────────────────────────

export type LifecycleValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * Validate that an SVID lifecycle record is internally consistent.
 */
export function validateSvidLifecycle(record: SvidLifecycleRecord): LifecycleValidationResult {
  // SPIFFE ID must be parseable
  try {
    parseSpiffeId(record.spiffeId);
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }

  // Timestamps must be valid ISO dates
  const issuedMs = Date.parse(record.issuedAt);
  const expiresMs = Date.parse(record.expiresAt);
  const rotationStartMs = Date.parse(record.rotationWindowStartsAt);

  if (isNaN(issuedMs)) {
    return { valid: false, reason: `Invalid issuedAt timestamp: '${record.issuedAt}'` };
  }
  if (isNaN(expiresMs)) {
    return { valid: false, reason: `Invalid expiresAt timestamp: '${record.expiresAt}'` };
  }
  if (isNaN(rotationStartMs)) {
    return {
      valid: false,
      reason: `Invalid rotationWindowStartsAt timestamp: '${record.rotationWindowStartsAt}'`,
    };
  }

  // issuedAt must be before expiresAt
  if (issuedMs >= expiresMs) {
    return { valid: false, reason: 'issuedAt must be before expiresAt.' };
  }

  // Rotation window must be between issuedAt and expiresAt
  if (rotationStartMs <= issuedMs || rotationStartMs >= expiresMs) {
    return {
      valid: false,
      reason: 'rotationWindowStartsAt must be between issuedAt and expiresAt.',
    };
  }

  // Revoked state requires revocation metadata
  if (record.state === 'Revoked' && !record.revokedAt) {
    return { valid: false, reason: 'Revoked identity must have a revokedAt timestamp.' };
  }

  // Serial number must be non-empty
  if (!record.serialNumber || record.serialNumber.trim() === '') {
    return { valid: false, reason: 'serialNumber must be non-empty.' };
  }

  return { valid: true };
}

// ── State transitions ───────────────────────────────────────────────────────

const VALID_TRANSITIONS: ReadonlyMap<IdentityState, readonly IdentityState[]> = new Map([
  ['Pending', ['Active', 'Revoked']],
  ['Active', ['Rotating', 'Revoked', 'Expired']],
  ['Rotating', ['Active', 'Revoked', 'Expired']],
  ['Revoked', []], // terminal
  ['Expired', []], // terminal
]);

/**
 * Check if a state transition is valid for the SVID lifecycle.
 */
export function isValidTransition(from: IdentityState, to: IdentityState): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed?.includes(to) ?? false;
}

/**
 * Get all valid next states from a given state.
 */
export function validNextStates(from: IdentityState): readonly IdentityState[] {
  return VALID_TRANSITIONS.get(from) ?? [];
}

// ── Workspace boundary enforcement ──────────────────────────────────────────

/**
 * Validate that a SPIFFE ID belongs to the expected workspace.
 *
 * Convention: workspace-scoped SPIFFE IDs contain the workspace ID in the
 * workload path segment, e.g.:
 *   spiffe://portarium.io/ns/portarium/ws/<workspace-id>/sa/<service-account>
 *
 * Returns true if the SPIFFE ID's workspace segment matches the given workspace.
 */
export function isSpiffeIdInWorkspace(spiffeId: string, workspaceId: WorkspaceId): boolean {
  const { workloadPath } = parseSpiffeId(spiffeId);
  // Check for workspace segment: ws/<workspaceId>/ in the path
  const wsSegment = `ws/${String(workspaceId)}/`;
  return workloadPath.includes(wsSegment);
}

/**
 * Validate that a SPIFFE ID uses the expected trust domain.
 */
export function isSpiffeIdInTrustDomain(spiffeId: string, expectedDomain: string): boolean {
  const { trustDomain } = parseSpiffeId(spiffeId);
  return trustDomain === expectedDomain;
}

// ── Rotation policy ─────────────────────────────────────────────────────────

export type RotationPolicy = Readonly<{
  /** SVID TTL in seconds. */
  ttlSeconds: number;
  /** Seconds before expiry to begin rotation. */
  rotationLeadSeconds: number;
  /** Maximum number of SVIDs that may be active concurrently during rotation. */
  maxConcurrentSvids: number;
}>;

export function validateRotationPolicy(policy: RotationPolicy): LifecycleValidationResult {
  if (policy.ttlSeconds <= 0) {
    return { valid: false, reason: `ttlSeconds must be positive, got ${policy.ttlSeconds}.` };
  }

  if (policy.rotationLeadSeconds <= 0) {
    return {
      valid: false,
      reason: `rotationLeadSeconds must be positive, got ${policy.rotationLeadSeconds}.`,
    };
  }

  if (policy.rotationLeadSeconds >= policy.ttlSeconds) {
    return {
      valid: false,
      reason:
        `rotationLeadSeconds (${policy.rotationLeadSeconds}) must be less than ` +
        `ttlSeconds (${policy.ttlSeconds}).`,
    };
  }

  if (policy.maxConcurrentSvids < 1) {
    return {
      valid: false,
      reason: `maxConcurrentSvids must be >= 1, got ${policy.maxConcurrentSvids}.`,
    };
  }

  return { valid: true };
}

/**
 * Determine whether an SVID should be rotated given the current time
 * and rotation policy.
 */
export function shouldRotate(
  record: SvidLifecycleRecord,
  nowMs: number,
  policy: RotationPolicy,
): boolean {
  if (record.state !== 'Active') return false;
  const expiresMs = Date.parse(record.expiresAt);
  const rotationThreshold = expiresMs - policy.rotationLeadSeconds * 1000;
  return nowMs >= rotationThreshold;
}

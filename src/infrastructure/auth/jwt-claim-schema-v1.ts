/**
 * Standardised JWT claim set for Portarium tokens.
 *
 * All Portarium-issued JWTs must contain the required claims defined here.
 * Workspace scoping is enforced: tokens without a valid workspaceId are rejected.
 *
 * @see .specify/specs/jwt-claim-schema-v1.md
 */

import type { WorkspaceUserRole } from '../../domain/primitives/index.js';
import { isWorkspaceUserRole } from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Claim schema types
// ---------------------------------------------------------------------------

/** Required registered + Portarium-specific claims present in every valid token. */
export type PortariumJwtClaimsV1 = Readonly<{
  /** Subject — the principal identity (user or service account). */
  sub: string;
  /** Issuer — the identity provider that minted the token. */
  iss: string;
  /** Audience — one or more intended recipients. */
  aud: string | readonly string[];
  /** Workspace (tenant) scope — every token must be bound to exactly one workspace. */
  workspaceId: string;
  /** Tenant ID — alias for workspaceId (v1 equivalence). */
  tenantId: string;
  /** Workspace roles assigned to the principal. */
  roles: readonly WorkspaceUserRole[];
  /** Optional: agent identity when the token represents an AI agent. */
  agentId?: string;
  /** Optional: machine identity when the token represents a machine connector. */
  machineId?: string;
  /** Optional: fine-grained capability keys the principal may exercise. */
  capabilities?: readonly string[];
}>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class JwtClaimValidationError extends Error {
  public override readonly name = 'JwtClaimValidationError';
}

function requireString(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new JwtClaimValidationError(`Claim '${key}' must be a non-empty string.`);
  }
  return value.trim();
}

function requireAud(record: Readonly<Record<string, unknown>>): string | readonly string[] {
  const value = record['aud'];
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === 'string' && v.trim() !== '')
  ) {
    return value.map((v: string) => v.trim());
  }
  throw new JwtClaimValidationError(
    "Claim 'aud' must be a non-empty string or non-empty array of strings.",
  );
}

function requireRoles(record: Readonly<Record<string, unknown>>): readonly WorkspaceUserRole[] {
  const raw = record['roles'];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new JwtClaimValidationError("Claim 'roles' must be a non-empty array.");
  }
  const seen = new Set<string>();
  const out: WorkspaceUserRole[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry: unknown = raw[i];
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new JwtClaimValidationError(`Claim 'roles[${i}]' must be a non-empty string.`);
    }
    const role = entry.trim();
    if (!isWorkspaceUserRole(role)) {
      throw new JwtClaimValidationError(
        `Claim 'roles[${i}]' is not a valid workspace role: '${role}'.`,
      );
    }
    if (seen.has(role)) {
      throw new JwtClaimValidationError(`Claim 'roles[${i}]' duplicate role: '${role}'.`);
    }
    seen.add(role);
    out.push(role);
  }
  return out;
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new JwtClaimValidationError(`Claim '${key}' must be a non-empty string when present.`);
  }
  return value.trim();
}

function readOptionalStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new JwtClaimValidationError(`Claim '${key}' must be an array when present.`);
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string' || (value[i] as string).trim() === '') {
      throw new JwtClaimValidationError(`Claim '${key}[${i}]' must be a non-empty string.`);
    }
  }
  return value.map((v: string) => v.trim());
}

/**
 * Resolve workspaceId from claim payload.
 *
 * Accepts `workspaceId` or falls back to `tenantId` (v1 alias).
 * Throws when neither is present — workspace scoping is mandatory.
 */
function resolveWorkspaceId(record: Readonly<Record<string, unknown>>): string {
  const workspaceId = record['workspaceId'];
  if (typeof workspaceId === 'string' && workspaceId.trim() !== '') {
    return workspaceId.trim();
  }
  const tenantId = record['tenantId'];
  if (typeof tenantId === 'string' && tenantId.trim() !== '') {
    return tenantId.trim();
  }
  throw new JwtClaimValidationError(
    'Token must contain a workspaceId (or tenantId) claim. Workspace scoping is mandatory.',
  );
}

/**
 * Validate and parse raw JWT payload claims into the Portarium standard claim set.
 *
 * @throws JwtClaimValidationError when any required claim is missing or malformed.
 */
export function parsePortariumJwtClaims(payload: unknown): PortariumJwtClaimsV1 {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new JwtClaimValidationError('JWT payload must be a non-null object.');
  }
  const record = payload as Readonly<Record<string, unknown>>;

  const sub = requireString(record, 'sub');
  const iss = requireString(record, 'iss');
  const aud = requireAud(record);
  const workspaceId = resolveWorkspaceId(record);
  const tenantId = workspaceId; // v1: tenantId === workspaceId
  const roles = requireRoles(record);
  const agentId = readOptionalString(record, 'agentId');
  const machineId = readOptionalString(record, 'machineId');
  const capabilities = readOptionalStringArray(record, 'capabilities');

  return {
    sub,
    iss,
    aud,
    workspaceId,
    tenantId,
    roles,
    ...(agentId !== undefined ? { agentId } : {}),
    ...(machineId !== undefined ? { machineId } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
  };
}

/**
 * Type guard: does the payload look like it contains workspace-scoped claims?
 */
export function hasWorkspaceScope(payload: Readonly<Record<string, unknown>>): boolean {
  const workspaceId = payload['workspaceId'];
  if (typeof workspaceId === 'string' && workspaceId.trim() !== '') return true;
  const tenantId = payload['tenantId'];
  return typeof tenantId === 'string' && tenantId.trim() !== '';
}

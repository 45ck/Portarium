import type { WorkspaceUserRole } from '../../domain/primitives/index.js';
import { isWorkspaceUserRole } from '../../domain/primitives/index.js';
import { err, ok, type Result } from './result.js';
import type { Unauthorized } from './errors.js';

/**
 * Portarium standard JWT claim set (v1).
 *
 * Every token issued for or consumed by Portarium MUST carry the required
 * claims. Optional claims extend the principal identity for agent/machine
 * flows.
 */
export type PortariumJwtClaimsV1 = Readonly<{
  /** Subject — user or service principal identifier. */
  sub: string;
  /** Issuer — identity provider that issued the token. */
  iss: string;
  /** Audience — expected recipient(s). */
  aud: string | readonly string[];
  /** Workspace (tenant) the token is scoped to. */
  workspaceId: string;
  /** Tenant identifier (alias for workspaceId in v1). */
  tenantId: string;
  /** Workspace roles assigned to this principal. */
  roles: readonly WorkspaceUserRole[];
  /** Agent identity when the principal represents an AI agent. */
  agentId?: string;
  /** Machine identity when the principal represents a machine runtime. */
  machineId?: string;
  /** Fine-grained capability tokens (e.g. invoice:read). */
  capabilities?: readonly string[];
}>;

export type JwtClaimValidationError = Readonly<{
  field: string;
  message: string;
}>;

/**
 * Validate raw JWT payload claims against the Portarium v1 standard.
 *
 * Returns a validated claim set or a list of validation errors.
 */
export function validatePortariumJwtClaimsV1(
  payload: Record<string, unknown>,
): Result<PortariumJwtClaimsV1, Unauthorized> {
  const errors: JwtClaimValidationError[] = [];

  const sub = requireString(payload, 'sub', errors);
  const iss = requireString(payload, 'iss', errors);
  const aud = readAudience(payload, errors);

  const workspaceId = readWorkspaceIdClaim(payload, errors);
  const tenantId = workspaceId ?? '';

  const roles = readRolesClaim(payload, errors);

  if (errors.length > 0) {
    const details = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    return err({ kind: 'Unauthorized', message: `Invalid JWT claims: ${details}` });
  }

  const agentId = optionalString(payload, 'agentId');
  const machineId = optionalString(payload, 'machineId');
  const capabilities = optionalStringArray(payload, 'capabilities');

  return ok({
    sub: sub!,
    iss: iss!,
    aud: aud!,
    workspaceId: workspaceId!,
    tenantId,
    roles: roles!,
    ...(agentId !== undefined ? { agentId } : {}),
    ...(machineId !== undefined ? { machineId } : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
  });
}

/**
 * Enforce that the validated claims include a non-empty workspaceId.
 * This is a convenience guard for handlers that require workspace scoping.
 */
export function assertWorkspaceScoped(
  payload: Record<string, unknown>,
): Result<string, Unauthorized> {
  const workspaceId =
    typeof payload['workspaceId'] === 'string' ? payload['workspaceId'].trim() : undefined;
  const tenantId = typeof payload['tenantId'] === 'string' ? payload['tenantId'].trim() : undefined;

  const resolved = workspaceId ?? tenantId;
  if (!resolved || resolved === '') {
    return err({
      kind: 'Unauthorized',
      message: 'Token must include a non-empty workspaceId claim.',
    });
  }
  return ok(resolved);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  errors: JwtClaimValidationError[],
): string | undefined {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field: key, message: 'must be a non-empty string' });
    return undefined;
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim();
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const result = value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
  return result.length > 0 ? result : undefined;
}

function readAudience(
  record: Record<string, unknown>,
  errors: JwtClaimValidationError[],
): string | readonly string[] | undefined {
  const value = record['aud'];
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
    return value as readonly string[];
  }
  errors.push({ field: 'aud', message: 'must be a non-empty string or string array' });
  return undefined;
}

function readWorkspaceIdClaim(
  record: Record<string, unknown>,
  errors: JwtClaimValidationError[],
): string | undefined {
  const workspaceId = optionalString(record, 'workspaceId');
  if (workspaceId) return workspaceId;

  const tenantId = optionalString(record, 'tenantId');
  if (tenantId) return tenantId;

  errors.push({ field: 'workspaceId', message: 'must be a non-empty string' });
  return undefined;
}

function resolveRolesSource(record: Record<string, unknown>): unknown[] | undefined {
  const raw = record['roles'];
  if (Array.isArray(raw)) return raw as unknown[];

  const realmAccess = record['realm_access'];
  if (typeof realmAccess === 'object' && realmAccess !== null) {
    const realmRoles = (realmAccess as Record<string, unknown>)['roles'];
    if (Array.isArray(realmRoles)) return realmRoles as unknown[];
  }

  return undefined;
}

function filterValidRoles(source: unknown[]): WorkspaceUserRole[] {
  return source.filter(
    (entry): entry is WorkspaceUserRole => typeof entry === 'string' && isWorkspaceUserRole(entry),
  );
}

function readRolesClaim(
  record: Record<string, unknown>,
  errors: JwtClaimValidationError[],
): readonly WorkspaceUserRole[] | undefined {
  const source = resolveRolesSource(record);

  if (!source || source.length === 0) {
    errors.push({ field: 'roles', message: 'must be a non-empty array of workspace roles' });
    return undefined;
  }

  const validRoles = filterValidRoles(source);

  if (validRoles.length === 0) {
    errors.push({ field: 'roles', message: 'must contain at least one valid workspace role' });
    return undefined;
  }

  return validRoles;
}

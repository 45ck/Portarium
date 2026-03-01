/**
 * Workspace JWT scope validation for the Agent Gateway.
 *
 * Validates that JWT claims match the requested workspace scope.
 * Rejects tokens with mismatched workspace, expired tokens, and
 * tokens missing required identity propagation fields.
 *
 * ADR-0115 Section 5: Identity Model — request-level identity (JWT).
 * ADR-0100: JWT short-expiry revocation policy.
 *
 * Bead: bead-0836
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceJwtClaims = Readonly<{
  /** Subject — agent SPIFFE ID or user principal. */
  sub: string;
  /** Audience — target Action API or sidecar proxy. */
  aud: string | readonly string[];
  /** Workspace (tenant) scope. */
  workspaceId: string;
  /** Tenant ID alias (v1 equivalence). */
  tenantId: string;
  /** Permitted action types for this request. */
  scope?: readonly string[];
  /** Correlation to the originating workflow run. */
  workflowRunId?: string;
  /** Expiry as ISO string or epoch seconds. */
  exp?: number;
  /** Issued-at as epoch seconds. */
  iat?: number;
}>;

export type ScopeValidationResult =
  | Readonly<{ valid: true; claims: WorkspaceJwtClaims }>
  | Readonly<{ valid: false; reason: string }>;

export type WorkspaceScopeValidatorConfig = Readonly<{
  /** Maximum token age in seconds. Tokens older than this are rejected. Default: 900 (15 min per ADR-0100). */
  maxTokenAgeSec?: number;
  /** Clock skew tolerance in seconds. Default: 30. */
  clockSkewToleranceSec?: number;
  /** Expected audience values. When set, token aud must include at least one. */
  expectedAudience?: readonly string[];
  /** Clock function for testability. */
  nowEpochSec?: () => number;
}>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TOKEN_AGE_SEC = 900; // 15 minutes per ADR-0100
const DEFAULT_CLOCK_SKEW_TOLERANCE_SEC = 30;

/**
 * Validate that JWT claims carry a valid workspace scope matching the request.
 *
 * Checks:
 * 1. workspaceId claim is present and matches requestedWorkspaceId.
 * 2. Token has not expired (exp claim, with clock skew tolerance).
 * 3. Token age does not exceed maxTokenAgeSec (iat claim).
 * 4. Audience matches expected values (when configured).
 * 5. Subject (sub) is present.
 */
export function validateWorkspaceJwtScope(
  claims: Readonly<Record<string, unknown>>,
  requestedWorkspaceId: string,
  config?: WorkspaceScopeValidatorConfig,
): ScopeValidationResult {
  const nowSec = (config?.nowEpochSec ?? (() => Math.floor(Date.now() / 1000)))();
  const maxAge = config?.maxTokenAgeSec ?? DEFAULT_MAX_TOKEN_AGE_SEC;
  const skew = config?.clockSkewToleranceSec ?? DEFAULT_CLOCK_SKEW_TOLERANCE_SEC;

  // 1. Subject must be present
  const sub = claims['sub'];
  if (typeof sub !== 'string' || sub.trim() === '') {
    return { valid: false, reason: 'Missing or empty sub claim.' };
  }

  // 2. Workspace scope must match
  const workspaceId = resolveWorkspace(claims);
  if (workspaceId === undefined) {
    return { valid: false, reason: 'Token must contain a workspaceId or tenantId claim.' };
  }
  if (workspaceId !== requestedWorkspaceId) {
    return {
      valid: false,
      reason: `Workspace scope mismatch: token scope '${workspaceId}' does not match requested '${requestedWorkspaceId}'.`,
    };
  }

  // 3. Expiry check
  const exp = claims['exp'];
  if (typeof exp === 'number') {
    if (nowSec > exp + skew) {
      return { valid: false, reason: 'Token has expired.' };
    }
  }

  // 4. Token age check (iat)
  const iat = claims['iat'];
  if (typeof iat === 'number') {
    if (nowSec - iat > maxAge + skew) {
      return { valid: false, reason: `Token age exceeds maximum of ${maxAge} seconds.` };
    }
  }

  // 5. Audience check
  if (config?.expectedAudience && config.expectedAudience.length > 0) {
    const aud = claims['aud'];
    const audArray = typeof aud === 'string' ? [aud] : Array.isArray(aud) ? aud : [];
    const hasMatch = config.expectedAudience.some((expected) => audArray.includes(expected));
    if (!hasMatch) {
      return { valid: false, reason: 'Token audience does not match expected values.' };
    }
  }

  // Build validated claims
  const scope = readStringArray(claims, 'scope');
  const workflowRunId = readOptString(claims, 'workflowRunId');
  const audValue = claims['aud'];

  return {
    valid: true,
    claims: {
      sub: sub.trim(),
      aud: typeof audValue === 'string' ? audValue : Array.isArray(audValue) ? audValue : '',
      workspaceId,
      tenantId: workspaceId,
      ...(scope ? { scope } : {}),
      ...(workflowRunId ? { workflowRunId } : {}),
      ...(typeof exp === 'number' ? { exp } : {}),
      ...(typeof iat === 'number' ? { iat } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWorkspace(claims: Readonly<Record<string, unknown>>): string | undefined {
  const wid = claims['workspaceId'];
  if (typeof wid === 'string' && wid.trim() !== '') return wid.trim();
  const tid = claims['tenantId'];
  if (typeof tid === 'string' && tid.trim() !== '') return tid.trim();
  return undefined;
}

function readOptString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

function readStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return strings.length > 0 ? strings.map((s) => s.trim()) : undefined;
}

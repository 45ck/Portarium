import {
  createLocalJWKSet,
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
} from 'jose';

import { appContextFromWorkspaceAuthClaims } from '../../application/iam/claims-to-context.js';
import { isWorkspaceUserRole } from '../../domain/primitives/index.js';
import type {
  AuthenticateBearerTokenInput,
  AuthenticationPort,
} from '../../application/ports/authentication.js';
import { err, ok, type Result } from '../../application/common/result.js';
import type { AppContext, Unauthorized } from '../../application/common/index.js';

/**
 * Accepted `typ` header values for Portarium access tokens.
 *
 * RFC 9068 §2.1 specifies "at+JWT" for OAuth 2.0 access tokens issued by an
 * authorisation server. Legacy implementations may use "JWT". Both are accepted;
 * configure `requiredTokenType` to enforce one value.
 */
export type JwtTokenType = 'at+JWT' | 'JWT';

export type JoseJwtAuthenticationConfig = Readonly<{
  /** Expected issuer (`iss`). When omitted, issuer is not validated. */
  issuer?: string;
  /**
   * Trusted issuer allowlist for multi-IdP federation.
   *
   * When provided, the token's `iss` claim must exactly match one of these values
   * **in addition** to any value set via `issuer`. If only `trustedIssuers` is
   * set (no `issuer`), jose's built-in issuer check is skipped and the allowlist
   * is applied manually after verification.
   */
  trustedIssuers?: readonly string[];
  /** Expected audience (`aud`). When omitted, audience is not validated. */
  audience?: string | readonly string[];
  /**
   * Authorized party (`azp`) — the client_id permitted to present this token.
   *
   * When set, the `azp` claim in the token must exactly match this value.
   * Prevents cross-client token forwarding attacks (RFC 7519 §4.1).
   */
  authorizedParty?: string;
  /**
   * Required JWT `typ` header value.
   *
   * When set, tokens with a mismatching `typ` header are rejected. Defaults to
   * accepting both "at+JWT" (RFC 9068) and "JWT" (legacy).
   */
  requiredTokenType?: JwtTokenType;
  /** Local JWKS. Exactly one of jwks/jwksUri must be provided. */
  jwks?: JSONWebKeySet;
  /** Remote JWKS URI. Exactly one of jwks/jwksUri must be provided. */
  jwksUri?: string;
  /** Clock tolerance in seconds applied during exp/nbf validation. */
  clockToleranceSeconds?: number;
}>;

const JWT_AUTH_ERROR_NAMES = new Set([
  'JWTExpired',
  'JWTInvalid',
  'JWTClaimValidationFailed',
  'JWTSignatureVerificationFailed',
  'JOSEError',
]);

const ACCEPTED_TOKEN_TYPES = new Set<string>(['at+JWT', 'JWT']);

function parseBearerToken(header: string | undefined): Result<string, Unauthorized> {
  if (typeof header !== 'string' || header.trim() === '') {
    return err({ kind: 'Unauthorized', message: 'Missing Authorization header.' });
  }
  const value = header.trim();

  const space = value.indexOf(' ');
  if (space === -1) {
    return err({ kind: 'Unauthorized', message: 'Invalid Authorization header.' });
  }

  const scheme = value.slice(0, space);
  const token = value.slice(space + 1).trim();

  if (scheme.toLowerCase() !== 'bearer' || token === '') {
    return err({ kind: 'Unauthorized', message: 'Invalid Authorization header.' });
  }

  return ok(token);
}

/**
 * Validate the `typ` JOSE header claim.
 *
 * RFC 9068 §2.1 requires access tokens issued by an AS to carry `typ: "at+JWT"`.
 * We accept "JWT" for legacy IdP compatibility. An unknown type is rejected.
 */
function validateTokenType(
  token: string,
  requiredTokenType: JwtTokenType | undefined,
): Result<void, Unauthorized> {
  let typ: unknown;
  try {
    const header = decodeProtectedHeader(token);
    typ = header.typ;
  } catch {
    return err({ kind: 'Unauthorized', message: 'Malformed JWT header.' });
  }

  if (typ !== undefined) {
    const typStr = typeof typ === 'string' ? typ : '';
    if (!ACCEPTED_TOKEN_TYPES.has(typStr)) {
      return err({
        kind: 'Unauthorized',
        message: `Invalid token type '${typStr}'. Expected 'at+JWT' or 'JWT'.`,
      });
    }
    if (requiredTokenType !== undefined && typStr !== requiredTokenType) {
      return err({
        kind: 'Unauthorized',
        message: `Token type mismatch: expected '${requiredTokenType}', got '${typStr}'.`,
      });
    }
  }

  return ok(undefined);
}

/**
 * Validate the `azp` (authorized party) claim.
 *
 * Per RFC 7519 §4.1 and OpenID Connect Core §2, `azp` identifies the client
 * to which the token was issued. When `authorizedParty` is configured, any
 * token lacking or mismatching `azp` is rejected.
 */
function validateAuthorizedParty(
  payload: Record<string, unknown>,
  authorizedParty: string | undefined,
): Result<void, Unauthorized> {
  if (authorizedParty === undefined) return ok(undefined);

  const azp = payload['azp'];
  if (typeof azp !== 'string' || azp.trim() === '') {
    return err({
      kind: 'Unauthorized',
      message: "Token must include the 'azp' claim when authorized party validation is enabled.",
    });
  }
  if (azp.trim() !== authorizedParty) {
    return err({
      kind: 'Unauthorized',
      message: 'Authorized party mismatch.',
    });
  }
  return ok(undefined);
}

/**
 * Validate the `iss` claim against the trusted issuer allowlist.
 *
 * Used when `trustedIssuers` is configured without a single `issuer`, or to
 * augment jose's built-in issuer check with multi-IdP federation support.
 */
function validateTrustedIssuer(
  payload: Record<string, unknown>,
  trustedIssuers: readonly string[] | undefined,
): Result<void, Unauthorized> {
  if (!trustedIssuers || trustedIssuers.length === 0) return ok(undefined);

  const iss = payload['iss'];
  if (typeof iss !== 'string' || iss.trim() === '') {
    return err({ kind: 'Unauthorized', message: "Token is missing the 'iss' claim." });
  }
  if (!trustedIssuers.includes(iss.trim())) {
    return err({ kind: 'Unauthorized', message: 'Issuer not in trusted allowlist.' });
  }
  return ok(undefined);
}

function parseScopes(payload: Record<string, unknown>): readonly string[] {
  const scope = payload['scope'];
  if (typeof scope === 'string') {
    return scope
      .split(' ')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }

  const scopes = payload['scopes'];
  if (Array.isArray(scopes) && scopes.every((s) => typeof s === 'string')) {
    return (scopes as readonly string[]).map((s) => s.trim()).filter((s) => s !== '');
  }

  return [];
}

function readWorkspaceId(payload: Record<string, unknown>): string | undefined {
  const workspaceId = payload['workspaceId'];
  if (typeof workspaceId === 'string' && workspaceId.trim() !== '') {
    return workspaceId.trim();
  }

  const tenantId = payload['tenantId'];
  if (typeof tenantId === 'string' && tenantId.trim() !== '') {
    return tenantId.trim();
  }

  return undefined;
}

function readRoles(payload: Record<string, unknown>): readonly string[] {
  const rolesClaim = payload['roles'];
  if (Array.isArray(rolesClaim)) {
    return rolesClaim.filter((entry): entry is string => typeof entry === 'string');
  }

  const realmAccess = payload['realm_access'];
  if (typeof realmAccess !== 'object' || realmAccess === null) {
    return [];
  }
  const realmRoles = (realmAccess as Record<string, unknown>)['roles'];
  if (!Array.isArray(realmRoles)) {
    return [];
  }
  return realmRoles.filter((entry): entry is string => typeof entry === 'string');
}

function parseWorkspaceRoles(payload: Record<string, unknown>): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of readRoles(payload)) {
    const role = entry.trim();
    if (!isWorkspaceUserRole(role) || seen.has(role)) {
      continue;
    }
    seen.add(role);
    out.push(role);
  }
  return out;
}

function normalizeWorkspaceClaims(payload: Record<string, unknown>): Record<string, unknown> {
  const workspaceId = readWorkspaceId(payload);
  const roles = parseWorkspaceRoles(payload);
  return {
    ...payload,
    ...(workspaceId ? { workspaceId } : {}),
    ...(roles.length > 0 ? { roles } : {}),
  };
}

function isReadonlyStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function buildVerifyOptions(
  args: Readonly<{
    issuer: string | undefined;
    audience: string | readonly string[] | undefined;
    clockToleranceSeconds: number;
  }>,
): JWTVerifyOptions {
  const audience: string | string[] | undefined =
    args.audience === undefined
      ? undefined
      : isReadonlyStringArray(args.audience)
        ? [...args.audience]
        : args.audience;

  return {
    clockTolerance: args.clockToleranceSeconds,
    ...(args.issuer !== undefined ? { issuer: args.issuer } : {}),
    ...(audience !== undefined ? { audience } : {}),
  };
}

function buildGetKey(config: JoseJwtAuthenticationConfig): JWTVerifyGetKey {
  if (config.jwks && config.jwksUri) {
    throw new Error('Exactly one of jwks or jwksUri must be provided.');
  }
  if (config.jwks) {
    return createLocalJWKSet(config.jwks);
  }
  if (config.jwksUri) {
    return createRemoteJWKSet(new URL(config.jwksUri));
  }
  throw new Error('Either jwks or jwksUri must be provided.');
}

/**
 * JWT authentication adapter using `jose`.
 *
 * Production hardening (bead-0328):
 * - `typ` header check: rejects unknown token types (RFC 9068).
 * - `azp` claim validation: prevents cross-client token forwarding.
 * - Trusted issuer allowlist: supports multi-IdP federation.
 * - Workspace scope mismatch check (pre-existing, enforced on every request).
 *
 * Validates the bearer token signature and standard registered claims (exp/nbf),
 * then materializes AppContext from the Portarium IAM claims:
 * - sub
 * - workspaceId
 * - roles
 */
export class JoseJwtAuthentication implements AuthenticationPort {
  readonly #getKey: JWTVerifyGetKey;
  readonly #issuer: string | undefined;
  readonly #trustedIssuers: readonly string[] | undefined;
  readonly #audience: string | readonly string[] | undefined;
  readonly #authorizedParty: string | undefined;
  readonly #requiredTokenType: JwtTokenType | undefined;
  readonly #clockToleranceSeconds: number;

  public constructor(config: JoseJwtAuthenticationConfig) {
    this.#getKey = buildGetKey(config);
    this.#issuer = config.issuer;
    this.#trustedIssuers = config.trustedIssuers;
    this.#audience = config.audience;
    this.#authorizedParty = config.authorizedParty;
    this.#requiredTokenType = config.requiredTokenType;
    this.#clockToleranceSeconds = config.clockToleranceSeconds ?? 0;
  }

  async #verifyPayload(
    token: string,
  ): Promise<Result<Record<string, unknown>, Unauthorized>> {
    try {
      const options = buildVerifyOptions({
        issuer: this.#issuer,
        audience: this.#audience,
        clockToleranceSeconds: this.#clockToleranceSeconds,
      });

      const verified = await jwtVerify(token, this.#getKey, options);
      return ok(verified.payload as Record<string, unknown>);
    } catch (error) {
      if (error instanceof Error && JWT_AUTH_ERROR_NAMES.has(error.name)) {
        return err({ kind: 'Unauthorized', message: 'Invalid or expired token.' });
      }
      return err({ kind: 'Unauthorized', message: 'Invalid or expired token.' });
    }
  }

  public async authenticateBearerToken(
    input: AuthenticateBearerTokenInput,
  ): Promise<Result<AppContext, Unauthorized>> {
    const tokenResult = parseBearerToken(input.authorizationHeader);
    if (!tokenResult.ok) return tokenResult;

    const token = tokenResult.value;

    // Validate typ header before attempting cryptographic verification.
    const typResult = validateTokenType(token, this.#requiredTokenType);
    if (!typResult.ok) return typResult;

    const payloadResult = await this.#verifyPayload(token);
    if (!payloadResult.ok) return payloadResult;

    const payload = payloadResult.value;

    // Validate azp (authorized party) after signature verification.
    const azpResult = validateAuthorizedParty(payload, this.#authorizedParty);
    if (!azpResult.ok) return azpResult;

    // Validate trusted issuer allowlist (multi-IdP federation).
    const issuerResult = validateTrustedIssuer(payload, this.#trustedIssuers);
    if (!issuerResult.ok) return issuerResult;

    const normalizedClaims = normalizeWorkspaceClaims(payload);

    const { actor, ctx } = appContextFromWorkspaceAuthClaims({
      claims: normalizedClaims,
      correlationId: input.correlationId,
      ...(input.traceparent ? { traceparent: input.traceparent } : {}),
      ...(input.tracestate ? { tracestate: input.tracestate } : {}),
      scopes: parseScopes(payload),
    });

    if (input.expectedWorkspaceId && actor.workspaceId.toString() !== input.expectedWorkspaceId) {
      return err({ kind: 'Unauthorized', message: 'Workspace scope mismatch.' });
    }

    return ok(ctx);
  }
}

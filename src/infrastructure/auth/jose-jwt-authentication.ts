import {
  createLocalJWKSet,
  createRemoteJWKSet,
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

export type JoseJwtAuthenticationConfig = Readonly<{
  /** Expected issuer (`iss`). When omitted, issuer is not validated. */
  issuer?: string;
  /** Expected audience (`aud`). When omitted, audience is not validated. */
  audience?: string | readonly string[];
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
 * Validates the bearer token signature and standard registered claims (exp/nbf),
 * then materializes AppContext from the Portarium IAM claims:
 * - sub
 * - workspaceId
 * - roles
 */
export class JoseJwtAuthentication implements AuthenticationPort {
  readonly #getKey: JWTVerifyGetKey;
  readonly #issuer: string | undefined;
  readonly #audience: string | readonly string[] | undefined;
  readonly #clockToleranceSeconds: number;

  public constructor(config: JoseJwtAuthenticationConfig) {
    this.#getKey = buildGetKey(config);
    this.#issuer = config.issuer;
    this.#audience = config.audience;
    this.#clockToleranceSeconds = config.clockToleranceSeconds ?? 0;
  }

  async #verifyPayload(token: string): Promise<Result<Record<string, unknown>, Unauthorized>> {
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

    const payloadResult = await this.#verifyPayload(tokenResult.value);
    if (!payloadResult.ok) return payloadResult;

    const payload = payloadResult.value;
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

import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';

import { toAppContext, type AppContext } from '../../application/common/context.js';
import type { AuthenticationPort } from '../../application/ports/authentication.js';
import { err, ok, type Result } from '../../application/common/result.js';
import type { Unauthorized } from '../../application/common/errors.js';
import type { TraceContext } from '../../application/common/trace-context.js';

export const DEFAULT_COCKPIT_SESSION_COOKIE = 'portarium_cockpit_session';
export const WEB_SESSION_REQUEST_HEADER = 'x-portarium-request';

export type CockpitWebSessionClaims = Readonly<{
  sub: string;
  workspaceId: string;
  roles: readonly string[];
  personas: readonly string[];
  capabilities: readonly string[];
  apiScopes: readonly string[];
  displayName?: string;
}>;

export type CockpitWebSessionRecord = Readonly<{
  sessionId: string;
  ctx: AppContext;
  claims: CockpitWebSessionClaims;
  issuedAtMs: number;
  expiresAtMs: number;
}>;

export interface CockpitWebSessionStore {
  create(input: { ctx: AppContext; ttlMs: number; nowMs: number }): CockpitWebSessionRecord;
  get(sessionId: string, nowMs: number): CockpitWebSessionRecord | null;
  delete(sessionId: string): void;
}

export type CockpitWebSessionConfig = Readonly<{
  cookieName?: string;
  ttlSeconds?: number;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcRedirectUri?: string;
  allowDevelopmentSession?: boolean;
  developmentBearerToken?: string;
  fetchImpl?: typeof fetch;
}>;

export type OidcCallbackBody = Readonly<{
  code: string;
  state?: string;
  codeVerifier: string;
}>;

type TokenResponse = Readonly<{
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
}>;

const DEFAULT_TTL_SECONDS = 15 * 60;
const DEFAULT_OIDC_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_IN_MEMORY_SESSIONS = 5_000;

export class InMemoryCockpitWebSessionStore implements CockpitWebSessionStore {
  readonly #sessions = new Map<string, CockpitWebSessionRecord>();

  public constructor(private readonly maxSessions = DEFAULT_MAX_IN_MEMORY_SESSIONS) {}

  public create(input: { ctx: AppContext; ttlMs: number; nowMs: number }): CockpitWebSessionRecord {
    this.prune(input.nowMs);
    const sessionId = randomUUID();
    const record: CockpitWebSessionRecord = {
      sessionId,
      ctx: input.ctx,
      claims: claimsFromContext(input.ctx),
      issuedAtMs: input.nowMs,
      expiresAtMs: input.nowMs + input.ttlMs,
    };
    if (this.#sessions.size >= this.maxSessions) {
      const oldestSessionId = this.#sessions.keys().next().value;
      if (oldestSessionId) this.#sessions.delete(oldestSessionId);
    }
    this.#sessions.set(sessionId, record);
    return record;
  }

  public get(sessionId: string, nowMs: number): CockpitWebSessionRecord | null {
    const record = this.#sessions.get(sessionId) ?? null;
    if (!record) return null;
    if (record.expiresAtMs <= nowMs) {
      this.#sessions.delete(sessionId);
      return null;
    }
    return record;
  }

  public delete(sessionId: string): void {
    this.#sessions.delete(sessionId);
  }

  private prune(nowMs: number): void {
    for (const [sessionId, record] of this.#sessions) {
      if (record.expiresAtMs <= nowMs) this.#sessions.delete(sessionId);
    }
  }
}

export function cockpitWebSessionTtlMs(config: CockpitWebSessionConfig | undefined): number {
  const seconds = Number(config?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_TTL_SECONDS * 1000;
  return Math.min(seconds, 24 * 60 * 60) * 1000;
}

export function claimsFromContext(ctx: AppContext): CockpitWebSessionClaims {
  return {
    sub: String(ctx.principalId),
    workspaceId: String(ctx.tenantId),
    roles: [...ctx.roles],
    personas: [],
    capabilities: [...(ctx.capabilities ?? [])],
    apiScopes: [...ctx.scopes],
  };
}

export function contextForRequest(
  record: CockpitWebSessionRecord,
  correlationId: string,
  traceContext: TraceContext,
): AppContext {
  return toAppContext({
    tenantId: String(record.ctx.tenantId),
    principalId: String(record.ctx.principalId),
    roles: record.ctx.roles,
    scopes: record.ctx.scopes,
    capabilities: record.ctx.capabilities ?? [],
    correlationId,
    traceparent: traceContext.traceparent,
    ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
  });
}

export function readSessionIdFromCookie(
  req: IncomingMessage,
  cookieName = DEFAULT_COCKPIT_SESSION_COOKIE,
): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== 'string' || header.trim() === '') return undefined;
  const cookies = header.split(';');
  for (const cookie of cookies) {
    const index = cookie.indexOf('=');
    if (index === -1) continue;
    const name = cookie.slice(0, index).trim();
    if (name !== cookieName) continue;
    const value = cookie.slice(index + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function buildSessionCookie(
  req: IncomingMessage,
  sessionId: string,
  ttlMs: number,
  cookieName = DEFAULT_COCKPIT_SESSION_COOKIE,
): string {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000));
  const parts = [
    `${cookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (shouldUseSecureCookie(req)) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookie(
  req: IncomingMessage,
  cookieName = DEFAULT_COCKPIT_SESSION_COOKIE,
): string {
  const parts = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (shouldUseSecureCookie(req)) parts.push('Secure');
  return parts.join('; ');
}

export function isUnsafeSessionRequestAllowed(req: IncomingMessage): boolean {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const marker = req.headers[WEB_SESSION_REQUEST_HEADER];
  const hasMarker =
    typeof marker === 'string'
      ? marker === '1' || marker === 'true'
      : Array.isArray(marker)
        ? marker.some((value) => value === '1' || value === 'true')
        : false;
  return hasMarker && isTrustedUnsafeRequestContext(req);
}

export async function authenticateCockpitWebSession(
  args: Readonly<{
    req: IncomingMessage;
    store: CockpitWebSessionStore | undefined;
    config: CockpitWebSessionConfig | undefined;
    nowMs: number;
    correlationId: string;
    traceContext: TraceContext;
    expectedWorkspaceId?: string;
    requireExpectedWorkspaceId?: boolean;
  }>,
): Promise<Result<AppContext, Unauthorized> | null> {
  if (!args.store) return null;
  const sessionId = readSessionIdFromCookie(args.req, args.config?.cookieName);
  if (!sessionId) return null;
  if (!isUnsafeSessionRequestAllowed(args.req)) {
    return err({
      kind: 'Unauthorized',
      message: 'Cookie-authenticated mutations require X-Portarium-Request.',
    });
  }
  const record = args.store.get(sessionId, args.nowMs);
  if (!record) {
    return err({ kind: 'Unauthorized', message: 'Cockpit session expired or invalid.' });
  }
  const expectedWorkspaceId = args.expectedWorkspaceId?.trim();
  if (args.requireExpectedWorkspaceId && !expectedWorkspaceId) {
    return err({
      kind: 'Unauthorized',
      message: 'Workspace-bound authentication requires expectedWorkspaceId.',
    });
  }
  if (expectedWorkspaceId && String(record.ctx.tenantId) !== expectedWorkspaceId) {
    return err({ kind: 'Unauthorized', message: 'Workspace scope mismatch.' });
  }
  return ok(contextForRequest(record, args.correlationId, args.traceContext));
}

export async function exchangeOidcCodeForWebSession(
  args: Readonly<{
    body: OidcCallbackBody;
    authentication: AuthenticationPort;
    config: CockpitWebSessionConfig;
    correlationId: string;
    traceContext: TraceContext;
  }>,
): Promise<
  Result<
    { ctx: AppContext; ttlMs: number },
    Unauthorized | { kind: 'ValidationFailed'; field: string; message: string }
  >
> {
  const issuer = args.config.oidcIssuer?.trim();
  const clientId = args.config.oidcClientId?.trim();
  const redirectUri = args.config.oidcRedirectUri?.trim();
  if (!issuer || !clientId || !redirectUri) {
    return err({
      kind: 'ValidationFailed',
      field: 'oidc',
      message: 'Cockpit web OIDC session exchange is not configured.',
    });
  }
  const fetchImpl = args.config.fetchImpl ?? fetch;
  const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  let discovery: Response;
  try {
    discovery = await fetchWithTimeout(fetchImpl, discoveryUrl);
  } catch {
    return err({
      kind: 'ValidationFailed',
      field: 'oidc',
      message: 'OIDC discovery request failed.',
    });
  }
  if (!discovery.ok) {
    return err({
      kind: 'ValidationFailed',
      field: 'oidc',
      message: `OIDC discovery failed with status ${discovery.status}.`,
    });
  }
  const discoveryBody = (await discovery.json()) as Record<string, unknown>;
  const tokenEndpoint =
    typeof discoveryBody['token_endpoint'] === 'string'
      ? discoveryBody['token_endpoint']
      : `${issuer.replace(/\/$/, '')}/token`;

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.body.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: args.body.codeVerifier,
  });
  let tokenResponse: Response;
  try {
    tokenResponse = await fetchWithTimeout(fetchImpl, tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
  } catch {
    return err({
      kind: 'Unauthorized',
      message: 'OIDC token exchange request failed.',
    });
  }
  if (!tokenResponse.ok) {
    return err({
      kind: 'Unauthorized',
      message: `OIDC token exchange failed with status ${tokenResponse.status}.`,
    });
  }
  const tokenPayload = (await tokenResponse.json()) as TokenResponse;
  const accessToken =
    typeof tokenPayload.access_token === 'string' ? tokenPayload.access_token : '';
  if (!accessToken) {
    return err({
      kind: 'Unauthorized',
      message: 'OIDC token response did not include an access token.',
    });
  }
  const auth = await args.authentication.authenticateBearerToken({
    authorizationHeader: `Bearer ${accessToken}`,
    correlationId: args.correlationId,
    traceparent: args.traceContext.traceparent,
    ...(args.traceContext.tracestate ? { tracestate: args.traceContext.tracestate } : {}),
  });
  if (!auth.ok) return auth;

  const tokenTtlSeconds =
    typeof tokenPayload.expires_in === 'number' && Number.isFinite(tokenPayload.expires_in)
      ? tokenPayload.expires_in
      : undefined;
  const configTtlMs = cockpitWebSessionTtlMs(args.config);
  const ttlMs = tokenTtlSeconds ? Math.min(tokenTtlSeconds * 1000, configTtlMs) : configTtlMs;
  return ok({
    ctx: auth.value,
    ttlMs,
  });
}

export async function createDevelopmentWebSession(
  args: Readonly<{
    authentication: AuthenticationPort;
    config: CockpitWebSessionConfig;
    correlationId: string;
    traceContext: TraceContext;
  }>,
): Promise<Result<{ ctx: AppContext; ttlMs: number }, Unauthorized>> {
  if (!args.config.allowDevelopmentSession || !args.config.developmentBearerToken?.trim()) {
    return err({ kind: 'Unauthorized', message: 'Development web session is not enabled.' });
  }
  const auth = await args.authentication.authenticateBearerToken({
    authorizationHeader: `Bearer ${args.config.developmentBearerToken.trim()}`,
    correlationId: args.correlationId,
    traceparent: args.traceContext.traceparent,
    ...(args.traceContext.tracestate ? { tracestate: args.traceContext.tracestate } : {}),
  });
  if (!auth.ok) return auth;
  return ok({ ctx: auth.value, ttlMs: cockpitWebSessionTtlMs(args.config) });
}

function shouldUseSecureCookie(req: IncomingMessage): boolean {
  if (process.env['NODE_ENV'] === 'development') {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (typeof forwardedProto === 'string') {
      return forwardedProto
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .includes('https');
    }
    if (Array.isArray(forwardedProto)) {
      return forwardedProto.some((value) => value.trim().toLowerCase() === 'https');
    }
    return false;
  }
  return true;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
): Promise<Response> {
  if (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function' &&
    !init?.signal
  ) {
    return fetchImpl(input, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_OIDC_FETCH_TIMEOUT_MS),
    });
  }
  return fetchImpl(input, init);
}

function isTrustedUnsafeRequestContext(req: IncomingMessage): boolean {
  const fetchSite = firstHeader(req.headers['sec-fetch-site'])?.toLowerCase();
  if (
    fetchSite &&
    fetchSite !== 'same-origin' &&
    fetchSite !== 'same-site' &&
    fetchSite !== 'none'
  ) {
    return false;
  }

  const origin = firstHeader(req.headers.origin);
  if (!origin) return true;

  const host = firstHeader(req.headers['x-forwarded-host']) ?? firstHeader(req.headers.host);
  if (!host) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.host !== host) return false;
    const forwardedProto = firstHeader(req.headers['x-forwarded-proto']);
    if (!forwardedProto) return true;
    return parsed.protocol.replace(/:$/, '').toLowerCase() === forwardedProto.toLowerCase();
  } catch {
    return false;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim();
  return value?.trim();
}

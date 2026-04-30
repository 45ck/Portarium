import { consumePkceStateForCallback, OidcError, type CallbackParams } from '@/lib/oidc-client';
import type { ParsedAuthClaims } from '@/stores/auth-store';

export interface WebSessionResponse {
  authenticated: true;
  claims: ParsedAuthClaims;
}

function isClaims(value: unknown): value is ParsedAuthClaims {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const personas = record.personas;
  const capabilities = record.capabilities;
  const apiScopes = record.apiScopes;
  const displayName = record.displayName;
  return (
    typeof record.sub === 'string' &&
    typeof record.workspaceId === 'string' &&
    Array.isArray(record.roles) &&
    record.roles.every((role) => typeof role === 'string') &&
    (personas === undefined ||
      (Array.isArray(personas) && personas.every((persona) => typeof persona === 'string'))) &&
    (capabilities === undefined ||
      (Array.isArray(capabilities) &&
        capabilities.every((capability) => typeof capability === 'string'))) &&
    (apiScopes === undefined ||
      (Array.isArray(apiScopes) && apiScopes.every((scope) => typeof scope === 'string'))) &&
    (displayName === undefined || typeof displayName === 'string')
  );
}

function parseWebSessionResponse(value: unknown): WebSessionResponse {
  if (typeof value !== 'object' || value === null) {
    throw new OidcError('Invalid Cockpit session response', 'token_exchange_failed');
  }
  const record = value as Record<string, unknown>;
  if (record.authenticated !== true || !isClaims(record.claims)) {
    throw new OidcError('Invalid Cockpit session claims', 'invalid_jwt');
  }
  const claims = record.claims;
  return {
    authenticated: true,
    claims: {
      ...claims,
      personas: claims.personas ?? [],
      capabilities: claims.capabilities ?? [],
      apiScopes: claims.apiScopes ?? [],
    },
  };
}

async function readSessionResponse(response: Response): Promise<WebSessionResponse> {
  if (!response.ok) {
    throw new OidcError(
      `Cockpit session request failed: ${response.status}`,
      'token_exchange_failed',
    );
  }
  return parseWebSessionResponse(await response.json());
}

export async function fetchCurrentWebSession(): Promise<WebSessionResponse | null> {
  const response = await fetch('/auth/session', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 401) return null;
  return readSessionResponse(response);
}

export async function establishWebSession(params: CallbackParams): Promise<WebSessionResponse> {
  const pkce = consumePkceStateForCallback(params.state);
  const response = await fetch('/auth/oidc/callback', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Portarium-Request': '1',
    },
    body: JSON.stringify({
      code: params.code,
      ...(params.state ? { state: params.state } : {}),
      codeVerifier: pkce.codeVerifier,
    }),
  });
  return readSessionResponse(response);
}

export async function createDevelopmentWebSession(): Promise<WebSessionResponse> {
  const response = await fetch('/auth/dev-session', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Portarium-Request': '1',
    },
  });
  return readSessionResponse(response);
}

export async function logoutWebSession(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Portarium-Request': '1' },
  });
}

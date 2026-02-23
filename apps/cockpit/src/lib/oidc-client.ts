/**
 * OIDC PKCE client for Portarium Cockpit mobile/web auth.
 *
 * Implements the Authorization Code flow with PKCE (RFC 7636).
 * Works on both native (Capacitor in-app browser + deep links) and web
 * (window.location redirect + URL hash/query params).
 *
 * Configuration is read from Vite env vars:
 *   VITE_OIDC_ISSUER       — e.g. https://auth.portarium.io
 *   VITE_OIDC_CLIENT_ID    — e.g. portarium-cockpit
 *   VITE_OIDC_REDIRECT_URI — e.g. portarium://auth/callback (native)
 *                                  https://app.portarium.io/auth/callback (web)
 *   VITE_OIDC_SCOPE        — default: "openid profile"
 *
 * Bead: bead-0721
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export function loadOidcConfig(): OidcConfig {
  const issuer = (import.meta.env.VITE_OIDC_ISSUER ?? '').trim();
  const clientId = (import.meta.env.VITE_OIDC_CLIENT_ID ?? '').trim();
  const redirectUri = (import.meta.env.VITE_OIDC_REDIRECT_URI ?? '').trim();
  const scope = (import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile').trim();
  return { issuer, clientId, redirectUri, scope };
}

export function isOidcConfigured(config: OidcConfig): boolean {
  return config.issuer !== '' && config.clientId !== '' && config.redirectUri !== '';
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random code_verifier (43–128 chars, base64url).
 * RFC 7636 §4.1 recommends 32 random octets → 43 base64url chars.
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

/**
 * Derive code_challenge = BASE64URL(SHA-256(ASCII(code_verifier))).
 * Uses Web Crypto API (available in modern browsers + Capacitor WebView).
 */
export async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

function base64urlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// PKCE state (persisted in sessionStorage for web redirect round-trip)
// ---------------------------------------------------------------------------

const PKCE_STATE_KEY = 'portarium_pkce_state';

interface PkceState {
  codeVerifier: string;
  state: string; // random CSRF token
  redirectUri: string;
  issuer: string;
  clientId: string;
}

function savePkceState(pkceState: PkceState): void {
  sessionStorage.setItem(PKCE_STATE_KEY, JSON.stringify(pkceState));
}

function loadPkceState(): PkceState | null {
  const raw = sessionStorage.getItem(PKCE_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PkceState;
  } catch {
    return null;
  }
}

function clearPkceState(): void {
  sessionStorage.removeItem(PKCE_STATE_KEY);
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export interface StartLoginOptions {
  config: OidcConfig;
  /** Override discovery endpoint (default: {issuer}/.well-known/openid-configuration) */
  discoveryUrl?: string;
}

export interface LoginSession {
  /** URL to open in the in-app browser or redirect to */
  authorizationUrl: string;
  /** PKCE code_verifier — keep secret; needed for token exchange */
  codeVerifier: string;
  /** Random CSRF state token */
  state: string;
}

/**
 * Prepare a PKCE login session.
 * Fetches OIDC discovery to resolve the authorization endpoint.
 * Saves state to sessionStorage for web redirect round-trips.
 */
export async function prepareLoginSession(opts: StartLoginOptions): Promise<LoginSession> {
  const { config } = opts;

  // --- 1. Discover authorization endpoint ---
  const discoveryUrl =
    opts.discoveryUrl ?? `${config.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

  const discoveryRes = await fetch(discoveryUrl);
  if (!discoveryRes.ok) {
    throw new OidcError(
      `OIDC discovery failed: ${discoveryRes.status} ${discoveryRes.statusText}`,
      'discovery_failed',
    );
  }
  const discovery = (await discoveryRes.json()) as Record<string, unknown>;
  const authorizationEndpoint =
    typeof discovery.authorization_endpoint === 'string'
      ? discovery.authorization_endpoint
      : `${config.issuer.replace(/\/$/, '')}/authorize`;

  // --- 2. Generate PKCE values ---
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await deriveCodeChallenge(codeVerifier);
  const state = generateCodeVerifier(); // reuse random generator for CSRF token

  // --- 3. Build authorization URL ---
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  const authorizationUrl = `${authorizationEndpoint}?${params.toString()}`;

  // --- 4. Persist PKCE state for web redirect round-trip ---
  savePkceState({
    codeVerifier,
    state,
    redirectUri: config.redirectUri,
    issuer: config.issuer,
    clientId: config.clientId,
  });

  return { authorizationUrl, codeVerifier, state };
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface ExchangeCodeOptions {
  /** Authorization code received from the callback */
  code: string;
  /** The CSRF state returned in the callback — must match session state */
  callbackState?: string;
  /** Use stored PKCE state (for web redirect flows) */
  fromSession?: boolean;
  /** Or provide PKCE values directly (for native deep-link flows) */
  codeVerifier?: string;
  state?: string;
  config?: OidcConfig;
  /** Override token endpoint */
  tokenEndpoint?: string;
}

/**
 * Exchange an authorization code for tokens using PKCE.
 * Validates the CSRF state token before making the token request.
 */
export async function exchangeCode(opts: ExchangeCodeOptions): Promise<TokenResponse> {
  // --- 1. Resolve PKCE session ---
  let pkceState: PkceState;

  if (opts.fromSession !== false) {
    const stored = loadPkceState();
    if (!stored) {
      throw new OidcError('No PKCE session found in storage', 'session_not_found');
    }
    pkceState = stored;
  } else if (opts.codeVerifier && opts.config) {
    pkceState = {
      codeVerifier: opts.codeVerifier,
      state: opts.state ?? '',
      redirectUri: opts.config.redirectUri,
      issuer: opts.config.issuer,
      clientId: opts.config.clientId,
    };
  } else {
    throw new OidcError(
      'Either fromSession or codeVerifier+config must be provided',
      'invalid_args',
    );
  }

  // --- 2. CSRF state check ---
  if (opts.callbackState !== undefined && opts.callbackState !== pkceState.state) {
    clearPkceState();
    throw new OidcError('CSRF state mismatch — possible replay attack', 'state_mismatch');
  }

  // --- 3. Discover token endpoint ---
  let tokenEndpoint: string;
  if (opts.tokenEndpoint) {
    tokenEndpoint = opts.tokenEndpoint;
  } else {
    const discoveryUrl = `${pkceState.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    const discoveryRes = await fetch(discoveryUrl);
    if (!discoveryRes.ok) {
      throw new OidcError(`OIDC discovery failed: ${discoveryRes.status}`, 'discovery_failed');
    }
    const discovery = (await discoveryRes.json()) as Record<string, unknown>;
    tokenEndpoint =
      typeof discovery.token_endpoint === 'string'
        ? discovery.token_endpoint
        : `${pkceState.issuer.replace(/\/$/, '')}/token`;
  }

  // --- 4. Exchange code for tokens ---
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: pkceState.redirectUri,
    client_id: pkceState.clientId,
    code_verifier: pkceState.codeVerifier,
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    clearPkceState();
    throw new OidcError(
      `Token exchange failed: ${tokenRes.status} — ${errBody}`,
      'token_exchange_failed',
    );
  }

  const tokens = (await tokenRes.json()) as TokenResponse;
  clearPkceState();
  return tokens;
}

// ---------------------------------------------------------------------------
// Callback URL parsing
// ---------------------------------------------------------------------------

export interface CallbackParams {
  code: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Parse an OIDC callback URL (query string or hash fragment).
 * Handles both standard redirect callbacks and deep links.
 */
export function parseCallbackUrl(url: string): CallbackParams {
  let search: string;

  try {
    const parsed = new URL(url);
    // Prefer query params; fall back to fragment (implicit flow legacy)
    search = parsed.search || `?${parsed.hash.replace(/^#/, '')}`;
  } catch {
    // Bare query string passed directly
    search = url.startsWith('?') ? url : `?${url}`;
  }

  const params = new URLSearchParams(search);

  const error = params.get('error') ?? undefined;
  if (error) {
    return {
      code: '',
      state: params.get('state') ?? undefined,
      error,
      errorDescription: params.get('error_description') ?? undefined,
    };
  }

  const code = params.get('code') ?? '';
  if (!code) {
    throw new OidcError('No authorization code in callback URL', 'missing_code');
  }

  return { code, state: params.get('state') ?? undefined };
}

// ---------------------------------------------------------------------------
// JWT decode (payload only — no signature verification at this layer)
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without signature verification.
 * Signature verification is done server-side by the control plane.
 * This is used client-side only to extract display claims (workspace, role).
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new OidcError('Invalid JWT format', 'invalid_jwt');
  }
  // Base64url → base64 → JSON
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
  try {
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    throw new OidcError('Failed to decode JWT payload', 'invalid_jwt');
  }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export type OidcErrorCode =
  | 'discovery_failed'
  | 'session_not_found'
  | 'state_mismatch'
  | 'token_exchange_failed'
  | 'missing_code'
  | 'invalid_jwt'
  | 'invalid_args';

export class OidcError extends Error {
  public readonly code: OidcErrorCode;

  constructor(message: string, code: OidcErrorCode) {
    super(message);
    this.name = 'OidcError';
    this.code = code;
  }
}

/**
 * Contract tests for the OIDC PKCE client.
 * Tests pure functions (PKCE helpers, URL parsing, JWT decode).
 * Does not call real OIDC endpoints.
 *
 * Bead: bead-0721
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  parseCallbackUrl,
  decodeJwtPayload,
  OidcError,
  loadOidcConfig,
  isOidcConfigured,
  prepareLoginSession,
  exchangeCode,
} from './oidc-client';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

describe('generateCodeVerifier', () => {
  it('returns a base64url string of 43 chars', () => {
    const v = generateCodeVerifier();
    // 32 bytes → 43 base64url chars (no padding)
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(v.length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('deriveCodeChallenge', () => {
  it('returns a base64url string', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const c1 = await deriveCodeChallenge(verifier);
    const c2 = await deriveCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('produces different challenges for different verifiers', async () => {
    const c1 = await deriveCodeChallenge(generateCodeVerifier());
    const c2 = await deriveCodeChallenge(generateCodeVerifier());
    expect(c1).not.toBe(c2);
  });
});

// ---------------------------------------------------------------------------
// parseCallbackUrl
// ---------------------------------------------------------------------------

describe('parseCallbackUrl', () => {
  it('parses authorization code from query string', () => {
    const result = parseCallbackUrl('portarium://auth/callback?code=abc123&state=xyz');
    expect(result.code).toBe('abc123');
    expect(result.state).toBe('xyz');
    expect(result.error).toBeUndefined();
  });

  it('parses error response', () => {
    const result = parseCallbackUrl(
      'portarium://auth/callback?error=access_denied&error_description=User+denied+access&state=xyz',
    );
    expect(result.code).toBe('');
    expect(result.error).toBe('access_denied');
    expect(result.errorDescription).toBe('User denied access');
  });

  it('throws OidcError when no code present', () => {
    expect(() => parseCallbackUrl('portarium://auth/callback?state=xyz')).toThrow(OidcError);
  });

  it('parses bare query string without URL', () => {
    const result = parseCallbackUrl('?code=mycode&state=mystate');
    expect(result.code).toBe('mycode');
    expect(result.state).toBe('mystate');
  });

  it('parses full HTTPS redirect URI', () => {
    const result = parseCallbackUrl('https://app.portarium.io/auth/callback?code=zzz');
    expect(result.code).toBe('zzz');
  });
});

// ---------------------------------------------------------------------------
// decodeJwtPayload
// ---------------------------------------------------------------------------

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    // Build a fake JWT with known payload
    const payload = { sub: 'user-1', workspaceId: 'ws-1', roles: ['admin'] };
    const encoded = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const jwt = `header.${encoded}.signature`;

    const result = decodeJwtPayload(jwt);
    expect(result.sub).toBe('user-1');
    expect(result.workspaceId).toBe('ws-1');
    expect(result.roles).toEqual(['admin']);
  });

  it('throws OidcError for malformed JWT', () => {
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow(OidcError);
  });

  it('throws OidcError for JWT with invalid base64 payload', () => {
    expect(() => decodeJwtPayload('header.!!invalid!!.sig')).toThrow(OidcError);
  });
});

// ---------------------------------------------------------------------------
// loadOidcConfig / isOidcConfigured
// ---------------------------------------------------------------------------

describe('loadOidcConfig', () => {
  it('reads from import.meta.env', () => {
    const config = loadOidcConfig();
    // In test env all VITE_* vars are undefined → empty strings
    expect(typeof config.issuer).toBe('string');
    expect(typeof config.clientId).toBe('string');
    expect(typeof config.redirectUri).toBe('string');
  });

  it('uses default scope if not set', () => {
    const config = loadOidcConfig();
    expect(config.scope).toBe('openid profile');
  });
});

describe('isOidcConfigured', () => {
  it('returns false when config is empty', () => {
    expect(isOidcConfigured({ issuer: '', clientId: '', redirectUri: '', scope: '' })).toBe(false);
  });

  it('returns false when only issuer is set', () => {
    expect(
      isOidcConfigured({
        issuer: 'https://auth.example.com',
        clientId: '',
        redirectUri: '',
        scope: 'openid',
      }),
    ).toBe(false);
  });

  it('returns true when all required fields are set', () => {
    expect(
      isOidcConfigured({
        issuer: 'https://auth.example.com',
        clientId: 'my-client',
        redirectUri: 'portarium://auth/callback',
        scope: 'openid',
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// prepareLoginSession (mocked fetch)
// ---------------------------------------------------------------------------

describe('prepareLoginSession', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // sessionStorage is not available in vitest node environment — stub it
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn(),
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an authorization URL with PKCE parameters', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
      }),
    } as Response);

    const config = {
      issuer: 'https://auth.example.com',
      clientId: 'cockpit',
      redirectUri: 'portarium://auth/callback',
      scope: 'openid profile',
    };

    const session = await prepareLoginSession({ config });

    expect(session.authorizationUrl).toContain('https://auth.example.com/authorize');
    expect(session.authorizationUrl).toContain('client_id=cockpit');
    expect(session.authorizationUrl).toContain('code_challenge_method=S256');
    expect(session.authorizationUrl).toContain('code_challenge=');
    expect(session.authorizationUrl).toContain('response_type=code');
    expect(session.codeVerifier).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    expect(session.state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('throws OidcError when discovery fails', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
    } as Response);

    const config = {
      issuer: 'https://auth.example.com',
      clientId: 'cockpit',
      redirectUri: 'portarium://auth/callback',
      scope: 'openid',
    };

    await expect(prepareLoginSession({ config })).rejects.toThrow(OidcError);
  });
});

// ---------------------------------------------------------------------------
// exchangeCode (mocked fetch + sessionStorage)
// ---------------------------------------------------------------------------

describe('exchangeCode', () => {
  const validPkceState = JSON.stringify({
    codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    state: 'randomstate123',
    redirectUri: 'portarium://auth/callback',
    issuer: 'https://auth.example.com',
    clientId: 'cockpit',
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn(),
      getItem: vi.fn().mockReturnValue(validPkceState),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges code for tokens and returns access_token', async () => {
    const mockFetch = vi.mocked(fetch);
    // First call: discovery
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_endpoint: 'https://auth.example.com/token' }),
    } as Response);
    // Second call: token exchange
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    } as Response);

    const result = await exchangeCode({ code: 'authcode123', callbackState: 'randomstate123' });
    expect(result.access_token).toBe('test-access-token');
    expect(result.token_type).toBe('Bearer');
  });

  it('throws OidcError on CSRF state mismatch', async () => {
    await expect(exchangeCode({ code: 'authcode', callbackState: 'wrong-state' })).rejects.toThrow(
      OidcError,
    );
  });

  it('throws OidcError when token exchange returns non-200', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_endpoint: 'https://auth.example.com/token' }),
    } as Response);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    } as Response);

    await expect(
      exchangeCode({ code: 'bad-code', callbackState: 'randomstate123' }),
    ).rejects.toThrow(OidcError);
  });
});

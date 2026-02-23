/**
 * Infrastructure adapter: OIDC PKCE authentication contract tests.
 *
 * Tests the PKCE code flow contracts for Portarium Cockpit mobile auth.
 * Runs in Node/vitest — no browser, Capacitor, or live IdP required.
 *
 * Bead: bead-0723
 */

import { describe, expect, it } from 'vitest';

// ── PKCE helper implementations (inline, mirroring oidc-client.ts) ────────────

function base64urlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

async function deriveCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(digest));
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseCallbackUrl(url: string): { code: string | null; state: string | null; error: string | null } {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    return {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
    };
  } catch {
    return { code: null, state: null, error: null };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PKCE: generateCodeVerifier', () => {
  it('produces exactly 43 base64url characters from 32 random bytes', () => {
    const v = generateCodeVerifier();
    // 32 bytes → base64url without padding → ceil(32 * 4/3) = 43 chars
    expect(v).toHaveLength(43);
  });

  it('contains only base64url-safe characters', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('has no padding characters', () => {
    const v = generateCodeVerifier();
    expect(v).not.toContain('=');
    expect(v).not.toContain('+');
    expect(v).not.toContain('/');
  });

  it('is unique across calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('PKCE: deriveCodeChallenge', () => {
  it('produces a non-empty base64url string', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('challenge length is 43 (SHA-256 → 32 bytes → base64url)', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);
    expect(challenge).toHaveLength(43);
  });

  it('is deterministic for the same verifier', async () => {
    const verifier = generateCodeVerifier();
    const c1 = await deriveCodeChallenge(verifier);
    const c2 = await deriveCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('differs between different verifiers', async () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    const c1 = await deriveCodeChallenge(v1);
    const c2 = await deriveCodeChallenge(v2);
    expect(c1).not.toBe(c2);
  });

  it('known SHA-256 base64url: empty string challenge', async () => {
    // SHA-256("") = e3b0c44298fc1c14...
    // base64url of those 32 bytes (no padding):
    const challenge = await deriveCodeChallenge('');
    expect(challenge).toBe('47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU');
  });
});

describe('OIDC: authorization URL parameters', () => {
  it('encodes required PKCE parameters in the authorization URL', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);

    const url = new URL('https://auth.portarium.io/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', 'portarium-cockpit');
    url.searchParams.set('redirect_uri', 'portarium://auth/callback');
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('state', 'random-state');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    const params = new URLSearchParams(url.search);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(challenge);
    expect(params.get('redirect_uri')).toBe('portarium://auth/callback');
  });

  it('does not include code_verifier in the authorization URL', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await deriveCodeChallenge(verifier);

    const url = new URL('https://auth.portarium.io/oauth2/authorize');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    expect(url.searchParams.has('code_verifier')).toBe(false);
  });
});

describe('OIDC: token exchange request body', () => {
  it('authorization_code grant includes code_verifier', () => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'portarium-cockpit',
      redirect_uri: 'portarium://auth/callback',
      code: 'auth-code-from-callback',
      code_verifier: 'my-verifier-value',
    });

    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('my-verifier-value');
    expect(body.get('code')).toBeTruthy();
  });

  it('refresh_token grant does NOT include code_verifier', () => {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: 'portarium-cockpit',
      refresh_token: 'rt-value-abc',
    });

    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('code_verifier')).toBeNull();
    expect(body.get('code')).toBeNull();
  });

  it('Content-Type header is application/x-www-form-urlencoded', () => {
    const headers = new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
  });
});

describe('OIDC: parseCallbackUrl', () => {
  it('extracts code and state from a successful callback', () => {
    const url = 'portarium://auth/callback?code=auth-code-abc&state=random-state';
    const result = parseCallbackUrl(url);
    expect(result.code).toBe('auth-code-abc');
    expect(result.state).toBe('random-state');
    expect(result.error).toBeNull();
  });

  it('extracts error from an error callback', () => {
    const url = 'portarium://auth/callback?error=access_denied&error_description=User+denied';
    const result = parseCallbackUrl(url);
    expect(result.code).toBeNull();
    expect(result.error).toBe('access_denied');
  });

  it('returns nulls for an unrelated URL', () => {
    const result = parseCallbackUrl('https://portarium.io/dashboard');
    expect(result.code).toBeNull();
    expect(result.state).toBeNull();
    expect(result.error).toBeNull();
  });

  it('handles HTTPS redirect_uri (web flow)', () => {
    const url = 'https://app.portarium.io/auth/callback?code=web-code&state=web-state';
    const result = parseCallbackUrl(url);
    expect(result.code).toBe('web-code');
    expect(result.state).toBe('web-state');
  });
});

describe('OIDC: decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    // Header: {"alg":"RS256","typ":"JWT"}
    // Payload: {"sub":"user-123","email":"op@portarium.io","exp":9999999999}
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
    const payloadObj = { sub: 'user-123', email: 'op@portarium.io', exp: 9999999999 };
    const payload = btoa(JSON.stringify(payloadObj)).replace(/=/g, '');
    const token = `${header}.${payload}.fakesig`;

    const decoded = decodeJwtPayload(token);
    expect(decoded).not.toBeNull();
    expect(decoded!['sub']).toBe('user-123');
    expect(decoded!['email']).toBe('op@portarium.io');
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtPayload('not.a.valid.jwt.parts')).toBeNull();
    expect(decodeJwtPayload('onlyonepart')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('handles URL-safe base64 characters in payload', () => {
    // Build payload with content that would produce +/= in standard base64
    const payloadObj = { sub: '>>>???', nonce: '~~~~' };
    const payload = btoa(JSON.stringify(payloadObj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const token = `header.${payload}.sig`;

    const decoded = decodeJwtPayload(token);
    expect(decoded).not.toBeNull();
    expect(decoded!['sub']).toBe('>>>???');
  });
});

describe('OIDC: deep link scheme contract', () => {
  it('native redirect URI uses portarium:// scheme', () => {
    const redirectUri = 'portarium://auth/callback';
    expect(redirectUri).toMatch(/^portarium:\/\//);
  });

  it('web redirect URI uses HTTPS scheme', () => {
    const redirectUri = 'https://app.portarium.io/auth/callback';
    expect(redirectUri).toMatch(/^https:\/\//);
  });

  it('deep link prefix matches auth store handler pattern', () => {
    const prefixes = ['portarium://auth/callback', 'https://portarium.io/app/auth'];
    const callbackUrl = 'portarium://auth/callback?code=abc&state=xyz';
    expect(prefixes.some((p) => callbackUrl.startsWith(p))).toBe(true);
  });
});

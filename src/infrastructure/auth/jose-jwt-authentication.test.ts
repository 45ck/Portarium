import { describe, expect, it } from 'vitest';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { JoseJwtAuthenticationConfig } from './jose-jwt-authentication.js';
import { JoseJwtAuthentication } from './jose-jwt-authentication.js';
import { toHttpStatus } from '../../application/common/errors.js';

describe('JoseJwtAuthentication', () => {
  it('returns Unauthorized when Authorization header is missing', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: undefined,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(toHttpStatus(result.error)).toBe(401);
  });

  it('rejects invalid signature', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: 'Bearer not-a-jwt',
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
  });

  it('rejects expired token', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      workspaceId: 'ws-1',
      roles: ['operator'],
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('0s')
      .sign(privateKey);

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
  });

  it('authenticates and materializes AppContext from claims', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      workspaceId: 'ws-1',
      roles: ['operator', 'approver'],
      scope: 'run:read run:start',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
      expectedWorkspaceId: 'ws-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.tenantId).toBe('ws-1');
    expect(result.value.principalId).toBe('user-1');
    expect(result.value.roles).toEqual(['operator', 'approver']);
    expect(result.value.scopes).toEqual(['run:read', 'run:start']);
    expect(result.value.correlationId).toBe('corr-1');
  });

  it('rejects workspace scope mismatch', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      workspaceId: 'ws-1',
      roles: ['operator'],
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
      expectedWorkspaceId: 'ws-other',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
  });

  // -------------------------------------------------------------------------
  // typ header validation (RFC 9068)
  // -------------------------------------------------------------------------

  it('rejects token with unknown typ header', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1', typ: 'dpop+jwt' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain("'dpop+jwt'");
  });

  it('rejects token when requiredTokenType is at+JWT but typ is JWT', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      requiredTokenType: 'at+JWT',
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain('mismatch');
  });

  it('accepts token with typ at+JWT when requiredTokenType is at+JWT', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1', typ: 'at+JWT' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      requiredTokenType: 'at+JWT',
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(true);
  });

  it('accepts Keycloak-style tenant/realm role claims', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      tenantId: 'ws-1',
      realm_access: { roles: ['operator', 'offline_access'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const auth = new JoseJwtAuthentication({ jwks: { keys: [jwk] } });
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
      expectedWorkspaceId: 'ws-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success.');
    expect(result.value.tenantId).toBe('ws-1');
    expect(result.value.roles).toEqual(['operator']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// azp (authorized party), trustedIssuers, and non-standard claim extraction
// ─────────────────────────────────────────────────────────────────────────────

describe('JoseJwtAuthentication — authorization and issuer', () => {
  // -------------------------------------------------------------------------
  // azp (authorized party) validation
  // -------------------------------------------------------------------------

  it('rejects token missing azp when authorizedParty is configured', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      authorizedParty: 'portarium-ui',
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain("'azp'");
  });

  it('rejects token with mismatching azp', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      workspaceId: 'ws-1',
      roles: ['operator'],
      azp: 'some-other-client',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      authorizedParty: 'portarium-ui',
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain('Authorized party mismatch');
  });

  it('accepts token with matching azp', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({
      workspaceId: 'ws-1',
      roles: ['operator'],
      azp: 'portarium-ui',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      authorizedParty: 'portarium-ui',
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Trusted issuer allowlist
  // -------------------------------------------------------------------------

  it('rejects token from issuer not in trustedIssuers allowlist', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuer('https://untrusted-idp.example.com')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      trustedIssuers: ['https://idp.portarium.io', 'https://sso.enterprise.example.com'],
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unauthorized.');
    expect(result.error.kind).toBe('Unauthorized');
    expect(result.error.message).toContain('trusted allowlist');
  });

  it('accepts token from issuer in trustedIssuers allowlist', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'kid-1';

    const token = await new SignJWT({ workspaceId: 'ws-1', roles: ['operator'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'kid-1' })
      .setSubject('user-1')
      .setIssuer('https://sso.enterprise.example.com')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(privateKey);

    const config: JoseJwtAuthenticationConfig = {
      jwks: { keys: [jwk] },
      trustedIssuers: ['https://idp.portarium.io', 'https://sso.enterprise.example.com'],
    };
    const auth = new JoseJwtAuthentication(config);
    const result = await auth.authenticateBearerToken({
      authorizationHeader: `Bearer ${token}`,
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(true);
  });
});

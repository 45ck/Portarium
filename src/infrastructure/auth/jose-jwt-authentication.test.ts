import { describe, expect, it } from 'vitest';

import { SignJWT, exportJWK, generateKeyPair } from 'jose';

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

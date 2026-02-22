import { describe, expect, it } from 'vitest';
import { DevTokenAuthentication } from './dev-token-authentication.js';

const VALID_TOKEN = 'dev-secret-token-xyz';
const WORKSPACE_ID = 'ws-local-dev';

function makeAuth(overrides?: Partial<{ token: string; workspaceId: string; userId: string }>) {
  return new DevTokenAuthentication({
    token: VALID_TOKEN,
    workspaceId: WORKSPACE_ID,
    ...overrides,
  });
}

describe('DevTokenAuthentication', () => {
  describe('constructor', () => {
    it('throws when token is empty', () => {
      expect(() => makeAuth({ token: '' })).toThrow('token must be a non-empty string');
    });

    it('throws when workspaceId is empty', () => {
      expect(() => makeAuth({ workspaceId: '' })).toThrow('workspaceId must be a non-empty string');
    });
  });

  describe('authenticateBearerToken', () => {
    it('accepts the configured token', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      expect(result.ok).toBe(true);
    });

    it('returned context has admin role', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      if (!result.ok) throw new Error('Expected ok');
      expect(result.value.roles).toContain('admin');
    });

    it('returned context has configured workspaceId as tenantId', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      if (!result.ok) throw new Error('Expected ok');
      expect(result.value.tenantId).toBe(WORKSPACE_ID);
    });

    it('uses custom userId in principalId', async () => {
      const auth = makeAuth({ userId: 'alice' });
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      if (!result.ok) throw new Error('Expected ok');
      expect(result.value.principalId).toBe('alice');
    });

    it('defaults userId to "dev-user"', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      if (!result.ok) throw new Error('Expected ok');
      expect(result.value.principalId).toBe('dev-user');
    });

    it('rejects missing Authorization header', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: undefined,
        correlationId: 'corr-1',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected unauthorized');
      expect(result.error.kind).toBe('Unauthorized');
    });

    it('rejects empty Authorization header', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: '',
        correlationId: 'corr-1',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects wrong token value', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: 'Bearer wrong-token',
        correlationId: 'corr-1',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected unauthorized');
      expect(result.error.kind).toBe('Unauthorized');
    });

    it('rejects non-bearer scheme', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Basic ${VALID_TOKEN}`,
        correlationId: 'corr-1',
      });
      expect(result.ok).toBe(false);
    });

    it('rejects when expectedWorkspaceId does not match', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
        expectedWorkspaceId: 'different-workspace',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected unauthorized');
      expect(result.error.kind).toBe('Unauthorized');
    });

    it('accepts when expectedWorkspaceId matches', async () => {
      const auth = makeAuth();
      const result = await auth.authenticateBearerToken({
        authorizationHeader: `Bearer ${VALID_TOKEN}`,
        correlationId: 'corr-1',
        expectedWorkspaceId: WORKSPACE_ID,
      });
      expect(result.ok).toBe(true);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { VaultCredentialStore } from './vault-credential-store.js';

describe('VaultCredentialStore', () => {
  const tenantId = TenantId('tenant-1');

  function makeStore(fetchImpl: typeof fetch) {
    return new VaultCredentialStore({
      vaultAddr: 'http://vault.local:8200',
      token: 'root-token',
      kvMountPath: 'secret',
      fetchImpl,
    });
  }

  describe('getSecret', () => {
    it('returns secret value from Vault KV v2', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({
            data: {
              data: { value: 'super-secret' },
              metadata: { version: 3 },
            },
          }),
          { status: 200 },
        ),
      );

      const store = makeStore(fetchImpl);
      const result = await store.getSecret(tenantId, 'api-key');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');
      expect(result.value.value).toBe('super-secret');
      expect(result.value.version).toBe('3');

      expect(fetchImpl).toHaveBeenCalledWith(
        'http://vault.local:8200/v1/secret/data/tenant-1/api-key',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'x-vault-token': 'root-token' }),
        }),
      );
    });

    it('returns NotFound when secret does not exist', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('', { status: 404 }),
      );
      const store = makeStore(fetchImpl);
      const result = await store.getSecret(tenantId, 'missing');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('NotFound');
    });

    it('returns DependencyFailure on server error', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('internal error', { status: 500 }),
      );
      const store = makeStore(fetchImpl);
      const result = await store.getSecret(tenantId, 'ref');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('DependencyFailure');
    });

    it('returns DependencyFailure on network failure', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        throw new Error('network error');
      });
      const store = makeStore(fetchImpl);
      const result = await store.getSecret(tenantId, 'ref');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('DependencyFailure');
    });

    it('returns NotFound when response data lacks value key', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({ data: { data: { other: 'field' } } }),
          { status: 200 },
        ),
      );
      const store = makeStore(fetchImpl);
      const result = await store.getSecret(tenantId, 'ref');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('NotFound');
    });
  });

  describe('rotateSecret', () => {
    it('writes new secret and returns version', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({ data: { version: 4 } }),
          { status: 200 },
        ),
      );
      const store = makeStore(fetchImpl);
      const result = await store.rotateSecret(tenantId, 'api-key');

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected success');
      expect(result.value.newVersion).toBe('4');

      expect(fetchImpl).toHaveBeenCalledWith(
        'http://vault.local:8200/v1/secret/data/tenant-1/api-key',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns DependencyFailure on error', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('error', { status: 500 }),
      );
      const store = makeStore(fetchImpl);
      const result = await store.rotateSecret(tenantId, 'ref');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('DependencyFailure');
    });
  });

  describe('revokeSecret', () => {
    it('deletes secret metadata', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response(null, { status: 204 }),
      );
      const store = makeStore(fetchImpl);
      const result = await store.revokeSecret(tenantId, 'api-key');

      expect(result.ok).toBe(true);

      expect(fetchImpl).toHaveBeenCalledWith(
        'http://vault.local:8200/v1/secret/metadata/tenant-1/api-key',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('returns NotFound when secret does not exist', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('', { status: 404 }),
      );
      const store = makeStore(fetchImpl);
      const result = await store.revokeSecret(tenantId, 'missing');

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected failure');
      expect(result.error.kind).toBe('NotFound');
    });
  });
});

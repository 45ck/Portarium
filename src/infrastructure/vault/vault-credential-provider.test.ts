import { describe, it, expect, vi } from 'vitest';
import { VaultCredentialProvider } from './vault-credential-provider.js';
import { TenantId } from '../../domain/primitives/index.js';
import type { CredentialReference } from '../../application/ports/credential-provider.js';

function ref(overrides: Partial<CredentialReference> = {}): CredentialReference {
  return {
    tenantId: TenantId('tenant-1'),
    credentialName: 'erpnext-api-key',
    ...overrides,
  };
}

function vaultOkResponse(value: string, version = 3, createdTime = '2026-01-15T10:00:00Z') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        data: { value },
        metadata: { version, created_time: createdTime },
      },
    }),
  };
}

describe('VaultCredentialProvider', () => {
  const baseConfig = {
    vaultAddr: 'http://vault.local:8200',
    token: 'vault-token-abc',
  };

  it('retrieves a credential successfully', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(vaultOkResponse('s3cr3t', 5, '2026-02-01T12:00:00Z'));
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.secret).toBe('s3cr3t');
      expect(result.value.version).toBe(5);
      expect(result.value.createdAtIso).toBe('2026-02-01T12:00:00Z');
    }

    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toBe('http://vault.local:8200/v1/secret/data/tenant-1/erpnext-api-key');
  });

  it('appends version query param when version is specified', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(vaultOkResponse('val', 2));
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    await provider.getCredential(ref({ version: 2 }));

    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toContain('?version=2');
  });

  it('uses custom kvMountPath', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(vaultOkResponse('x'));
    const provider = new VaultCredentialProvider({ ...baseConfig, kvMountPath: 'kv', fetchImpl });

    await provider.getCredential(ref());

    const url = fetchImpl.mock.calls[0]![0] as string;
    expect(url).toContain('/v1/kv/data/tenant-1/');
  });

  it('returns CredentialNotFound on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CredentialNotFound');
    }
  });

  it('returns CredentialAccessDenied on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CredentialAccessDenied');
    }
  });

  it('returns CredentialProviderUnavailable on 500', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CredentialProviderUnavailable');
    }
  });

  it('returns CredentialProviderUnavailable on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CredentialProviderUnavailable');
    }
  });

  it('returns CredentialNotFound when value key is missing from Vault data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { data: { other_key: 'something' }, metadata: { version: 1 } },
      }),
    });
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    const result = await provider.getCredential(ref());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('CredentialNotFound');
      expect(result.error.message).toContain("no 'value' key");
    }
  });

  it('sends x-vault-token header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(vaultOkResponse('x'));
    const provider = new VaultCredentialProvider({ ...baseConfig, fetchImpl });

    await provider.getCredential(ref());

    const headers = fetchImpl.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers['x-vault-token']).toBe('vault-token-abc');
  });
});

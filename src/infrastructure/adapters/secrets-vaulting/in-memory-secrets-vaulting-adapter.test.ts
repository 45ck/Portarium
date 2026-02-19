import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemorySecretsVaultingAdapter } from './in-memory-secrets-vaulting-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemorySecretsVaultingAdapter', () => {
  it('returns tenant-scoped secrets', async () => {
    const seedA = InMemorySecretsVaultingAdapter.seedMinimal(TENANT_A);
    const seedB = InMemorySecretsVaultingAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: {
        ...seedA,
        secrets: [...seedA.secrets!, ...seedB.secrets!],
      },
    });

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listSecrets' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'externalRefs') return;
    expect(listed.result.externalRefs).toHaveLength(1);
    expect(listed.result.externalRefs[0]?.displayLabel).toContain('secret/app/api-key');
  });

  it('supports secret put/get/list/rotate/delete lifecycle', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT_A),
    });

    const put = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'putSecret',
      payload: { path: 'secret/app/token', value: 's3cr3t' },
    });
    expect(put.ok).toBe(true);
    if (!put.ok || put.result.kind !== 'externalRef') return;

    const get = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getSecret',
      payload: { path: 'secret/app/token' },
    });
    expect(get.ok).toBe(true);
    if (!get.ok || get.result.kind !== 'externalRef') return;
    expect(get.result.externalRef.displayLabel).toContain('secret/app/token');

    const rotate = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'rotateSecret',
      payload: { path: 'secret/app/token' },
    });
    expect(rotate.ok).toBe(true);
    if (!rotate.ok || rotate.result.kind !== 'externalRef') return;
    expect(rotate.result.externalRef.displayLabel).toContain('rotated');

    const list = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listSecrets',
      payload: { pathPrefix: 'secret/app/' },
    });
    expect(list.ok).toBe(true);
    if (!list.ok || list.result.kind !== 'externalRefs') return;
    expect(list.result.externalRefs.some((ref) => ref.displayLabel.includes('secret/app/token'))).toBe(
      true,
    );

    const deleted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'deleteSecret',
      payload: { path: 'secret/app/token' },
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok || deleted.result.kind !== 'accepted') return;
    expect(deleted.result.operation).toBe('deleteSecret');
  });

  it('supports certificate and key lifecycle operations', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT_A),
    });

    const createdCert = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCertificate',
      payload: { commonName: 'api.internal.local' },
    });
    expect(createdCert.ok).toBe(true);
    if (!createdCert.ok || createdCert.result.kind !== 'externalRef') return;
    const certificateId = createdCert.result.externalRef.externalId;

    const getCert = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getCertificate',
      payload: { certificateId },
    });
    expect(getCert.ok).toBe(true);
    if (!getCert.ok || getCert.result.kind !== 'externalRef') return;
    expect(getCert.result.externalRef.externalId).toBe(certificateId);

    const renewCert = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'renewCertificate',
      payload: { certificateId },
    });
    expect(renewCert.ok).toBe(true);
    if (!renewCert.ok || renewCert.result.kind !== 'externalRef') return;
    expect(renewCert.result.externalRef.displayLabel).toContain('renewed');

    const certs = await adapter.execute({ tenantId: TENANT_A, operation: 'listCertificates' });
    expect(certs.ok).toBe(true);
    if (!certs.ok || certs.result.kind !== 'externalRefs') return;
    expect(certs.result.externalRefs.length).toBeGreaterThan(0);

    const key = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createKey',
      payload: { keyName: 'service-key' },
    });
    expect(key.ok).toBe(true);
    if (!key.ok || key.result.kind !== 'externalRef') return;

    const keys = await adapter.execute({ tenantId: TENANT_A, operation: 'listKeys' });
    expect(keys.ok).toBe(true);
    if (!keys.ok || keys.result.kind !== 'externalRefs') return;
    expect(keys.result.externalRefs.some((ref) => ref.externalId === key.result.externalRef.externalId)).toBe(
      true,
    );
  });

  it('supports crypto, audit, and secret policy operations', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const encrypted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'encrypt',
      payload: { data: 'payload', keyRef: 'key-1000' },
    });
    expect(encrypted.ok).toBe(true);
    if (!encrypted.ok || encrypted.result.kind !== 'externalRef') return;
    expect(encrypted.result.externalRef.externalType).toBe('encrypted_payload');

    const decrypted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'decrypt',
      payload: { data: 'cipher', keyRef: 'key-1000' },
    });
    expect(decrypted.ok).toBe(true);
    if (!decrypted.ok || decrypted.result.kind !== 'externalRef') return;
    expect(decrypted.result.externalRef.externalType).toBe('decrypted_payload');

    const policy = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'setSecretPolicy',
      payload: { path: 'secret/app/api-key', policy: 'read:ops-team' },
    });
    expect(policy.ok).toBe(true);
    if (!policy.ok || policy.result.kind !== 'externalRef') return;
    expect(policy.result.externalRef.externalType).toBe('secret_policy');

    const audit = await adapter.execute({ tenantId: TENANT_A, operation: 'getAuditLog' });
    expect(audit.ok).toBe(true);
    if (!audit.ok || audit.result.kind !== 'externalRefs') return;
    expect(audit.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemorySecretsVaultingAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'getSecret',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported SecretsVaulting operation: bogusOperation.',
    });
  });
});

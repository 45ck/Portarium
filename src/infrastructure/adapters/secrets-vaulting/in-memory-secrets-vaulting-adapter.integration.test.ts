import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemorySecretsVaultingAdapter } from './in-memory-secrets-vaulting-adapter.js';

const TENANT = TenantId('tenant-integration');
const OTHER_TENANT = TenantId('tenant-other');

describe('InMemorySecretsVaultingAdapter integration', () => {
  it('supports full secret lifecycle operations', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT),
    });

    const put = await adapter.execute({
      tenantId: TENANT,
      operation: 'putSecret',
      payload: { path: 'secret/app/integration-token', value: 'token-value' },
    });
    expect(put.ok).toBe(true);
    if (!put.ok || put.result.kind !== 'externalRef') return;

    const get = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSecret',
      payload: { path: 'secret/app/integration-token' },
    });
    expect(get.ok).toBe(true);
    if (!get.ok || get.result.kind !== 'externalRef') return;
    expect(get.result.externalRef.externalId).toBe(put.result.externalRef.externalId);

    const rotate = await adapter.execute({
      tenantId: TENANT,
      operation: 'rotateSecret',
      payload: { path: 'secret/app/integration-token' },
    });
    expect(rotate.ok).toBe(true);
    if (!rotate.ok || rotate.result.kind !== 'externalRef') return;
    expect(rotate.result.externalRef.externalId).not.toBe(put.result.externalRef.externalId);

    const list = await adapter.execute({
      tenantId: TENANT,
      operation: 'listSecrets',
      payload: { pathPrefix: 'secret/app/' },
    });
    expect(list.ok).toBe(true);
    if (!list.ok || list.result.kind !== 'externalRefs') return;
    expect(
      list.result.externalRefs.some(
        (item) => (item.displayLabel ?? '').includes('secret/app/integration-token'),
      ),
    ).toBe(true);

    const deleted = await adapter.execute({
      tenantId: TENANT,
      operation: 'deleteSecret',
      payload: { path: 'secret/app/integration-token' },
    });
    expect(deleted).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'deleteSecret' },
    });
  });

  it('supports certificate, key, crypto, policy, and audit operations', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdCert = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCertificate',
      payload: { commonName: 'integration.portarium.local' },
    });
    expect(createdCert.ok).toBe(true);
    if (!createdCert.ok || createdCert.result.kind !== 'externalRef') return;
    const certificateId = createdCert.result.externalRef.externalId;

    const renewedCert = await adapter.execute({
      tenantId: TENANT,
      operation: 'renewCertificate',
      payload: { certificateId },
    });
    expect(renewedCert.ok).toBe(true);
    if (!renewedCert.ok || renewedCert.result.kind !== 'externalRef') return;
    expect(renewedCert.result.externalRef.displayLabel).toContain('renewed');

    const listedCerts = await adapter.execute({ tenantId: TENANT, operation: 'listCertificates' });
    expect(listedCerts.ok).toBe(true);
    if (!listedCerts.ok || listedCerts.result.kind !== 'externalRefs') return;
    expect(
      listedCerts.result.externalRefs.some(
        (candidate) => candidate.externalId === renewedCert.result.externalRef.externalId,
      ),
    ).toBe(true);

    const createdKey = await adapter.execute({
      tenantId: TENANT,
      operation: 'createKey',
      payload: { keyName: 'integration-signing-key' },
    });
    expect(createdKey.ok).toBe(true);
    if (!createdKey.ok || createdKey.result.kind !== 'externalRef') return;
    const keyRef = createdKey.result.externalRef.externalId;

    const encrypt = await adapter.execute({
      tenantId: TENANT,
      operation: 'encrypt',
      payload: { data: 'plain', keyRef },
    });
    expect(encrypt.ok).toBe(true);
    if (!encrypt.ok || encrypt.result.kind !== 'externalRef') return;
    expect(encrypt.result.externalRef.externalType).toBe('encrypted_payload');
    expect(encrypt.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const decrypt = await adapter.execute({
      tenantId: TENANT,
      operation: 'decrypt',
      payload: { data: 'cipher', keyRef },
    });
    expect(decrypt.ok).toBe(true);
    if (!decrypt.ok || decrypt.result.kind !== 'externalRef') return;
    expect(decrypt.result.externalRef.externalType).toBe('decrypted_payload');

    const policy = await adapter.execute({
      tenantId: TENANT,
      operation: 'setSecretPolicy',
      payload: { path: 'secret/app/api-key', policy: 'read:security-team' },
    });
    expect(policy.ok).toBe(true);
    if (!policy.ok || policy.result.kind !== 'externalRef') return;
    expect(policy.result.externalRef.externalType).toBe('secret_policy');

    const audit = await adapter.execute({ tenantId: TENANT, operation: 'getAuditLog' });
    expect(audit.ok).toBe(true);
    if (!audit.ok || audit.result.kind !== 'externalRefs') return;
    expect(audit.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('keeps data tenant scoped', async () => {
    const tenantSeed = InMemorySecretsVaultingAdapter.seedMinimal(TENANT);
    const otherSeed = InMemorySecretsVaultingAdapter.seedMinimal(OTHER_TENANT);
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: {
        secrets: [...tenantSeed.secrets!, ...otherSeed.secrets!],
        certificates: [...tenantSeed.certificates!, ...otherSeed.certificates!],
        keys: [...tenantSeed.keys!, ...otherSeed.keys!],
        auditLogs: [...tenantSeed.auditLogs!, ...otherSeed.auditLogs!],
      },
    });

    const tenantSecrets = await adapter.execute({ tenantId: TENANT, operation: 'listSecrets' });
    expect(tenantSecrets.ok).toBe(true);
    if (!tenantSecrets.ok || tenantSecrets.result.kind !== 'externalRefs') return;
    expect(tenantSecrets.result.externalRefs).toHaveLength(1);

    const otherSecrets = await adapter.execute({ tenantId: OTHER_TENANT, operation: 'listSecrets' });
    expect(otherSecrets.ok).toBe(true);
    if (!otherSecrets.ok || otherSecrets.result.kind !== 'externalRefs') return;
    expect(otherSecrets.result.externalRefs).toHaveLength(1);

    const createdOtherCert = await adapter.execute({
      tenantId: OTHER_TENANT,
      operation: 'createCertificate',
      payload: { commonName: 'other.portarium.local' },
    });
    expect(createdOtherCert.ok).toBe(true);
    if (!createdOtherCert.ok || createdOtherCert.result.kind !== 'externalRef') return;

    const getOtherCertFromTenant = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCertificate',
      payload: { certificateId: createdOtherCert.result.externalRef.externalId },
    });
    expect(getOtherCertFromTenant).toEqual({
      ok: false,
      error: 'not_found',
      message: `Certificate ${createdOtherCert.result.externalRef.externalId} was not found.`,
    });
  });

  it('returns validation errors for missing required payload fields', async () => {
    const adapter = new InMemorySecretsVaultingAdapter({
      seed: InMemorySecretsVaultingAdapter.seedMinimal(TENANT),
    });

    const getMissingPath = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSecret',
    });
    expect(getMissingPath).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'path is required for getSecret.',
    });

    const encryptMissingKeyRef = await adapter.execute({
      tenantId: TENANT,
      operation: 'encrypt',
      payload: { data: 'plain' },
    });
    expect(encryptMissingKeyRef).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'keyRef is required for encrypt.',
    });

    const policyMissingPolicy = await adapter.execute({
      tenantId: TENANT,
      operation: 'setSecretPolicy',
      payload: { path: 'secret/app/api-key' },
    });
    expect(policyMissingPolicy).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'policy is required for setSecretPolicy.',
    });
  });
});

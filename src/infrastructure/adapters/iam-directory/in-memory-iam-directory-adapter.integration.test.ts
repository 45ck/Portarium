import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryIamDirectoryAdapter } from './in-memory-iam-directory-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryIamDirectoryAdapter integration', () => {
  it('supports user lifecycle operations', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createUser',
      payload: { displayName: 'Integration User', email: 'integration@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const partyId = created.result.party.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateUser',
      payload: { partyId, displayName: 'Integration User Updated' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Integration User Updated');

    const deactivated = await adapter.execute({
      tenantId: TENANT,
      operation: 'deactivateUser',
      payload: { partyId },
    });
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok || deactivated.result.kind !== 'party') return;
    expect(deactivated.result.party.roles).toContain('inactive');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listUsers' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'parties') return;
    expect(listed.result.parties.some((party) => party.partyId === partyId)).toBe(true);
  });

  it('supports group creation and membership assignment operations', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT),
    });

    const group = await adapter.execute({
      tenantId: TENANT,
      operation: 'createGroup',
      payload: { name: 'Security' },
    });
    expect(group.ok).toBe(true);
    if (!group.ok || group.result.kind !== 'externalRef') return;
    const groupId = group.result.externalRef.externalId;

    const addMembership = await adapter.execute({
      tenantId: TENANT,
      operation: 'addUserToGroup',
      payload: { userId: 'user-1000', groupId },
    });
    expect(addMembership.ok).toBe(true);
    if (!addMembership.ok || addMembership.result.kind !== 'accepted') return;

    const removeMembership = await adapter.execute({
      tenantId: TENANT,
      operation: 'removeUserFromGroup',
      payload: { userId: 'user-1000', groupId },
    });
    expect(removeMembership.ok).toBe(true);
    if (!removeMembership.ok || removeMembership.result.kind !== 'accepted') return;

    const listedGroups = await adapter.execute({ tenantId: TENANT, operation: 'listGroups' });
    expect(listedGroups.ok).toBe(true);
    if (!listedGroups.ok || listedGroups.result.kind !== 'externalRefs') return;
    expect(listedGroups.result.externalRefs.some((ref) => ref.externalId === groupId)).toBe(true);
  });

  it('supports role, application, auth, MFA, and audit flows', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const roles = await adapter.execute({ tenantId: TENANT, operation: 'listRoles' });
    expect(roles.ok).toBe(true);
    if (!roles.ok || roles.result.kind !== 'externalRefs') return;
    const roleId = roles.result.externalRefs[0]!.externalId;

    const assigned = await adapter.execute({
      tenantId: TENANT,
      operation: 'assignRole',
      payload: { userId: 'user-1000', roleId },
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok || assigned.result.kind !== 'accepted') return;

    const revoked = await adapter.execute({
      tenantId: TENANT,
      operation: 'revokeRole',
      payload: { userId: 'user-1000', roleId },
    });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok || revoked.result.kind !== 'accepted') return;

    const apps = await adapter.execute({ tenantId: TENANT, operation: 'listApplications' });
    expect(apps.ok).toBe(true);
    if (!apps.ok || apps.result.kind !== 'externalRefs') return;
    const applicationId = apps.result.externalRefs[0]!.externalId;

    const app = await adapter.execute({
      tenantId: TENANT,
      operation: 'getApplication',
      payload: { applicationId },
    });
    expect(app.ok).toBe(true);
    if (!app.ok || app.result.kind !== 'externalRef') return;
    expect(app.result.externalRef.externalId).toBe(applicationId);

    const auth = await adapter.execute({
      tenantId: TENANT,
      operation: 'authenticateUser',
      payload: { username: 'user@example.com' },
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok || auth.result.kind !== 'externalRef') return;
    expect(auth.result.externalRef.displayLabel).toContain('2026-02-19T00:00:00.000Z');

    const mfa = await adapter.execute({
      tenantId: TENANT,
      operation: 'verifyMFA',
      payload: { userId: 'user-1000', factor: 'totp' },
    });
    expect(mfa.ok).toBe(true);
    if (!mfa.ok || mfa.result.kind !== 'externalRef') return;
    expect(mfa.result.externalRef.displayLabel).toContain('2026-02-19T00:00:00.000Z');

    const auditLogs = await adapter.execute({ tenantId: TENANT, operation: 'listAuditLogs' });
    expect(auditLogs.ok).toBe(true);
    if (!auditLogs.ok || auditLogs.result.kind !== 'externalRefs') return;
    expect(auditLogs.result.externalRefs).toHaveLength(1);
  });

  it('returns validation errors for missing required payload fields', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT),
    });

    const missingUserId = await adapter.execute({
      tenantId: TENANT,
      operation: 'verifyMFA',
      payload: { factor: 'totp' },
    });
    expect(missingUserId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'userId is required for verifyMFA.',
    });

    const missingRoleId = await adapter.execute({
      tenantId: TENANT,
      operation: 'assignRole',
      payload: { userId: 'user-1000' },
    });
    expect(missingRoleId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'roleId is required for assignRole.',
    });
  });
});

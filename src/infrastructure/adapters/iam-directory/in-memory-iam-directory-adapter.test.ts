import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryIamDirectoryAdapter } from './in-memory-iam-directory-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryIamDirectoryAdapter', () => {
  it('returns tenant-scoped users', async () => {
    const seedA = InMemoryIamDirectoryAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryIamDirectoryAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: {
        ...seedA,
        users: [...seedA.users!, ...seedB.users!],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listUsers' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'parties') return;
    expect(result.result.parties).toHaveLength(1);
    expect(result.result.parties[0]?.tenantId).toBe(TENANT_A);
  });

  it('creates, updates, fetches, and deactivates users', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createUser',
      payload: { displayName: 'Alice Operator', email: 'alice@example.com' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'party') return;
    const partyId = created.result.party.partyId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateUser',
      payload: { partyId, displayName: 'Alice Ops' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'party') return;
    expect(updated.result.party.displayName).toBe('Alice Ops');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getUser',
      payload: { partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'party') return;
    expect(fetched.result.party.partyId).toBe(partyId);

    const deactivated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'deactivateUser',
      payload: { partyId },
    });
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok || deactivated.result.kind !== 'party') return;
    expect(deactivated.result.party.roles).toContain('inactive');
  });

  it('supports group list/get/create and membership operations', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT_A),
    });

    const groups = await adapter.execute({ tenantId: TENANT_A, operation: 'listGroups' });
    expect(groups.ok).toBe(true);
    if (!groups.ok || groups.result.kind !== 'externalRefs') return;
    expect(groups.result.externalRefs).toHaveLength(1);

    const group = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getGroup',
      payload: { groupId: groups.result.externalRefs[0]!.externalId },
    });
    expect(group.ok).toBe(true);
    if (!group.ok || group.result.kind !== 'externalRef') return;
    expect(group.result.externalRef.externalType).toBe('group');

    const createdGroup = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createGroup',
      payload: { name: 'SRE' },
    });
    expect(createdGroup.ok).toBe(true);
    if (!createdGroup.ok || createdGroup.result.kind !== 'externalRef') return;

    const addMembership = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addUserToGroup',
      payload: { userId: 'user-1000', groupId: createdGroup.result.externalRef.externalId },
    });
    expect(addMembership.ok).toBe(true);
    if (!addMembership.ok || addMembership.result.kind !== 'accepted') return;
    expect(addMembership.result.operation).toBe('addUserToGroup');

    const removeMembership = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'removeUserFromGroup',
      payload: { userId: 'user-1000', groupId: createdGroup.result.externalRef.externalId },
    });
    expect(removeMembership.ok).toBe(true);
    if (!removeMembership.ok || removeMembership.result.kind !== 'accepted') return;
    expect(removeMembership.result.operation).toBe('removeUserFromGroup');
  });

  it('supports role, application, auth, MFA, and audit operations', async () => {
    const adapter = new InMemoryIamDirectoryAdapter({
      seed: InMemoryIamDirectoryAdapter.seedMinimal(TENANT_A),
    });

    const roles = await adapter.execute({ tenantId: TENANT_A, operation: 'listRoles' });
    expect(roles.ok).toBe(true);
    if (!roles.ok || roles.result.kind !== 'externalRefs') return;
    const roleId = roles.result.externalRefs[0]!.externalId;

    const assignRole = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assignRole',
      payload: { userId: 'user-1000', roleId },
    });
    expect(assignRole.ok).toBe(true);
    if (!assignRole.ok || assignRole.result.kind !== 'accepted') return;

    const revokeRole = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'revokeRole',
      payload: { userId: 'user-1000', roleId },
    });
    expect(revokeRole.ok).toBe(true);
    if (!revokeRole.ok || revokeRole.result.kind !== 'accepted') return;

    const applications = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listApplications',
    });
    expect(applications.ok).toBe(true);
    if (!applications.ok || applications.result.kind !== 'externalRefs') return;
    const applicationId = applications.result.externalRefs[0]!.externalId;

    const application = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getApplication',
      payload: { applicationId },
    });
    expect(application.ok).toBe(true);
    if (!application.ok || application.result.kind !== 'externalRef') return;
    expect(application.result.externalRef.externalId).toBe(applicationId);

    const auth = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'authenticateUser',
      payload: { username: 'user@example.com' },
    });
    expect(auth.ok).toBe(true);
    if (!auth.ok || auth.result.kind !== 'externalRef') return;
    expect(auth.result.externalRef.externalType).toBe('auth_session');

    const mfa = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'verifyMFA',
      payload: { userId: 'user-1000', factor: 'totp' },
    });
    expect(mfa.ok).toBe(true);
    if (!mfa.ok || mfa.result.kind !== 'externalRef') return;
    expect(mfa.result.externalRef.externalType).toBe('mfa_verification');

    const auditLogs = await adapter.execute({ tenantId: TENANT_A, operation: 'listAuditLogs' });
    expect(auditLogs.ok).toBe(true);
    if (!auditLogs.ok || auditLogs.result.kind !== 'externalRefs') return;
    expect(auditLogs.result.externalRefs).toHaveLength(1);
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryIamDirectoryAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listUsers',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported IamDirectory operation: bogusOperation.',
    });
  });
});

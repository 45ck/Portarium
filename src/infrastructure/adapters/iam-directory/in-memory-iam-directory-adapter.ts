import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { PartyId } from '../../../domain/primitives/index.js';
import type {
  IamDirectoryAdapterPort,
  IamDirectoryExecuteInputV1,
  IamDirectoryExecuteOutputV1,
} from '../../../application/ports/iam-directory-adapter.js';
import { IAM_DIRECTORY_OPERATIONS_V1 } from '../../../application/ports/iam-directory-adapter.js';

const OPERATION_SET = new Set<string>(IAM_DIRECTORY_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: IamDirectoryExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type TenantGroupMembership = Readonly<{
  tenantId: IamDirectoryExecuteInputV1['tenantId'];
  userId: string;
  groupId: string;
}>;

type TenantRoleAssignment = Readonly<{
  tenantId: IamDirectoryExecuteInputV1['tenantId'];
  userId: string;
  roleId: string;
}>;

type InMemoryIamDirectoryAdapterSeed = Readonly<{
  users?: readonly PartyV1[];
  groups?: readonly TenantExternalRef[];
  roles?: readonly TenantExternalRef[];
  applications?: readonly TenantExternalRef[];
  auditLogs?: readonly TenantExternalRef[];
  groupMemberships?: readonly TenantGroupMembership[];
  roleAssignments?: readonly TenantRoleAssignment[];
}>;

type InMemoryIamDirectoryAdapterParams = Readonly<{
  seed?: InMemoryIamDirectoryAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemoryIamDirectoryAdapter implements IamDirectoryAdapterPort {
  readonly #now: () => Date;
  readonly #users: PartyV1[];
  readonly #groups: TenantExternalRef[];
  readonly #roles: TenantExternalRef[];
  readonly #applications: TenantExternalRef[];
  readonly #auditLogs: TenantExternalRef[];
  readonly #groupMemberships: TenantGroupMembership[];
  readonly #roleAssignments: TenantRoleAssignment[];
  #userSequence: number;
  #groupSequence: number;
  #authSequence: number;
  #mfaSequence: number;

  public constructor(params?: InMemoryIamDirectoryAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#users = [...(params?.seed?.users ?? [])];
    this.#groups = [...(params?.seed?.groups ?? [])];
    this.#roles = [...(params?.seed?.roles ?? [])];
    this.#applications = [...(params?.seed?.applications ?? [])];
    this.#auditLogs = [...(params?.seed?.auditLogs ?? [])];
    this.#groupMemberships = [...(params?.seed?.groupMemberships ?? [])];
    this.#roleAssignments = [...(params?.seed?.roleAssignments ?? [])];
    this.#userSequence = this.#users.length;
    this.#groupSequence = this.#groups.length;
    this.#authSequence = 0;
    this.#mfaSequence = 0;
  }

  public async execute(input: IamDirectoryExecuteInputV1): Promise<IamDirectoryExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported IamDirectory operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listUsers':
        return { ok: true, result: { kind: 'parties', parties: this.#listUsers(input) } };
      case 'getUser':
        return this.#getUser(input);
      case 'createUser':
        return this.#createUser(input);
      case 'updateUser':
        return this.#updateUser(input);
      case 'deactivateUser':
        return this.#deactivateUser(input);
      case 'listGroups':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listGroups(input) },
        };
      case 'getGroup':
        return this.#getGroup(input);
      case 'createGroup':
        return this.#createGroup(input);
      case 'addUserToGroup':
        return this.#addUserToGroup(input);
      case 'removeUserFromGroup':
        return this.#removeUserFromGroup(input);
      case 'listRoles':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: this.#listRoles(input) } };
      case 'assignRole':
        return this.#assignRole(input);
      case 'revokeRole':
        return this.#revokeRole(input);
      case 'listApplications':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listApplications(input) },
        };
      case 'getApplication':
        return this.#getApplication(input);
      case 'authenticateUser':
        return this.#authenticateUser(input);
      case 'verifyMFA':
        return this.#verifyMfa(input);
      case 'listAuditLogs':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listAuditLogs(input) },
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported IamDirectory operation: ${String(input.operation)}.`,
        };
    }
  }

  #listUsers(input: IamDirectoryExecuteInputV1): readonly PartyV1[] {
    return this.#users.filter((user) => user.tenantId === input.tenantId);
  }

  #getUser(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getUser.' };
    }
    const user = this.#users.find(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${partyId} was not found.` };
    }
    return { ok: true, result: { kind: 'party', party: user } };
  }

  #createUser(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createUser.',
      };
    }

    const user: PartyV1 = {
      partyId: PartyId(`user-${++this.#userSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['user'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#users.push(user);
    return { ok: true, result: { kind: 'party', party: user } };
  }

  #updateUser(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for updateUser.',
      };
    }

    const index = this.#users.findIndex(
      (user) => user.tenantId === input.tenantId && user.partyId === partyId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `User ${partyId} was not found.` };
    }

    const updated: PartyV1 = {
      ...this.#users[index]!,
      ...(typeof input.payload?.['displayName'] === 'string'
        ? { displayName: input.payload['displayName'] }
        : {}),
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#users[index] = updated;
    return { ok: true, result: { kind: 'party', party: updated } };
  }

  #deactivateUser(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for deactivateUser.',
      };
    }

    const index = this.#users.findIndex(
      (user) => user.tenantId === input.tenantId && user.partyId === partyId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `User ${partyId} was not found.` };
    }

    const current = this.#users[index]!;
    const roles = [...new Set([...current.roles, 'inactive'])];
    const updated: PartyV1 = { ...current, roles };
    this.#users[index] = updated;
    return { ok: true, result: { kind: 'party', party: updated } };
  }

  #listGroups(input: IamDirectoryExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#listTenantRefs(this.#groups, input);
  }

  #getGroup(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    return this.#getTenantRef(input, this.#groups, 'groupId', 'Group');
  }

  #createGroup(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createGroup.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'DirectorySuite',
      portFamily: 'IamDirectory',
      externalId: `group-${++this.#groupSequence}`,
      externalType: 'group',
      displayLabel: name,
    };
    this.#groups.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #addUserToGroup(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for addUserToGroup.',
      };
    }
    const groupId = readString(input.payload, 'groupId');
    if (groupId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'groupId is required for addUserToGroup.',
      };
    }

    const user = this.#users.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === userId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${userId} was not found.` };
    }
    const group = this.#groups.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === groupId,
    );
    if (group === undefined) {
      return { ok: false, error: 'not_found', message: `Group ${groupId} was not found.` };
    }

    const exists = this.#groupMemberships.some(
      (membership) =>
        membership.tenantId === input.tenantId &&
        membership.userId === userId &&
        membership.groupId === groupId,
    );
    if (!exists) {
      this.#groupMemberships.push({ tenantId: input.tenantId, userId, groupId });
    }
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #removeUserFromGroup(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for removeUserFromGroup.',
      };
    }
    const groupId = readString(input.payload, 'groupId');
    if (groupId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'groupId is required for removeUserFromGroup.',
      };
    }

    const index = this.#groupMemberships.findIndex(
      (membership) =>
        membership.tenantId === input.tenantId &&
        membership.userId === userId &&
        membership.groupId === groupId,
    );
    if (index < 0) {
      return {
        ok: false,
        error: 'not_found',
        message: `Group membership for user ${userId} and group ${groupId} was not found.`,
      };
    }
    this.#groupMemberships.splice(index, 1);
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #listRoles(input: IamDirectoryExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#listTenantRefs(this.#roles, input);
  }

  #assignRole(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for assignRole.',
      };
    }
    const roleId = readString(input.payload, 'roleId');
    if (roleId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'roleId is required for assignRole.',
      };
    }

    const user = this.#users.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === userId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${userId} was not found.` };
    }
    const role = this.#roles.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === roleId,
    );
    if (role === undefined) {
      return { ok: false, error: 'not_found', message: `Role ${roleId} was not found.` };
    }

    const exists = this.#roleAssignments.some(
      (assignment) =>
        assignment.tenantId === input.tenantId &&
        assignment.userId === userId &&
        assignment.roleId === roleId,
    );
    if (!exists) {
      this.#roleAssignments.push({ tenantId: input.tenantId, userId, roleId });
    }
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #revokeRole(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for revokeRole.',
      };
    }
    const roleId = readString(input.payload, 'roleId');
    if (roleId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'roleId is required for revokeRole.',
      };
    }

    const index = this.#roleAssignments.findIndex(
      (assignment) =>
        assignment.tenantId === input.tenantId &&
        assignment.userId === userId &&
        assignment.roleId === roleId,
    );
    if (index < 0) {
      return {
        ok: false,
        error: 'not_found',
        message: `Role assignment for user ${userId} and role ${roleId} was not found.`,
      };
    }
    this.#roleAssignments.splice(index, 1);
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #listApplications(input: IamDirectoryExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#listTenantRefs(this.#applications, input);
  }

  #getApplication(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    return this.#getTenantRef(input, this.#applications, 'applicationId', 'Application');
  }

  #authenticateUser(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const username = readString(input.payload, 'username');
    if (username === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'username is required for authenticateUser.',
      };
    }

    const user = this.#users.find(
      (candidate) =>
        candidate.tenantId === input.tenantId &&
        (candidate.email === username || candidate.partyId === username),
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${username} was not found.` };
    }

    const issuedAtIso = this.#now().toISOString();
    const externalRef: ExternalObjectRef = {
      sorName: 'DirectorySuite',
      portFamily: 'IamDirectory',
      externalId: `auth-${++this.#authSequence}`,
      externalType: 'auth_session',
      displayLabel: `${user.displayName} authenticated at ${issuedAtIso}`,
      deepLinkUrl: `https://directory.example/sessions/${this.#authSequence}?issuedAt=${encodeURIComponent(issuedAtIso)}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #verifyMfa(input: IamDirectoryExecuteInputV1): IamDirectoryExecuteOutputV1 {
    const userId = readString(input.payload, 'userId');
    if (userId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'userId is required for verifyMFA.',
      };
    }
    const factor = readString(input.payload, 'factor');
    if (factor === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'factor is required for verifyMFA.',
      };
    }

    const user = this.#users.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === userId,
    );
    if (user === undefined) {
      return { ok: false, error: 'not_found', message: `User ${userId} was not found.` };
    }

    const verifiedAtIso = this.#now().toISOString();
    const externalRef: ExternalObjectRef = {
      sorName: 'DirectorySuite',
      portFamily: 'IamDirectory',
      externalId: `mfa-${++this.#mfaSequence}`,
      externalType: 'mfa_verification',
      displayLabel: `MFA verified with ${factor} at ${verifiedAtIso}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listAuditLogs(input: IamDirectoryExecuteInputV1): readonly ExternalObjectRef[] {
    return this.#listTenantRefs(this.#auditLogs, input);
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: IamDirectoryExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((item) => item.tenantId === input.tenantId)
      .map((item) => item.externalRef);
  }

  #getTenantRef(
    input: IamDirectoryExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
  ): IamDirectoryExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for get${label}.`,
      };
    }
    const ref = source.find(
      (item) => item.tenantId === input.tenantId && item.externalRef.externalId === externalId,
    );
    if (ref === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: ref.externalRef } };
  }

  public static seedMinimal(
    tenantId: IamDirectoryExecuteInputV1['tenantId'],
  ): InMemoryIamDirectoryAdapterSeed {
    return {
      users: [
        {
          partyId: PartyId('user-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Directory User',
          email: 'user@example.com',
          roles: ['user'],
        },
      ],
      groups: [
        {
          tenantId,
          externalRef: {
            sorName: 'DirectorySuite',
            portFamily: 'IamDirectory',
            externalId: 'group-1000',
            externalType: 'group',
            displayLabel: 'Engineering',
          },
        },
      ],
      roles: [
        {
          tenantId,
          externalRef: {
            sorName: 'DirectorySuite',
            portFamily: 'IamDirectory',
            externalId: 'role-1000',
            externalType: 'role',
            displayLabel: 'WorkspaceAdmin',
          },
        },
      ],
      applications: [
        {
          tenantId,
          externalRef: {
            sorName: 'DirectorySuite',
            portFamily: 'IamDirectory',
            externalId: 'app-1000',
            externalType: 'application',
            displayLabel: 'Ops Cockpit',
          },
        },
      ],
      auditLogs: [
        {
          tenantId,
          externalRef: {
            sorName: 'DirectorySuite',
            portFamily: 'IamDirectory',
            externalId: 'audit-1000',
            externalType: 'audit_log',
            displayLabel: 'User login success',
          },
        },
      ],
      groupMemberships: [
        {
          tenantId,
          userId: 'user-1000',
          groupId: 'group-1000',
        },
      ],
      roleAssignments: [
        {
          tenantId,
          userId: 'user-1000',
          roleId: 'role-1000',
        },
      ],
    };
  }
}

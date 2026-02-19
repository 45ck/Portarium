import {
  TenantId,
  UserId,
  WorkforceMemberId,
  WorkforceQueueId,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
  type WorkspaceUserRole,
  type WorkforceMemberId as WorkforceMemberIdType,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import type { WorkspaceUserV1 } from '../users/workspace-user-v1.js';
import {
  readIsoString,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const WORKFORCE_MEMBER_EVENTS = {
  Registered: 'WorkforceMemberRegistered',
  CapabilityUpdated: 'WorkforceMemberCapabilityUpdated',
  AvailabilityChanged: 'WorkforceMemberAvailabilityChanged',
} as const;

const WORKFORCE_AVAILABILITY_STATUSES = ['available', 'busy', 'offline'] as const;
const WORKFORCE_CAPABILITY_VOCAB = [
  'operations.dispatch',
  'operations.approval',
  'operations.escalation',
  'robotics.supervision',
  'robotics.safety.override',
] as const;

export type WorkforceAvailabilityStatus = (typeof WORKFORCE_AVAILABILITY_STATUSES)[number];
export type WorkforceCapability = (typeof WORKFORCE_CAPABILITY_VOCAB)[number];

export type WorkforceMemberV1 = Readonly<{
  schemaVersion: 1;
  workforceMemberId: WorkforceMemberIdType;
  linkedUserId: UserIdType;
  displayName: string;
  capabilities: readonly WorkforceCapability[];
  availabilityStatus: WorkforceAvailabilityStatus;
  queueMemberships: readonly WorkforceQueueIdType[];
  tenantId: TenantIdType;
  createdAtIso: string;
  updatedAtIso?: string;
}>;

export class WorkforceMemberParseError extends Error {
  public override readonly name = 'WorkforceMemberParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkforceMemberV1(value: unknown): WorkforceMemberV1 {
  const record = readRecord(value, 'WorkforceMember', WorkforceMemberParseError);
  if (record['schemaVersion'] !== 1) {
    throw new WorkforceMemberParseError('WorkforceMember.schemaVersion must be 1.');
  }

  const queueMemberships = parseQueueMemberships(record['queueMemberships']);
  const capabilities = parseCapabilities(record['capabilities']);
  const updatedAtIso = readOptionalIsoString(record, 'updatedAtIso', WorkforceMemberParseError);

  return {
    schemaVersion: 1,
    workforceMemberId: WorkforceMemberId(
      readString(record, 'workforceMemberId', WorkforceMemberParseError),
    ),
    linkedUserId: UserId(readString(record, 'linkedUserId', WorkforceMemberParseError)),
    displayName: readString(record, 'displayName', WorkforceMemberParseError),
    capabilities,
    availabilityStatus: parseAvailabilityStatus(
      readString(record, 'availabilityStatus', WorkforceMemberParseError),
    ),
    queueMemberships,
    tenantId: TenantId(readString(record, 'tenantId', WorkforceMemberParseError)),
    createdAtIso: readIsoString(record, 'createdAtIso', WorkforceMemberParseError),
    ...(updatedAtIso ? { updatedAtIso } : {}),
  };
}

export function assertLinkedWorkspaceUserActive(
  member: WorkforceMemberV1,
  workspaceUser: WorkspaceUserV1,
): void {
  if (workspaceUser.userId !== member.linkedUserId) {
    throw new WorkforceMemberParseError('WorkforceMember.linkedUserId must reference WorkspaceUser.userId.');
  }
  if (!workspaceUser.active) {
    throw new WorkforceMemberParseError('WorkforceMember must link to an active WorkspaceUser.');
  }
}

export function updateWorkforceMemberCapabilitiesV1(params: {
  member: WorkforceMemberV1;
  nextCapabilities: readonly WorkforceCapability[];
  actorRole: WorkspaceUserRole;
  updatedAtIso: string;
}): WorkforceMemberV1 {
  if (params.actorRole !== 'admin') {
    throw new WorkforceMemberParseError('Capabilities can only be updated by admin role.');
  }

  return {
    ...params.member,
    capabilities: dedupeCapabilities(params.nextCapabilities),
    updatedAtIso: readIsoString({ updatedAtIso: params.updatedAtIso }, 'updatedAtIso', WorkforceMemberParseError),
  };
}

export function updateWorkforceMemberAvailabilityV1(params: {
  member: WorkforceMemberV1;
  nextStatus: WorkforceAvailabilityStatus;
  actorUserId: UserIdType;
  updatedAtIso: string;
}): WorkforceMemberV1 {
  if (params.actorUserId !== params.member.linkedUserId) {
    throw new WorkforceMemberParseError('Availability is self-managed by the linked user only.');
  }

  return {
    ...params.member,
    availabilityStatus: params.nextStatus,
    updatedAtIso: readIsoString({ updatedAtIso: params.updatedAtIso }, 'updatedAtIso', WorkforceMemberParseError),
  };
}

function parseCapabilities(value: unknown): readonly WorkforceCapability[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new WorkforceMemberParseError('capabilities must be a non-empty array.');
  }

  const parsed = value.map((raw, i) => {
    return parseWorkforceCapabilityV1(raw, `capabilities[${i}]`, WorkforceMemberParseError);
  });

  return dedupeCapabilities(parsed);
}

export function parseWorkforceCapabilityV1<E extends Error>(
  raw: unknown,
  pathLabel: string,
  ErrorType: new (message: string) => E,
): WorkforceCapability {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ErrorType(`${pathLabel} must be a non-empty string.`);
  }
  if (!(WORKFORCE_CAPABILITY_VOCAB as readonly string[]).includes(raw)) {
    throw new ErrorType(
      `${pathLabel} must be in controlled vocab: ${WORKFORCE_CAPABILITY_VOCAB.join(', ')}.`,
    );
  }
  return raw as WorkforceCapability;
}

function dedupeCapabilities(value: readonly WorkforceCapability[]): readonly WorkforceCapability[] {
  return [...new Set(value)];
}

function parseAvailabilityStatus(value: string): WorkforceAvailabilityStatus {
  if ((WORKFORCE_AVAILABILITY_STATUSES as readonly string[]).includes(value)) {
    return value as WorkforceAvailabilityStatus;
  }
  throw new WorkforceMemberParseError(
    `availabilityStatus must be one of: ${WORKFORCE_AVAILABILITY_STATUSES.join(', ')}.`,
  );
}

function parseQueueMemberships(value: unknown): readonly WorkforceQueueIdType[] {
  if (!Array.isArray(value)) {
    throw new WorkforceMemberParseError('queueMemberships must be an array.');
  }

  const entries: readonly unknown[] = value;
  const out: WorkforceQueueIdType[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const raw = entries[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new WorkforceMemberParseError(`queueMemberships[${i}] must be a non-empty string.`);
    }
    if (!seen.has(raw)) {
      out.push(WorkforceQueueId(raw));
      seen.add(raw);
    }
  }
  return out;
}

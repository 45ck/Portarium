import {
  TenantId,
  WorkforceMemberId,
  WorkforceQueueId,
  type TenantId as TenantIdType,
  type WorkforceMemberId as WorkforceMemberIdType,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import { readRecord, readString } from '../validation/parse-utils.js';
import type { HumanTaskV1 } from './human-task-v1.js';
import type { WorkforceCapability, WorkforceMemberV1 } from './workforce-member-v1.js';
import { parseWorkforceCapabilityV1 } from './workforce-member-v1.js';

const ROUTING_STRATEGIES = ['round-robin', 'least-busy', 'manual'] as const;
type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];

export const WORKFORCE_QUEUE_EVENTS = {
  Created: 'WorkforceQueueCreated',
  MemberAdded: 'WorkforceQueueMemberAdded',
  HumanTaskQueued: 'HumanTaskQueued',
} as const;

export type WorkforceQueueV1 = Readonly<{
  schemaVersion: 1;
  workforceQueueId: WorkforceQueueIdType;
  name: string;
  requiredCapabilities: readonly WorkforceCapability[];
  memberIds: readonly WorkforceMemberIdType[];
  routingStrategy: RoutingStrategy;
  tenantId: TenantIdType;
}>;

export type WorkforceQueueRouteResultV1 = Readonly<{
  stayedPending: boolean;
  selectedMemberId?: WorkforceMemberIdType;
}>;

export class WorkforceQueueParseError extends Error {
  public override readonly name = 'WorkforceQueueParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkforceQueueV1(value: unknown): WorkforceQueueV1 {
  const record = readRecord(value, 'WorkforceQueue', WorkforceQueueParseError);
  if (record['schemaVersion'] !== 1) {
    throw new WorkforceQueueParseError('WorkforceQueue.schemaVersion must be 1.');
  }

  return {
    schemaVersion: 1,
    workforceQueueId: WorkforceQueueId(
      readString(record, 'workforceQueueId', WorkforceQueueParseError),
    ),
    name: readString(record, 'name', WorkforceQueueParseError),
    requiredCapabilities: parseCapabilities(record['requiredCapabilities']),
    memberIds: parseMemberIds(record['memberIds']),
    routingStrategy: parseRoutingStrategy(
      readString(record, 'routingStrategy', WorkforceQueueParseError),
    ),
    tenantId: TenantId(readString(record, 'tenantId', WorkforceQueueParseError)),
  };
}

export function validateTaskCanQueueV1(queue: WorkforceQueueV1, task: HumanTaskV1): void {
  for (const cap of task.requiredCapabilities) {
    if (!queue.requiredCapabilities.includes(cap)) {
      throw new WorkforceQueueParseError(
        `Task capability '${cap}' is not covered by queue requiredCapabilities.`,
      );
    }
  }
}

export function routeHumanTaskToQueueV1(params: {
  queue: WorkforceQueueV1;
  task: HumanTaskV1;
  members: readonly WorkforceMemberV1[];
  lastAssignedMemberId?: WorkforceMemberIdType;
  activeAssignmentsByMember?: Readonly<Record<string, number>>;
}): WorkforceQueueRouteResultV1 {
  validateTaskCanQueueV1(params.queue, params.task);

  const available = params.members.filter(
    (m) =>
      params.queue.memberIds.includes(m.workforceMemberId) && m.availabilityStatus === 'available',
  );

  if (available.length === 0 || params.queue.routingStrategy === 'manual') {
    return { stayedPending: true };
  }

  if (params.queue.routingStrategy === 'least-busy') {
    const selected = chooseLeastBusy(available, params.activeAssignmentsByMember ?? {});
    return { stayedPending: false, selectedMemberId: selected.workforceMemberId };
  }

  const selected = chooseRoundRobin(available, params.lastAssignedMemberId);
  return { stayedPending: false, selectedMemberId: selected.workforceMemberId };
}

function chooseRoundRobin(
  available: readonly WorkforceMemberV1[],
  lastAssignedMemberId: WorkforceMemberIdType | undefined,
): WorkforceMemberV1 {
  if (!lastAssignedMemberId) return available[0]!;
  const idx = available.findIndex((m) => m.workforceMemberId === lastAssignedMemberId);
  if (idx === -1 || idx === available.length - 1) return available[0]!;
  return available[idx + 1]!;
}

function chooseLeastBusy(
  available: readonly WorkforceMemberV1[],
  activeAssignmentsByMember: Readonly<Record<string, number>>,
): WorkforceMemberV1 {
  let best = available[0]!;
  let bestLoad = activeAssignmentsByMember[best.workforceMemberId] ?? 0;
  for (let i = 1; i < available.length; i += 1) {
    const candidate = available[i]!;
    const load = activeAssignmentsByMember[candidate.workforceMemberId] ?? 0;
    if (load < bestLoad) {
      best = candidate;
      bestLoad = load;
    }
  }
  return best;
}

function parseCapabilities(value: unknown): readonly WorkforceCapability[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new WorkforceQueueParseError('requiredCapabilities must be a non-empty array.');
  }
  return [
    ...new Set(
      value.map((entry, i) =>
        parseWorkforceCapabilityV1(entry, `requiredCapabilities[${i}]`, WorkforceQueueParseError),
      ),
    ),
  ];
}

function parseMemberIds(value: unknown): readonly WorkforceMemberIdType[] {
  if (!Array.isArray(value)) {
    throw new WorkforceQueueParseError('memberIds must be an array.');
  }
  const entries: readonly unknown[] = value;
  const out: WorkforceMemberIdType[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const raw = entries[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new WorkforceQueueParseError(`memberIds[${i}] must be a non-empty string.`);
    }
    if (!seen.has(raw)) {
      seen.add(raw);
      out.push(WorkforceMemberId(raw));
    }
  }
  return out;
}

function parseRoutingStrategy(value: string): RoutingStrategy {
  if ((ROUTING_STRATEGIES as readonly string[]).includes(value)) {
    return value as RoutingStrategy;
  }
  throw new WorkforceQueueParseError(
    `routingStrategy must be one of: ${ROUTING_STRATEGIES.join(', ')}.`,
  );
}

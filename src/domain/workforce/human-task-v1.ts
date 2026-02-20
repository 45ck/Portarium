import {
  ActionId,
  EvidenceId,
  HumanTaskId,
  RunId,
  WorkItemId,
  WorkforceMemberId,
  WorkforceQueueId,
  type ActionId as ActionIdType,
  type EvidenceId as EvidenceIdType,
  type HumanTaskId as HumanTaskIdType,
  type RunId as RunIdType,
  type WorkItemId as WorkItemIdType,
  type WorkforceMemberId as WorkforceMemberIdType,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import {
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';
import { parseWorkforceCapabilityV1, type WorkforceCapability } from './workforce-member-v1.js';

const HUMAN_TASK_STATUSES = [
  'pending',
  'assigned',
  'in-progress',
  'completed',
  'escalated',
] as const;

export const HUMAN_TASK_EVENTS = {
  Created: 'HumanTaskCreated',
  Assigned: 'HumanTaskAssigned',
  Completed: 'HumanTaskCompleted',
  Escalated: 'HumanTaskEscalated',
} as const;

export type HumanTaskStatus = (typeof HUMAN_TASK_STATUSES)[number];

export type HumanTaskV1 = Readonly<{
  schemaVersion: 1;
  humanTaskId: HumanTaskIdType;
  workItemId: WorkItemIdType;
  runId: RunIdType;
  stepId: ActionIdType;
  assigneeId?: WorkforceMemberIdType;
  groupId?: WorkforceQueueIdType;
  description: string;
  requiredCapabilities: readonly WorkforceCapability[];
  status: HumanTaskStatus;
  dueAt?: string;
  completedAt?: string;
  completedById?: WorkforceMemberIdType;
  evidenceAnchorId?: EvidenceIdType;
}>;

export interface HumanTaskStatusTransitionMap {
  pending: 'assigned' | 'escalated';
  assigned: 'in-progress' | 'escalated' | 'completed';
  'in-progress': 'completed' | 'escalated';
  completed: never;
  escalated: 'assigned' | 'in-progress' | 'completed';
}

export type ValidHumanTaskStatusTransition<From extends HumanTaskStatus = HumanTaskStatus> =
  HumanTaskStatusTransitionMap[From];

export const HUMAN_TASK_TRANSITIONS: Readonly<Record<HumanTaskStatus, readonly HumanTaskStatus[]>> =
  {
    pending: ['assigned', 'escalated'],
    assigned: ['in-progress', 'escalated', 'completed'],
    'in-progress': ['completed', 'escalated'],
    completed: [],
    escalated: ['assigned', 'in-progress', 'completed'],
  } as const;

export class HumanTaskParseError extends Error {
  public override readonly name = 'HumanTaskParseError';

  public constructor(message: string) {
    super(message);
  }
}

export class HumanTaskTransitionError extends Error {
  public override readonly name = 'HumanTaskTransitionError';

  public constructor(from: HumanTaskStatus, to: HumanTaskStatus) {
    super(`Invalid human task transition: ${from} -> ${to}`);
  }
}

export function parseHumanTaskV1(value: unknown): HumanTaskV1 {
  const record = readRecord(value, 'HumanTask', HumanTaskParseError);
  if (record['schemaVersion'] !== 1) {
    throw new HumanTaskParseError('HumanTask.schemaVersion must be 1.');
  }

  const assigneeId = readOptionalString(record, 'assigneeId', HumanTaskParseError);
  const groupId = readOptionalString(record, 'groupId', HumanTaskParseError);
  const dueAt = readOptionalIsoString(record, 'dueAt', HumanTaskParseError);
  const completedAt = readOptionalIsoString(record, 'completedAt', HumanTaskParseError);
  const completedById = readOptionalString(record, 'completedById', HumanTaskParseError);
  const evidenceAnchorId = readOptionalString(record, 'evidenceAnchorId', HumanTaskParseError);

  return {
    schemaVersion: 1,
    humanTaskId: HumanTaskId(readString(record, 'humanTaskId', HumanTaskParseError)),
    workItemId: WorkItemId(readString(record, 'workItemId', HumanTaskParseError)),
    runId: RunId(readString(record, 'runId', HumanTaskParseError)),
    stepId: ActionId(readString(record, 'stepId', HumanTaskParseError)),
    ...(assigneeId ? { assigneeId: WorkforceMemberId(assigneeId) } : {}),
    ...(groupId ? { groupId: WorkforceQueueId(groupId) } : {}),
    description: readString(record, 'description', HumanTaskParseError),
    requiredCapabilities: parseRequiredCapabilities(record['requiredCapabilities']),
    status: parseStatus(readString(record, 'status', HumanTaskParseError)),
    ...(dueAt ? { dueAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(completedById ? { completedById: WorkforceMemberId(completedById) } : {}),
    ...(evidenceAnchorId ? { evidenceAnchorId: EvidenceId(evidenceAnchorId) } : {}),
  };
}

export function isValidHumanTaskTransition(from: HumanTaskStatus, to: HumanTaskStatus): boolean {
  return HUMAN_TASK_TRANSITIONS[from].includes(to);
}

export function transitionHumanTaskStatusV1(
  task: HumanTaskV1,
  nextStatus: ValidHumanTaskStatusTransition<typeof task.status>,
): HumanTaskV1 {
  if (!isValidHumanTaskTransition(task.status, nextStatus)) {
    throw new HumanTaskTransitionError(task.status, nextStatus);
  }
  if (task.status === 'completed') {
    throw new HumanTaskTransitionError(task.status, nextStatus);
  }
  return { ...task, status: nextStatus };
}

export function assignHumanTaskV1(params: {
  task: HumanTaskV1;
  assigneeId: WorkforceMemberIdType;
}): HumanTaskV1 {
  ensureNotCompleted(params.task);
  return { ...params.task, assigneeId: params.assigneeId, status: 'assigned' };
}

export function completeHumanTaskV1(params: {
  task: HumanTaskV1;
  completedById: WorkforceMemberIdType;
  completedAt: string;
  evidenceAnchorId: EvidenceIdType;
}): HumanTaskV1 {
  ensureNotCompleted(params.task);
  const completedAt = readIsoString(
    { completedAt: params.completedAt },
    'completedAt',
    HumanTaskParseError,
  );
  return {
    ...params.task,
    status: 'completed',
    completedById: params.completedById,
    completedAt,
    evidenceAnchorId: params.evidenceAnchorId,
  };
}

export function escalateHumanTaskV1(params: {
  task: HumanTaskV1;
  groupId: WorkforceQueueIdType;
}): HumanTaskV1 {
  ensureNotCompleted(params.task);
  const { assigneeId, ...rest } = params.task;
  void assigneeId;
  return {
    ...rest,
    status: 'escalated',
    groupId: params.groupId,
  };
}

function parseStatus(value: string): HumanTaskStatus {
  if ((HUMAN_TASK_STATUSES as readonly string[]).includes(value)) {
    return value as HumanTaskStatus;
  }
  throw new HumanTaskParseError(`status must be one of: ${HUMAN_TASK_STATUSES.join(', ')}.`);
}

function parseRequiredCapabilities(value: unknown): readonly WorkforceCapability[] {
  if (!Array.isArray(value)) {
    throw new HumanTaskParseError('requiredCapabilities must be an array.');
  }
  return value.map((entry, i) =>
    parseWorkforceCapabilityV1(entry, `requiredCapabilities[${i}]`, HumanTaskParseError),
  );
}

function ensureNotCompleted(task: HumanTaskV1): void {
  if (task.status === 'completed') {
    throw new HumanTaskParseError('Completed HumanTask is immutable.');
  }
}

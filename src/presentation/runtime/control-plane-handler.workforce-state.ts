import type {
  EvidenceRecord,
  HumanTaskRecord,
  WorkforceMemberRecord,
  WorkforceQueueRecord,
} from './control-plane-handler.shared.js';

const WORKFORCE_FIXTURE: Readonly<{
  members: readonly WorkforceMemberRecord[];
  queues: readonly WorkforceQueueRecord[];
}> = {
  members: [
    {
      schemaVersion: 1,
      workforceMemberId: 'wm-1',
      linkedUserId: 'user-1',
      displayName: 'Alice Martinez',
      capabilities: ['operations.approval', 'operations.escalation'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-finance', 'queue-general'],
      tenantId: 'workspace-1',
      createdAtIso: '2026-02-19T00:00:00.000Z',
      updatedAtIso: '2026-02-19T00:00:00.000Z',
    },
    {
      schemaVersion: 1,
      workforceMemberId: 'wm-2',
      linkedUserId: 'user-2',
      displayName: 'Bob Chen',
      capabilities: ['operations.dispatch'],
      availabilityStatus: 'busy',
      queueMemberships: ['queue-general'],
      tenantId: 'workspace-1',
      createdAtIso: '2026-02-19T00:00:00.000Z',
      updatedAtIso: '2026-02-19T00:00:00.000Z',
    },
  ],
  queues: [
    {
      schemaVersion: 1,
      workforceQueueId: 'queue-finance',
      name: 'Finance Queue',
      requiredCapabilities: ['operations.approval'],
      memberIds: ['wm-1'],
      routingStrategy: 'least-busy',
      tenantId: 'workspace-1',
    },
    {
      schemaVersion: 1,
      workforceQueueId: 'queue-general',
      name: 'General Queue',
      requiredCapabilities: ['operations.dispatch'],
      memberIds: ['wm-1', 'wm-2'],
      routingStrategy: 'round-robin',
      tenantId: 'workspace-1',
    },
  ],
};

const HUMAN_TASK_FIXTURE: readonly HumanTaskRecord[] = [
  {
    schemaVersion: 1,
    humanTaskId: 'ht-1',
    workItemId: 'wi-101',
    runId: 'run-101',
    stepId: 'step-approve',
    assigneeId: 'wm-1',
    groupId: 'queue-finance',
    description: 'Approve invoice correction',
    requiredCapabilities: ['operations.approval'],
    status: 'assigned',
    dueAt: '2026-02-20T12:00:00.000Z',
    tenantId: 'workspace-1',
  },
  {
    schemaVersion: 1,
    humanTaskId: 'ht-2',
    workItemId: 'wi-102',
    runId: 'run-102',
    stepId: 'step-review',
    groupId: 'queue-general',
    description: 'Quality-check export batch',
    requiredCapabilities: ['operations.dispatch'],
    status: 'pending',
    dueAt: '2026-02-21T12:00:00.000Z',
    tenantId: 'workspace-1',
  },
];

let runtimeHumanTasks: HumanTaskRecord[] = [...HUMAN_TASK_FIXTURE];
let runtimeEvidence: EvidenceRecord[] = [];

export function listFixtureMembers(workspaceId: string): WorkforceMemberRecord[] {
  return WORKFORCE_FIXTURE.members.filter((member) => member.tenantId === workspaceId);
}

export function listFixtureQueues(workspaceId: string): WorkforceQueueRecord[] {
  return WORKFORCE_FIXTURE.queues.filter((queue) => queue.tenantId === workspaceId);
}

export function listRuntimeHumanTasks(workspaceId: string): HumanTaskRecord[] {
  return runtimeHumanTasks.filter((task) => task.tenantId === workspaceId);
}

export function updateRuntimeHumanTask(nextTask: HumanTaskRecord): void {
  runtimeHumanTasks = runtimeHumanTasks.map((task) =>
    task.humanTaskId === nextTask.humanTaskId && task.tenantId === nextTask.tenantId
      ? nextTask
      : task,
  );
}

export function listRuntimeEvidence(workspaceId: string): EvidenceRecord[] {
  return runtimeEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

export function appendRuntimeEvidence(entry: EvidenceRecord): void {
  runtimeEvidence = [...runtimeEvidence, entry];
}

import { describe, expect, it } from 'vitest';

import {
  HumanTaskId,
  TenantId,
  WorkforceMemberId,
  WorkforceQueueId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import {
  parseHumanTaskV1,
  parseWorkforceMemberV1,
  parseWorkforceQueueV1,
  type HumanTaskStatus,
  type WorkforceAvailabilityStatus,
  type WorkforceCapability,
} from '../../domain/workforce/index.js';
import {
  InMemoryHumanTaskStore,
  InMemoryWorkforceMemberStore,
  InMemoryWorkforceQueueStore,
} from './in-memory-workforce-store.js';

const ISO = '2026-02-20T00:00:00.000Z';

function makeMember(
  workspaceId: string,
  id: string,
  availabilityStatus: WorkforceAvailabilityStatus = 'available',
  capabilities: readonly WorkforceCapability[] = ['operations.dispatch'],
) {
  return parseWorkforceMemberV1({
    schemaVersion: 1,
    workforceMemberId: id,
    linkedUserId: `user-${id}`,
    displayName: `Member ${id}`,
    capabilities,
    availabilityStatus,
    queueMemberships: ['queue-general'],
    tenantId: workspaceId,
    createdAtIso: ISO,
  });
}

function makeQueue(
  workspaceId: string,
  id: string,
  requiredCapabilities: readonly WorkforceCapability[] = ['operations.dispatch'],
) {
  return parseWorkforceQueueV1({
    schemaVersion: 1,
    workforceQueueId: id,
    name: `Queue ${id}`,
    requiredCapabilities,
    memberIds: ['wm-a'],
    routingStrategy: 'round-robin',
    tenantId: workspaceId,
  });
}

function makeTask(id: string, status: HumanTaskStatus = 'pending') {
  return parseHumanTaskV1({
    schemaVersion: 1,
    humanTaskId: id,
    workItemId: `wi-${id}`,
    runId: `run-${id}`,
    stepId: `step-${id}`,
    description: `Task ${id}`,
    requiredCapabilities: ['operations.dispatch'],
    status,
  });
}

describe('InMemoryWorkforceMemberStore', () => {
  it('persists member mutations and scopes reads by tenant workspace', async () => {
    const store = new InMemoryWorkforceMemberStore([
      makeMember('ws-a', 'wm-a'),
      makeMember('ws-b', 'wm-b', 'busy'),
    ]);

    await expect(
      store.getWorkforceMemberById(
        TenantId('ws-a'),
        WorkforceMemberId('wm-a'),
        WorkspaceId('ws-a'),
      ),
    ).resolves.toMatchObject({ workforceMemberId: 'wm-a', tenantId: 'ws-a' });
    await expect(
      store.getWorkforceMemberById(
        TenantId('ws-a'),
        WorkforceMemberId('wm-a'),
        WorkspaceId('ws-b'),
      ),
    ).resolves.toBeNull();

    const updated = { ...makeMember('ws-a', 'wm-a'), availabilityStatus: 'offline' as const };
    await store.saveWorkforceMember(TenantId('ws-a'), updated, WorkspaceId('ws-a'));

    const page = await store.listWorkforceMembers(TenantId('ws-a'), {
      workspaceId: WorkspaceId('ws-a'),
      availability: 'offline',
      limit: 10,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.workforceMemberId).toBe('wm-a');
    expect(page.items[0]?.availabilityStatus).toBe('offline');

    await expect(
      store.saveWorkforceMember(TenantId('ws-a'), makeMember('ws-b', 'wm-b'), WorkspaceId('ws-a')),
    ).rejects.toThrow(/workspaceId/);
  });
});

describe('InMemoryWorkforceQueueStore', () => {
  it('persists queues and applies workspace and capability filters', async () => {
    const store = new InMemoryWorkforceQueueStore([
      makeQueue('ws-a', 'queue-a', ['operations.dispatch']),
      makeQueue('ws-b', 'queue-b', ['operations.approval']),
    ]);

    await store.saveWorkforceQueue(
      TenantId('ws-a'),
      makeQueue('ws-a', 'queue-escalation', ['operations.escalation']),
      WorkspaceId('ws-a'),
    );

    const page = await store.listWorkforceQueues(TenantId('ws-a'), {
      workspaceId: WorkspaceId('ws-a'),
      capability: 'operations.escalation',
      limit: 10,
    });
    expect(page.items.map((queue) => queue.workforceQueueId)).toEqual(['queue-escalation']);

    await expect(
      store.getWorkforceQueueById(
        TenantId('ws-a'),
        WorkforceQueueId('queue-b'),
        WorkspaceId('ws-a'),
      ),
    ).resolves.toBeNull();
  });
});

describe('InMemoryHumanTaskStore', () => {
  it('persists human-task mutations and scopes list/read by workspace', async () => {
    const store = new InMemoryHumanTaskStore([
      { workspaceId: 'ws-a', task: makeTask('ht-a') },
      { workspaceId: 'ws-b', task: makeTask('ht-b', 'assigned') },
    ]);

    const assigned = {
      ...makeTask('ht-a'),
      status: 'assigned' as const,
      assigneeId: WorkforceMemberId('wm-a'),
    };
    await store.saveHumanTask(TenantId('ws-a'), assigned, WorkspaceId('ws-a'));

    await expect(
      store.getHumanTaskById(TenantId('ws-a'), HumanTaskId('ht-a'), WorkspaceId('ws-a')),
    ).resolves.toMatchObject({ humanTaskId: 'ht-a', status: 'assigned', assigneeId: 'wm-a' });
    await expect(
      store.getHumanTaskById(TenantId('ws-a'), HumanTaskId('ht-b'), WorkspaceId('ws-a')),
    ).resolves.toBeNull();

    const page = await store.listHumanTasks(TenantId('ws-a'), {
      workspaceId: WorkspaceId('ws-a'),
      status: 'assigned',
      limit: 10,
    });
    expect(page.items.map((task) => task.humanTaskId)).toEqual(['ht-a']);
  });
});

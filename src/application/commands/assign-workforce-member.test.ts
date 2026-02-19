import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../common/context.js';
import type { AssignWorkforceMemberDeps } from './assign-workforce-member.js';
import { assignWorkforceMember } from './assign-workforce-member.js';
import {
  EvidenceId,
  HashSha256,
  WorkforceMemberId,
  WorkforceQueueId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import {
  parseHumanTaskV1,
  parseWorkforceMemberV1,
  parseWorkforceQueueV1,
} from '../../domain/workforce/index.js';

const ctx = toAppContext({
  tenantId: 'ws-1',
  principalId: 'user-admin',
  roles: ['admin'],
  correlationId: 'corr-1',
});

function makeDeps(overrides: Partial<AssignWorkforceMemberDeps> = {}): AssignWorkforceMemberDeps {
  const deps: AssignWorkforceMemberDeps = {
    authorization: {
      isAllowed: vi.fn(async () => true),
    },
    clock: {
      nowIso: vi.fn(() => '2026-02-19T11:00:00.000Z'),
    },
    idGenerator: {
      generateId: vi
        .fn()
        .mockReturnValueOnce('evt-1')
        .mockReturnValueOnce('evi-1')
        .mockReturnValueOnce('evt-2')
        .mockReturnValueOnce('evi-2'),
    },
    unitOfWork: {
      execute: vi.fn(async (fn) => fn()),
    },
    workItemStore: {
      getWorkItemById: vi.fn(async () =>
        parseWorkItemV1({
          schemaVersion: 1,
          workItemId: 'wi-1',
          workspaceId: 'ws-1',
          createdAtIso: '2026-02-19T10:00:00.000Z',
          createdByUserId: 'user-init',
          title: 'Investigate alert',
          status: 'Open',
        }),
      ),
      listWorkItems: vi.fn(async () => ({ items: [] })),
      saveWorkItem: vi.fn(async () => undefined),
    },
    humanTaskStore: {
      getHumanTaskById: vi.fn(async () =>
        parseHumanTaskV1({
          schemaVersion: 1,
          humanTaskId: 'ht-1',
          workItemId: 'wi-1',
          runId: 'run-1',
          stepId: 'step-1',
          description: 'Validate stop-path acknowledgement',
          requiredCapabilities: ['robotics.supervision'],
          status: 'pending',
        }),
      ),
      saveHumanTask: vi.fn(async () => undefined),
    },
    workforceMemberStore: {
      getWorkforceMemberById: vi.fn(async () =>
        parseWorkforceMemberV1({
          schemaVersion: 1,
          workforceMemberId: 'wm-1',
          linkedUserId: 'user-ops-1',
          displayName: 'Ops One',
          capabilities: ['robotics.supervision'],
          availabilityStatus: 'available',
          queueMemberships: ['queue-1'],
          tenantId: 'ws-1',
          createdAtIso: '2026-02-19T09:00:00.000Z',
        }),
      ),
      listWorkforceMembersByIds: vi.fn(async () => [
        parseWorkforceMemberV1({
          schemaVersion: 1,
          workforceMemberId: 'wm-1',
          linkedUserId: 'user-ops-1',
          displayName: 'Ops One',
          capabilities: ['robotics.supervision'],
          availabilityStatus: 'available',
          queueMemberships: ['queue-1'],
          tenantId: 'ws-1',
          createdAtIso: '2026-02-19T09:00:00.000Z',
        }),
      ]),
    },
    workforceQueueStore: {
      getWorkforceQueueById: vi.fn(async () =>
        parseWorkforceQueueV1({
          schemaVersion: 1,
          workforceQueueId: 'queue-1',
          name: 'Robot Ops',
          requiredCapabilities: ['robotics.supervision'],
          memberIds: ['wm-1'],
          routingStrategy: 'round-robin',
          tenantId: 'ws-1',
        }),
      ),
    },
    eventPublisher: {
      publish: vi.fn(async () => undefined),
    },
    evidenceLog: {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        evidenceId: EvidenceId('evi-1'),
        previousHash: undefined,
        hashSha256: HashSha256('h1'),
      })),
    },
    ...overrides,
  };

  return deps;
}

describe('assignWorkforceMember', () => {
  it('assigns workforce member to WorkItem and writes evidence', async () => {
    const deps = makeDeps();
    const result = await assignWorkforceMember(deps, ctx, {
      workspaceId: WorkspaceId('ws-1'),
      target: {
        kind: 'WorkItem',
        workItemId: 'wi-1',
        workforceMemberId: 'wm-1',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetKind).toBe('WorkItem');
    expect(result.value.workforceMemberId).toBe(WorkforceMemberId('wm-1'));
    expect(deps.workItemStore.saveWorkItem).toHaveBeenCalledTimes(1);
    expect(deps.evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
  });

  it('assigns pending HumanTask via queue routing', async () => {
    const deps = makeDeps();
    const result = await assignWorkforceMember(deps, ctx, {
      workspaceId: 'ws-1',
      target: {
        kind: 'HumanTask',
        humanTaskId: 'ht-1',
        workforceQueueId: WorkforceQueueId('queue-1'),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetKind).toBe('HumanTask');
    expect(result.value.workforceMemberId).toBe(WorkforceMemberId('wm-1'));
    expect(deps.humanTaskStore.saveHumanTask).toHaveBeenCalledTimes(1);
  });

  it('rejects HumanTask assignment when required capabilities are missing', async () => {
    const deps = makeDeps({
      workforceMemberStore: {
        getWorkforceMemberById: vi.fn(async () =>
          parseWorkforceMemberV1({
            schemaVersion: 1,
            workforceMemberId: 'wm-1',
            linkedUserId: 'user-ops-1',
            displayName: 'Ops One',
            capabilities: ['operations.dispatch'],
            availabilityStatus: 'available',
            queueMemberships: ['queue-1'],
            tenantId: 'ws-1',
            createdAtIso: '2026-02-19T09:00:00.000Z',
          }),
        ),
        listWorkforceMembersByIds: vi.fn(async () => []),
      },
    });

    const result = await assignWorkforceMember(deps, ctx, {
      workspaceId: 'ws-1',
      target: {
        kind: 'HumanTask',
        humanTaskId: 'ht-1',
        workforceMemberId: 'wm-1',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/required capabilities/i);
  });

  it('rejects assignment when workforce member is unavailable', async () => {
    const deps = makeDeps({
      workforceMemberStore: {
        getWorkforceMemberById: vi.fn(async () =>
          parseWorkforceMemberV1({
            schemaVersion: 1,
            workforceMemberId: 'wm-1',
            linkedUserId: 'user-ops-1',
            displayName: 'Ops One',
            capabilities: ['robotics.supervision'],
            availabilityStatus: 'offline',
            queueMemberships: ['queue-1'],
            tenantId: 'ws-1',
            createdAtIso: '2026-02-19T09:00:00.000Z',
          }),
        ),
        listWorkforceMembersByIds: vi.fn(async () => []),
      },
    });

    const result = await assignWorkforceMember(deps, ctx, {
      workspaceId: 'ws-1',
      target: {
        kind: 'WorkItem',
        workItemId: 'wi-1',
        workforceMemberId: 'wm-1',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/unavailable/i);
  });
});

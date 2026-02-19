import { describe, expect, it } from 'vitest';
import { WorkforceMemberId } from '../primitives/index.js';
import { parseHumanTaskV1 } from './human-task-v1.js';
import { parseWorkforceMemberV1 } from './workforce-member-v1.js';
import {
  parseWorkforceQueueV1,
  routeHumanTaskToQueueV1,
  validateTaskCanQueueV1,
} from './workforce-queue-v1.js';

function baseQueue(overrides: Record<string, unknown> = {}) {
  return parseWorkforceQueueV1({
    schemaVersion: 1,
    workforceQueueId: 'queue-ops',
    name: 'Operations Queue',
    requiredCapabilities: ['operations.dispatch', 'operations.approval'],
    memberIds: ['wm-1', 'wm-2'],
    routingStrategy: 'round-robin',
    tenantId: 'ws-1',
    ...overrides,
  });
}

function member(id: string, availabilityStatus: 'available' | 'busy' | 'offline') {
  return parseWorkforceMemberV1({
    schemaVersion: 1,
    workforceMemberId: id,
    linkedUserId: `${id}-user`,
    displayName: id,
    capabilities: ['operations.dispatch'],
    availabilityStatus,
    queueMemberships: ['queue-ops'],
    tenantId: 'ws-1',
    createdAtIso: '2026-02-19T00:00:00.000Z',
  });
}

function task(requiredCapabilities: readonly string[]) {
  return parseHumanTaskV1({
    schemaVersion: 1,
    humanTaskId: 'ht-1',
    workItemId: 'wi-1',
    runId: 'run-1',
    stepId: 'act-1',
    groupId: 'queue-ops',
    description: 'Manual verification',
    requiredCapabilities,
    status: 'pending',
  });
}

describe('WorkforceQueueV1', () => {
  it('validates task capability subset', () => {
    const queue = baseQueue();
    expect(() => validateTaskCanQueueV1(queue, task(['operations.dispatch']))).not.toThrow();
    expect(() => validateTaskCanQueueV1(queue, task(['robotics.supervision']))).toThrow(
      /not covered/i,
    );
  });

  it('routes round-robin across available members', () => {
    const queue = baseQueue();
    const routed = routeHumanTaskToQueueV1({
      queue,
      task: task(['operations.dispatch']),
      members: [member('wm-1', 'available'), member('wm-2', 'available')],
      lastAssignedMemberId: WorkforceMemberId('wm-1'),
    });

    expect(routed.stayedPending).toBe(false);
    expect(routed.selectedMemberId).toBe('wm-2');
  });

  it('routes least-busy when strategy is least-busy', () => {
    const queue = baseQueue({ routingStrategy: 'least-busy' });
    const routed = routeHumanTaskToQueueV1({
      queue,
      task: task(['operations.dispatch']),
      members: [member('wm-1', 'available'), member('wm-2', 'available')],
      activeAssignmentsByMember: { 'wm-1': 3, 'wm-2': 1 },
    });

    expect(routed.selectedMemberId).toBe('wm-2');
  });

  it('keeps task pending when no available members', () => {
    const queue = baseQueue();
    const routed = routeHumanTaskToQueueV1({
      queue,
      task: task(['operations.dispatch']),
      members: [member('wm-1', 'busy'), member('wm-2', 'offline')],
    });

    expect(routed.stayedPending).toBe(true);
    expect(routed.selectedMemberId).toBeUndefined();
  });
});

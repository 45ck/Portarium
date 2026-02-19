import { describe, expect, it } from 'vitest';
import { EvidenceId, WorkforceMemberId, WorkforceQueueId } from '../primitives/index.js';
import {
  assignHumanTaskV1,
  completeHumanTaskV1,
  escalateHumanTaskV1,
  parseHumanTaskV1,
  transitionHumanTaskStatusV1,
} from './human-task-v1.js';

function baseTask() {
  return parseHumanTaskV1({
    schemaVersion: 1,
    humanTaskId: 'ht-1',
    workItemId: 'wi-1',
    runId: 'run-1',
    stepId: 'act-1',
    groupId: 'queue-a',
    description: 'Verify payload load area',
    requiredCapabilities: ['operations.dispatch'],
    status: 'pending',
    dueAt: '2026-02-20T00:00:00.000Z',
  });
}

describe('HumanTaskV1', () => {
  it('parses a valid human task', () => {
    const task = baseTask();
    expect(task.status).toBe('pending');
    expect(task.groupId).toBe('queue-a');
  });

  it('supports explicit state transitions', () => {
    const assigned = transitionHumanTaskStatusV1(baseTask(), 'assigned');
    const inProgress = transitionHumanTaskStatusV1(assigned, 'in-progress');
    expect(inProgress.status).toBe('in-progress');
  });

  it('supports assignment and completion flow', () => {
    const assigned = assignHumanTaskV1({
      task: baseTask(),
      assigneeId: WorkforceMemberId('wm-1'),
    });
    const completed = completeHumanTaskV1({
      task: assigned,
      completedById: WorkforceMemberId('wm-1'),
      completedAt: '2026-02-19T12:00:00.000Z',
      evidenceAnchorId: EvidenceId('ev-1'),
    });
    expect(completed.status).toBe('completed');
    expect(completed.evidenceAnchorId).toBe('ev-1');
  });

  it('escalation clears assignee and requeues to target group', () => {
    const assigned = assignHumanTaskV1({
      task: baseTask(),
      assigneeId: WorkforceMemberId('wm-1'),
    });
    const escalated = escalateHumanTaskV1({
      task: assigned,
      groupId: WorkforceQueueId('queue-escalation'),
    });

    expect(escalated.status).toBe('escalated');
    expect(escalated.assigneeId).toBeUndefined();
    expect(escalated.groupId).toBe('queue-escalation');
  });

  it('treats completed tasks as immutable', () => {
    const completed = completeHumanTaskV1({
      task: assignHumanTaskV1({
        task: baseTask(),
        assigneeId: WorkforceMemberId('wm-1'),
      }),
      completedById: WorkforceMemberId('wm-1'),
      completedAt: '2026-02-19T12:00:00.000Z',
      evidenceAnchorId: EvidenceId('ev-1'),
    });

    expect(() =>
      assignHumanTaskV1({
        task: completed,
        assigneeId: WorkforceMemberId('wm-2'),
      }),
    ).toThrow(/immutable/i);
  });
});

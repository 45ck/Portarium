import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../common/context.js';
import type { CompleteHumanTaskDeps } from './complete-human-task.js';
import { completeHumanTask } from './complete-human-task.js';
import { EvidenceId, HashSha256 } from '../../domain/primitives/index.js';
import { parseHumanTaskV1, parseWorkforceMemberV1 } from '../../domain/workforce/index.js';

const ctx = toAppContext({
  tenantId: 'ws-1',
  principalId: 'user-ops-1',
  roles: ['operator'],
  correlationId: 'corr-1',
});

function makeDeps(overrides: Partial<CompleteHumanTaskDeps> = {}): CompleteHumanTaskDeps {
  return {
    authorization: { isAllowed: vi.fn(async () => true) },
    clock: { nowIso: vi.fn(() => '2026-02-19T12:00:00.000Z') },
    idGenerator: {
      generateId: vi.fn().mockReturnValueOnce('evt-1').mockReturnValueOnce('evi-1'),
    },
    unitOfWork: { execute: vi.fn(async (fn) => fn()) },
    humanTaskStore: {
      getHumanTaskById: vi.fn(async () =>
        parseHumanTaskV1({
          schemaVersion: 1,
          humanTaskId: 'ht-1',
          workItemId: 'wi-1',
          runId: 'run-1',
          stepId: 'step-1',
          assigneeId: 'wm-1',
          description: 'Confirm safety boundary',
          requiredCapabilities: ['robotics.supervision'],
          status: 'assigned',
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
      listWorkforceMembersByIds: vi.fn(async () => []),
    },
    eventPublisher: { publish: vi.fn(async () => undefined) },
    evidenceLog: {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        evidenceId: EvidenceId('evi-1'),
        hashSha256: HashSha256('h1'),
      })),
    },
    runResumer: { resumeRunFromHumanTask: vi.fn(async () => undefined) },
    ...overrides,
  };
}

describe('completeHumanTask', () => {
  it('completes assigned task, writes evidence, and resumes run', async () => {
    const deps = makeDeps();
    const result = await completeHumanTask(deps, ctx, {
      workspaceId: 'ws-1',
      humanTaskId: 'ht-1',
      completionNote: 'done',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('completed');
    expect(result.value.alreadyCompleted).toBe(false);
    expect(deps.evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(deps.runResumer.resumeRunFromHumanTask).toHaveBeenCalledTimes(1);
  });

  it('rejects completion when caller is not the assignee', async () => {
    const deps = makeDeps({
      workforceMemberStore: {
        getWorkforceMemberById: vi.fn(async () =>
          parseWorkforceMemberV1({
            schemaVersion: 1,
            workforceMemberId: 'wm-1',
            linkedUserId: 'user-other',
            displayName: 'Ops Two',
            capabilities: ['robotics.supervision'],
            availabilityStatus: 'available',
            queueMemberships: ['queue-1'],
            tenantId: 'ws-1',
            createdAtIso: '2026-02-19T09:00:00.000Z',
          }),
        ),
        listWorkforceMembersByIds: vi.fn(async () => []),
      },
    });
    const result = await completeHumanTask(deps, ctx, {
      workspaceId: 'ws-1',
      humanTaskId: 'ht-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/assigned workforce member/i);
  });

  it('returns idempotent success when task is already completed', async () => {
    const deps = makeDeps({
      humanTaskStore: {
        getHumanTaskById: vi.fn(async () =>
          parseHumanTaskV1({
            schemaVersion: 1,
            humanTaskId: 'ht-1',
            workItemId: 'wi-1',
            runId: 'run-1',
            stepId: 'step-1',
            assigneeId: 'wm-1',
            description: 'Confirm safety boundary',
            requiredCapabilities: ['robotics.supervision'],
            status: 'completed',
            completedById: 'wm-1',
            completedAt: '2026-02-19T11:59:00.000Z',
            evidenceAnchorId: 'evi-done',
          }),
        ),
        saveHumanTask: vi.fn(async () => undefined),
      },
    });

    const result = await completeHumanTask(deps, ctx, {
      workspaceId: 'ws-1',
      humanTaskId: 'ht-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alreadyCompleted).toBe(true);
    expect(deps.humanTaskStore.saveHumanTask).not.toHaveBeenCalled();
    expect(deps.evidenceLog.appendEntry).not.toHaveBeenCalled();
    expect(deps.runResumer.resumeRunFromHumanTask).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryProjectsWorkMgmtAdapter } from './in-memory-projects-work-mgmt-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryProjectsWorkMgmtAdapter integration', () => {
  it('supports project and task lifecycle operations', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT),
    });

    const project = await adapter.execute({
      tenantId: TENANT,
      operation: 'createProject',
      payload: { name: 'Migration Program' },
    });
    expect(project.ok).toBe(true);
    if (!project.ok || project.result.kind !== 'externalRef') return;
    const projectId = project.result.externalRef.externalId;

    const fetchedProject = await adapter.execute({
      tenantId: TENANT,
      operation: 'getProject',
      payload: { projectId },
    });
    expect(fetchedProject.ok).toBe(true);
    if (!fetchedProject.ok || fetchedProject.result.kind !== 'externalRef') return;
    expect(fetchedProject.result.externalRef.externalId).toBe(projectId);

    const createdTask = await adapter.execute({
      tenantId: TENANT,
      operation: 'createTask',
      payload: { title: 'Validate data mappings' },
    });
    expect(createdTask.ok).toBe(true);
    if (!createdTask.ok || createdTask.result.kind !== 'task') return;
    const taskId = createdTask.result.task.canonicalTaskId;

    const updatedTask = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateTask',
      payload: { taskId, status: 'in_progress' },
    });
    expect(updatedTask.ok).toBe(true);
    if (!updatedTask.ok || updatedTask.result.kind !== 'task') return;
    expect(updatedTask.result.task.status).toBe('in_progress');

    const assignedTask = await adapter.execute({
      tenantId: TENANT,
      operation: 'assignTask',
      payload: { taskId, assigneeId: 'user-2000' },
    });
    expect(assignedTask.ok).toBe(true);
    if (!assignedTask.ok || assignedTask.result.kind !== 'task') return;
    expect(assignedTask.result.task.assigneeId).toBe('user-2000');

    const deletedTask = await adapter.execute({
      tenantId: TENANT,
      operation: 'deleteTask',
      payload: { taskId },
    });
    expect(deletedTask.ok).toBe(true);
    if (!deletedTask.ok || deletedTask.result.kind !== 'accepted') return;
  });

  it('supports boards, sprints, milestones, comments, and time entries', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const boards = await adapter.execute({ tenantId: TENANT, operation: 'listBoards' });
    expect(boards.ok).toBe(true);
    if (!boards.ok || boards.result.kind !== 'externalRefs') return;
    const boardId = boards.result.externalRefs[0]!.externalId;

    const board = await adapter.execute({
      tenantId: TENANT,
      operation: 'getBoard',
      payload: { boardId },
    });
    expect(board.ok).toBe(true);
    if (!board.ok || board.result.kind !== 'externalRef') return;
    expect(board.result.externalRef.externalId).toBe(boardId);

    const sprint = await adapter.execute({
      tenantId: TENANT,
      operation: 'createSprint',
      payload: { name: 'Sprint 14' },
    });
    expect(sprint.ok).toBe(true);
    if (!sprint.ok || sprint.result.kind !== 'externalRef') return;
    const sprintId = sprint.result.externalRef.externalId;

    const fetchedSprint = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSprint',
      payload: { sprintId },
    });
    expect(fetchedSprint.ok).toBe(true);
    if (!fetchedSprint.ok || fetchedSprint.result.kind !== 'externalRef') return;
    expect(fetchedSprint.result.externalRef.externalId).toBe(sprintId);

    const milestones = await adapter.execute({ tenantId: TENANT, operation: 'listMilestones' });
    expect(milestones.ok).toBe(true);
    if (!milestones.ok || milestones.result.kind !== 'externalRefs') return;
    const milestoneId = milestones.result.externalRefs[0]!.externalId;

    const milestone = await adapter.execute({
      tenantId: TENANT,
      operation: 'getMilestone',
      payload: { milestoneId },
    });
    expect(milestone.ok).toBe(true);
    if (!milestone.ok || milestone.result.kind !== 'externalRef') return;
    expect(milestone.result.externalRef.externalId).toBe(milestoneId);

    const comment = await adapter.execute({
      tenantId: TENANT,
      operation: 'addComment',
      payload: { refId: 'task-1000', content: 'Need API owner sign-off.' },
    });
    expect(comment.ok).toBe(true);
    if (!comment.ok || comment.result.kind !== 'externalRef') return;
    const commentId = comment.result.externalRef.externalId;

    const comments = await adapter.execute({
      tenantId: TENANT,
      operation: 'listComments',
      payload: { refId: 'task-1000' },
    });
    expect(comments.ok).toBe(true);
    if (!comments.ok || comments.result.kind !== 'externalRefs') return;
    expect(comments.result.externalRefs.some((item) => item.externalId === commentId)).toBe(true);

    const labels = await adapter.execute({ tenantId: TENANT, operation: 'listLabels' });
    expect(labels.ok).toBe(true);
    if (!labels.ok || labels.result.kind !== 'externalRefs') return;
    expect(labels.result.externalRefs.length).toBeGreaterThan(0);

    const logged = await adapter.execute({
      tenantId: TENANT,
      operation: 'logTime',
      payload: { taskId: 'task-1000', minutes: 25 },
    });
    expect(logged.ok).toBe(true);
    if (!logged.ok || logged.result.kind !== 'externalRef') return;
    expect(logged.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const timeEntries = await adapter.execute({
      tenantId: TENANT,
      operation: 'listTimeEntries',
      payload: { taskId: 'task-1000' },
    });
    expect(timeEntries.ok).toBe(true);
    if (!timeEntries.ok || timeEntries.result.kind !== 'externalRefs') return;
    expect(timeEntries.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('returns validation errors for missing required fields', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT),
    });

    const missingName = await adapter.execute({
      tenantId: TENANT,
      operation: 'createProject',
      payload: {},
    });
    expect(missingName).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'name is required for createProject.',
    });

    const missingRef = await adapter.execute({
      tenantId: TENANT,
      operation: 'listComments',
      payload: {},
    });
    expect(missingRef).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'refId is required for listComments.',
    });

    const invalidMinutes = await adapter.execute({
      tenantId: TENANT,
      operation: 'logTime',
      payload: { taskId: 'task-1000', minutes: -5 },
    });
    expect(invalidMinutes).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'minutes must be a positive number for logTime.',
    });
  });
});

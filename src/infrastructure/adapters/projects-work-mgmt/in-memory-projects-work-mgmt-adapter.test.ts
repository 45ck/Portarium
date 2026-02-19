import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryProjectsWorkMgmtAdapter } from './in-memory-projects-work-mgmt-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryProjectsWorkMgmtAdapter', () => {
  it('returns tenant-scoped projects and tasks', async () => {
    const seedA = InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: {
        ...seedA,
        projects: [...seedA.projects!, ...seedB.projects!],
        tasks: [...seedA.tasks!, ...seedB.tasks!],
      },
    });

    const projects = await adapter.execute({ tenantId: TENANT_A, operation: 'listProjects' });
    expect(projects.ok).toBe(true);
    if (!projects.ok || projects.result.kind !== 'externalRefs') return;
    expect(projects.result.externalRefs).toHaveLength(1);
    expect(projects.result.externalRefs[0]?.externalId).toBe('project-1000');

    const tasks = await adapter.execute({ tenantId: TENANT_A, operation: 'listTasks' });
    expect(tasks.ok).toBe(true);
    if (!tasks.ok || tasks.result.kind !== 'tasks') return;
    expect(tasks.result.tasks).toHaveLength(1);
    expect(tasks.result.tasks[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports task create/update/assign/get/delete lifecycle', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createTask',
      payload: { title: 'Run staging validation' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'task') return;
    const taskId = created.result.task.canonicalTaskId;

    const updated = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateTask',
      payload: { taskId, status: 'in_progress', title: 'Run staging validation + smoke' },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || updated.result.kind !== 'task') return;
    expect(updated.result.task.status).toBe('in_progress');

    const assigned = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assignTask',
      payload: { taskId, assigneeId: 'user-1000' },
    });
    expect(assigned.ok).toBe(true);
    if (!assigned.ok || assigned.result.kind !== 'task') return;
    expect(assigned.result.task.assigneeId).toBe('user-1000');

    const fetched = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getTask',
      payload: { taskId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'task') return;
    expect(fetched.result.task.canonicalTaskId).toBe(taskId);

    const deleted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'deleteTask',
      payload: { taskId },
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok || deleted.result.kind !== 'accepted') return;

    const missing = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getTask',
      payload: { taskId },
    });
    expect(missing).toEqual({
      ok: false,
      error: 'not_found',
      message: `Task ${taskId} was not found.`,
    });
  });

  it('supports project, sprint, comment, and time-entry operations', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdProject = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createProject',
      payload: { name: 'Customer Onboarding Improvements' },
    });
    expect(createdProject.ok).toBe(true);
    if (!createdProject.ok || createdProject.result.kind !== 'externalRef') return;
    const projectId = createdProject.result.externalRef.externalId;

    const fetchedProject = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getProject',
      payload: { projectId },
    });
    expect(fetchedProject.ok).toBe(true);
    if (!fetchedProject.ok || fetchedProject.result.kind !== 'externalRef') return;
    expect(fetchedProject.result.externalRef.externalId).toBe(projectId);

    const createdSprint = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createSprint',
      payload: { name: 'Sprint 13' },
    });
    expect(createdSprint.ok).toBe(true);
    if (!createdSprint.ok || createdSprint.result.kind !== 'externalRef') return;
    const sprintId = createdSprint.result.externalRef.externalId;

    const fetchedSprint = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getSprint',
      payload: { sprintId },
    });
    expect(fetchedSprint.ok).toBe(true);
    if (!fetchedSprint.ok || fetchedSprint.result.kind !== 'externalRef') return;
    expect(fetchedSprint.result.externalRef.externalId).toBe(sprintId);

    const addedComment = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'addComment',
      payload: { refId: 'task-1000', content: 'Please add rollback notes.' },
    });
    expect(addedComment.ok).toBe(true);
    if (!addedComment.ok || addedComment.result.kind !== 'externalRef') return;
    const commentId = addedComment.result.externalRef.externalId;

    const comments = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listComments',
      payload: { refId: 'task-1000' },
    });
    expect(comments.ok).toBe(true);
    if (!comments.ok || comments.result.kind !== 'externalRefs') return;
    expect(comments.result.externalRefs.some((item) => item.externalId === commentId)).toBe(true);

    const loggedTime = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'logTime',
      payload: { taskId: 'task-1000', minutes: 30 },
    });
    expect(loggedTime.ok).toBe(true);
    if (!loggedTime.ok || loggedTime.result.kind !== 'externalRef') return;
    expect(loggedTime.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const timeEntries = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listTimeEntries',
      payload: { taskId: 'task-1000' },
    });
    expect(timeEntries.ok).toBe(true);
    if (!timeEntries.ok || timeEntries.result.kind !== 'externalRefs') return;
    expect(timeEntries.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('returns validation errors for required payload fields', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter({
      seed: InMemoryProjectsWorkMgmtAdapter.seedMinimal(TENANT_A),
    });

    const missingTaskId = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assignTask',
      payload: { assigneeId: 'user-1' },
    });
    expect(missingTaskId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'taskId is required for assignTask.',
    });

    const invalidStatus = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateTask',
      payload: { taskId: 'task-1000', status: 'blocked' },
    });
    expect(invalidStatus).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'status must be one of: todo, in_progress, done, cancelled.',
    });

    const invalidMinutes = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'logTime',
      payload: { taskId: 'task-1000', minutes: 0 },
    });
    expect(invalidMinutes).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'minutes must be a positive number for logTime.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryProjectsWorkMgmtAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listProjects',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported ProjectsWorkMgmt operation: bogusOperation.',
    });
  });
});

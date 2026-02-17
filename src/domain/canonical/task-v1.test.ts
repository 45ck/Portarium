import { describe, expect, it } from 'vitest';

import { TaskParseError, parseCanonicalTaskV1 } from './task-v1.js';

describe('parseCanonicalTaskV1', () => {
  const valid = {
    canonicalTaskId: 'task-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    title: 'Review PR',
    status: 'todo',
    assigneeId: 'user-5',
    dueAtIso: '2026-02-20T17:00:00.000Z',
    externalRefs: [
      {
        sorName: 'jira',
        portFamily: 'ProjectsWorkMgmt',
        externalId: 'PROJ-42',
        externalType: 'Issue',
      },
    ],
  };

  it('parses a full CanonicalTaskV1 with all fields', () => {
    const task = parseCanonicalTaskV1(valid);
    expect(task.canonicalTaskId).toBe('task-1');
    expect(task.title).toBe('Review PR');
    expect(task.status).toBe('todo');
    expect(task.assigneeId).toBe('user-5');
    expect(task.dueAtIso).toBe('2026-02-20T17:00:00.000Z');
    expect(task.externalRefs).toHaveLength(1);
  });

  it('parses a minimal CanonicalTaskV1 (required fields only)', () => {
    const task = parseCanonicalTaskV1({
      canonicalTaskId: 'task-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      title: 'Deploy',
      status: 'in_progress',
    });
    expect(task.canonicalTaskId).toBe('task-2');
    expect(task.assigneeId).toBeUndefined();
    expect(task.dueAtIso).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseCanonicalTaskV1('nope')).toThrow(TaskParseError);
    expect(() => parseCanonicalTaskV1(null)).toThrow(TaskParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseCanonicalTaskV1({ ...valid, title: '' })).toThrow(/title/);
  });

  it('rejects invalid status', () => {
    expect(() => parseCanonicalTaskV1({ ...valid, status: 'blocked' })).toThrow(/status/);
  });
});

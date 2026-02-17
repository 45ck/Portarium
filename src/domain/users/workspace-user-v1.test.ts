import { describe, expect, it } from 'vitest';

import { WorkspaceUserParseError, parseWorkspaceUserV1 } from './workspace-user-v1.js';

describe('parseWorkspaceUserV1: happy path', () => {
  it('parses a minimal user', () => {
    const user = parseWorkspaceUserV1({
      userId: 'user-1',
      workspaceId: 'ws-1',
      email: 'ops@example.com',
      roles: ['operator'],
      active: true,
      createdAtIso: '2026-02-16T00:00:00.000Z',
    });

    expect(user.userId).toBe('user-1');
    expect(user.workspaceId).toBe('ws-1');
    expect(user.email).toBe('ops@example.com');
    expect(user.roles).toEqual(['operator']);
    expect(user.active).toBe(true);
    expect(user.displayName).toBeUndefined();
  });

  it('parses displayName and multiple roles', () => {
    const user = parseWorkspaceUserV1({
      userId: 'user-2',
      workspaceId: 'ws-1',
      email: 'admin@example.com',
      displayName: 'Admin',
      roles: ['admin', 'approver'],
      active: false,
      createdAtIso: '2026-02-16T00:00:00.000Z',
    });

    expect(user.displayName).toBe('Admin');
    expect(user.roles).toEqual(['admin', 'approver']);
    expect(user.active).toBe(false);
  });
});

describe('parseWorkspaceUserV1: validation', () => {
  it('rejects non-object inputs', () => {
    expect(() => parseWorkspaceUserV1('nope')).toThrow(WorkspaceUserParseError);
  });

  it('rejects invalid emails', () => {
    expect(() =>
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: 'ws-1',
        email: 'not-an-email',
        roles: ['operator'],
        active: true,
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/email/i);
  });

  it('rejects invalid roles', () => {
    expect(() =>
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: 'ws-1',
        email: 'ops@example.com',
        roles: [],
        active: true,
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/roles.*non-empty/i);

    expect(() =>
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: 'ws-1',
        email: 'ops@example.com',
        roles: ['superAdmin'],
        active: true,
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/roles\[0\]/i);

    expect(() =>
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: 'ws-1',
        email: 'ops@example.com',
        roles: ['operator', 'operator'],
        active: true,
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/duplicates/i);
  });

  it('rejects invalid active values', () => {
    expect(() =>
      parseWorkspaceUserV1({
        userId: 'user-1',
        workspaceId: 'ws-1',
        email: 'ops@example.com',
        roles: ['operator'],
        active: 'yes',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/active.*boolean/i);
  });
});

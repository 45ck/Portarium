import { describe, expect, it } from 'vitest';

import { TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import { parseWorkspaceUserV1 } from '../../domain/users/index.js';
import { InMemoryWorkspaceUserStore } from './in-memory-workspace-user-store.js';

const T = TenantId('t-1');
const WS = WorkspaceId('ws-1');

function makeUser(userId: string, workspaceId = 'ws-1') {
  return parseWorkspaceUserV1({
    userId,
    workspaceId,
    email: `${userId}@example.com`,
    displayName: `User ${userId}`,
    roles: ['operator'],
    active: true,
    createdAtIso: '2026-01-01T00:00:00Z',
  });
}

describe('InMemoryWorkspaceUserStore', () => {
  it('saves, gets, and removes a workspace user', async () => {
    const store = new InMemoryWorkspaceUserStore();
    await store.saveWorkspaceUser(T, makeUser('user-1'));

    const found = await store.getWorkspaceUserById(T, WS, UserId('user-1'));
    expect(found?.email).toBe('user-1@example.com');

    await store.removeWorkspaceUser(T, WS, UserId('user-1'));
    expect(await store.getWorkspaceUserById(T, WS, UserId('user-1'))).toBeNull();
  });

  it('lists users by workspace with cursor pagination', async () => {
    const store = new InMemoryWorkspaceUserStore();
    await store.saveWorkspaceUser(T, makeUser('user-a'));
    await store.saveWorkspaceUser(T, makeUser('user-b'));
    await store.saveWorkspaceUser(T, makeUser('user-c', 'ws-other'));

    const firstPage = await store.listWorkspaceUsers(T, WS, { limit: 1 });
    expect(firstPage.items.map((user) => String(user.userId))).toEqual(['user-a']);
    expect(firstPage.nextCursor).toBe('user-a');

    const cursor = firstPage.nextCursor;
    if (!cursor) throw new Error('Expected first page to include nextCursor.');
    const secondPage = await store.listWorkspaceUsers(T, WS, {
      limit: 10,
      cursor,
    });
    expect(secondPage.items.map((user) => String(user.userId))).toEqual(['user-b']);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it('isolates users by tenant and workspace', async () => {
    const store = new InMemoryWorkspaceUserStore();
    await store.saveWorkspaceUser(T, makeUser('user-1'));

    expect(await store.getWorkspaceUserById(TenantId('other'), WS, UserId('user-1'))).toBeNull();
    expect(await store.getWorkspaceUserById(T, WorkspaceId('other'), UserId('user-1'))).toBeNull();
  });
});

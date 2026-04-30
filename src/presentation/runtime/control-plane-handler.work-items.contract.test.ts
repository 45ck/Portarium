import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import type {
  ListWorkItemsFilter,
  WorkItemStore,
  WorkforceMemberStore,
} from '../../application/ports/index.js';
import { UserId, WorkItemId, WorkforceMemberId } from '../../domain/primitives/index.js';
import { parseWorkforceMemberV1 } from '../../domain/workforce/index.js';
import { parseWorkItemV1, type WorkItemV1 } from '../../domain/work-items/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

type HandlerDeps = Parameters<typeof createControlPlaneHandler>[0];

const WORKSPACE_ID = 'workspace-1';

function makeCtx() {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'user-1',
    roles: ['admin'],
    correlationId: 'corr-work-items',
  });
}

function makeWorkItem(overrides: Partial<WorkItemV1> = {}): WorkItemV1 {
  return parseWorkItemV1({
    schemaVersion: 1,
    workItemId: 'wi-1',
    workspaceId: WORKSPACE_ID,
    createdAtIso: '2026-04-30T00:00:00.000Z',
    createdByUserId: 'user-1',
    title: 'Review controlled run',
    status: 'Open',
    ...overrides,
  });
}

function makeWorkItemStore(initialItems: readonly WorkItemV1[] = [makeWorkItem()]): WorkItemStore {
  const items = new Map(initialItems.map((item) => [String(item.workItemId), item]));
  return {
    getWorkItemById: vi.fn(async (_tenantId, workspaceId, workItemId) => {
      const item = items.get(String(workItemId)) ?? null;
      return item && item.workspaceId === workspaceId ? item : null;
    }),
    listWorkItems: vi.fn(async (_tenantId, workspaceId, filter: ListWorkItemsFilter) => {
      const filtered = [...items.values()].filter((item) => {
        if (item.workspaceId !== workspaceId) return false;
        if (filter.status && item.status !== filter.status) return false;
        if (filter.ownerUserId && item.ownerUserId !== filter.ownerUserId) return false;
        return true;
      });
      return { items: filtered, ...(filter.cursor ? { nextCursor: filter.cursor } : {}) };
    }),
    saveWorkItem: vi.fn(async (_tenantId, workItem) => {
      items.set(String(workItem.workItemId), workItem);
    }),
  };
}

function makeWorkforceMemberStore(): WorkforceMemberStore {
  const member = parseWorkforceMemberV1({
    schemaVersion: 1,
    workforceMemberId: 'wm-1',
    linkedUserId: 'user-2',
    displayName: 'Operator Two',
    capabilities: ['operations.dispatch'],
    availabilityStatus: 'available',
    queueMemberships: [],
    tenantId: WORKSPACE_ID,
    createdAtIso: '2026-04-30T00:00:00.000Z',
  });
  return {
    getWorkforceMemberById: vi.fn(async (_tenantId, workforceMemberId) =>
      workforceMemberId === WorkforceMemberId('wm-1') ? member : null,
    ),
    listWorkforceMembersByIds: vi.fn(async () => [member]),
  };
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx()),
    },
    authorization: {
      isAllowed: async () => true,
    },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    ...overrides,
  };
}

async function startWith(deps: HandlerDeps): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
}

function url(path: string): string {
  return `http://${handle!.host}:${handle!.port}${path}`;
}

describe('control-plane work-item routes', () => {
  it('lists, reads, and patches workspace work items', async () => {
    const workItemStore = makeWorkItemStore();
    await startWith(makeDeps({ workItemStore }));

    const listRes = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items?status=Open`));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { items: WorkItemV1[] };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]!.workItemId).toBe('wi-1');

    const getRes = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items/wi-1`));
    expect(getRes.status).toBe(200);
    expect(((await getRes.json()) as WorkItemV1).title).toBe('Review controlled run');

    const patchRes = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items/wi-1`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'InProgress', title: 'Review updated run' }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as WorkItemV1;
    expect(patchBody.status).toBe('InProgress');
    expect(patchBody.title).toBe('Review updated run');
  });

  it('creates work items and writes owner assignment from workforce members', async () => {
    const workItemStore = makeWorkItemStore([]);
    await startWith(
      makeDeps({
        workItemStore,
        workforceMemberStore: makeWorkforceMemberStore(),
        clock: () => new Date('2026-04-30T01:02:03.000Z'),
      }),
    );

    const createRes = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Investigate exception' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as WorkItemV1;
    expect(created.workItemId).toMatch(/^wi-/);
    expect(created.createdAtIso).toBe('2026-04-30T01:02:03.000Z');

    const assignmentRes = await fetch(
      url(`/v1/workspaces/${WORKSPACE_ID}/work-items/${created.workItemId}/assignment`),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workforceMemberId: 'wm-1' }),
      },
    );
    expect(assignmentRes.status).toBe(200);
    expect(await assignmentRes.json()).toEqual({
      workItemId: created.workItemId,
      ownerUserId: 'user-2',
      workforceMemberId: 'wm-1',
    });

    const readAssignmentRes = await fetch(
      url(`/v1/workspaces/${WORKSPACE_ID}/work-items/${created.workItemId}/assignment`),
    );
    expect(readAssignmentRes.status).toBe(200);
    expect(await readAssignmentRes.json()).toEqual({
      workItemId: created.workItemId,
      ownerUserId: 'user-2',
    });
  });

  it('clears work item owner assignment', async () => {
    const workItemStore = makeWorkItemStore([
      makeWorkItem({ workItemId: WorkItemId('wi-assigned'), ownerUserId: UserId('user-2') }),
    ]);
    await startWith(makeDeps({ workItemStore }));

    const clearRes = await fetch(
      url(`/v1/workspaces/${WORKSPACE_ID}/work-items/wi-assigned/assignment`),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workforceMemberId: null }),
      },
    );
    expect(clearRes.status).toBe(200);
    expect(await clearRes.json()).toEqual({ workItemId: 'wi-assigned' });

    const getRes = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items/wi-assigned`));
    const body = (await getRes.json()) as WorkItemV1;
    expect(body.ownerUserId).toBeUndefined();
  });

  it('returns service unavailable when work item storage is not configured', async () => {
    await startWith(makeDeps());

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items`));
    expect(res.status).toBe(503);
  });
});

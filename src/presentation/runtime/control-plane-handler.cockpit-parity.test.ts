import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { createCanonicalWorkItemSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';
import {
  ApprovalId,
  EvidenceId,
  RunId,
  UserId,
  WorkItemId,
  WorkflowId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

const WORKSPACE_ID = 'ws-cockpit-parity-1';
const OTHER_WORKSPACE_ID = 'ws-cockpit-parity-2';
const WORK_ITEM_ID = 'wi-cockpit-parity-1';
const PLAN_ID = 'plan-cockpit-parity-1';

type WorkspaceRole = 'admin' | 'operator' | 'approver' | 'auditor';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly WorkspaceRole[] = ['operator'], workspaceId = WORKSPACE_ID) {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-cockpit-parity-1',
    roles,
    correlationId: 'corr-cockpit-parity',
  });
}

function makeWorkItem(workspaceId = WORKSPACE_ID) {
  return createCanonicalWorkItemSeedV1({
    workItemId: WorkItemId(WORK_ITEM_ID),
    workspaceId: WorkspaceId(workspaceId),
    createdByUserId: UserId('user-cockpit-parity-1'),
    ownerUserId: UserId('user-cockpit-parity-2'),
    links: {
      runIds: [RunId('run-cockpit-parity-1')],
      workflowIds: [WorkflowId('wf-cockpit-parity-1')],
      approvalIds: [ApprovalId('approval-cockpit-parity-1')],
      evidenceIds: [EvidenceId('evi-cockpit-parity-1')],
    },
  });
}

function makePlan(workspaceId = WORKSPACE_ID) {
  return {
    schemaVersion: 1,
    planId: PLAN_ID,
    workspaceId,
    createdAtIso: '2026-04-30T00:00:00.000Z',
    createdByUserId: 'user-cockpit-parity-1',
    plannedEffects: [
      {
        effectId: 'effect-cockpit-parity-1',
        operation: 'Update',
        target: {
          sorName: 'jira',
          portFamily: 'ProjectsWorkMgmt',
          externalId: 'PROJ-1',
          externalType: 'Issue',
        },
        summary: 'Update linked issue.',
      },
    ],
  } as const;
}

function makeDeps(overrides: Record<string, unknown> = {}): ControlPlaneDeps {
  const workItems = [makeWorkItem(), makeWorkItem(OTHER_WORKSPACE_ID)];
  const plans = [makePlan(), makePlan(OTHER_WORKSPACE_ID)];

  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx()),
    },
    authorization: {
      isAllowed: vi.fn(async () => true),
    },
    workspaceStore: {
      getWorkspaceById: vi.fn(async () => null),
      getWorkspaceByName: vi.fn(async () => null),
      saveWorkspace: vi.fn(async () => undefined),
    },
    runStore: {
      getRunById: vi.fn(async () => null),
      saveRun: vi.fn(async () => undefined),
    },
    evidenceLog: {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        previousHash: 'hash-prev',
        hashSha256: 'hash-next',
      })),
    },
    workItemStore: {
      getWorkItemById: vi.fn(async (_tenantId, workspaceId, workItemId) => {
        return (
          workItems.find(
            (item) =>
              String(item.workspaceId) === String(workspaceId) &&
              String(item.workItemId) === String(workItemId),
          ) ?? null
        );
      }),
      listWorkItems: vi.fn(async (_tenantId, workspaceId) => ({
        items: workItems.filter((item) => String(item.workspaceId) === String(workspaceId)),
      })),
      saveWorkItem: vi.fn(async () => undefined),
    },
    planQueryStore: {
      getPlanById: vi.fn(async (_tenantId, workspaceId, planId) => {
        return (
          plans.find(
            (plan) =>
              String(plan.workspaceId) === String(workspaceId) &&
              String(plan.planId) === String(planId),
          ) ?? null
        );
      }),
    },
    ...overrides,
  } as unknown as ControlPlaneDeps;
}

async function startWith(overrides: Record<string, unknown> = {}): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(overrides)),
  });
}

function url(path: string): string {
  return `http://127.0.0.1:${handle!.port}${path}`;
}

async function readProblem(
  res: Response,
): Promise<{ type?: string; title?: string; status?: number }> {
  expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  return (await res.json()) as { type?: string; title?: string; status?: number };
}

describe('Cockpit work-items API parity', () => {
  it('lists work items from the requested workspace only', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { workspaceId: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.workspaceId).toBe(WORKSPACE_ID);
  });

  it('returns an empty list for a workspace with no work items', async () => {
    const emptyWorkspaceId = 'ws-cockpit-parity-empty';
    await startWith({
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'], emptyWorkspaceId)),
      },
    });

    const res = await fetch(url(`/v1/workspaces/${emptyWorkspaceId}/work-items`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it('returns 401 when list authentication fails', async () => {
    await startWith({
      authentication: {
        authenticateBearerToken: async () =>
          err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
      },
    });

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items`));

    expect(res.status).toBe(401);
    const body = await readProblem(res);
    expect(body.title).toBe('Unauthorized');
  });

  it('returns 403 when the caller cannot read work items', async () => {
    await startWith({ authorization: { isAllowed: vi.fn(async () => false) } });

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items`));

    expect(res.status).toBe(403);
    const body = await readProblem(res);
    expect(body.title).toBe('Forbidden');
  });

  it('returns 422 Problem Details for invalid list filters', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items?status=NotAStatus`));

    expect(res.status).toBe(422);
    const body = await readProblem(res);
    expect(body.type).toMatch(/validation-failed/);
  });

  it('returns 404 Problem Details when a work item is missing', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items/wi-missing`));

    expect(res.status).toBe(404);
    const body = await readProblem(res);
    expect(body.type).toMatch(/not-found/);
  });

  it('returns 412 for stale work item updates', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/work-items/${WORK_ITEM_ID}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'if-match': '"stale-revision"' },
      body: JSON.stringify({ status: 'InProgress' }),
    });

    expect(res.status).toBe(412);
    const body = await readProblem(res);
    expect(body.type).toMatch(/precondition-failed/);
  });

  it('returns 422 Problem Details for invalid assignment payloads', async () => {
    await startWith();

    const res = await fetch(
      url(`/v1/workspaces/${WORKSPACE_ID}/work-items/${WORK_ITEM_ID}/assignment`),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workforceMemberId: '' }),
      },
    );

    expect(res.status).toBe(422);
    const body = await readProblem(res);
    expect(body.type).toMatch(/validation-failed/);
  });
});

describe('Cockpit plan API parity', () => {
  it('returns a plan scoped to the requested workspace', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/plans/${PLAN_ID}`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { workspaceId: string; planId: string };
    expect(body.workspaceId).toBe(WORKSPACE_ID);
    expect(body.planId).toBe(PLAN_ID);
  });

  it('returns 403 when the requested plan workspace differs from the token workspace', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${OTHER_WORKSPACE_ID}/plans/${PLAN_ID}`));

    expect(res.status).toBe(403);
    const body = await readProblem(res);
    expect(body.type).toMatch(/forbidden/);
  });

  it('returns 404 Problem Details when the plan is missing', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/plans/plan-missing`));

    expect(res.status).toBe(404);
    const body = await readProblem(res);
    expect(body.type).toMatch(/not-found/);
  });
});

describe('Cockpit evidence API parity', () => {
  it('returns an empty evidence list for a workspace with no evidence', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/evidence`));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it('returns 401 when evidence list authentication fails', async () => {
    await startWith({
      authentication: {
        authenticateBearerToken: async () =>
          err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
      },
    });

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/evidence`));

    expect(res.status).toBe(401);
    const body = await readProblem(res);
    expect(body.title).toBe('Unauthorized');
  });

  it('returns 403 when the caller cannot read evidence', async () => {
    await startWith({ authorization: { isAllowed: vi.fn(async () => false) } });

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/evidence`));

    expect(res.status).toBe(403);
    const body = await readProblem(res);
    expect(body.title).toBe('Forbidden');
  });

  it('returns 422 Problem Details for invalid evidence category filters', async () => {
    await startWith();

    const res = await fetch(url(`/v1/workspaces/${WORKSPACE_ID}/evidence?category=Invalid`));

    expect(res.status).toBe(422);
    const body = await readProblem(res);
    expect(body.type).toMatch(/validation-failed/);
  });
});

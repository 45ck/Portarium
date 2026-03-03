/**
 * Contract tests for the approval CRUD routes.
 *
 *   GET  /v1/workspaces/:workspaceId/approvals
 *   GET  /v1/workspaces/:workspaceId/approvals/:approvalId
 *   POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { ApprovalId, PlanId, RunId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import type { ApprovalPendingV1, ApprovalV1 } from '../../domain/approvals/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const WORKSPACE_ID = 'ws-approval-contract-1';
const APPROVAL_ID = 'approval-contract-1';

const PENDING_APPROVAL: ApprovalPendingV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId(APPROVAL_ID),
  workspaceId: WorkspaceId(WORKSPACE_ID),
  runId: RunId('run-1'),
  planId: PlanId('plan-1'),
  prompt: 'Approve this tool invocation.',
  requestedAtIso: '2026-03-01T00:00:00.000Z',
  requestedByUserId: UserId('requester-1'),
  status: 'Pending',
};

function makeCtx(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'approver-1',
    roles,
    correlationId: 'corr-approval-contract',
  });
}

function makeDeps(
  overrides: {
    approvals?: ApprovalV1[];
    roles?: readonly ('admin' | 'operator' | 'approver' | 'auditor')[];
  } = {},
): ControlPlaneDeps {
  const store = new Map<string, ApprovalV1>();
  for (const a of overrides.approvals ?? []) {
    store.set(String(a.approvalId), a);
  }
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx(overrides.roles ?? ['operator'])),
    },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    approvalStore: {
      getApprovalById: async (_t, _w, id) => store.get(String(id)) ?? null,
      saveApproval: async (_t, approval) => {
        store.set(String(approval.approvalId), approval);
      },
    },
    approvalQueryStore: {
      listApprovals: async () => ({ items: [...store.values()] }),
    },
  };
}

async function startWith(
  overrides: Parameters<typeof makeDeps>[0] = {},
): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(overrides)),
  });
}

const BASE = 'http://127.0.0.1';
function listUrl(): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals`;
}
function getUrl(id = APPROVAL_ID): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals/${id}`;
}
function decideUrl(id = APPROVAL_ID): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals/${id}/decide`;
}

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/approvals
// ---------------------------------------------------------------------------

describe('GET /approvals — list', () => {
  it('returns 200 with empty list when no approvals exist', async () => {
    await startWith();
    const res = await fetch(listUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it('returns 200 with items when approvals exist', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(listUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/approvals/:approvalId
// ---------------------------------------------------------------------------

describe('GET /approvals/:approvalId — get', () => {
  it('returns 200 with the approval', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(getUrl());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBe(APPROVAL_ID);
    expect(body.status).toBe('Pending');
  });

  it('returns 404 when approval does not exist', async () => {
    await startWith();
    const res = await fetch(getUrl('nonexistent'));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/not-found/);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide
// ---------------------------------------------------------------------------

describe('POST /approvals/:approvalId/decide', () => {
  it('returns 422 when body is not JSON', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/validation-failed/);
  });

  it('returns 422 when decision is invalid', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Maybe', rationale: 'unsure' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/decision must be one of/);
  });

  it('returns 200 on successful Approved decision', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBe(APPROVAL_ID);
    expect(body.status).toBe('Approved');
  });

  it('returns 200 on successful Denied decision', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Denied', rationale: 'Too risky.' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBe(APPROVAL_ID);
    expect(body.status).toBe('Denied');
  });

  it('returns 404 when approval does not exist', async () => {
    await startWith();
    const res = await fetch(decideUrl('nonexistent'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/not-found/);
  });

  it('returns 409 when approval is already decided', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    // First: decide it
    const first = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'First.' }),
    });
    expect(first.status).toBe(200);
    // Second: try to decide again
    const second = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Denied', rationale: 'Second attempt.' }),
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { type: string };
    expect(body.type).toMatch(/conflict/);
  });
});

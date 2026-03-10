/**
 * Contract tests for the agent-action execute route.
 *
 * POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute
 *
 * Verifies body validation, missing deps (501), auth rejection, approval not
 * found (404), approval not approved (409), and success (200) branches.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { ApprovalId, PlanId, RunId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import type { ApprovalDecidedV1, ApprovalPendingV1 } from '../../domain/approvals/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import { startHealthServer } from './health-server.js';
import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const WORKSPACE_ID = 'ws-execute-contract';
const APPROVAL_ID = 'appr-execute-1';

function makeCtx() {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'agent-system-1',
    roles: ['operator'] as const,
    correlationId: 'corr-execute-contract',
  });
}

const APPROVED_APPROVAL: ApprovalDecidedV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId(APPROVAL_ID),
  workspaceId: WorkspaceId(WORKSPACE_ID),
  runId: RunId('run-1'),
  planId: PlanId('plan-1'),
  prompt: 'Execute tool.',
  requestedAtIso: '2026-03-01T00:00:00.000Z',
  requestedByUserId: UserId('agent-1'),
  status: 'Approved',
  decidedAtIso: '2026-03-01T00:01:00.000Z',
  decidedByUserId: UserId('approver-1'),
  rationale: 'Approved.',
};

function makeDeps(overrides: Partial<ControlPlaneDeps> = {}): ControlPlaneDeps {
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
    approvalStore: {
      getApprovalById: async () => APPROVED_APPROVAL,
      saveApproval: async () => undefined,
    },
    actionRunner: {
      dispatchAction: async () => ({ ok: true as const, output: { executed: true } }),
    },
    eventPublisher: {
      publish: async () => undefined,
    },
    unitOfWork: {
      execute: async (fn) => fn(),
    },
    ...overrides,
  };
}

async function startWith(overrides: Partial<ControlPlaneDeps> = {}): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(overrides)),
  });
}

function executeUrl(approvalId = APPROVAL_ID): string {
  return `http://127.0.0.1:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/agent-actions/${approvalId}/execute`;
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute
// ---------------------------------------------------------------------------

describe('POST /agent-actions/:approvalId/execute — missing deps', () => {
  it('returns 501 when approvalStore is not wired', async () => {
    const deps = makeDeps();
    // Use a fresh deps object without approvalStore to avoid exactOptionalPropertyTypes issues
    const { approvalStore: _removed, ...depsWithoutApprovalStore } = deps;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(depsWithoutApprovalStore),
    });
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name' }),
    });
    expect(res.status).toBe(501);
  });

  it('returns 501 when actionRunner is not wired', async () => {
    const deps = makeDeps();
    const { actionRunner: _removed, ...depsWithoutActionRunner } = deps;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(depsWithoutActionRunner),
    });
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name' }),
    });
    expect(res.status).toBe(501);
  });
});

describe('POST /agent-actions/:approvalId/execute — body validation', () => {
  it('returns 422 when body is not a JSON object', async () => {
    await startWith();
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/validation-failed/);
  });

  it('returns 422 when flowRef is missing', async () => {
    await startWith();
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/flowRef/);
  });
});

describe('POST /agent-actions/:approvalId/execute — approval not found', () => {
  it('returns 404 when approval does not exist', async () => {
    await startWith({
      approvalStore: {
        getApprovalById: async () => null,
        saveApproval: async () => undefined,
      },
    });
    const res = await fetch(executeUrl('appr-missing'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /agent-actions/:approvalId/execute — wrong approval status', () => {
  it('returns 409 when approval is Pending (not Approved)', async () => {
    const pendingApproval: ApprovalPendingV1 = {
      schemaVersion: 1,
      approvalId: ApprovalId(APPROVAL_ID),
      workspaceId: WorkspaceId(WORKSPACE_ID),
      runId: RunId('run-1'),
      planId: PlanId('plan-1'),
      prompt: 'Execute tool.',
      requestedAtIso: '2026-03-01T00:00:00.000Z',
      requestedByUserId: UserId('agent-1'),
      status: 'Pending',
    };
    await startWith({
      approvalStore: {
        getApprovalById: async () => pendingApproval,
        saveApproval: async () => undefined,
      },
    });
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name' }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/conflict/);
    expect(body.detail).toMatch(/Approved/);
  });
});

describe('POST /agent-actions/:approvalId/execute — success', () => {
  it('returns 200 with executionId when action runner succeeds', async () => {
    await startWith();
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name', payload: { key: 'value' } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      executionId: string;
      approvalId: string;
      status: string;
      output: unknown;
    };
    expect(body.executionId).toBeDefined();
    expect(body.approvalId).toBe(APPROVAL_ID);
    expect(body.status).toBe('Executed');
    expect(body.output).toEqual({ executed: true });
  });

  it('returns 200 with Failed status when action runner fails', async () => {
    await startWith({
      actionRunner: {
        dispatchAction: async () => ({
          ok: false as const,
          errorKind: 'RemoteError' as const,
          message: 'Downstream system unavailable.',
        }),
      },
    });
    const res = await fetch(executeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flowRef: 'machine-1/tool-name' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; errorMessage: string };
    expect(body.status).toBe('Failed');
    expect(body.errorMessage).toBe('Downstream system unavailable.');
  });
});

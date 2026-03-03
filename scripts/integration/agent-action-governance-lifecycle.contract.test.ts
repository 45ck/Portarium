/**
 * Integration contract tests for the agent-action governance lifecycle.
 *
 * Covers the full propose → poll approval → decide → execute pipeline
 * through HTTP endpoints on the control plane.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../src/application/common/context.js';
import { ok } from '../../src/application/common/result.js';
import type { ApprovalV1 } from '../../src/domain/approvals/index.js';
import { parsePolicyV1 } from '../../src/domain/policy/index.js';
import { HashSha256 } from '../../src/domain/primitives/index.js';
import type { EvidenceEntryAppendInput, EvidenceLogPort } from '../../src/application/ports/index.js';
import type { TenantId } from '../../src/domain/primitives/index.js';
import { createControlPlaneHandler } from '../../src/presentation/runtime/control-plane-handler.js';
import type { ControlPlaneDeps } from '../../src/presentation/runtime/control-plane-handler.shared.js';
import type { HealthServerHandle } from '../../src/presentation/runtime/health-server.js';
import { startHealthServer } from '../../src/presentation/runtime/health-server.js';

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-gov-lifecycle';
const OPERATOR_ID = 'operator-gov-1';
const APPROVER_ID = 'approver-gov-1';

let handle: HealthServerHandle | undefined;
let approvalStore: Map<string, ApprovalV1>;
let publishedEvents: unknown[];
let callCount: number;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(
  principalId: string,
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[],
) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId,
    roles,
    correlationId: 'corr-gov-lifecycle',
  });
}

function makePolicy() {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-gov-1',
    workspaceId: WORKSPACE_ID,
    name: 'Governance Lifecycle Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    createdByUserId: 'policy-admin-1',
  });
}

function makeDeps(
  principalId: string,
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[],
): ControlPlaneDeps {
  approvalStore = new Map();
  publishedEvents = [];
  callCount = 0;
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx(principalId, roles)),
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
    policyStore: {
      getPolicyById: async () => makePolicy(),
    },
    approvalStore: {
      getApprovalById: async (_t, _w, id) => approvalStore.get(String(id)) ?? null,
      saveApproval: async (_t, approval) => {
        approvalStore.set(String(approval.approvalId), approval);
      },
    },
    approvalQueryStore: {
      listApprovals: async (_t, _w, filter) => {
        let items = [...approvalStore.values()];
        if (filter.status) items = items.filter((a) => a.status === filter.status);
        return { items };
      },
    },
    eventPublisher: {
      publish: async (event) => {
        publishedEvents.push(event);
      },
    },
    evidenceLog: {
      appendEntry: async (_tenantId: TenantId, entry: EvidenceEntryAppendInput) => ({
        ...entry,
        previousHash: HashSha256(''),
        hashSha256: HashSha256(`hash-${++callCount}`),
      }),
    } as unknown as EvidenceLogPort,
    unitOfWork: {
      execute: async (fn) => fn(),
    },
  };
}

async function startServer(
  principalId: string,
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[],
): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(principalId, roles)),
  });
}

function baseUrl(): string {
  return `http://127.0.0.1:${handle!.port}`;
}

function proposeUrl(): string {
  return `${baseUrl()}/v1/workspaces/${WORKSPACE_ID}/agent-actions:propose`;
}

function approvalUrl(approvalId: string): string {
  return `${baseUrl()}/v1/workspaces/${WORKSPACE_ID}/approvals/${approvalId}`;
}

function decideUrl(approvalId: string): string {
  return `${baseUrl()}/v1/workspaces/${WORKSPACE_ID}/approvals/${approvalId}/decide`;
}

function listApprovalsUrl(query = ''): string {
  return `${baseUrl()}/v1/workspaces/${WORKSPACE_ID}/approvals${query ? `?${query}` : ''}`;
}

// ---------------------------------------------------------------------------
// Allow flow: ReadOnly tool, Auto tier
// ---------------------------------------------------------------------------

describe('Allow flow (ReadOnly tool, Auto tier)', () => {
  it('propose returns 200 Allow and no approvalId', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'query:listFiles',
        toolName: 'file:list',
        executionTier: 'Auto',
        policyIds: ['pol-gov-1'],
        rationale: 'Read-only file listing.',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['decision']).toBe('Allow');
    expect(body['proposalId']).toBeDefined();
    expect(body['approvalId']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// NeedsApproval flow: Mutation tool, HumanApprove tier with maker-checker
// ---------------------------------------------------------------------------

describe('NeedsApproval flow (Mutation tool, HumanApprove tier)', () => {
  it('propose → poll → approve → verify full lifecycle', async () => {
    // Phase 1: Propose (as operator)
    await startServer(OPERATOR_ID, ['operator']);

    const proposeRes = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-sender',
        actionKind: 'comms:sendEmail',
        toolName: 'email:send',
        executionTier: 'HumanApprove',
        policyIds: ['pol-gov-1'],
        rationale: 'Mutation tool requires approval.',
      }),
    });

    expect(proposeRes.status).toBe(202);
    const proposeBody = (await proposeRes.json()) as Record<string, unknown>;
    expect(proposeBody['decision']).toBe('NeedsApproval');
    const approvalId = proposeBody['approvalId'] as string;
    expect(approvalId).toBeDefined();
    expect(typeof approvalId).toBe('string');

    // Phase 2: Poll approval (GET)
    const getRes = await fetch(approvalUrl(approvalId));
    expect(getRes.status).toBe(200);
    const approval = (await getRes.json()) as Record<string, unknown>;
    expect(approval['status']).toBe('Pending');
    expect(approval['approvalId']).toBe(approvalId);

    // Phase 3: List pending approvals
    const listRes = await fetch(listApprovalsUrl('status=Pending'));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items.length).toBeGreaterThanOrEqual(1);

    // Phase 4: Decide — restart server as approver (different user for maker-checker)
    await handle?.close();
    handle = undefined;

    // Re-use same approval store state by building deps with shared store
    const sharedStore = approvalStore;
    const sharedEvents = publishedEvents;
    let sharedCallCount = callCount;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(APPROVER_ID, ['approver'])),
        },
        authorization: { isAllowed: async () => true },
        workspaceStore: {
          getWorkspaceById: async () => null,
          getWorkspaceByName: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: { getRunById: async () => null, saveRun: async () => undefined },
        policyStore: { getPolicyById: async () => makePolicy() },
        approvalStore: {
          getApprovalById: async (_t, _w, id) => sharedStore.get(String(id)) ?? null,
          saveApproval: async (_t, a) => {
            sharedStore.set(String(a.approvalId), a);
          },
        },
        approvalQueryStore: {
          listApprovals: async () => ({ items: [...sharedStore.values()] }),
        },
        eventPublisher: { publish: async (event) => { sharedEvents.push(event); } },
        evidenceLog: {
          appendEntry: async (_tenantId: TenantId, entry: EvidenceEntryAppendInput) => ({
            ...entry,
            previousHash: HashSha256(''),
            hashSha256: HashSha256(`hash-${++sharedCallCount}`),
          }),
        } as unknown as EvidenceLogPort,
        unitOfWork: { execute: async (fn) => fn() },
      }),
    });

    const decideRes = await fetch(decideUrl(approvalId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved',
        rationale: 'Reviewed and approved.',
      }),
    });

    expect(decideRes.status).toBe(200);
    const decideBody = (await decideRes.json()) as Record<string, unknown>;
    expect(decideBody['status']).toBe('Approved');

    // Verify approval is now Approved
    const verifyRes = await fetch(approvalUrl(approvalId));
    expect(verifyRes.status).toBe(200);
    const verifiedApproval = (await verifyRes.json()) as Record<string, unknown>;
    expect(verifiedApproval['status']).toBe('Approved');
  });
});

// ---------------------------------------------------------------------------
// Denied flow: Dangerous tool
// ---------------------------------------------------------------------------

describe('Denied flow (Dangerous tool)', () => {
  it('propose returns 403 Forbidden for dangerous tool', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-admin',
        actionKind: 'system:exec',
        toolName: 'shell:exec',
        executionTier: 'ManualOnly',
        policyIds: ['pol-gov-1'],
        rationale: 'Dangerous system tool.',
      }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/forbidden/);
    expect(body.detail).toMatch(/Dangerous/);
  });
});

// ---------------------------------------------------------------------------
// Denied approval flow
// ---------------------------------------------------------------------------

describe('Denied approval flow', () => {
  it('propose → deny → verify status is Denied', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    // Propose mutation
    const proposeRes = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-deleter',
        actionKind: 'data:delete',
        toolName: 'record:delete',
        executionTier: 'HumanApprove',
        policyIds: ['pol-gov-1'],
        rationale: 'Delete operation requires approval.',
      }),
    });

    expect(proposeRes.status).toBe(202);
    const proposeBody = (await proposeRes.json()) as Record<string, unknown>;
    const approvalId = proposeBody['approvalId'] as string;

    // Switch to approver and deny
    await handle?.close();
    handle = undefined;
    const sharedStore = approvalStore;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(APPROVER_ID, ['approver'])),
        },
        authorization: { isAllowed: async () => true },
        workspaceStore: {
          getWorkspaceById: async () => null,
          getWorkspaceByName: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: { getRunById: async () => null, saveRun: async () => undefined },
        policyStore: { getPolicyById: async () => makePolicy() },
        approvalStore: {
          getApprovalById: async (_t, _w, id) => sharedStore.get(String(id)) ?? null,
          saveApproval: async (_t, a) => {
            sharedStore.set(String(a.approvalId), a);
          },
        },
        eventPublisher: { publish: async () => undefined },
        evidenceLog: {
          appendEntry: async (_tenantId: TenantId, entry: EvidenceEntryAppendInput) => ({
            ...entry,
            previousHash: HashSha256(''),
            hashSha256: HashSha256('hash-deny'),
          }),
        } as unknown as EvidenceLogPort,
        unitOfWork: { execute: async (fn) => fn() },
      }),
    });

    const denyRes = await fetch(decideUrl(approvalId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Denied',
        rationale: 'Too risky, denied.',
      }),
    });

    expect(denyRes.status).toBe(200);
    const denyBody = (await denyRes.json()) as Record<string, unknown>;
    expect(denyBody['status']).toBe('Denied');
  });
});

// ---------------------------------------------------------------------------
// Workspace mismatch rejection
// ---------------------------------------------------------------------------

describe('Workspace mismatch rejection', () => {
  it('propose against wrong workspace returns error', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    // Use a different workspace ID in the URL than the auth context
    const wrongWsUrl = `${baseUrl()}/v1/workspaces/ws-wrong/agent-actions:propose`;
    const res = await fetch(wrongWsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'query:list',
        toolName: 'file:list',
        executionTier: 'Auto',
        policyIds: ['pol-gov-1'],
        rationale: 'Test workspace mismatch.',
      }),
    });

    // Should get 403 (workspace scope mismatch) or 422 (validation)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// Auth/authz negative paths
// ---------------------------------------------------------------------------

describe('Auth/authz negative paths', () => {
  it('returns 401 when authentication fails', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ({
            ok: false as const,
            error: { kind: 'Unauthorized' as const, message: 'Invalid token.' },
          }),
        },
        authorization: { isAllowed: async () => true },
        workspaceStore: {
          getWorkspaceById: async () => null,
          getWorkspaceByName: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: { getRunById: async () => null, saveRun: async () => undefined },
        policyStore: { getPolicyById: async () => makePolicy() },
      }),
    });

    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'query:list',
        toolName: 'file:list',
        executionTier: 'Auto',
        policyIds: ['pol-gov-1'],
        rationale: 'Test auth failure.',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when authorization is denied', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(OPERATOR_ID, ['operator'])),
        },
        authorization: { isAllowed: async () => false },
        workspaceStore: {
          getWorkspaceById: async () => null,
          getWorkspaceByName: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: { getRunById: async () => null, saveRun: async () => undefined },
        policyStore: { getPolicyById: async () => makePolicy() },
      }),
    });

    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'query:list',
        toolName: 'file:list',
        executionTier: 'Auto',
        policyIds: ['pol-gov-1'],
        rationale: 'Test authz failure.',
      }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 for GET approval that does not exist', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    const res = await fetch(approvalUrl('appr-nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 409 when deciding an already-decided approval', async () => {
    await startServer(OPERATOR_ID, ['operator']);

    // Propose to create an approval
    const proposeRes = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-writer',
        actionKind: 'data:write',
        toolName: 'record:update',
        executionTier: 'HumanApprove',
        policyIds: ['pol-gov-1'],
        rationale: 'Mutation requires approval.',
      }),
    });
    expect(proposeRes.status).toBe(202);
    const body = (await proposeRes.json()) as Record<string, unknown>;
    const approvalId = body['approvalId'] as string;

    // Switch to approver and approve
    await handle?.close();
    handle = undefined;
    const sharedStore = approvalStore;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(APPROVER_ID, ['approver'])),
        },
        authorization: { isAllowed: async () => true },
        workspaceStore: {
          getWorkspaceById: async () => null,
          getWorkspaceByName: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: { getRunById: async () => null, saveRun: async () => undefined },
        policyStore: { getPolicyById: async () => makePolicy() },
        approvalStore: {
          getApprovalById: async (_t, _w, id) => sharedStore.get(String(id)) ?? null,
          saveApproval: async (_t, a) => {
            sharedStore.set(String(a.approvalId), a);
          },
        },
        eventPublisher: { publish: async () => undefined },
        evidenceLog: {
          appendEntry: async (_tenantId: TenantId, entry: EvidenceEntryAppendInput) => ({
            ...entry,
            previousHash: HashSha256(''),
            hashSha256: HashSha256('hash-conflict'),
          }),
        } as unknown as EvidenceLogPort,
        unitOfWork: { execute: async (fn) => fn() },
      }),
    });

    // First decide: should succeed
    const firstRes = await fetch(decideUrl(approvalId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'OK.' }),
    });
    expect(firstRes.status).toBe(200);

    // Second decide: should conflict
    const secondRes = await fetch(decideUrl(approvalId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Denied', rationale: 'Too late.' }),
    });
    expect(secondRes.status).toBe(409);
  });
});

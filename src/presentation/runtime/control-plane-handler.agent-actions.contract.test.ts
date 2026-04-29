/**
 * Contract tests for the agent-action proposal route.
 *
 * POST /v1/workspaces/:workspaceId/agent-actions:propose
 *
 * Verifies body validation, auth rejection, and the Allow / NeedsApproval /
 * Denied decision branches are returned with correct status codes.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import { parsePolicyV1 } from '../../domain/policy/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const WORKSPACE_ID = 'ws-contract-1';

function makeCtx(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator']) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'operator-1',
    roles,
    correlationId: 'corr-agent-action-contract',
  });
}

function makePolicy() {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-contract-1',
    workspaceId: WORKSPACE_ID,
    name: 'Contract Test Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    createdByUserId: 'policy-admin-1',
  });
}

const savedApprovals: unknown[] = [];

function makeDeps(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
): ControlPlaneDeps {
  savedApprovals.length = 0;
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx(roles)),
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
      savePolicy: async () => {},
    },
    approvalStore: {
      getApprovalById: async () => null,
      saveApproval: async (_tenantId, approval) => {
        savedApprovals.push(approval);
      },
    },
    unitOfWork: {
      execute: async (fn) => fn(),
    },
    eventPublisher: {
      publish: async () => undefined,
    },
    evidenceLog: {
      appendEntry: async (_tenantId, entry) => ({
        ...entry,
        previousHash: HashSha256(''),
        hashSha256: HashSha256('hash-contract'),
      }),
    },
  };
}

async function startWithDeps(deps: ControlPlaneDeps): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
}

async function startWith(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
): Promise<void> {
  await startWithDeps(makeDeps(roles));
}

const BASE = 'http://127.0.0.1';
function proposeUrl(): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/agent-actions:propose`;
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/agent-actions:propose
// ---------------------------------------------------------------------------

describe('POST /agent-actions:propose — missing governance deps', () => {
  it.each([['policyStore'], ['approvalStore'], ['eventPublisher'], ['evidenceLog']] as const)(
    'returns 503 when %s is not wired',
    async (dependencyName) => {
      const deps = makeDeps();
      const { [dependencyName]: _removed, ...depsWithoutDependency } = deps;
      await startWithDeps(depsWithoutDependency);

      const res = await fetch(proposeUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-reader',
          actionKind: 'comms:listEmails',
          toolName: 'email:list',
          executionTier: 'Auto',
          policyIds: ['pol-contract-1'],
          rationale: 'Read-only tool.',
        }),
      });

      expect(res.status).toBe(503);
      const body = (await res.json()) as { type: string; detail: string };
      expect(body.type).toMatch(/service-unavailable/);
      expect(body.detail).toContain(dependencyName);
    },
  );
});

describe('POST /agent-actions:propose — body validation', () => {
  it('returns 400 when body is not valid JSON', async () => {
    await startWith();
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/bad-request/);
  });

  it('returns 422 when required fields are missing', async () => {
    await startWith();
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    // agentId is empty string → validation fails
    expect(res.status).toBe(422);
  });
});

describe('POST /agent-actions:propose — decision branches', () => {
  it('returns 200 Allow for ReadOnly tool at Auto tier', async () => {
    await startWith();
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'comms:listEmails',
        toolName: 'email:list',
        executionTier: 'Auto',
        policyIds: ['pol-contract-1'],
        rationale: 'Read-only tool.',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { decision: string; proposalId: string };
    expect(body.decision).toBe('Allow');
    expect(body.proposalId).toBeDefined();
  });

  it('does not leak internal dependency errors in 503 detail', async () => {
    await startWithDeps({
      ...makeDeps(),
      unitOfWork: {
        execute: async () => {
          throw new Error('postgres://policy-db.internal:5432 evidence_log insert failed');
        },
      },
    });
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-reader',
        actionKind: 'comms:listEmails',
        toolName: 'email:list',
        executionTier: 'Auto',
        policyIds: ['pol-contract-1'],
        rationale: 'Read-only tool.',
      }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/correlation ID/i);
    expect(body.detail).not.toContain('policy-db.internal');
    expect(body.detail).not.toContain('evidence_log');
  });

  it('returns 202 NeedsApproval for Mutation tool with approvalId', async () => {
    await startWith();
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-sender',
        actionKind: 'comms:sendEmail',
        toolName: 'email:send',
        executionTier: 'HumanApprove',
        policyIds: ['pol-contract-1'],
        rationale: 'Mutation tool requires approval.',
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      decision: string;
      approvalId: string;
      proposalId: string;
    };
    expect(body.decision).toBe('NeedsApproval');
    expect(body.approvalId).toBeDefined();
    expect(typeof body.approvalId).toBe('string');
    expect(body.proposalId).toBeDefined();
    expect(savedApprovals.length).toBe(1);
  });

  it('returns 403 Forbidden for Dangerous tool', async () => {
    await startWith();
    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-dangerous',
        actionKind: 'system:exec',
        toolName: 'shell:exec',
        executionTier: 'ManualOnly',
        policyIds: ['pol-contract-1'],
        rationale: 'Dangerous tool.',
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/forbidden/);
    expect(body.detail).toMatch(/Dangerous/);
  });
});

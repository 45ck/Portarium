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
import type { WorkspaceStreamEvent } from '../../application/ports/event-stream.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import { parsePolicyV1 } from '../../domain/policy/index.js';
import { InMemoryAgentActionProposalStore } from '../../infrastructure/stores/in-memory-agent-action-proposal-store.js';
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

function makeCtx(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
  principalId = 'operator-1',
) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId,
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

const savedApprovals: ApprovalV1[] = [];

function makeDeps(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
  overrides: Pick<ControlPlaneDeps, 'agentActionProposalStore'> = {},
  principalId = 'operator-1',
): ControlPlaneDeps {
  savedApprovals.length = 0;
  const approvalStore = new Map<string, ApprovalV1>();
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx(roles, principalId)),
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
      getApprovalById: async (_tenantId, _workspaceId, approvalId) =>
        approvalStore.get(String(approvalId)) ?? null,
      saveApproval: async (_tenantId, approval) => {
        savedApprovals.push(approval);
        approvalStore.set(String(approval.approvalId), approval);
      },
    },
    approvalQueryStore: {
      listApprovals: async () => ({ items: [...approvalStore.values()] }),
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
    ...overrides,
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

function approvalUrl(approvalId: string): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals/${approvalId}`;
}

function decideApprovalUrl(approvalId: string): string {
  return `${approvalUrl(approvalId)}/decide`;
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

  it('persists proposals for approval enrichment and decisions', async () => {
    const agentActionProposalStore = new InMemoryAgentActionProposalStore();
    let principalId = 'operator-1';
    const deps = makeDeps(['operator'], { agentActionProposalStore });
    await startWithDeps({
      ...deps,
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'], principalId)),
      },
    });

    const propose = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-sender',
        machineId: 'machine-review-1',
        actionKind: 'comms:sendEmail',
        toolName: 'email:send',
        executionTier: 'HumanApprove',
        policyIds: ['pol-contract-1'],
        rationale: 'Mutation tool requires approval.',
      }),
    });
    expect(propose.status).toBe(202);
    const proposed = (await propose.json()) as {
      decision: string;
      approvalId: string;
      proposalId: string;
    };
    expect(proposed.decision).toBe('NeedsApproval');

    const enriched = await fetch(approvalUrl(proposed.approvalId));
    expect(enriched.status).toBe(200);
    const approval = (await enriched.json()) as {
      agentActionProposal?: {
        proposalId: string;
        agentId: string;
        machineId?: string;
        toolName: string;
      };
    };
    expect(approval.agentActionProposal).toMatchObject({
      proposalId: proposed.proposalId,
      agentId: 'agent-sender',
      machineId: 'machine-review-1',
      toolName: 'email:send',
    });

    principalId = 'approver-1';
    const decision = await fetch(decideApprovalUrl(proposed.approvalId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toMatchObject({
      approvalId: proposed.approvalId,
      status: 'Approved',
    });
  });

  it('publishes ApprovalRequested to the live workspace event stream', async () => {
    const published: WorkspaceStreamEvent[] = [];
    await startWithDeps({
      ...makeDeps(),
      eventStream: {
        publish: (event) => {
          published.push(event);
        },
        subscribe: () => () => undefined,
      },
    });

    const res = await fetch(proposeUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-sender',
        machineId: 'machine-phone-review',
        actionKind: 'comms:sendEmail',
        toolName: 'email:send',
        executionTier: 'HumanApprove',
        policyIds: ['pol-contract-1'],
        rationale: 'Mutation tool requires approval.',
        parameters: { beadId: 'bead-0975', subject: 'Status update' },
      }),
    });

    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      approvalId: string;
      proposalId: string;
    };
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: 'com.portarium.approval.ApprovalRequested',
      workspaceId: WORKSPACE_ID,
      data: {
        approvalId: body.approvalId,
        proposalId: body.proposalId,
        beadId: 'bead-0975',
        agentId: 'agent-sender',
        machineId: 'machine-phone-review',
        toolName: 'email:send',
        executionTier: 'HumanApprove',
        parameters: { beadId: 'bead-0975' },
      },
    });
    const eventData = published[0]?.data as { parameters?: Record<string, unknown> };
    expect(eventData.parameters ?? {}).not.toHaveProperty('subject');
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

/**
 * Contract tests for the approval CRUD routes.
 *
 *   GET  /v1/workspaces/:workspaceId/approvals
 *   GET  /v1/workspaces/:workspaceId/approvals/:approvalId
 *   POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import type { IdempotencyStore } from '../../application/ports/index.js';
import {
  AgentId,
  ApprovalId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  PlanId,
  PolicyId,
  ProposalId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1, ApprovalV1 } from '../../domain/approvals/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import { InMemoryEventStreamBroadcast } from '../../infrastructure/event-streaming/in-memory-event-stream-broadcast.js';
import type { WorkspaceStreamEvent } from '../../application/ports/event-stream.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { InMemoryCockpitWebSessionStore } from './cockpit-web-session.js';
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

const AGENT_ACTION_APPROVAL: ApprovalPendingV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId('approval-agent-contract-1'),
  workspaceId: WorkspaceId(WORKSPACE_ID),
  runId: RunId('proposal-contract-1'),
  planId: PlanId('proposal-contract-1'),
  prompt: 'Approve this agent action.',
  requestedAtIso: '2026-03-01T00:00:00.000Z',
  requestedByUserId: UserId('requester-1'),
  status: 'Pending',
};

function makeAgentActionProposal(): AgentActionProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: ProposalId('proposal-contract-1'),
    workspaceId: WorkspaceId(WORKSPACE_ID),
    agentId: AgentId('agent-contract-1'),
    actionKind: 'invoke-tool',
    toolName: 'write-record',
    executionTier: 'HumanApprove',
    toolClassification: {
      toolName: 'write-record',
      category: 'Mutation',
      minimumTier: 'HumanApprove',
      rationale: 'Writes external state.',
    },
    policyDecision: 'RequireApproval',
    policyIds: [PolicyId('policy-contract-1')],
    decision: 'NeedsApproval',
    approvalId: AGENT_ACTION_APPROVAL.approvalId,
    rationale: 'Needs operator review.',
    requestedByUserId: UserId('requester-1'),
    correlationId: CorrelationId('corr-proposal-contract'),
    proposedAtIso: '2026-03-01T00:00:00.000Z',
    evidenceId: EvidenceId('evidence-contract-1'),
  };
}

function makeCtx(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator']) {
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
    eventStream?: InMemoryEventStreamBroadcast;
    agentActionProposal?: AgentActionProposalV1 | null;
    authorization?: ControlPlaneDeps['authorization'];
    approvalQueryStore?: ControlPlaneDeps['approvalQueryStore'];
    idempotency?: ControlPlaneDeps['idempotency'];
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
    authorization: overrides.authorization ?? { isAllowed: async () => true },
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
    approvalQueryStore: overrides.approvalQueryStore ?? {
      listApprovals: async () => ({ items: [...store.values()] }),
    },
    evidenceLog: {
      appendEntry: async (_tenantId, entry) => ({
        ...entry,
        hashSha256: HashSha256('hash-approval-contract'),
      }),
    },
    ...(overrides.idempotency ? { idempotency: overrides.idempotency } : {}),
    ...(overrides.agentActionProposal !== undefined
      ? {
          agentActionProposalStore: {
            getProposalById: async () => overrides.agentActionProposal ?? null,
            getProposalByApprovalId: async () => overrides.agentActionProposal ?? null,
            getProposalByIdempotencyKey: async () => null,
            saveProposal: async () => undefined,
          },
        }
      : {}),
    ...(overrides.eventStream ? { eventStream: overrides.eventStream } : {}),
  };
}

async function startWith(overrides: Parameters<typeof makeDeps>[0] = {}): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(overrides)),
  });
}

const BASE = 'http://127.0.0.1';
function listUrl(query = ''): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals${query}`;
}
function getUrl(id = APPROVAL_ID): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals/${id}`;
}
function createUrl(): string {
  return `${BASE}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/approvals`;
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

  it('returns 422 before list use-case when status is not a known approval status', async () => {
    let authorizationCalled = false;
    await startWith({
      authorization: {
        isAllowed: async () => {
          authorizationCalled = true;
          return true;
        },
      },
      approvalQueryStore: {
        listApprovals: async () => {
          throw new Error('approval query store should not be called');
        },
      },
    });

    const res = await fetch(listUrl('?status=Done'));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.detail).toContain('status must be one of');
    expect(authorizationCalled).toBe(false);
  });

  it.each(['0', '-1', '10x', '', '1.5'])(
    'returns 422 before list use-case when limit=%s is not a positive integer',
    async (limit) => {
      let authorizationCalled = false;
      await startWith({
        authorization: {
          isAllowed: async () => {
            authorizationCalled = true;
            return true;
          },
        },
        approvalQueryStore: {
          listApprovals: async () => {
            throw new Error('approval query store should not be called');
          },
        },
      });

      const res = await fetch(listUrl(`?limit=${encodeURIComponent(limit)}`));
      expect(res.status).toBe(422);
      const body = (await res.json()) as { type: string; detail: string };
      expect(body.type).toMatch(/validation-failed/);
      expect(body.detail).toBe('limit must be a positive integer.');
      expect(authorizationCalled).toBe(false);
    },
  );
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
// POST /v1/workspaces/:workspaceId/approvals
// ---------------------------------------------------------------------------

describe('POST /approvals', () => {
  it('returns 201 and creates a pending approval', async () => {
    await startWith();

    const res = await fetch(createUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'run-1', planId: 'plan-1', prompt: 'Need approval' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBeTruthy();
    expect(body.status).toBe('Pending');
    expect(res.headers.get('location')).toMatch(
      /\/v1\/workspaces\/ws-approval-contract-1\/approvals\//,
    );
  });

  it('returns 422 when the create payload includes unknown fields', async () => {
    await startWith();

    const res = await fetch(createUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Need approval',
        unexpectedField: true,
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain('unexpectedField');
  });

  it('returns 403 when the caller cannot create approvals', async () => {
    await startWith({
      authorization: {
        isAllowed: async () => false,
      },
    });

    const res = await fetch(createUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'run-1', planId: 'plan-1', prompt: 'Need approval' }),
    });

    expect(res.status).toBe(403);
  });

  it('accepts and returns an artifact-first approval packet', async () => {
    await startWith();

    const res = await fetch(createUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Need approval',
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-contract-1',
          artifacts: [
            {
              artifactId: 'artifact-contract-1',
              title: 'Generated launch brief',
              mimeType: 'text/markdown',
              role: 'primary',
            },
          ],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'marketing.campaign.write',
              reason: 'Publish approved campaign assets.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-1',
            summary: 'Publish generated artifact and metadata.',
            actionIds: ['action-render', 'action-publish'],
            plannedEffectIds: ['effect-1', 'effect-2'],
          },
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      approvalPacket?: { packetId?: string; planScope?: { actionIds?: string[] } };
    };
    expect(body.approvalPacket?.packetId).toBe('packet-contract-1');
    expect(body.approvalPacket?.planScope?.actionIds).toEqual(['action-render', 'action-publish']);
  });

  it('returns 422 when the approval packet is malformed', async () => {
    await startWith();

    const res = await fetch(createUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Need approval',
        approvalPacket: {
          schemaVersion: 1,
          packetId: 'packet-contract-1',
          artifacts: [],
          reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
          requestedCapabilities: [
            {
              capabilityId: 'marketing.campaign.write',
              reason: 'Publish approved campaign assets.',
              required: true,
            },
          ],
          planScope: {
            planId: 'plan-1',
            summary: 'Publish generated artifact and metadata.',
            actionIds: ['action-render'],
            plannedEffectIds: ['effect-1'],
          },
        },
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/artifacts/);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide
// ---------------------------------------------------------------------------

describe('POST /approvals/:approvalId/decide', () => {
  it('requires the same-origin request marker for cookie-authenticated approval decisions', async () => {
    const auth = vi.fn(async () => {
      throw new Error('Bearer authentication should not run for cookie-backed approval decisions.');
    });
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['approver']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ approvals: [PENDING_APPROVAL] }),
        authentication: { authenticateBearerToken: auth },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: {
        cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain('X-Portarium-Request');
    expect(auth).not.toHaveBeenCalled();
  });

  it('accepts cookie-authenticated approval decisions within session workspace scope', async () => {
    const auth = vi.fn(async () => {
      throw new Error('Bearer authentication should not run for cookie-backed approval decisions.');
    });
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['approver']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ approvals: [PENDING_APPROVAL] }),
        authentication: { authenticateBearerToken: auth },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: {
        cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
        'content-type': 'application/json',
        'x-portarium-request': '1',
      },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body).toEqual({ approvalId: APPROVAL_ID, status: 'Approved' });
    expect(auth).not.toHaveBeenCalled();
  });

  it('rejects cookie-authenticated approval decisions outside session workspace scope', async () => {
    const auth = vi.fn(async () => {
      throw new Error('Bearer authentication should not run for cookie-backed approval decisions.');
    });
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['approver']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ approvals: [PENDING_APPROVAL] }),
        authentication: { authenticateBearerToken: auth },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    });

    const res = await fetch(
      `${BASE}:${handle.port}/v1/workspaces/ws-other/approvals/${APPROVAL_ID}/decide`,
      {
        method: 'POST',
        headers: {
          cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
          'content-type': 'application/json',
          'x-portarium-request': '1',
        },
        body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
      },
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Workspace scope mismatch.');
    expect(auth).not.toHaveBeenCalled();
  });

  it('returns 400 when body is not valid JSON', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/bad-request/);
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

  it('returns 200 when safety-classified dual approval includes prior approvers', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved',
        rationale: 'Second approver sign-off.',
        sodConstraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
        previousApproverIds: ['approver-2'],
        robotContext: { safetyClassifiedZone: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBe(APPROVAL_ID);
    expect(body.status).toBe('Approved');
  });

  it('returns 403 when hazardous-zone mission proposer tries to approve', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved',
        rationale: 'Unsafe self-approval.',
        sodConstraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
        robotContext: {
          hazardousZone: true,
          missionProposerUserId: 'approver-1',
        },
      }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/HazardousZoneNoSelfApprovalViolation/);
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

  it('replays matching Idempotency-Key without a second SSE broadcast', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const events: WorkspaceStreamEvent[] = [];
    broadcast.subscribe(WORKSPACE_ID, (e) => events.push(e));
    const cache = new Map<string, unknown>();

    await startWith({
      approvals: [PENDING_APPROVAL],
      eventStream: broadcast,
      idempotency: {
        get: async <T>(key: Parameters<IdempotencyStore['get']>[0]) =>
          (cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T | undefined) ??
          null,
        set: async (key, value) => {
          cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
        },
      },
    });

    const request = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'approval-http-idem-1',
      },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    };
    const first = await fetch(decideUrl(), request);
    const second = await fetch(decideUrl(), request);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ approvalId: APPROVAL_ID, status: 'Approved' });
    expect(events).toHaveLength(1);
  });

  it('returns 409 and does not broadcast when an agent-action approval has no linked proposal', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const events: WorkspaceStreamEvent[] = [];
    broadcast.subscribe(WORKSPACE_ID, (e) => events.push(e));

    await startWith({
      approvals: [AGENT_ACTION_APPROVAL],
      agentActionProposal: null,
      eventStream: broadcast,
    });

    const res = await fetch(decideUrl('approval-agent-contract-1'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/conflict/);
    expect(body.detail).toMatch(/agent action proposal/i);
    expect(events).toEqual([]);
  });

  it('returns 200 when an agent-action approval has a matching linked proposal', async () => {
    await startWith({
      approvals: [AGENT_ACTION_APPROVAL],
      agentActionProposal: makeAgentActionProposal(),
    });

    const res = await fetch(decideUrl('approval-agent-contract-1'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBe('approval-agent-contract-1');
    expect(body.status).toBe('Approved');
  });

  it('does not leak internal dependency errors in 502 detail', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ approvals: [PENDING_APPROVAL] }),
        unitOfWork: {
          execute: async () => {
            throw new Error('database host db.internal.local table approvals write failed');
          },
        },
      }),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'Looks good.' }),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/correlation ID/i);
    expect(body.detail).not.toContain('db.internal.local');
    expect(body.detail).not.toContain('approvals write failed');
  });

  it('returns 422 when previousApproverIds is malformed', async () => {
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision: 'Approved',
        rationale: 'Bad payload.',
        previousApproverIds: [''],
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/previousApproverIds/);
  });
});

// ---------------------------------------------------------------------------
// SSE event broadcast on approval decision
// ---------------------------------------------------------------------------

describe('POST /approvals/:approvalId/decide — SSE broadcast', () => {
  it('broadcasts ApprovalGranted event to eventStream on Approved decision', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const events: WorkspaceStreamEvent[] = [];
    broadcast.subscribe(WORKSPACE_ID, (e) => events.push(e));

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({ approvals: [PENDING_APPROVAL], eventStream: broadcast }),
      ),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'LGTM.' }),
    });
    expect(res.status).toBe(200);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('com.portarium.approval.ApprovalGranted');
    expect(events[0]!.workspaceId).toBe(WORKSPACE_ID);
    const data = events[0]!.data as Record<string, unknown>;
    expect(data['approvalId']).toBe(APPROVAL_ID);
    expect(data['decision']).toBe('Approved');
  });

  it('broadcasts ApprovalDenied event to eventStream on Denied decision', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const events: WorkspaceStreamEvent[] = [];
    broadcast.subscribe(WORKSPACE_ID, (e) => events.push(e));

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({ approvals: [PENDING_APPROVAL], eventStream: broadcast }),
      ),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Denied', rationale: 'Too risky.' }),
    });
    expect(res.status).toBe(200);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('com.portarium.approval.ApprovalDenied');
    const data = events[0]!.data as Record<string, unknown>;
    expect(data['decision']).toBe('Denied');
  });

  it('broadcasts ApprovalChangesRequested event on RequestChanges decision', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const events: WorkspaceStreamEvent[] = [];
    broadcast.subscribe(WORKSPACE_ID, (e) => events.push(e));

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({ approvals: [PENDING_APPROVAL], eventStream: broadcast }),
      ),
    });

    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'RequestChanges', rationale: 'Needs work.' }),
    });
    expect(res.status).toBe(200);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('com.portarium.approval.ApprovalChangesRequested');
  });

  it('does not broadcast when eventStream is not provided', async () => {
    // No eventStream in deps — should still return 200 without error
    await startWith({ approvals: [PENDING_APPROVAL] });
    const res = await fetch(decideUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'Approved', rationale: 'No SSE.' }),
    });
    expect(res.status).toBe(200);
  });
});

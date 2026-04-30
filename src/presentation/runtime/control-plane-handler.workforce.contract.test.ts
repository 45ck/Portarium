/**
 * Contract tests for workforce mutation routes.
 *
 * Verifies that invalid request bodies are rejected with 400 Problem Details,
 * and that valid payloads pass through. Mirrors the machine-agent contract test pattern.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { InMemoryEvidenceLog } from '../../infrastructure/stores/in-memory-evidence-log.js';
import {
  InMemoryHumanTaskStore,
  InMemoryWorkforceMemberStore,
  InMemoryWorkforceQueueStore,
} from '../../infrastructure/stores/in-memory-workforce-store.js';
import {
  parseHumanTaskV1,
  parseWorkforceMemberV1,
  parseWorkforceQueueV1,
} from '../../domain/workforce/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import {
  buildInMemoryHumanTaskStore,
  buildInMemoryWorkforceMemberStore,
  buildInMemoryWorkforceQueueStore,
} from './control-plane-handler.bootstrap.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin']) {
  return toAppContext({
    tenantId: 'workspace-1',
    principalId: 'user-1',
    roles,
    correlationId: 'corr-workforce-contract',
  });
}

function makeDeps(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin']) {
  const evidenceLog = new InMemoryEvidenceLog();
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
    workforceMemberStore: buildInMemoryWorkforceMemberStore('workspace-1'),
    workforceQueueStore: buildInMemoryWorkforceQueueStore('workspace-1'),
    humanTaskStore: buildInMemoryHumanTaskStore('workspace-1'),
    evidenceLog,
    evidenceQueryStore: evidenceLog,
  };
}

function makeStoreOnlyDeps() {
  const evidenceLog = new InMemoryEvidenceLog();
  const workforceMemberStore = new InMemoryWorkforceMemberStore([
    parseWorkforceMemberV1({
      schemaVersion: 1,
      workforceMemberId: 'wm-live',
      linkedUserId: 'user-live',
      displayName: 'Live Store Operator',
      capabilities: ['operations.dispatch'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-live'],
      tenantId: 'workspace-live',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    }),
  ]);
  const workforceQueueStore = new InMemoryWorkforceQueueStore([
    parseWorkforceQueueV1({
      schemaVersion: 1,
      workforceQueueId: 'queue-live',
      name: 'Live Queue',
      requiredCapabilities: ['operations.dispatch'],
      memberIds: ['wm-live'],
      routingStrategy: 'round-robin',
      tenantId: 'workspace-live',
    }),
  ]);
  const humanTaskStore = new InMemoryHumanTaskStore([
    {
      workspaceId: 'workspace-live',
      task: parseHumanTaskV1({
        schemaVersion: 1,
        humanTaskId: 'ht-live',
        workItemId: 'wi-live',
        runId: 'run-live',
        stepId: 'step-live',
        description: 'Store-only task',
        requiredCapabilities: ['operations.dispatch'],
        status: 'pending',
      }),
    },
  ]);

  return {
    authentication: {
      authenticateBearerToken: async () =>
        ok(
          toAppContext({
            tenantId: 'workspace-live',
            principalId: 'user-live',
            roles: ['operator'],
            correlationId: 'corr-store-backed-workforce',
          }),
        ),
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
    workforceMemberStore,
    workforceQueueStore,
    humanTaskStore,
    evidenceLog,
    evidenceQueryStore: evidenceLog,
    clock: () => new Date('2026-02-20T10:00:00.000Z'),
  };
}

async function startWith(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin'],
): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(makeDeps(roles)),
  });
}

const BASE = 'http://127.0.0.1';
function url(path: string): string {
  return `${BASE}:${handle!.port}${path}`;
}

// ---------------------------------------------------------------------------
// PATCH /workforce/:workforceMemberId/availability
// ---------------------------------------------------------------------------

describe('PATCH /workforce/:id/availability — body validation', () => {
  it('returns 400 when availabilityStatus is missing', async () => {
    await startWith(['admin']);
    const res = await fetch(url('/v1/workspaces/workspace-1/workforce/wm-1/availability'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(400);
  });

  it('returns 400 when availabilityStatus is an unrecognised value', async () => {
    await startWith(['admin']);
    const res = await fetch(url('/v1/workspaces/workspace-1/workforce/wm-1/availability'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ availabilityStatus: 'unknown' }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('returns 400 when body is not JSON', async () => {
    await startWith(['admin']);
    const res = await fetch(url('/v1/workspaces/workspace-1/workforce/wm-1/availability'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid availabilityStatus', async () => {
    await startWith(['admin']);
    const res = await fetch(url('/v1/workspaces/workspace-1/workforce/wm-1/availability'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ availabilityStatus: 'busy' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availabilityStatus: string };
    expect(body.availabilityStatus).toBe('busy');
  });
});

describe('store-backed workforce route reads', () => {
  it('uses injected stores for list, mutation, and restart read checks', async () => {
    const deps = makeStoreOnlyDeps();
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    let res = await fetch(url('/v1/workspaces/workspace-live/workforce'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      items: [{ workforceMemberId: 'wm-live', tenantId: 'workspace-live' }],
    });

    res = await fetch(url('/v1/workspaces/workspace-live/workforce/wm-live/availability'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ availabilityStatus: 'busy' }),
    });
    expect(res.status).toBe(200);

    res = await fetch(url('/v1/workspaces/workspace-live/human-tasks/ht-live/assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workforceMemberId: 'wm-live' }),
    });
    expect(res.status).toBe(200);

    await handle.close();
    handle = undefined;
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    res = await fetch(url('/v1/workspaces/workspace-live/workforce/wm-live'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      workforceMemberId: 'wm-live',
      availabilityStatus: 'busy',
    });

    res = await fetch(url('/v1/workspaces/workspace-live/human-tasks/ht-live'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      humanTaskId: 'ht-live',
      assigneeId: 'wm-live',
      status: 'assigned',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /human-tasks/:humanTaskId/assign
// ---------------------------------------------------------------------------

describe('POST /human-tasks/:id/assign — body validation', () => {
  it('returns 400 when body has neither workforceMemberId nor workforceQueueId', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(400);
  });

  it('returns 400 when body is null/unparseable JSON', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 when workforceMemberId is provided', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/assign'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workforceMemberId: 'wm-2' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { assigneeId: string };
    expect(body.assigneeId).toBe('wm-2');
  });
});

// ---------------------------------------------------------------------------
// POST /human-tasks/:humanTaskId/complete
// ---------------------------------------------------------------------------

describe('POST /human-tasks/:id/complete — body validation', () => {
  it('returns 400 when body is a non-object non-null value', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/complete'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('not-an-object'),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(400);
  });

  it('returns 200 with empty body (no completionNote required)', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/complete'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('completed');
  });

  it('returns 200 when completionNote is provided', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/complete'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ completionNote: 'Resolved by operator' }),
    });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /human-tasks/:humanTaskId/escalate
// ---------------------------------------------------------------------------

describe('POST /human-tasks/:id/escalate — body validation', () => {
  it('returns 400 when workforceQueueId is missing', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/escalate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(400);
  });

  it('returns 400 when workforceQueueId is blank', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/escalate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workforceQueueId: '   ' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not parseable JSON', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/escalate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 when workforceQueueId is valid', async () => {
    await startWith(['operator']);
    const res = await fetch(url('/v1/workspaces/workspace-1/human-tasks/ht-1/escalate'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workforceQueueId: 'queue-escalation' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; groupId: string };
    expect(body.status).toBe('escalated');
    expect(body.groupId).toBe('queue-escalation');
  });
});

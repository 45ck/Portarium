/**
 * Contract tests for workforce mutation routes.
 *
 * Verifies that invalid request bodies are rejected with 400 Problem Details,
 * and that valid payloads pass through. Mirrors the machine-agent contract test pattern.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin']) {
  return toAppContext({
    tenantId: 'tenant-1',
    principalId: 'user-1',
    roles,
    correlationId: 'corr-workforce-contract',
  });
}

function makeDeps(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin']) {
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

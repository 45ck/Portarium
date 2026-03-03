/**
 * Contract tests for run-related routes on the control-plane handler.
 *
 * Focuses on the `status` query parameter validation for GET /v1/workspaces/:id/runs.
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

function makeCtx(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
) {
  return toAppContext({
    tenantId: 'ws-runs-1',
    principalId: 'user-1',
    roles,
    correlationId: 'corr-runs-contract',
  });
}

function makeDeps(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
) {
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
    runQueryStore: {
      listRuns: async () => ({ items: [] }),
    },
  };
}

async function startWith(
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['operator'],
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
// GET /v1/workspaces/:workspaceId/runs?status=...
// ---------------------------------------------------------------------------

describe('GET /runs — status query parameter validation', () => {
  it('returns 422 for invalid status value', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=NotAStatus'));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.detail).toMatch(/status must be one of/);
  });

  it('returns 422 for empty status value', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status='));
    // Empty string is not a valid RunStatus, so it should be rejected.
    expect(res.status).toBe(422);
  });

  it('accepts valid status Pending', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=Pending'));
    expect(res.status).toBe(200);
  });

  it('accepts valid status Running', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=Running'));
    expect(res.status).toBe(200);
  });

  it('accepts valid status WaitingForApproval', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=WaitingForApproval'));
    expect(res.status).toBe(200);
  });

  it('accepts valid status Failed', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=Failed'));
    expect(res.status).toBe(200);
  });

  it('accepts valid status Cancelled', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs?status=Cancelled'));
    expect(res.status).toBe(200);
  });

  it('returns 200 when no status filter is given', async () => {
    await startWith();
    const res = await fetch(url('/v1/workspaces/ws-runs-1/runs'));
    expect(res.status).toBe(200);
  });
});

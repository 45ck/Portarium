/**
 * Contract tests for run-related routes on the control-plane handler.
 *
 * Focuses on the `status` query parameter validation for GET /v1/workspaces/:id/runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import {
  CorrelationId,
  EvidenceId,
  HashSha256,
  RunId,
  UserId,
  WorkflowId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

type WorkspaceRole = 'admin' | 'operator' | 'approver' | 'auditor';

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly WorkspaceRole[] = ['operator']) {
  return toAppContext({
    tenantId: 'ws-runs-1',
    principalId: 'user-1',
    roles,
    correlationId: 'corr-runs-contract',
  });
}

const RUN: RunV1 = {
  schemaVersion: 1,
  runId: RunId('run-1'),
  workspaceId: WorkspaceId('ws-runs-1'),
  workflowId: WorkflowId('workflow-1'),
  correlationId: CorrelationId('corr-run-1'),
  executionTier: 'HumanApprove',
  initiatedByUserId: UserId('requester-1'),
  status: 'Running',
  createdAtIso: '2026-04-30T00:00:00.000Z',
};

function makeDeps(
  overrides: {
    roles?: readonly WorkspaceRole[];
    run?: RunV1 | null;
    authentication?: ControlPlaneDeps['authentication'];
    authorization?: ControlPlaneDeps['authorization'];
    evidenceLog?: ControlPlaneDeps['evidenceLog'] | null;
  } = {},
): ControlPlaneDeps {
  const run = overrides.run ?? null;
  return {
    authentication: overrides.authentication ?? {
      authenticateBearerToken: async () => ok(makeCtx(overrides.roles ?? ['operator'])),
    },
    authorization: overrides.authorization ?? {
      isAllowed: async () => true,
    },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: vi.fn(async () => run),
      saveRun: vi.fn(async () => undefined),
    },
    runQueryStore: {
      listRuns: async () => ({ items: [] }),
    },
    ...(overrides.evidenceLog === null
      ? {}
      : {
          evidenceLog: overrides.evidenceLog ?? {
            appendEntry: vi.fn(async (_tenantId, entry) => ({
              ...entry,
              evidenceId: EvidenceId(String(entry.evidenceId)),
              previousHash: undefined,
              hashSha256: HashSha256('hash-1'),
            })),
          },
        }),
  };
}

async function startWith(
  overrides: Parameters<typeof makeDeps>[0] = {},
): Promise<ControlPlaneDeps> {
  const deps = makeDeps(overrides);
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
  return deps;
}

const BASE = 'http://127.0.0.1';
function url(path: string): string {
  return `${BASE}:${handle!.port}${path}`;
}

function interventionUrl(runId = 'run-1'): string {
  return url(`/v1/workspaces/ws-runs-1/runs/${runId}/interventions`);
}

function postIntervention(body: unknown, headers: Record<string, string> = {}) {
  return fetch(interventionUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
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

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/runs/:runId/interventions
// ---------------------------------------------------------------------------

describe('POST /runs/:runId/interventions', () => {
  it('returns 200 and records evidence for a run pause intervention', async () => {
    const deps = await startWith({ run: RUN });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
      surface: 'steering',
      authoritySource: 'run-charter',
      effect: 'current-run-effect',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; controlState: string };
    expect(body.status).toBe('Paused');
    expect(body.controlState).toBe('blocked');
    expect(deps.runStore.saveRun).toHaveBeenCalledWith(
      WorkspaceId('ws-runs-1'),
      expect.objectContaining({ status: 'Paused', controlState: 'blocked' }),
    );
    expect(deps.evidenceLog?.appendEntry).toHaveBeenCalledWith(
      WorkspaceId('ws-runs-1'),
      expect.objectContaining({
        category: 'Action',
        links: { runId: RunId('run-1') },
      }),
    );
  });

  it('returns 400 when body is not valid JSON', async () => {
    await startWith({ run: RUN });

    const res = await postIntervention('not-json');

    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/bad-request/);
  });

  it('returns 415 when content type is not JSON', async () => {
    await startWith({ run: RUN });

    const res = await postIntervention(
      JSON.stringify({ interventionType: 'pause', rationale: 'Need operator review.' }),
      { 'content-type': 'text/plain' },
    );

    expect(res.status).toBe(415);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/unsupported-media-type/);
  });

  it('returns 422 when the intervention payload is invalid', async () => {
    await startWith({ run: RUN });

    const res = await postIntervention({ interventionType: 'handoff', rationale: 'short' });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.detail).toMatch(/payload is invalid/);
  });

  it('returns 401 when authentication fails', async () => {
    await startWith({
      run: RUN,
      authentication: {
        authenticateBearerToken: async () =>
          err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
      },
    });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when the caller cannot intervene in runs', async () => {
    await startWith({
      run: RUN,
      authorization: { isAllowed: vi.fn(async () => false) },
    });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 when the run does not exist', async () => {
    await startWith({ run: null });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
    });

    expect(res.status).toBe(404);
  });

  it('returns 409 for effectful interventions against a terminal run', async () => {
    await startWith({ run: { ...RUN, status: 'Cancelled' } satisfies RunV1 });

    const res = await postIntervention({
      interventionType: 'freeze',
      rationale: 'Need emergency stop.',
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/conflict/);
  });

  it('fails closed with 503 when the evidence log is unavailable', async () => {
    await startWith({ run: RUN, evidenceLog: null });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/service-unavailable/);
    expect(body.detail).toMatch(/evidenceLog is not configured/);
  });
});

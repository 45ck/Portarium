/**
 * Contract tests for run-related routes on the control-plane handler.
 *
 * Focuses on the `status` query parameter validation for GET /v1/workspaces/:id/runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
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
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { InMemoryCockpitWebSessionStore } from './cockpit-web-session.js';
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

const WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'workflow-1',
  workspaceId: 'ws-runs-1',
  name: 'Contract Workflow',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [{ actionId: 'act-1', order: 1, portFamily: 'ItsmItOps', operation: 'workflow:run' }],
});

const ADAPTER_REGISTRATION = parseAdapterRegistrationV1({
  schemaVersion: 1,
  adapterId: 'adapter-1',
  workspaceId: 'ws-runs-1',
  providerSlug: 'service-now',
  portFamily: 'ItsmItOps',
  enabled: true,
  capabilityMatrix: [{ operation: 'workflow:run', requiresAuth: true }],
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://api.service-now.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  },
});

function makeDeps(
  overrides: {
    roles?: readonly WorkspaceRole[];
    run?: RunV1 | null;
    authentication?: ControlPlaneDeps['authentication'];
    authorization?: ControlPlaneDeps['authorization'];
    evidenceLog?: ControlPlaneDeps['evidenceLog'] | null;
    startRuntimeConfigured?: boolean;
  } = {},
): ControlPlaneDeps {
  let run = overrides.run ?? null;
  const idempotency = new Map<string, unknown>();
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
      getRunById: vi.fn(async (_tenantId, _workspaceId, requestedRunId) =>
        run && String(run.runId) === String(requestedRunId) ? run : null,
      ),
      saveRun: vi.fn(async (_tenantId, nextRun) => {
        run = nextRun;
      }),
    },
    runQueryStore: {
      listRuns: async () => ({ items: [] }),
    },
    ...(overrides.startRuntimeConfigured === false
      ? {}
      : {
          workflowStore: {
            getWorkflowById: async () => WORKFLOW,
            listWorkflowsByName: async () => [WORKFLOW],
          },
          adapterRegistrationStore: {
            listByWorkspace: async () => [ADAPTER_REGISTRATION],
          },
          idempotency: {
            get: async <T>(
              key: Parameters<NonNullable<ControlPlaneDeps['idempotency']>['get']>[0],
            ) =>
              (idempotency.get(`${String(key.tenantId)}:${key.commandName}:${key.requestKey}`) as
                | T
                | undefined) ?? null,
            set: async (key, value) => {
              idempotency.set(
                `${String(key.tenantId)}:${key.commandName}:${key.requestKey}`,
                value,
              );
            },
          },
          orchestrator: {
            startRun: async () => undefined,
          },
          unitOfWork: {
            execute: async <T>(fn: () => Promise<T>) => fn(),
          },
          eventPublisher: {
            publish: async () => undefined,
          },
        }),
    ...(overrides.evidenceLog === null
      ? {}
      : {
          evidenceLog: overrides.evidenceLog ?? {
            appendEntry: vi.fn(async (_tenantId, entry) => ({
              ...entry,
              evidenceId: EvidenceId(String(entry.evidenceId)),
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

function runsUrl(): string {
  return url('/v1/workspaces/ws-runs-1/runs');
}

function cancelUrl(runId = 'run-1'): string {
  return url(`/v1/workspaces/ws-runs-1/runs/${runId}/cancel`);
}

function postIntervention(body: unknown, headers: Record<string, string> = {}) {
  return fetch(interventionUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function postRun(body: unknown, headers: Record<string, string> = {}) {
  return fetch(runsUrl(), {
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

describe('POST /runs', () => {
  it('returns 201 and persists a new run', async () => {
    const deps = await startWith();

    const res = await postRun({ workflowId: 'workflow-1' }, { 'idempotency-key': 'idem-run-1' });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { workflowId: string; status: string };
    expect(body.workflowId).toBe('workflow-1');
    expect(body.status).toBe('Pending');
    expect(deps.runStore.saveRun).toHaveBeenCalledTimes(1);
    expect(res.headers.get('location')).toMatch(/\/v1\/workspaces\/ws-runs-1\/runs\//);
  });

  it('returns 422 when workflowId is missing', async () => {
    await startWith();

    const res = await postRun({});

    expect(res.status).toBe(422);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/workflowId/);
  });

  it('returns 503 when run-start dependencies are unavailable', async () => {
    await startWith({ startRuntimeConfigured: false });

    const res = await postRun({ workflowId: 'workflow-1' });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toMatch(/Run start is unavailable/);
  });
});

describe('POST /runs/:runId/cancel', () => {
  it('returns 200 and persists the cancelled run', async () => {
    const deps = await startWith({ run: RUN });

    const res = await fetch(cancelUrl(), { method: 'POST' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; endedAtIso: string };
    expect(body.status).toBe('Cancelled');
    expect(body.endedAtIso).toBeDefined();
    expect(deps.runStore.saveRun).toHaveBeenCalledWith(
      WorkspaceId('ws-runs-1'),
      expect.objectContaining({ status: 'Cancelled' }),
    );
  });

  it('returns 409 when the run is already terminal', async () => {
    await startWith({ run: { ...RUN, status: 'Succeeded' } satisfies RunV1 });

    const res = await fetch(cancelUrl(), { method: 'POST' });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string };
    expect(body.type).toMatch(/conflict/);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/runs/:runId/interventions
// ---------------------------------------------------------------------------

describe('POST /runs/:runId/interventions', () => {
  it('requires the same-origin request marker for cookie-authenticated run interventions', async () => {
    const auth = vi.fn(async () => {
      throw new Error('Bearer authentication should not run for cookie-backed run interventions.');
    });
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['operator']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ run: RUN }),
        authentication: { authenticateBearerToken: auth },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    });

    const res = await fetch(interventionUrl(), {
      method: 'POST',
      headers: {
        cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        interventionType: 'pause',
        rationale: 'Need operator review.',
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain('X-Portarium-Request');
    expect(auth).not.toHaveBeenCalled();
  });

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

  it('returns 422 when the intervention payload includes unknown fields', async () => {
    await startWith({ run: RUN });

    const res = await postIntervention({
      interventionType: 'pause',
      rationale: 'Need operator review.',
      unexpectedField: true,
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.detail).toContain('unexpectedField');
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

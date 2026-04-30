import { afterEach, vi } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { HashSha256, RunId, WorkspaceId } from '../../domain/primitives/index.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/index.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';
import { parseRunV1 } from '../../domain/runs/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

export const WORKSPACE_ID = 'ws-runtime-parity-1';

type WorkspaceRole = 'admin' | 'operator' | 'approver' | 'auditor';

const ACTIVE_WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-runtime-parity-1',
  workspaceId: WORKSPACE_ID,
  name: 'Runtime Parity Workflow',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    { actionId: 'act-1', order: 1, portFamily: 'ItsmItOps', operation: 'workflow:simulate' },
  ],
});

const INACTIVE_WORKFLOW = parseWorkflowV1({
  ...ACTIVE_WORKFLOW,
  workflowId: 'wf-runtime-parity-inactive',
  active: false,
});

const ACTIVE_ADAPTER = parseAdapterRegistrationV1({
  schemaVersion: 1,
  adapterId: 'adapter-runtime-parity-1',
  workspaceId: WORKSPACE_ID,
  providerSlug: 'service-now',
  portFamily: 'ItsmItOps',
  enabled: true,
  capabilityMatrix: [{ operation: 'workflow:simulate', requiresAuth: true }],
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://api.service-now.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  },
});

const RUN = parseRunV1({
  schemaVersion: 1,
  runId: 'run-runtime-parity-1',
  workspaceId: WORKSPACE_ID,
  workflowId: ACTIVE_WORKFLOW.workflowId,
  correlationId: 'corr-run-runtime-parity-1',
  executionTier: 'Auto',
  initiatedByUserId: 'user-runtime-parity-1',
  status: 'Running',
  createdAtIso: '2026-04-30T00:00:00.000Z',
});

function buildRunStore(initialRuns: readonly ReturnType<typeof parseRunV1>[] = [RUN]) {
  const runs = new Map(initialRuns.map((run) => [String(run.runId), run]));
  return {
    getRunById: vi.fn(async (_tenantId, _workspaceId, runId) => runs.get(String(runId)) ?? null),
    saveRun: vi.fn(async (_tenantId, run) => {
      runs.set(String(run.runId), run);
    }),
  };
}

function buildApprovalStore(initialApprovals: readonly ApprovalV1[] = []) {
  const approvals = new Map(
    initialApprovals.map((approval) => [String(approval.approvalId), approval]),
  );
  return {
    getApprovalById: vi.fn(
      async (_tenantId, _workspaceId, approvalId) => approvals.get(String(approvalId)) ?? null,
    ),
    saveApproval: vi.fn(async (_tenantId, approval) => {
      approvals.set(String(approval.approvalId), approval);
    }),
  };
}

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(roles: readonly WorkspaceRole[] = ['operator']) {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'user-runtime-parity-1',
    roles,
    correlationId: 'corr-runtime-parity',
  });
}

export function runtimeParityUrl(path: string): string {
  return `http://127.0.0.1:${handle!.port}${path}`;
}

export async function startRuntimeParityServer(
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const deps = {
    authentication: {
      authenticateBearerToken:
        overrides['authentication'] ??
        (async () => ok(makeCtx()) as ReturnType<typeof ok<ReturnType<typeof makeCtx>>>),
    },
    authorization: overrides['authorization'] ?? {
      isAllowed: async () => true,
    },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: overrides['runStore'] ?? {
      ...buildRunStore(),
    },
    runQueryStore: {
      listRuns: async () => ({ items: [] }),
    },
    approvalStore: overrides['approvalStore'] ?? buildApprovalStore(),
    approvalQueryStore: {
      listApprovals: async () => ({ items: [] }),
    },
    eventPublisher: {
      publish: vi.fn(async () => undefined),
    },
    evidenceLog: {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        previousHash: HashSha256('hash-prev'),
        hashSha256: HashSha256('hash-next'),
      })),
    },
    unitOfWork: {
      execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    },
    workflowStore:
      overrides['workflowStore'] ??
      ({
        getWorkflowById: vi.fn(async () => ACTIVE_WORKFLOW),
        listWorkflowsByName: vi.fn(async () => [ACTIVE_WORKFLOW]),
      } as const),
    adapterRegistrationStore:
      overrides['adapterRegistrationStore'] ??
      ({
        listByWorkspace: vi.fn(async () => [ACTIVE_ADAPTER]),
      } as const),
    idempotency: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    },
    orchestrator: {
      startRun: vi.fn(async () => undefined),
    },
    ...overrides,
  };

  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(
      deps as unknown as Parameters<typeof createControlPlaneHandler>[0],
    ),
  });

  return deps;
}

export function startRunUrl(): string {
  return runtimeParityUrl(`/v1/workspaces/${WORKSPACE_ID}/runs`);
}

export function cancelRunUrl(runId = String(RunId('run-runtime-parity-1'))): string {
  return runtimeParityUrl(`/v1/workspaces/${WORKSPACE_ID}/runs/${runId}/cancel`);
}

export function createApprovalUrl(): string {
  return runtimeParityUrl(`/v1/workspaces/${WORKSPACE_ID}/approvals`);
}

export function unauthorizedAuthentication() {
  return {
    authenticateBearerToken: async () =>
      err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
  };
}

export function forbiddenAuthorization() {
  return { isAllowed: vi.fn(async () => false) };
}

export function runStoreWithStatus(status: 'Running' | 'Cancelled' | 'Failed') {
  return buildRunStore([
    parseRunV1({
      ...RUN,
      runId: 'run-runtime-parity-1',
      workspaceId: String(WorkspaceId(WORKSPACE_ID)),
      status,
    }),
  ]);
}

export function runStoreNotFound() {
  return {
    getRunById: vi.fn(async () => null),
    saveRun: vi.fn(async () => undefined),
  };
}

export function workflowStoreNotFound() {
  return {
    getWorkflowById: vi.fn(async () => null),
    listWorkflowsByName: vi.fn(async () => []),
  };
}

export function workflowStoreInactive() {
  return {
    getWorkflowById: vi.fn(async () => INACTIVE_WORKFLOW),
    listWorkflowsByName: vi.fn(async () => [INACTIVE_WORKFLOW, ACTIVE_WORKFLOW]),
  };
}

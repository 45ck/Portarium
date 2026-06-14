#!/usr/bin/env tsx
import process from 'node:process';

import { clampLimit, type Page } from '../../src/application/common/query.js';
import type {
  AdapterRegistrationStore,
  RunQueryStore,
  RunStore,
  WorkspaceQueryStore,
  WorkspaceStore,
  WorkflowStore,
} from '../../src/application/ports/index.js';
import type { PlanQueryStore } from '../../src/application/ports/plan-query-store.js';
import type { AdapterRegistrationV1 } from '../../src/domain/adapters/index.js';
import type { PlanV1 } from '../../src/domain/plan/index.js';
import type {
  PlanId,
  TenantId,
  WorkflowId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import type { RunV1 } from '../../src/domain/runs/index.js';
import type { WorkflowV1 } from '../../src/domain/workflows/index.js';
import type { WorkspaceV1 } from '../../src/domain/workspaces/index.js';
import { createControlPlaneHandler } from '../../src/presentation/runtime/control-plane-handler.js';
import { buildControlPlaneDeps } from '../../src/presentation/runtime/control-plane-handler.bootstrap.js';
import type { ControlPlaneDeps } from '../../src/presentation/runtime/control-plane-handler.shared.js';
import { startHealthServer } from '../../src/presentation/runtime/health-server.js';
import { createCockpitLiveSeedBundle } from '../seed/cockpit-live-seed-data.js';

const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_WORKSPACE_ID = 'ws-local-dev';
const DEFAULT_DEV_TOKEN = 'portarium-dev-token';

type MutableAdapterRegistrationStore = AdapterRegistrationStore & {
  saveRegistration(tenantId: TenantId, registration: AdapterRegistrationV1): Promise<void>;
};

class LiveMemoryWorkspaceStore implements WorkspaceStore, WorkspaceQueryStore {
  readonly #workspaces = new Map<string, WorkspaceV1>();

  public async getWorkspaceById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
  ): Promise<WorkspaceV1 | null> {
    return this.#workspaces.get(key(tenantId, workspaceId)) ?? null;
  }

  public async getWorkspaceByName(
    tenantId: TenantId,
    workspaceName: string,
  ): Promise<WorkspaceV1 | null> {
    return (
      [...this.#workspaces.values()].find(
        (workspace) =>
          String(workspace.tenantId) === String(tenantId) && workspace.name === workspaceName,
      ) ?? null
    );
  }

  public async saveWorkspace(workspace: WorkspaceV1): Promise<void> {
    this.#workspaces.set(key(workspace.tenantId, workspace.workspaceId), workspace);
  }

  public async listWorkspaces(
    tenantId: TenantId,
    filter: { nameQuery?: string; limit?: number; cursor?: string },
  ): Promise<Page<WorkspaceV1>> {
    const nameQuery = filter.nameQuery?.toLowerCase();
    const items = [...this.#workspaces.values()]
      .filter((workspace) => String(workspace.tenantId) === String(tenantId))
      .filter((workspace) => (nameQuery ? workspace.name.toLowerCase().includes(nameQuery) : true))
      .sort((left, right) => String(left.workspaceId).localeCompare(String(right.workspaceId)));

    return pageByCursor(items, (workspace) => String(workspace.workspaceId), filter);
  }
}

class LiveMemoryRunStore implements RunStore, RunQueryStore {
  readonly #runs = new Map<string, RunV1>();

  public async getRunById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    runId: string,
  ): Promise<RunV1 | null> {
    return this.#runs.get(key(tenantId, workspaceId, runId)) ?? null;
  }

  public async saveRun(tenantId: TenantId, run: RunV1): Promise<void> {
    this.#runs.set(key(tenantId, run.workspaceId, run.runId), run);
  }

  public async listRuns(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    query: Parameters<RunQueryStore['listRuns']>[2],
  ): Promise<Page<RunV1>> {
    const { filter, pagination, search, sort } = query;
    const normalizedSearch = search?.toLowerCase();
    const items = [...this.#runs.values()]
      .filter((run) => String(run.workspaceId) === String(workspaceId))
      .filter((run) => this.#runs.has(key(tenantId, workspaceId, run.runId)))
      .filter((run) => (filter.status ? run.status === filter.status : true))
      .filter((run) => (filter.workflowId ? String(run.workflowId) === filter.workflowId : true))
      .filter((run) =>
        filter.initiatedByUserId
          ? String(run.initiatedByUserId) === filter.initiatedByUserId
          : true,
      )
      .filter((run) =>
        filter.correlationId ? String(run.correlationId) === filter.correlationId : true,
      )
      .filter((run) =>
        normalizedSearch
          ? [
              String(run.runId),
              String(run.workflowId),
              String(run.status),
              String(run.correlationId),
            ].some((value) => value.toLowerCase().includes(normalizedSearch))
          : true,
      )
      .sort((left, right) => compareRuns(left, right, sort));

    return pageByCursor(items, (run) => String(run.runId), pagination);
  }
}

class LiveMemoryWorkflowStore implements WorkflowStore {
  readonly #workflows = new Map<string, WorkflowV1>();

  public async getWorkflowById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    workflowId: WorkflowId,
  ): Promise<WorkflowV1 | null> {
    return this.#workflows.get(key(tenantId, workspaceId, workflowId)) ?? null;
  }

  public async listWorkflowsByName(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    workflowName: string,
  ): Promise<readonly WorkflowV1[]> {
    return [...this.#workflows.values()].filter(
      (workflow) =>
        String(workflow.workspaceId) === String(workspaceId) &&
        this.#workflows.has(key(tenantId, workspaceId, workflow.workflowId)) &&
        workflow.name === workflowName,
    );
  }

  public saveWorkflow(tenantId: TenantId, workflow: WorkflowV1): void {
    this.#workflows.set(key(tenantId, workflow.workspaceId, workflow.workflowId), workflow);
  }
}

class LiveMemoryPlanQueryStore implements PlanQueryStore {
  readonly #plans = new Map<string, PlanV1>();

  public async getPlanById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    planId: PlanId,
  ): Promise<PlanV1 | null> {
    return this.#plans.get(key(tenantId, workspaceId, planId)) ?? null;
  }

  public savePlan(tenantId: TenantId, plan: PlanV1): void {
    this.#plans.set(key(tenantId, plan.workspaceId, plan.planId), plan);
  }
}

function key(...parts: readonly unknown[]): string {
  return parts.map((part) => String(part)).join('\u0000');
}

function pageByCursor<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  pagination: { limit?: number; cursor?: string },
): Page<T> {
  const limit = clampLimit(pagination.limit);
  const startIndex = pagination.cursor
    ? Math.max(0, items.findIndex((item) => idOf(item) === pagination.cursor) + 1)
    : 0;
  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < items.length ? idOf(pageItems[pageItems.length - 1]!) : undefined;
  return { items: pageItems, ...(nextCursor ? { nextCursor } : {}) };
}

function compareRuns(
  left: RunV1,
  right: RunV1,
  sort: Parameters<RunQueryStore['listRuns']>[2]['sort'],
): number {
  const field = sort?.field ?? 'createdAtIso';
  const direction = sort?.direction === 'asc' ? 1 : -1;
  const leftValue = runSortValue(left, field);
  const rightValue = runSortValue(right, field);
  return leftValue.localeCompare(rightValue) * direction;
}

function runSortValue(run: RunV1, field: string): string {
  switch (field) {
    case 'runId':
      return String(run.runId);
    case 'status':
      return run.status;
    case 'startedAtIso':
      return run.startedAtIso ?? '';
    case 'createdAtIso':
    default:
      return run.createdAtIso;
  }
}

function hasWritableAdapterStore(
  store: AdapterRegistrationStore | undefined,
): store is MutableAdapterRegistrationStore {
  return (
    typeof (store as Partial<MutableAdapterRegistrationStore> | undefined)?.saveRegistration ===
    'function'
  );
}

async function seedLiveMemoryDeps(
  deps: ControlPlaneDeps,
  workspaceId: string,
): Promise<ControlPlaneDeps> {
  const workspaceStore = new LiveMemoryWorkspaceStore();
  const runStore = new LiveMemoryRunStore();
  const workflowStore = new LiveMemoryWorkflowStore();
  const planQueryStore = new LiveMemoryPlanQueryStore();
  const seededDeps: ControlPlaneDeps = {
    ...deps,
    workspaceStore,
    workspaceQueryStore: workspaceStore,
    runStore,
    runQueryStore: runStore,
    workflowStore,
    planQueryStore,
  };

  const bundle = createCockpitLiveSeedBundle({ tenantId: workspaceId, workspaceId });
  await workspaceStore.saveWorkspace(bundle.workspace);
  for (const user of bundle.users)
    await seededDeps.workspaceUserStore?.saveWorkspaceUser(bundle.tenantId, user);
  for (const policy of bundle.policies) {
    await seededDeps.policyStore?.savePolicy(bundle.tenantId, bundle.workspaceId, policy);
  }
  for (const workflow of bundle.workflows) workflowStore.saveWorkflow(bundle.tenantId, workflow);
  if (hasWritableAdapterStore(seededDeps.adapterRegistrationStore)) {
    for (const adapter of bundle.adapters) {
      await seededDeps.adapterRegistrationStore.saveRegistration(bundle.tenantId, adapter);
    }
  }
  for (const machine of bundle.machines) {
    await seededDeps.machineRegistryStore?.saveMachineRegistration(bundle.tenantId, machine);
  }
  for (const agent of bundle.agents) {
    await seededDeps.machineRegistryStore?.saveAgentConfig(bundle.tenantId, agent);
  }
  for (const run of bundle.runs) await runStore.saveRun(bundle.tenantId, run);
  for (const plan of bundle.plans) planQueryStore.savePlan(bundle.tenantId, plan);
  for (const approval of bundle.approvals) {
    await seededDeps.approvalStore?.saveApproval(bundle.tenantId, approval);
  }
  for (const workItem of bundle.workItems) {
    await seededDeps.workItemStore?.saveWorkItem(bundle.tenantId, workItem);
  }
  for (const member of bundle.workforceMembers) {
    await seededDeps.workforceMemberStore?.saveWorkforceMember?.(
      bundle.tenantId,
      member,
      bundle.workspaceId,
    );
  }
  for (const queue of bundle.workforceQueues) {
    await seededDeps.workforceQueueStore?.saveWorkforceQueue?.(
      bundle.tenantId,
      queue,
      bundle.workspaceId,
    );
  }
  for (const task of bundle.humanTasks) {
    await seededDeps.humanTaskStore?.saveHumanTask(bundle.tenantId, task, bundle.workspaceId);
  }
  for (const entry of bundle.evidence) {
    await seededDeps.evidenceLog?.appendEntry(bundle.tenantId, entry);
  }

  return seededDeps;
}

function applyLocalDefaults(): { host: string; port: number; workspaceId: string } {
  const workspaceId = process.env['PORTARIUM_LIVE_STACK_WORKSPACE_ID'] ?? DEFAULT_WORKSPACE_ID;
  process.env['NODE_ENV'] ??= 'development';
  process.env['DEV_STUB_STORES'] ??= 'true';
  process.env['ENABLE_DEV_AUTH'] ??= 'true';
  process.env['PORTARIUM_DEV_TOKEN'] ??= DEFAULT_DEV_TOKEN;
  process.env['PORTARIUM_DEV_WORKSPACE_ID'] ??= workspaceId;
  process.env['PORTARIUM_DEV_USER_ID'] ??= 'user-local-dev';
  process.env['PORTARIUM_SYSTEM_WORKSPACE_ID'] ??= workspaceId;
  process.env['PORTARIUM_APPROVAL_SCHEDULER_DISABLED'] ??= 'true';
  process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] ??= 'http://localhost:5173,http://127.0.0.1:5173';

  const portRaw = process.env['PORTARIUM_HTTP_PORT'] ?? String(DEFAULT_PORT);
  const parsedPort = Number(portRaw);
  return {
    host: process.env['PORTARIUM_HTTP_HOST'] ?? DEFAULT_HOST,
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT,
    workspaceId,
  };
}

async function main(): Promise<void> {
  const { host, port, workspaceId } = applyLocalDefaults();
  const baseDeps = await buildControlPlaneDeps();
  const deps = await seedLiveMemoryDeps(baseDeps, workspaceId);
  const handle = await startHealthServer({
    role: 'control-plane-live-memory',
    host,
    port,
    handler: createControlPlaneHandler(deps),
    readinessCheck: async () => ({
      ok: true,
      checks: { liveMemorySeed: { ok: true, message: `seeded ${workspaceId}` } },
    }),
  });

  process.stdout.write(
    `[cockpit-live-memory-api] listening on http://${handle.host}:${handle.port} workspace=${workspaceId}\n`,
  );

  const close = async () => {
    await handle.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}

main().catch((error: unknown) => {
  process.stderr.write(
    `[cockpit-live-memory-api] Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

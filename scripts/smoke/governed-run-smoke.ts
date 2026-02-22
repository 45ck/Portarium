#!/usr/bin/env tsx
/**
 * scripts/smoke/governed-run-smoke.ts
 *
 * One-command local governed-run smoke test (bead-cgtt).
 *
 * Exercises the full product story end-to-end using in-memory adapters —
 * no running server, database, or external services required.
 *
 * Story:
 *   1. Create workspace
 *   2. Register adapter (ItsmItOps port family)
 *   3. Define workflow (one action requiring approval)
 *   4. Start governed run → runId captured
 *   5. Create approval gate for the run
 *   6. Approve the gate → ApprovalDecided event emitted
 *   7. Dispatch adapter action → ok result
 *   8. Append evidence entries (Plan, Approval, Action, System)
 *   9. Verify evidence chain (correlationId + category coverage)
 *
 * Usage:
 *   npm run smoke:governed-run
 *
 * Bead: bead-cgtt
 */

import { randomUUID } from 'node:crypto';

import { registerWorkspace } from '../../src/application/commands/register-workspace.js';
import { startWorkflow } from '../../src/application/commands/start-workflow.js';
import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { toAppContext } from '../../src/application/common/context.js';
import type {
  AdapterRegistrationStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
  WorkspaceStore,
} from '../../src/application/ports/index.js';
import type { ApprovalStore } from '../../src/application/ports/approval-store.js';
import type { ActionRunnerPort } from '../../src/application/ports/action-runner.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type { EvidenceEntryAppendInput } from '../../src/application/ports/evidence-log.js';
import { parseAdapterRegistrationV1 } from '../../src/domain/adapters/adapter-registration-v1.js';
import { parseApprovalV1 } from '../../src/domain/approvals/approval-v1.js';
import { parseWorkflowV1 } from '../../src/domain/workflows/workflow-v1.js';
import type { WorkflowV1 } from '../../src/domain/workflows/workflow-v1.js';
import type { RunV1 } from '../../src/domain/runs/run-v1.js';
import type { WorkspaceV1 } from '../../src/domain/workspaces/workspace-v1.js';
import type { AdapterRegistrationV1 } from '../../src/domain/adapters/adapter-registration-v1.js';
import type { ApprovalV1 } from '../../src/domain/approvals/approval-v1.js';
import type { EvidenceEntryV1 } from '../../src/domain/evidence/evidence-entry-v1.js';
import {
  ActionId,
  ApprovalId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  TenantId,
  UserId,
  WorkflowId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';

// ── Constants ─────────────────────────────────────────────────────────────

const TENANT_ID = TenantId('tenant-smoke');
const WS_ID = WorkspaceId('ws-smoke-cgtt');
const WF_ID = WorkflowId('wf-smoke-cgtt');
const ADAPTER_ID = 'adapter-smoke-itsm' as const;
const NOW = new Date().toISOString();

// ── In-memory stores ──────────────────────────────────────────────────────

class SmokeWorkspaceStore implements WorkspaceStore {
  readonly #map = new Map<string, WorkspaceV1>();
  getWorkspaceById(_t: string, id: string): Promise<WorkspaceV1 | null> {
    return Promise.resolve(this.#map.get(id) ?? null);
  }
  getWorkspaceByName(_t: string, name: string): Promise<WorkspaceV1 | null> {
    return Promise.resolve([...this.#map.values()].find((w) => w.name === name) ?? null);
  }
  saveWorkspace(ws: WorkspaceV1): Promise<void> {
    this.#map.set(String(ws.workspaceId), ws);
    return Promise.resolve();
  }
}

class SmokeIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();
  get<T>(key: IdempotencyKey): Promise<T | null> {
    return Promise.resolve(
      (this.#cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T) ?? null,
    );
  }
  set<T>(key: IdempotencyKey, value: T): Promise<void> {
    this.#cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
    return Promise.resolve();
  }
}

class SmokeWorkflowStore implements WorkflowStore {
  readonly #map = new Map<string, WorkflowV1>();
  save(wf: WorkflowV1): void {
    this.#map.set(String(wf.workflowId), wf);
  }
  getWorkflowById(_t: unknown, _ws: unknown, id: unknown): Promise<WorkflowV1 | null> {
    return Promise.resolve(this.#map.get(String(id)) ?? null);
  }
  listWorkflowsByName(_t: unknown, _ws: unknown, name: string): Promise<WorkflowV1[]> {
    return Promise.resolve([...this.#map.values()].filter((w) => w.name === name));
  }
}

class SmokeAdapterRegistrationStore implements AdapterRegistrationStore {
  readonly #registrations: AdapterRegistrationV1[] = [];
  add(reg: AdapterRegistrationV1): void {
    this.#registrations.push(reg);
  }
  listByWorkspace(_t: unknown, _ws: unknown): Promise<readonly AdapterRegistrationV1[]> {
    return Promise.resolve(this.#registrations);
  }
}

class SmokeRunStore implements RunStore {
  readonly #map = new Map<string, RunV1>();
  getRunById(_t: unknown, _ws: unknown, id: unknown): Promise<RunV1 | null> {
    return Promise.resolve(this.#map.get(String(id)) ?? null);
  }
  saveRun(_t: unknown, run: RunV1): Promise<void> {
    this.#map.set(String(run.runId), run);
    return Promise.resolve();
  }
  latestRun(): RunV1 | null {
    const runs = [...this.#map.values()];
    return runs[runs.length - 1] ?? null;
  }
}

class SmokeApprovalStore implements ApprovalStore {
  readonly #map = new Map<string, ApprovalV1>();
  save(approval: ApprovalV1): void {
    this.#map.set(String(approval.approvalId), approval);
  }
  getApprovalById(_t: unknown, _ws: unknown, id: unknown): Promise<ApprovalV1 | null> {
    return Promise.resolve(this.#map.get(String(id)) ?? null);
  }
  saveApproval(_t: unknown, approval: ApprovalV1): Promise<void> {
    this.#map.set(String(approval.approvalId), approval);
    return Promise.resolve();
  }
}

class SmokeEvidenceLog implements EvidenceLogPort {
  readonly entries: EvidenceEntryV1[] = [];
  appendEntry(_tenantId: unknown, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1> {
    const prev = this.entries[this.entries.length - 1];
    const hash = HashSha256(`sha256:${entry.evidenceId}:${entry.category}`);
    const record: EvidenceEntryV1 = prev
      ? { ...entry, previousHash: prev.hashSha256, hashSha256: hash }
      : { ...entry, hashSha256: hash };
    this.entries.push(record);
    return Promise.resolve(record);
  }
}

// ── Shared stubs ──────────────────────────────────────────────────────────

const ALLOW_ALL: AuthorizationPort = { isAllowed: async () => true };
const CLOCK: Clock = { nowIso: () => NOW };
const ID_GEN: IdGenerator = { generateId: () => randomUUID() };
const UNIT_OF_WORK: UnitOfWork = { execute: async (fn) => fn() };

// ── Steps ─────────────────────────────────────────────────────────────────

function ok(message: string): void {
  console.log(`  ✓ ${message}`);
}

function fail(message: string): never {
  console.error(`  ✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('\nPortarium governed-run smoke test\n');

  const workspaceStore = new SmokeWorkspaceStore();
  const workflowStore = new SmokeWorkflowStore();
  const adapterStore = new SmokeAdapterRegistrationStore();
  const runStore = new SmokeRunStore();
  const approvalStore = new SmokeApprovalStore();
  const evidenceLog = new SmokeEvidenceLog();
  const idempotency = new SmokeIdempotencyStore();

  const capturedEvents: unknown[] = [];
  const eventPublisher: EventPublisher = {
    publish: async (event) => {
      capturedEvents.push(event);
    },
  };

  const capturedActions: unknown[] = [];
  const actionRunner: ActionRunnerPort = {
    dispatchAction: async (input) => {
      capturedActions.push(input);
      return { ok: true, output: { status: 'completed', runId: String(input.runId) } };
    },
  };

  // Capture the runId that startWorkflow hands to the orchestrator
  let orchestratorRunId: string | undefined;
  const orchestrator: WorkflowOrchestrator = {
    startRun: async (input) => {
      orchestratorRunId = String(input.runId);
    },
  };

  // ── Step 1: Create workspace ──────────────────────────────────────────

  console.log('1. Workspace');
  const wsCtx = toAppContext({
    tenantId: TENANT_ID,
    principalId: 'smoke-script',
    roles: ['admin'],
    correlationId: `smoke-ws-${randomUUID()}`,
  });

  const wsResult = await registerWorkspace(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UNIT_OF_WORK,
      workspaceStore,
      eventPublisher,
    },
    wsCtx,
    {
      idempotencyKey: 'smoke-workspace',
      workspace: {
        schemaVersion: 1,
        workspaceId: WS_ID,
        tenantId: TENANT_ID,
        name: 'Smoke Demo',
        createdAtIso: NOW,
      },
    },
  );

  if (!wsResult.ok) fail(`registerWorkspace: ${JSON.stringify(wsResult.error)}`);
  ok(`workspace created: id=${wsResult.value.workspaceId}`);

  // ── Step 2: Register adapter ──────────────────────────────────────────

  console.log('\n2. Adapter registration');
  const adapterReg = parseAdapterRegistrationV1({
    schemaVersion: 1,
    adapterId: ADAPTER_ID,
    workspaceId: WS_ID,
    providerSlug: 'smoke-itsm',
    portFamily: 'ItsmItOps',
    enabled: true,
    capabilityMatrix: [{ operation: 'workflow:simulate', requiresAuth: false }],
    executionPolicy: {
      tenantIsolationMode: 'PerTenantWorker',
      egressAllowlist: ['https://localhost:7000'],
      credentialScope: 'capabilityMatrix',
      sandboxVerified: true,
      sandboxAvailable: false,
    },
  });
  adapterStore.add(adapterReg);
  ok(`adapter registered: id=${ADAPTER_ID}, portFamily=ItsmItOps`);

  // ── Step 3: Define workflow ───────────────────────────────────────────

  console.log('\n3. Workflow definition');
  const workflow: WorkflowV1 = parseWorkflowV1({
    schemaVersion: 1,
    workflowId: WF_ID,
    workspaceId: WS_ID,
    name: 'Smoke Governed Run',
    version: 1,
    active: true,
    executionTier: 'HumanApprove',
    actions: [
      {
        actionId: 'act-smoke-001',
        order: 1,
        portFamily: 'ItsmItOps',
        operation: 'workflow:simulate',
        executionTierOverride: 'HumanApprove',
      },
    ],
  });
  workflowStore.save(workflow);
  ok(`workflow defined: id=${WF_ID}, tier=HumanApprove`);

  // ── Step 4: Start governed run ────────────────────────────────────────

  console.log('\n4. Governed run initiation');
  const CORR_ID = CorrelationId(`smoke-corr-${randomUUID()}`);
  const runCtx = toAppContext({
    tenantId: TENANT_ID,
    principalId: UserId('user-operator'),
    roles: ['operator'],
    correlationId: CORR_ID,
  });

  const startResult = await startWorkflow(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UNIT_OF_WORK,
      workflowStore,
      adapterRegistrationStore: adapterStore,
      runStore,
      orchestrator,
      eventPublisher,
    },
    runCtx,
    {
      idempotencyKey: 'smoke-start-wf',
      workspaceId: WS_ID,
      workflowId: WF_ID,
    },
  );

  if (!startResult.ok) fail(`startWorkflow: ${JSON.stringify(startResult.error)}`);
  const RUN_ID = startResult.value.runId;
  if (orchestratorRunId !== String(RUN_ID)) {
    fail(`orchestrator runId mismatch: expected=${String(RUN_ID)} got=${orchestratorRunId}`);
  }
  ok(`run initiated: id=${RUN_ID}`);

  // ── Step 5: Create approval gate ──────────────────────────────────────

  console.log('\n5. Approval gate');
  const APPROVAL_ID = ApprovalId(`approval-smoke-${randomUUID()}`);
  const pendingApproval = parseApprovalV1({
    schemaVersion: 1,
    approvalId: APPROVAL_ID,
    workspaceId: WS_ID,
    runId: RUN_ID,
    planId: `plan-smoke-${randomUUID()}`,
    prompt: 'Approve governed smoke run?',
    requestedAtIso: NOW,
    requestedByUserId: 'user-operator',
    status: 'Pending',
  });
  approvalStore.save(pendingApproval);
  ok(`approval gate created: id=${APPROVAL_ID}`);

  // ── Step 6: Approve the gate ──────────────────────────────────────────

  console.log('\n6. Approval decision');
  const approvalCtx = toAppContext({
    tenantId: TENANT_ID,
    principalId: UserId('user-approver'),
    roles: ['approver'],
    correlationId: CORR_ID,
  });

  const approvalResult = await submitApproval(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      approvalStore,
      unitOfWork: UNIT_OF_WORK,
      eventPublisher,
    },
    approvalCtx,
    {
      workspaceId: WS_ID,
      approvalId: APPROVAL_ID,
      decision: 'Approved',
      rationale: 'Smoke test — all checks nominal',
    },
  );

  if (!approvalResult.ok) fail(`submitApproval: ${JSON.stringify(approvalResult.error)}`);
  if (approvalResult.value.status !== 'Approved') {
    fail(`expected approval status=Approved, got=${approvalResult.value.status}`);
  }
  ok(`approval decided: status=Approved`);

  // ── Step 7: Dispatch adapter action ───────────────────────────────────

  console.log('\n7. Adapter action dispatch');
  const ACTION_ID = ActionId(`action-smoke-${randomUUID()}`);
  const dispatchResult = await actionRunner.dispatchAction({
    actionId: ACTION_ID,
    tenantId: TENANT_ID,
    runId: RUN_ID,
    correlationId: CORR_ID,
    flowRef: 'itsm/workflow-simulate',
    payload: { runId: String(RUN_ID), step: 'smoke-action' },
  });

  if (!dispatchResult.ok) fail(`dispatchAction: ${JSON.stringify(dispatchResult)}`);
  ok(`action dispatched: id=${ACTION_ID}`);

  // ── Step 8: Evidence chain ────────────────────────────────────────────

  console.log('\n8. Evidence chain');

  const evPlan = await evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId(`ev-plan-${randomUUID()}`),
    workspaceId: WS_ID,
    correlationId: CORR_ID,
    occurredAtIso: NOW,
    category: 'Plan',
    summary: 'Workflow plan produced for governed run',
    actor: { kind: 'System' },
    links: { runId: RUN_ID },
  });
  ok(`evidence appended: category=Plan, hash=${evPlan.hashSha256}`);

  const evApproval = await evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId(`ev-approval-${randomUUID()}`),
    workspaceId: WS_ID,
    correlationId: CORR_ID,
    occurredAtIso: NOW,
    category: 'Approval',
    summary: 'Approval gate decided: Approved',
    actor: { kind: 'User', userId: UserId('user-approver') },
    links: { runId: RUN_ID },
  });
  ok(`evidence appended: category=Approval, hash=${evApproval.hashSha256}`);

  const evAction = await evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId(`ev-action-${randomUUID()}`),
    workspaceId: WS_ID,
    correlationId: CORR_ID,
    occurredAtIso: NOW,
    category: 'Action',
    summary: 'Adapter action dispatched via ItsmItOps',
    actor: {
      kind: 'Adapter',
      adapterId: ADAPTER_ID as ReturnType<
        typeof import('../../src/domain/primitives/index.js').AdapterId
      >,
    },
    links: { runId: RUN_ID },
  });
  ok(`evidence appended: category=Action, hash=${evAction.hashSha256}`);

  const evComplete = await evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId(`ev-system-${randomUUID()}`),
    workspaceId: WS_ID,
    correlationId: CORR_ID,
    occurredAtIso: NOW,
    category: 'System',
    summary: 'Governed run completed successfully',
    actor: { kind: 'System' },
    links: { runId: RUN_ID },
  });
  ok(`evidence appended: category=System, hash=${evComplete.hashSha256}`);

  // ── Step 9: Verify evidence chain ─────────────────────────────────────

  console.log('\n9. Evidence chain verification');

  const entries = evidenceLog.entries;
  if (entries.length !== 4) {
    fail(`expected 4 evidence entries, got=${entries.length}`);
  }

  const categories = entries.map((e) => e.category);
  const expectedCategories = ['Plan', 'Approval', 'Action', 'System'];
  for (const expected of expectedCategories) {
    if (!categories.includes(expected as never)) {
      fail(`missing evidence category: ${expected}`);
    }
  }
  ok(`all 4 evidence categories present: ${categories.join(', ')}`);

  const allCorrelated = entries.every((e) => String(e.correlationId) === String(CORR_ID));
  if (!allCorrelated) fail('evidence entries have mismatched correlationId');
  ok(`all evidence entries share correlationId=${CORR_ID}`);

  const chainLinked = entries.every(
    (e, i) => i === 0 || e.previousHash === entries[i - 1]!.hashSha256,
  );
  if (!chainLinked) fail('evidence chain hash linking broken');
  ok(`evidence chain hash-linked (${entries.length} entries)`);

  const approvalEventPublished = capturedEvents.some((e) => JSON.stringify(e).includes('Approved'));
  if (!approvalEventPublished) fail('ApprovalDecided event not published');
  ok(`ApprovalDecided event published (total events: ${capturedEvents.length})`);

  if (capturedActions.length !== 1) {
    fail(`expected 1 dispatched action, got=${capturedActions.length}`);
  }
  ok(`adapter action dispatched (correlationId confirmed in payload)`);

  // ── Summary ───────────────────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────────────────');
  console.log('✅ Governed-run smoke test PASSED\n');
  console.log(`   Workspace:   ${WS_ID}`);
  console.log(`   Adapter:     ${ADAPTER_ID} (ItsmItOps)`);
  console.log(`   Workflow:    ${WF_ID} (HumanApprove tier)`);
  console.log(`   Run:         ${RUN_ID}`);
  console.log(`   Approval:    ${APPROVAL_ID} → Approved`);
  console.log(`   Action:      ${ACTION_ID} → completed`);
  console.log(`   Evidence:    ${entries.length} entries, chain verified`);
  console.log('─────────────────────────────────────────────────────\n');
}

main().catch((err: unknown) => {
  console.error('\nSmoke test failed:', err);
  process.exit(1);
});

import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { NodePostgresSqlClient } from '../../src/infrastructure/postgresql/node-postgres-sql-client.js';
import { PostgresEvidenceLog } from '../../src/infrastructure/postgresql/postgres-eventing.js';
import { PostgresJsonDocumentStore } from '../../src/infrastructure/postgresql/postgres-json-document-store.js';
import { PostgresMachineRegistryStore } from '../../src/infrastructure/postgresql/postgres-machine-registry-store.js';
import { PostgresPlanQueryStore } from '../../src/infrastructure/postgresql/postgres-plan-query-store.js';
import {
  PostgresAdapterRegistrationStore,
  PostgresApprovalStore,
  PostgresPolicyStore,
  PostgresRunStore,
  PostgresWorkspaceStore,
  PostgresWorkspaceUserStore,
} from '../../src/infrastructure/postgresql/postgres-store-adapters.js';
import {
  PostgresHumanTaskStore,
  PostgresWorkforceMemberStore,
  PostgresWorkforceQueueStore,
  PostgresWorkItemStore,
} from '../../src/infrastructure/postgresql/postgres-workforce-store-adapters.js';
import type { SqlClient } from '../../src/infrastructure/postgresql/sql-client.js';
import {
  COCKPIT_LIVE_SEED_DEFAULTS,
  COCKPIT_LIVE_SEED_IDS,
  createCockpitLiveSeedBundle,
  createCockpitLiveSeedSummary,
  type CockpitLiveSeedBundle,
} from './cockpit-live-seed-data.js';

const LOCAL_DB_URL = 'postgresql://portarium:portarium@localhost:5432/portarium';
const COLLECTION_WORKFLOWS = 'workflows';
const COLLECTION_ADAPTERS = 'adapter-registrations';
const COLLECTION_PLANS = 'plans';
const COLLECTION_EVIDENCE = 'evidence-log';
const COLLECTION_IDEMPOTENCY = 'idempotency';

export type CockpitLiveSeedMode = 'seed' | 'validate' | 'dry-run';

export type CockpitLiveSeedConfig = Readonly<{
  mode: CockpitLiveSeedMode;
  databaseUrl: string;
  tenantId: string;
  workspaceId: string;
}>;

export type ValidationCheck = Readonly<{
  name: string;
  ok: boolean;
  detail: string;
}>;

export type PersistenceValidation = Readonly<{
  ok: boolean;
  checks: readonly ValidationCheck[];
}>;

export function readCockpitLiveSeedConfig(
  env: Record<string, string | undefined>,
  argv: readonly string[],
): CockpitLiveSeedConfig {
  const args = new Set(argv);
  if (args.has('--dry-run') && args.has('--validate')) {
    throw new Error('Use either --dry-run or --validate, not both.');
  }

  const mode: CockpitLiveSeedMode = args.has('--dry-run')
    ? 'dry-run'
    : args.has('--validate')
      ? 'validate'
      : 'seed';
  const tenantId =
    nonEmpty(env['PORTARIUM_SEED_TENANT_ID']) ??
    nonEmpty(env['PORTARIUM_SEED_WORKSPACE_ID']) ??
    COCKPIT_LIVE_SEED_DEFAULTS.tenantId;
  const workspaceId =
    nonEmpty(env['PORTARIUM_SEED_WORKSPACE_ID']) ??
    nonEmpty(env['PORTARIUM_DEV_WORKSPACE_ID']) ??
    tenantId;

  return {
    mode,
    databaseUrl:
      nonEmpty(env['PORTARIUM_DATABASE_URL']) ?? nonEmpty(env['DATABASE_URL']) ?? LOCAL_DB_URL,
    tenantId,
    workspaceId,
  };
}

export async function seedCockpitLiveBundle(
  client: SqlClient,
  bundle: CockpitLiveSeedBundle,
): Promise<void> {
  await client.withTransaction(async (tx) => {
    await ensureWorkspaceRegistry(tx, String(bundle.tenantId));

    const docStore = new PostgresJsonDocumentStore(tx);
    const workspaceStore = new PostgresWorkspaceStore(tx);
    const userStore = new PostgresWorkspaceUserStore(tx);
    const policyStore = new PostgresPolicyStore(tx);
    const runStore = new PostgresRunStore(tx);
    const approvalStore = new PostgresApprovalStore(tx);
    const workItemStore = new PostgresWorkItemStore(tx);
    const machineStore = new PostgresMachineRegistryStore(tx);
    const memberStore = new PostgresWorkforceMemberStore(tx);
    const queueStore = new PostgresWorkforceQueueStore(tx);
    const humanTaskStore = new PostgresHumanTaskStore(tx);
    const evidenceLog = new PostgresEvidenceLog(tx);

    await workspaceStore.saveWorkspace(bundle.workspace);
    for (const user of bundle.users) {
      await userStore.saveWorkspaceUser(bundle.tenantId, user);
    }
    for (const policy of bundle.policies) {
      await policyStore.savePolicy(bundle.tenantId, bundle.workspaceId, policy);
    }
    for (const workflow of bundle.workflows) {
      await docStore.upsert({
        tenantId: String(bundle.tenantId),
        workspaceId: String(bundle.workspaceId),
        collection: COLLECTION_WORKFLOWS,
        documentId: String(workflow.workflowId),
        payload: workflow,
      });
    }
    for (const adapter of bundle.adapters) {
      await docStore.upsert({
        tenantId: String(bundle.tenantId),
        workspaceId: String(bundle.workspaceId),
        collection: COLLECTION_ADAPTERS,
        documentId: String(adapter.adapterId),
        payload: adapter,
      });
    }
    for (const machine of bundle.machines) {
      await machineStore.saveMachineRegistration(bundle.tenantId, machine);
    }
    for (const agent of bundle.agents) {
      await machineStore.saveAgentConfig(bundle.tenantId, agent);
    }
    for (const run of bundle.runs) {
      await runStore.saveRun(bundle.tenantId, run);
    }
    for (const plan of bundle.plans) {
      await docStore.upsert({
        tenantId: String(bundle.tenantId),
        workspaceId: String(bundle.workspaceId),
        collection: COLLECTION_PLANS,
        documentId: String(plan.planId),
        payload: plan,
      });
    }
    for (const approval of bundle.approvals) {
      await approvalStore.saveApproval(bundle.tenantId, approval);
    }
    for (const workItem of bundle.workItems) {
      await workItemStore.saveWorkItem(bundle.tenantId, workItem);
    }
    for (const member of bundle.workforceMembers) {
      await memberStore.saveWorkforceMember(bundle.tenantId, member, bundle.workspaceId);
    }
    for (const queue of bundle.workforceQueues) {
      await queueStore.saveWorkforceQueue(bundle.tenantId, queue, bundle.workspaceId);
    }
    for (const task of bundle.humanTasks) {
      await humanTaskStore.saveHumanTask(bundle.tenantId, task, bundle.workspaceId);
    }

    await deleteSeedEvidence(tx, bundle);
    await deleteSeedIdempotency(tx, bundle);
    for (const entry of bundle.evidence) {
      await evidenceLog.appendEntry(bundle.tenantId, entry);
    }
  });
}

export async function validatePersistedCockpitLiveSeed(
  client: SqlClient,
  bundle: CockpitLiveSeedBundle,
): Promise<PersistenceValidation> {
  const docStore = new PostgresJsonDocumentStore(client);
  const workspaceStore = new PostgresWorkspaceStore(client);
  const userStore = new PostgresWorkspaceUserStore(client);
  const policyStore = new PostgresPolicyStore(client);
  const runStore = new PostgresRunStore(client);
  const adapterStore = new PostgresAdapterRegistrationStore(client);
  const machineStore = new PostgresMachineRegistryStore(client);
  const planStore = new PostgresPlanQueryStore(client);
  const approvalStore = new PostgresApprovalStore(client);
  const workItemStore = new PostgresWorkItemStore(client);
  const evidenceLog = new PostgresEvidenceLog(client);
  const memberStore = new PostgresWorkforceMemberStore(client);
  const queueStore = new PostgresWorkforceQueueStore(client);
  const humanTaskStore = new PostgresHumanTaskStore(client);

  const workspace = await workspaceStore.getWorkspaceById(bundle.tenantId, bundle.workspaceId);
  const users = await userStore.listWorkspaceUsers(bundle.tenantId, bundle.workspaceId, {
    limit: 200,
  });
  const policies = await policyStore.listPolicies(bundle.tenantId, bundle.workspaceId, {
    limit: 200,
  });
  const workflows = await docStore.listByIds(
    String(bundle.tenantId),
    COLLECTION_WORKFLOWS,
    [...COCKPIT_LIVE_SEED_IDS.workflows],
    String(bundle.workspaceId),
  );
  const adapters = await adapterStore.listByWorkspace(bundle.tenantId, bundle.workspaceId);
  const machines = await machineStore.listMachineRegistrations(bundle.tenantId, {
    workspaceId: bundle.workspaceId,
    pagination: { limit: 200 },
  });
  const agents = await machineStore.listAgentConfigs(bundle.tenantId, {
    workspaceId: bundle.workspaceId,
    pagination: { limit: 200 },
  });
  const runs = await runStore.listRuns(bundle.tenantId, bundle.workspaceId, {
    filter: {},
    pagination: { limit: 200 },
  });
  const plans = await Promise.all(
    bundle.plans.map((plan) =>
      planStore.getPlanById(bundle.tenantId, bundle.workspaceId, plan.planId),
    ),
  );
  const approvals = await approvalStore.listApprovals(bundle.tenantId, bundle.workspaceId, {
    limit: 200,
  });
  const workItems = await workItemStore.listWorkItems(bundle.tenantId, bundle.workspaceId, {
    limit: 200,
  });
  const evidence = await evidenceLog.listEvidenceEntries(bundle.tenantId, bundle.workspaceId, {
    filter: {},
    pagination: { limit: 200 },
  });
  const members = await memberStore.listWorkforceMembers(bundle.tenantId, {
    workspaceId: bundle.workspaceId,
    limit: 200,
  });
  const queues = await queueStore.listWorkforceQueues(bundle.tenantId, {
    workspaceId: bundle.workspaceId,
    limit: 200,
  });
  const tasks = await humanTaskStore.listHumanTasks(bundle.tenantId, {
    workspaceId: bundle.workspaceId,
    limit: 200,
  });

  const checks: ValidationCheck[] = [
    checkPresent('workspace', workspace !== null, String(bundle.workspaceId)),
    checkIds(
      'users',
      COCKPIT_LIVE_SEED_IDS.users,
      users.items.map((user) => String(user.userId)),
    ),
    checkIds(
      'policies',
      COCKPIT_LIVE_SEED_IDS.policies,
      policies.items.map((policy) => String(policy.policyId)),
    ),
    checkCount('workflows', workflows.length, COCKPIT_LIVE_SEED_IDS.workflows.length),
    checkIds(
      'adapters',
      COCKPIT_LIVE_SEED_IDS.adapters,
      adapters.map((adapter) => String(adapter.adapterId)),
    ),
    checkIds(
      'machines',
      COCKPIT_LIVE_SEED_IDS.machines,
      machines.items.map((machine) => String(machine.machineId)),
    ),
    checkIds(
      'agents',
      COCKPIT_LIVE_SEED_IDS.agents,
      agents.items.map((agent) => String(agent.agentId)),
    ),
    checkIds(
      'runs',
      COCKPIT_LIVE_SEED_IDS.runs,
      runs.items.map((run) => String(run.runId)),
    ),
    checkCount('plans', plans.filter(Boolean).length, COCKPIT_LIVE_SEED_IDS.plans.length),
    checkIds(
      'approvals',
      COCKPIT_LIVE_SEED_IDS.approvals,
      approvals.items.map((approval) => String(approval.approvalId)),
    ),
    checkIds(
      'work items',
      COCKPIT_LIVE_SEED_IDS.workItems,
      workItems.items.map((item) => String(item.workItemId)),
    ),
    checkIds(
      'evidence',
      COCKPIT_LIVE_SEED_IDS.evidence,
      evidence.items.map((entry) => String(entry.evidenceId)),
    ),
    checkIds(
      'workforce members',
      COCKPIT_LIVE_SEED_IDS.workforceMembers,
      members.items.map((member) => String(member.workforceMemberId)),
    ),
    checkIds(
      'workforce queues',
      COCKPIT_LIVE_SEED_IDS.workforceQueues,
      queues.items.map((queue) => String(queue.workforceQueueId)),
    ),
    checkIds(
      'human tasks',
      COCKPIT_LIVE_SEED_IDS.humanTasks,
      tasks.items.map((task) => String(task.humanTaskId)),
    ),
    checkIds(
      'run status coverage',
      ['WaitingForApproval', 'Running', 'Succeeded', 'Failed'],
      runs.items.map((run) => run.status),
    ),
    checkPresent(
      'waiting run smoke target',
      runs.items.some(
        (run) => String(run.runId) === 'run-live-001' && run.status === 'WaitingForApproval',
      ),
      'run-live-001 WaitingForApproval',
    ),
    checkIds(
      'evidence category coverage',
      ['Plan', 'Approval', 'Action', 'System'],
      evidence.items.map((entry) => entry.category),
    ),
    checkPresent(
      'pending approval smoke target',
      approvals.items.some(
        (approval) =>
          String(approval.approvalId) === 'apr-live-001' && approval.status === 'Pending',
      ),
      'apr-live-001 Pending',
    ),
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function ensureWorkspaceRegistry(client: SqlClient, tenantId: string): Promise<void> {
  await client.query(
    'INSERT INTO workspace_registry (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [tenantId],
  );
}

async function deleteSeedEvidence(client: SqlClient, bundle: CockpitLiveSeedBundle): Promise<void> {
  await client.query(
    `DELETE FROM domain_documents
      WHERE tenant_id = $1
        AND collection = $2
        AND workspace_id = $3
        AND (
          document_id = ANY($4::text[])
          OR payload->'links'->>'approvalId' = ANY($5::text[])
          OR payload->'links'->>'runId' = ANY($6::text[])
        )`,
    [
      String(bundle.tenantId),
      COLLECTION_EVIDENCE,
      String(bundle.workspaceId),
      bundle.evidence.map((entry) => String(entry.evidenceId)),
      bundle.approvals.map((approval) => String(approval.approvalId)),
      bundle.runs.map((run) => String(run.runId)),
    ],
  );
}

async function deleteSeedIdempotency(
  client: SqlClient,
  bundle: CockpitLiveSeedBundle,
): Promise<void> {
  await client.query(
    `DELETE FROM domain_documents
      WHERE tenant_id = $1
        AND collection = $2
        AND document_id LIKE ANY($3::text[])`,
    [
      String(bundle.tenantId),
      COLLECTION_IDEMPOTENCY,
      bundle.approvals.map(
        (approval) =>
          `SubmitApproval:${String(bundle.workspaceId)}:${String(approval.approvalId)}:%`,
      ),
    ],
  );
}

function checkPresent(name: string, ok: boolean, detail: string): ValidationCheck {
  return { name, ok, detail };
}

function checkCount(name: string, actual: number, expected: number): ValidationCheck {
  return {
    name,
    ok: actual === expected,
    detail: `expected ${expected}, found ${actual}`,
  };
}

function checkIds(
  name: string,
  expectedIds: readonly string[],
  actualIds: readonly string[],
): ValidationCheck {
  const actual = new Set(actualIds);
  const missing = expectedIds.filter((id) => !actual.has(id));
  return {
    name,
    ok: missing.length === 0,
    detail: missing.length === 0 ? `found ${expectedIds.length}` : `missing ${missing.join(', ')}`,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

function redactConnectionString(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<configured database url>';
  }
}

async function main(): Promise<void> {
  const config = readCockpitLiveSeedConfig(process.env, process.argv.slice(2));
  const bundle = createCockpitLiveSeedBundle({
    tenantId: config.tenantId,
    workspaceId: config.workspaceId,
  });
  const summary = createCockpitLiveSeedSummary(bundle);

  process.stdout.write(`[seed-cockpit-live] mode=${config.mode}\n`);
  process.stdout.write(
    `[seed-cockpit-live] database=${redactConnectionString(config.databaseUrl)}\n`,
  );
  process.stdout.write(JSON.stringify({ summary }, null, 2) + '\n');

  if (config.mode === 'dry-run') {
    process.stdout.write('[seed-cockpit-live] Dry run complete. No data was persisted.\n');
    return;
  }

  const client = new NodePostgresSqlClient({ connectionString: config.databaseUrl });
  try {
    if (config.mode === 'seed') {
      await seedCockpitLiveBundle(client, bundle);
      process.stdout.write('[seed-cockpit-live] Seed writes complete.\n');
    }
    const validation = await validatePersistedCockpitLiveSeed(client, bundle);
    process.stdout.write(JSON.stringify({ validation }, null, 2) + '\n');
    if (!validation.ok) {
      process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `[seed-cockpit-live] Error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}

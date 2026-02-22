#!/usr/bin/env tsx
/**
 * scripts/seed/seed-local.ts
 *
 * One-command local dev seed: creates a demo workspace, registers a machine
 * runtime, creates an AI agent, seeds a default policy, registers a demo
 * adapter, and prints user RBAC context — all using in-memory adapters with
 * no running server required.
 *
 * Usage:
 *   npm run seed:local
 *
 * Environment variables (all optional):
 *   PORTARIUM_SEED_WORKSPACE_ID   (default: ws-local-demo)
 *   PORTARIUM_SEED_WORKSPACE_NAME (default: Local Demo)
 *   PORTARIUM_SEED_MACHINE_ID     (default: machine-local-runner)
 *   PORTARIUM_SEED_AGENT_ID       (default: agent-local-classifier)
 *   PORTARIUM_SEED_POLICY_ID      (default: pol-local-default)
 *   PORTARIUM_SEED_ADAPTER_ID     (default: adapter-local-crm)
 *
 * Bead: bead-0733
 */

import { randomUUID } from 'node:crypto';

import { registerWorkspace } from '../../src/application/commands/register-workspace.js';
import {
  registerMachine,
  createAgent,
} from '../../src/application/commands/machine-agent-registration.js';
import { toAppContext } from '../../src/application/common/context.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  MachineRegistryStore,
  UnitOfWork,
  WorkspaceStore,
} from '../../src/application/ports/index.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type { WorkspaceV1 } from '../../src/domain/workspaces/workspace-v1.js';
import type {
  MachineRegistrationV1,
  AgentConfigV1,
} from '../../src/domain/machines/machine-registration-v1.js';
import type { EvidenceEntryV1 } from '../../src/domain/evidence/evidence-entry-v1.js';
import type { EvidenceEntryAppendInput } from '../../src/application/ports/evidence-log.js';
import { parsePolicyV1 } from '../../src/domain/policy/policy-v1.js';
import { parseAdapterRegistrationV1 } from '../../src/domain/adapters/adapter-registration-v1.js';
import type { PolicyV1 } from '../../src/domain/policy/policy-v1.js';
import type { AdapterRegistrationV1 } from '../../src/domain/adapters/adapter-registration-v1.js';
import { HashSha256, TenantId } from '../../src/domain/primitives/index.js';

// ── Config ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = process.env['PORTARIUM_SEED_WORKSPACE_ID'] ?? 'ws-local-demo';
const WORKSPACE_NAME = process.env['PORTARIUM_SEED_WORKSPACE_NAME'] ?? 'Local Demo';
const MACHINE_ID = process.env['PORTARIUM_SEED_MACHINE_ID'] ?? 'machine-local-runner';
const AGENT_ID = process.env['PORTARIUM_SEED_AGENT_ID'] ?? 'agent-local-classifier';
const POLICY_ID = process.env['PORTARIUM_SEED_POLICY_ID'] ?? 'pol-local-default';
const ADAPTER_ID = process.env['PORTARIUM_SEED_ADAPTER_ID'] ?? 'adapter-local-crm';
const SEED_USER_ID = 'user-seed-admin';
const NOW = new Date().toISOString();

// ── In-memory stores ──────────────────────────────────────────────────────

class LocalWorkspaceStore implements WorkspaceStore {
  readonly #byId = new Map<string, WorkspaceV1>();

  getWorkspaceById(_tenantId: string, id: string): Promise<WorkspaceV1 | null> {
    return Promise.resolve(this.#byId.get(id) ?? null);
  }
  getWorkspaceByName(_tenantId: string, name: string): Promise<WorkspaceV1 | null> {
    for (const ws of this.#byId.values()) {
      if (ws.name === name) return Promise.resolve(ws);
    }
    return Promise.resolve(null);
  }
  saveWorkspace(ws: WorkspaceV1): Promise<void> {
    this.#byId.set(String(ws.workspaceId), ws);
    return Promise.resolve();
  }
  list(): WorkspaceV1[] {
    return [...this.#byId.values()];
  }
}

class LocalIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();
  get<T>(key: IdempotencyKey): Promise<T | null> {
    const cacheKey = `${key.tenantId}:${key.commandName}:${key.requestKey}`;
    return Promise.resolve((this.#cache.get(cacheKey) as T) ?? null);
  }
  set<T>(key: IdempotencyKey, value: T): Promise<void> {
    this.#cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
    return Promise.resolve();
  }
}

class LocalMachineRegistryStore implements MachineRegistryStore {
  readonly #machines = new Map<string, MachineRegistrationV1>();
  readonly #agents = new Map<string, AgentConfigV1>();

  getMachineRegistrationById(
    _tenantId: unknown,
    id: unknown,
  ): Promise<MachineRegistrationV1 | null> {
    return Promise.resolve(this.#machines.get(String(id)) ?? null);
  }
  saveMachineRegistration(_tenantId: unknown, m: MachineRegistrationV1): Promise<void> {
    this.#machines.set(String(m.machineId), m);
    return Promise.resolve();
  }
  getAgentConfigById(_tenantId: unknown, id: unknown): Promise<AgentConfigV1 | null> {
    return Promise.resolve(this.#agents.get(String(id)) ?? null);
  }
  saveAgentConfig(_tenantId: unknown, a: AgentConfigV1): Promise<void> {
    this.#agents.set(String(a.agentId), a);
    return Promise.resolve();
  }
  updateMachineHeartbeat(): Promise<boolean> {
    return Promise.resolve(true);
  }
  updateAgentHeartbeat(): Promise<boolean> {
    return Promise.resolve(true);
  }

  listMachines(): MachineRegistrationV1[] {
    return [...this.#machines.values()];
  }
  listAgents(): AgentConfigV1[] {
    return [...this.#agents.values()];
  }
}

class LocalEvidenceLog implements EvidenceLogPort {
  readonly entries: EvidenceEntryAppendInput[] = [];
  appendEntry(_tenantId: unknown, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1> {
    this.entries.push(entry);
    const stub: EvidenceEntryV1 = {
      ...entry,
      previousHash: HashSha256(''),
      hashSha256: HashSha256(entry.evidenceId),
    };
    return Promise.resolve(stub);
  }
}

class LocalPolicyStore {
  readonly #policies = new Map<string, PolicyV1>();

  save(policy: PolicyV1): void {
    this.#policies.set(String(policy.policyId), policy);
  }
  getById(policyId: string): PolicyV1 | undefined {
    return this.#policies.get(policyId);
  }
  list(): PolicyV1[] {
    return [...this.#policies.values()];
  }
}

class LocalAdapterStore {
  readonly #adapters = new Map<string, AdapterRegistrationV1>();

  save(adapter: AdapterRegistrationV1): void {
    this.#adapters.set(String(adapter.adapterId), adapter);
  }
  list(): AdapterRegistrationV1[] {
    return [...this.#adapters.values()];
  }
}

// ── Shared stubs ──────────────────────────────────────────────────────────

const ALLOW_ALL: AuthorizationPort = { isAllowed: async () => true };
const CLOCK: Clock = { nowIso: () => NOW };
const ID_GEN: IdGenerator = { generateId: () => randomUUID() };
const EVENT_PUB: EventPublisher = { publish: async () => undefined };
const UNIT_OF_WORK: UnitOfWork = { execute: async (fn) => fn() };

// ── Seed steps ────────────────────────────────────────────────────────────

async function seedWorkspace(
  workspaceStore: LocalWorkspaceStore,
  idempotency: LocalIdempotencyStore,
): Promise<void> {
  const existing = await workspaceStore.getWorkspaceById(WORKSPACE_ID, WORKSPACE_ID);
  if (existing) {
    console.log(`  ↳ workspace '${WORKSPACE_NAME}' already exists — skipping`);
    return;
  }

  const ctx = toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'seed-script',
    roles: ['admin'],
    correlationId: `seed-${randomUUID()}`,
  });

  const result = await registerWorkspace(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UNIT_OF_WORK,
      workspaceStore,
      eventPublisher: EVENT_PUB,
    },
    ctx,
    {
      idempotencyKey: `seed-ws-${WORKSPACE_ID}`,
      workspace: {
        schemaVersion: 1,
        workspaceId: WORKSPACE_ID,
        tenantId: WORKSPACE_ID,
        name: WORKSPACE_NAME,
        createdAtIso: NOW,
      },
    },
  );

  if (!result.ok) {
    throw new Error(`registerWorkspace failed: ${JSON.stringify(result.error)}`);
  }
  console.log(`  ✓ workspace created: id=${result.value.workspaceId}`);
}

async function seedMachine(
  machineRegistry: LocalMachineRegistryStore,
  idempotency: LocalIdempotencyStore,
  evidenceLog: LocalEvidenceLog,
): Promise<void> {
  const existing = await machineRegistry.getMachineRegistrationById(
    TenantId(WORKSPACE_ID),
    MACHINE_ID,
  );
  if (existing) {
    console.log(`  ↳ machine '${MACHINE_ID}' already exists — skipping`);
    return;
  }

  const ctx = toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'seed-script',
    roles: ['admin'],
    correlationId: `seed-${randomUUID()}`,
  });

  const result = await registerMachine(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UNIT_OF_WORK,
      machineRegistryStore: machineRegistry,
      evidenceLog,
    },
    ctx,
    {
      idempotencyKey: `seed-machine-${MACHINE_ID}`,
      machine: {
        schemaVersion: 1,
        machineId: MACHINE_ID,
        workspaceId: WORKSPACE_ID,
        displayName: 'Local Runner',
        endpointUrl: 'https://localhost:7000/v1',
        active: true,
        capabilities: ['run:workflow', 'run:adapter'],
        registeredAtIso: NOW,
        executionPolicy: {
          isolationMode: 'PerTenantWorker',
          egressAllowlist: ['https://localhost:7000'],
          workloadIdentity: 'Required',
        },
        authConfig: { kind: 'bearer', secretRef: 'grants/local-dev-token' },
      },
    },
  );

  if (!result.ok) {
    throw new Error(`registerMachine failed: ${JSON.stringify(result.error)}`);
  }
  console.log(`  ✓ machine registered: id=${result.value.machineId}`);
}

async function seedAgent(
  machineRegistry: LocalMachineRegistryStore,
  idempotency: LocalIdempotencyStore,
  evidenceLog: LocalEvidenceLog,
): Promise<void> {
  const existing = await machineRegistry.getAgentConfigById(TenantId(WORKSPACE_ID), AGENT_ID);
  if (existing) {
    console.log(`  ↳ agent '${AGENT_ID}' already exists — skipping`);
    return;
  }

  const ctx = toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'seed-script',
    roles: ['admin'],
    correlationId: `seed-${randomUUID()}`,
  });

  const result = await createAgent(
    {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UNIT_OF_WORK,
      machineRegistryStore: machineRegistry,
      evidenceLog,
    },
    ctx,
    {
      idempotencyKey: `seed-agent-${AGENT_ID}`,
      agent: {
        schemaVersion: 1,
        agentId: AGENT_ID,
        workspaceId: WORKSPACE_ID,
        machineId: MACHINE_ID,
        displayName: 'Local Classifier Agent',
        capabilities: ['run:workflow'],
        policyTier: 'Auto',
        allowedTools: ['classify'],
        registeredAtIso: NOW,
      },
    },
  );

  if (!result.ok) {
    throw new Error(`createAgent failed: ${JSON.stringify(result.error)}`);
  }
  console.log(`  ✓ agent created: id=${result.value.agentId}`);
}

function seedPolicy(policyStore: LocalPolicyStore): void {
  if (policyStore.getById(POLICY_ID)) {
    console.log(`  ↳ policy '${POLICY_ID}' already exists — skipping`);
    return;
  }

  const policy = parsePolicyV1({
    schemaVersion: 1,
    policyId: POLICY_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Default Local Policy',
    description: 'Permissive default policy for local development.',
    active: true,
    priority: 100,
    version: 1,
    createdAtIso: NOW,
    createdByUserId: SEED_USER_ID,
    rules: [
      {
        ruleId: `rule-${POLICY_ID}-allow`,
        condition: 'risk.score <= 100',
        effect: 'Allow',
      },
    ],
  });

  policyStore.save(policy);
  console.log(`  ✓ policy seeded: id=${String(policy.policyId)} name="${policy.name}"`);
}

function seedAdapter(adapterStore: LocalAdapterStore): void {
  const existing = adapterStore.list().find((a) => String(a.adapterId) === ADAPTER_ID);
  if (existing) {
    console.log(`  ↳ adapter '${ADAPTER_ID}' already exists — skipping`);
    return;
  }

  const adapter = parseAdapterRegistrationV1({
    schemaVersion: 1,
    adapterId: ADAPTER_ID,
    workspaceId: WORKSPACE_ID,
    providerSlug: 'local-crm-stub',
    portFamily: 'CrmSales',
    enabled: true,
    capabilityMatrix: [
      {
        operation: 'list:contacts',
        requiresAuth: false,
      },
      {
        operation: 'create:contact',
        requiresAuth: false,
      },
    ],
    executionPolicy: {
      tenantIsolationMode: 'PerTenantWorker',
      egressAllowlist: ['https://localhost:7000'],
      credentialScope: 'capabilityMatrix',
      sandboxVerified: true,
      sandboxAvailable: true,
    },
    machineRegistrations: [
      {
        machineId: MACHINE_ID,
        endpointUrl: 'https://localhost:7000/v1',
        active: true,
        displayName: 'Local Runner',
      },
    ],
  });

  adapterStore.save(adapter);
  console.log(
    `  ✓ adapter registered: id=${String(adapter.adapterId)} family=${adapter.portFamily}`,
  );
}

function printUserSummary(): void {
  console.log(`  ✓ seed principal: id=${SEED_USER_ID} roles=[admin, operator, approver, auditor]`);
  console.log(`  ✓ workspace access: ${WORKSPACE_ID} (tenantId=${WORKSPACE_ID})`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Portarium local dev seed\n');

  const workspaceStore = new LocalWorkspaceStore();
  const machineRegistry = new LocalMachineRegistryStore();
  const idempotency = new LocalIdempotencyStore();
  const evidenceLog = new LocalEvidenceLog();
  const policyStore = new LocalPolicyStore();
  const adapterStore = new LocalAdapterStore();

  console.log('1. Workspace');
  await seedWorkspace(workspaceStore, idempotency);

  console.log('2. Machine runtime');
  await seedMachine(machineRegistry, idempotency, evidenceLog);

  console.log('3. AI agent');
  await seedAgent(machineRegistry, idempotency, evidenceLog);

  console.log('4. Default policy');
  seedPolicy(policyStore);

  console.log('5. Adapter registration (CrmSales — local stub)');
  seedAdapter(adapterStore);

  console.log('6. Users / RBAC');
  printUserSummary();

  console.log('\n✅ Seed complete.\n');
  console.log('Copy the following into your .env.local:\n');
  const devToken = process.env['PORTARIUM_DEV_TOKEN'] ?? 'dev-token-change-me';
  console.log(`PORTARIUM_DEV_TOKEN=${devToken}`);
  console.log(`PORTARIUM_DEV_WORKSPACE_ID=${WORKSPACE_ID}`);
  console.log(`PORTARIUM_DEV_USER_ID=${SEED_USER_ID}`);
  console.log(`PORTARIUM_SEED_WORKSPACE_ID=${WORKSPACE_ID}`);
  console.log(`PORTARIUM_SEED_MACHINE_ID=${MACHINE_ID}`);
  console.log(`PORTARIUM_SEED_AGENT_ID=${AGENT_ID}`);
  console.log(`PORTARIUM_SEED_POLICY_ID=${POLICY_ID}`);
  console.log(`PORTARIUM_SEED_ADAPTER_ID=${ADAPTER_ID}`);
}

main().catch((err: unknown) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});

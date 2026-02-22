/**
 * Smoke test for the local dev seed script.
 *
 * Verifies that the seed functions run end-to-end without error and produce
 * the expected workspace / machine / agent identities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
import { HashSha256, TenantId } from '../../src/domain/primitives/index.js';

// ── Minimal in-memory stores (mirroring seed-local.ts) ───────────────────

class MemWorkspaceStore implements WorkspaceStore {
  readonly #byId = new Map<string, WorkspaceV1>();
  getWorkspaceById(_t: string, id: string) {
    return Promise.resolve(this.#byId.get(id) ?? null);
  }
  getWorkspaceByName(_t: string, name: string) {
    for (const ws of this.#byId.values()) if (ws.name === name) return Promise.resolve(ws);
    return Promise.resolve(null);
  }
  saveWorkspace(ws: WorkspaceV1) {
    this.#byId.set(String(ws.workspaceId), ws);
    return Promise.resolve();
  }
  list() {
    return [...this.#byId.values()];
  }
}

class MemIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();
  get<T>(k: IdempotencyKey) {
    return Promise.resolve(
      (this.#cache.get(`${k.tenantId}:${k.commandName}:${k.requestKey}`) as T) ?? null,
    );
  }
  set<T>(k: IdempotencyKey, v: T) {
    this.#cache.set(`${k.tenantId}:${k.commandName}:${k.requestKey}`, v);
    return Promise.resolve();
  }
}

class MemMachineRegistryStore implements MachineRegistryStore {
  readonly #machines = new Map<string, MachineRegistrationV1>();
  readonly #agents = new Map<string, AgentConfigV1>();
  getMachineRegistrationById(_t: unknown, id: unknown) {
    return Promise.resolve(this.#machines.get(String(id)) ?? null);
  }
  saveMachineRegistration(_t: unknown, m: MachineRegistrationV1) {
    this.#machines.set(String(m.machineId), m);
    return Promise.resolve();
  }
  getAgentConfigById(_t: unknown, id: unknown) {
    return Promise.resolve(this.#agents.get(String(id)) ?? null);
  }
  saveAgentConfig(_t: unknown, a: AgentConfigV1) {
    this.#agents.set(String(a.agentId), a);
    return Promise.resolve();
  }
  updateMachineHeartbeat() {
    return Promise.resolve(true);
  }
  updateAgentHeartbeat() {
    return Promise.resolve(true);
  }
}

class MemEvidenceLog implements EvidenceLogPort {
  readonly appended: EvidenceEntryAppendInput[] = [];
  appendEntry(_t: unknown, e: EvidenceEntryAppendInput): Promise<EvidenceEntryV1> {
    this.appended.push(e);
    return Promise.resolve({
      ...e,
      previousHash: HashSha256(''),
      hashSha256: HashSha256(e.evidenceId),
    });
  }
}

// ── Shared stubs ──────────────────────────────────────────────────────────

const ALLOW_ALL: AuthorizationPort = { isAllowed: async () => true };
const NOW = '2026-02-22T00:00:00.000Z';
const CLOCK: Clock = { nowIso: () => NOW };
const ID_GEN: IdGenerator = { generateId: () => randomUUID() };
const EVENT_PUB: EventPublisher = { publish: async () => undefined };
const UOW: UnitOfWork = { execute: async (fn) => fn() };

const WS_ID = 'ws-seed-test';
const MACHINE_ID = 'machine-seed-test';
const AGENT_ID = 'agent-seed-test';

function makeCtx(workspaceId: string) {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'seed-script',
    roles: ['admin'],
    correlationId: `seed-test-${randomUUID()}`,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('seed-local: workspace seeding', () => {
  let wsStore: MemWorkspaceStore;
  let idempotency: MemIdempotencyStore;

  beforeEach(() => {
    wsStore = new MemWorkspaceStore();
    idempotency = new MemIdempotencyStore();
  });

  it('creates a workspace with the configured id and name', async () => {
    const result = await registerWorkspace(
      {
        authorization: ALLOW_ALL,
        clock: CLOCK,
        idGenerator: ID_GEN,
        idempotency,
        unitOfWork: UOW,
        workspaceStore: wsStore,
        eventPublisher: EVENT_PUB,
      },
      makeCtx(WS_ID),
      {
        idempotencyKey: `seed-ws-${WS_ID}`,
        workspace: {
          schemaVersion: 1,
          workspaceId: WS_ID,
          tenantId: WS_ID,
          name: 'Seed Test WS',
          createdAtIso: NOW,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.workspaceId).toBe(WS_ID);

    const saved = await wsStore.getWorkspaceById(WS_ID, WS_ID);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Seed Test WS');
  });

  it('is idempotent: second call with same key returns same result', async () => {
    const deps = {
      authorization: ALLOW_ALL,
      clock: CLOCK,
      idGenerator: ID_GEN,
      idempotency,
      unitOfWork: UOW,
      workspaceStore: wsStore,
      eventPublisher: EVENT_PUB,
    };
    const input = {
      idempotencyKey: `seed-ws-${WS_ID}`,
      workspace: {
        schemaVersion: 1,
        workspaceId: WS_ID,
        tenantId: WS_ID,
        name: 'Seed Test WS',
        createdAtIso: NOW,
      },
    };
    const ctx = makeCtx(WS_ID);

    const r1 = await registerWorkspace(deps, ctx, input);
    const r2 = await registerWorkspace(deps, ctx, input);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.workspaceId).toBe(r2.value.workspaceId);
    expect(wsStore.list()).toHaveLength(1);
  });
});

describe('seed-local: machine seeding', () => {
  let registry: MemMachineRegistryStore;
  let idempotency: MemIdempotencyStore;
  let evidence: MemEvidenceLog;

  beforeEach(() => {
    registry = new MemMachineRegistryStore();
    idempotency = new MemIdempotencyStore();
    evidence = new MemEvidenceLog();
  });

  it('registers a machine with the configured id and endpoint', async () => {
    const result = await registerMachine(
      {
        authorization: ALLOW_ALL,
        clock: CLOCK,
        idGenerator: ID_GEN,
        idempotency,
        unitOfWork: UOW,
        machineRegistryStore: registry,
        evidenceLog: evidence,
      },
      makeCtx(WS_ID),
      {
        idempotencyKey: `seed-machine-${MACHINE_ID}`,
        machine: {
          schemaVersion: 1,
          machineId: MACHINE_ID,
          workspaceId: WS_ID,
          displayName: 'Local Runner',
          endpointUrl: 'http://localhost:7000/v1',
          active: true,
          capabilities: ['run:workflow'],
          registeredAtIso: NOW,
          executionPolicy: {
            isolationMode: 'PerTenantWorker',
            egressAllowlist: ['https://localhost:7000'],
            workloadIdentity: 'Required',
          },
          authConfig: { kind: 'bearer', secretRef: 'grants/dev-token' },
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.machineId).toBe(MACHINE_ID);

    const saved = await registry.getMachineRegistrationById(TenantId(WS_ID), MACHINE_ID);
    expect(saved).not.toBeNull();
    expect(String(saved?.workspaceId)).toBe(WS_ID);
  });

  it('appends evidence on machine registration', async () => {
    await registerMachine(
      {
        authorization: ALLOW_ALL,
        clock: CLOCK,
        idGenerator: ID_GEN,
        idempotency,
        unitOfWork: UOW,
        machineRegistryStore: registry,
        evidenceLog: evidence,
      },
      makeCtx(WS_ID),
      {
        idempotencyKey: `seed-machine-${MACHINE_ID}`,
        machine: {
          schemaVersion: 1,
          machineId: MACHINE_ID,
          workspaceId: WS_ID,
          displayName: 'Local Runner',
          endpointUrl: 'http://localhost:7000/v1',
          active: true,
          capabilities: ['run:workflow'],
          registeredAtIso: NOW,
          executionPolicy: {
            isolationMode: 'PerTenantWorker',
            egressAllowlist: ['https://localhost:7000'],
            workloadIdentity: 'Required',
          },
          authConfig: { kind: 'bearer', secretRef: 'grants/dev-token' },
        },
      },
    );

    expect(evidence.appended.length).toBeGreaterThan(0);
    const summaries = evidence.appended.map((e) => e.summary);
    expect(
      summaries.some(
        (s) => s.toLowerCase().includes('machine') || s.toLowerCase().includes('register'),
      ),
    ).toBe(true);
  });
});

describe('seed-local: agent seeding', () => {
  let registry: MemMachineRegistryStore;
  let idempotency: MemIdempotencyStore;
  let evidence: MemEvidenceLog;

  beforeEach(() => {
    registry = new MemMachineRegistryStore();
    idempotency = new MemIdempotencyStore();
    evidence = new MemEvidenceLog();
  });

  it('creates an agent linked to the seeded machine', async () => {
    // Pre-register machine so agent tenant check passes
    await registerMachine(
      {
        authorization: ALLOW_ALL,
        clock: CLOCK,
        idGenerator: ID_GEN,
        idempotency,
        unitOfWork: UOW,
        machineRegistryStore: registry,
        evidenceLog: evidence,
      },
      makeCtx(WS_ID),
      {
        idempotencyKey: `seed-machine-${MACHINE_ID}`,
        machine: {
          schemaVersion: 1,
          machineId: MACHINE_ID,
          workspaceId: WS_ID,
          displayName: 'Local Runner',
          endpointUrl: 'http://localhost:7000/v1',
          active: true,
          capabilities: ['run:workflow'],
          registeredAtIso: NOW,
          executionPolicy: {
            isolationMode: 'PerTenantWorker',
            egressAllowlist: ['https://localhost:7000'],
            workloadIdentity: 'Required',
          },
          authConfig: { kind: 'bearer', secretRef: 'grants/dev-token' },
        },
      },
    );

    const result = await createAgent(
      {
        authorization: ALLOW_ALL,
        clock: CLOCK,
        idGenerator: ID_GEN,
        idempotency,
        unitOfWork: UOW,
        machineRegistryStore: registry,
        evidenceLog: evidence,
      },
      makeCtx(WS_ID),
      {
        idempotencyKey: `seed-agent-${AGENT_ID}`,
        agent: {
          schemaVersion: 1,
          agentId: AGENT_ID,
          workspaceId: WS_ID,
          machineId: MACHINE_ID,
          displayName: 'Local Classifier',
          capabilities: ['run:workflow'],
          policyTier: 'Auto',
          allowedTools: ['classify'],
          registeredAtIso: NOW,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agentId).toBe(AGENT_ID);

    const saved = await registry.getAgentConfigById(TenantId(WS_ID), AGENT_ID);
    expect(saved).not.toBeNull();
    expect(String(saved?.machineId)).toBe(MACHINE_ID);
  });
});

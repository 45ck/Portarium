import { describe, expect, it } from 'vitest';

import { AgentId, HashSha256, TenantId } from '../../domain/primitives/index.js';
import type { AgentConfigV1, MachineRegistrationV1 } from '../../domain/machines/index.js';
import { toAppContext } from '../common/context.js';
import {
  createAgent,
  registerMachine,
  type MachineAgentRegistrationDeps,
} from '../commands/machine-agent-registration.js';
import type {
  AuthorizationPort,
  Clock,
  EvidenceLogPort,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  MachineRegistryStore,
  UnitOfWork,
} from '../ports/index.js';

class InMemoryMachineRegistryStore implements MachineRegistryStore {
  readonly #machines = new Map<string, MachineRegistrationV1>();
  readonly #agents = new Map<string, AgentConfigV1>();

  public async getMachineRegistrationById(
    _tenantId: ReturnType<typeof TenantId>,
    machineId: MachineRegistrationV1['machineId'],
  ): Promise<MachineRegistrationV1 | null> {
    return this.#machines.get(String(machineId)) ?? null;
  }

  public async saveMachineRegistration(
    _tenantId: ReturnType<typeof TenantId>,
    registration: MachineRegistrationV1,
  ): Promise<void> {
    this.#machines.set(String(registration.machineId), registration);
  }

  public async getAgentConfigById(
    _tenantId: ReturnType<typeof TenantId>,
    agentId: AgentConfigV1['agentId'],
  ): Promise<AgentConfigV1 | null> {
    return this.#agents.get(String(agentId)) ?? null;
  }

  public async saveAgentConfig(
    _tenantId: ReturnType<typeof TenantId>,
    agent: AgentConfigV1,
  ): Promise<void> {
    this.#agents.set(String(agent.agentId), agent);
  }

  public async updateMachineHeartbeat(
    _tenantId: ReturnType<typeof TenantId>,
    _machineId: MachineRegistrationV1['machineId'],
    _heartbeat: import('../ports/machine-registry-store.js').HeartbeatData,
  ): Promise<boolean> {
    return true;
  }

  public async updateAgentHeartbeat(
    _tenantId: ReturnType<typeof TenantId>,
    _agentId: AgentConfigV1['agentId'],
    _heartbeat: import('../ports/machine-registry-store.js').HeartbeatData,
  ): Promise<boolean> {
    return true;
  }
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();

  public async get<T>(key: IdempotencyKey): Promise<T | null> {
    return (this.#cache.get(`${key.commandName}:${key.requestKey}`) as T) ?? null;
  }

  public async set<T>(key: IdempotencyKey, value: T): Promise<void> {
    this.#cache.set(`${key.commandName}:${key.requestKey}`, value);
  }
}

function buildDeps(): {
  deps: MachineAgentRegistrationDeps;
  registry: InMemoryMachineRegistryStore;
  evidenceSummaries: string[];
} {
  const registry = new InMemoryMachineRegistryStore();
  const evidenceSummaries: string[] = [];
  let idSequence = 1;

  const authorization: AuthorizationPort = {
    isAllowed: async () => true,
  };
  const clock: Clock = {
    nowIso: () => '2026-02-20T00:00:00.000Z',
  };
  const idGenerator: IdGenerator = {
    generateId: () => `evi-${idSequence++}`,
  };
  const idempotency = new InMemoryIdempotencyStore();
  const unitOfWork: UnitOfWork = {
    execute: async (fn) => fn(),
  };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: async (_tenantId, entry) => {
      evidenceSummaries.push(entry.summary);
      return {
        ...entry,
        hashSha256: HashSha256('a'.repeat(64)),
      };
    },
  };

  return {
    deps: {
      authorization,
      clock,
      idGenerator,
      idempotency,
      unitOfWork,
      machineRegistryStore: registry,
      evidenceLog,
    },
    registry,
    evidenceSummaries,
  };
}

describe('application integration: capability drift quarantine on agent re-registration', () => {
  it('quarantines drifted agent declarations and denies re-registration side effects', async () => {
    const { deps, registry, evidenceSummaries } = buildDeps();
    const ctx = toAppContext({
      tenantId: 'ws-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });

    const registeredMachine = await registerMachine(deps, ctx, {
      idempotencyKey: 'idem-machine-1',
      machine: {
        schemaVersion: 1,
        machineId: 'machine-1',
        workspaceId: 'ws-1',
        endpointUrl: 'https://gateway.example/v1',
        active: true,
        displayName: 'Runner',
        capabilities: ['run:workflow', 'run:sync'],
        registeredAtIso: '2026-02-20T00:00:00.000Z',
        executionPolicy: {
          isolationMode: 'PerTenantWorker',
          egressAllowlist: ['https://gateway.example'],
          workloadIdentity: 'Required',
        },
        authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
      },
    });
    expect(registeredMachine.ok).toBe(true);

    const firstRegistration = await createAgent(deps, ctx, {
      idempotencyKey: 'idem-agent-1',
      agent: {
        schemaVersion: 1,
        agentId: 'agent-1',
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        displayName: 'Classifier',
        capabilities: ['run:workflow'],
        policyTier: 'Auto',
        allowedTools: ['classify'],
        registeredAtIso: '2026-02-20T00:00:00.000Z',
      },
    });
    expect(firstRegistration.ok).toBe(true);

    const driftedRegistration = await createAgent(deps, ctx, {
      idempotencyKey: 'idem-agent-2',
      agent: {
        schemaVersion: 1,
        agentId: 'agent-1',
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        displayName: 'Classifier',
        capabilities: ['run:sync'],
        policyTier: 'Auto',
        allowedTools: ['classify'],
        registeredAtIso: '2026-02-20T00:01:00.000Z',
      },
    });

    expect(driftedRegistration.ok).toBe(false);
    if (driftedRegistration.ok) throw new Error('Expected quarantine conflict');
    expect(driftedRegistration.error.kind).toBe('Conflict');
    expect(driftedRegistration.error.message).toContain('quarantined');
    expect(driftedRegistration.error.message).toContain('added: run:sync');
    expect(driftedRegistration.error.message).toContain('removed: run:workflow');

    expect(evidenceSummaries).toHaveLength(2);
    expect(evidenceSummaries[0]).toContain('Registered machine');
    expect(evidenceSummaries[1]).toContain('Created agent');

    const storedAgent = await registry.getAgentConfigById(TenantId('ws-1'), AgentId('agent-1'));
    expect(storedAgent).not.toBeNull();
    expect(storedAgent?.allowedTools).toEqual(['classify']);
  });
});

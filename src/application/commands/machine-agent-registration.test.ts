import { describe, expect, it, vi } from 'vitest';

import {
  createAgent,
  registerMachine,
  updateAgentCapabilities,
} from './machine-agent-registration.js';
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
import type { EvidenceEntryAppendInput } from '../ports/evidence-log.js';
import { toAppContext } from '../common/context.js';
import { TenantId } from '../../domain/primitives/index.js';
import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import {
  parseAgentConfigV1,
  parseMachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';

function makeCtx(workspaceId = 'ws-1') {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-1',
    correlationId: 'corr-1',
    roles: ['admin'],
  });
}

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

  public async updateMachineHeartbeat(): Promise<boolean> {
    return true;
  }

  public async updateAgentHeartbeat(): Promise<boolean> {
    return true;
  }
}

function createDeps(overrides?: { allowed?: boolean; idGeneratorValues?: string[] }) {
  const registry = new InMemoryMachineRegistryStore();
  const evidenceAppends: EvidenceEntryAppendInput[] = [];
  const idValues = [...(overrides?.idGeneratorValues ?? ['evi-1', 'evi-2', 'evi-3', 'evi-4'])];

  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => overrides?.allowed ?? true),
  };
  const clock: Clock = {
    nowIso: vi.fn(() => '2026-02-20T10:00:00.000Z'),
  };
  const idGenerator: IdGenerator = {
    generateId: vi.fn(() => idValues.shift() ?? 'evi-fallback'),
  };

  const cache = new Map<string, unknown>();
  const idempotency: IdempotencyStore = {
    get: async <T>(key: IdempotencyKey) =>
      (cache.get(`${key.commandName}:${key.requestKey}`) as T | undefined) ?? null,
    set: async (key, value) => {
      cache.set(`${key.commandName}:${key.requestKey}`, value);
    },
  };
  const unitOfWork: UnitOfWork = {
    execute: vi.fn(async (fn) => fn()),
  };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async (_tenantId, entry) => {
      evidenceAppends.push(entry);
      return {
        ...entry,
        hashSha256: 'a'.repeat(64),
      };
    }),
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
    evidenceAppends,
  };
}

const VALID_MACHINE: unknown = {
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  endpointUrl: 'https://gateway.example/v1',
  active: true,
  displayName: 'Runner',
  capabilities: ['run:workflow'],
  registeredAtIso: '2026-02-20T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://gateway.example'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
};

const VALID_AGENT: unknown = {
  schemaVersion: 1,
  agentId: 'agent-1',
  workspaceId: 'ws-1',
  machineId: 'machine-1',
  displayName: 'Classifier',
  capabilities: ['run:workflow'],
  policyTier: 'Auto',
  allowedTools: ['classify'],
  registeredAtIso: '2026-02-20T00:00:00.000Z',
};

describe('machine-agent registration commands', () => {
  it('registerMachine persists machine and appends evidence', async () => {
    const { deps, registry, evidenceAppends } = createDeps();
    const result = await registerMachine(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-machine-1',
      machine: VALID_MACHINE,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.machineId).toBe('machine-1');
    const stored = await registry.getMachineRegistrationById(
      TenantId('ws-1'),
      result.value.machineId,
    );
    expect(stored).not.toBeNull();
    expect(evidenceAppends).toHaveLength(1);
    expect(evidenceAppends[0]!.summary).toContain('Registered machine');
  });

  it('registerMachine enforces tenant match', async () => {
    const { deps } = createDeps();
    const result = await registerMachine(deps, makeCtx('ws-2'), {
      idempotencyKey: 'idem-machine-2',
      machine: VALID_MACHINE,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });

  it('registerMachine is idempotent and does not append duplicate evidence', async () => {
    const { deps, evidenceAppends } = createDeps();
    const first = await registerMachine(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-machine-3',
      machine: VALID_MACHINE,
    });
    const second = await registerMachine(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-machine-3',
      machine: VALID_MACHINE,
    });

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(evidenceAppends).toHaveLength(1);
  });

  it('createAgent requires a registered machine and appends evidence on success', async () => {
    const { deps, registry, evidenceAppends } = createDeps();

    const missingMachine = await createAgent(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-missing',
      agent: VALID_AGENT,
    });
    expect(missingMachine.ok).toBe(false);
    if (missingMachine.ok) return;
    expect(missingMachine.error.kind).toBe('NotFound');

    await registry.saveMachineRegistration(
      TenantId('ws-1'),
      parseMachineRegistrationV1(VALID_MACHINE),
    );
    const created = await createAgent(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-1',
      agent: VALID_AGENT,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.agentId).toBe('agent-1');
    const stored = await registry.getAgentConfigById(TenantId('ws-1'), created.value.agentId);
    expect(stored).not.toBeNull();
    expect(evidenceAppends).toHaveLength(1);
    expect(evidenceAppends[0]!.summary).toContain('Created agent');
  });

  it('createAgent rejects capabilities that are not supported by the machine', async () => {
    const { deps, registry } = createDeps();
    await registry.saveMachineRegistration(
      TenantId('ws-1'),
      parseMachineRegistrationV1(VALID_MACHINE),
    );

    const result = await createAgent(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-capability-mismatch',
      agent: {
        ...(VALID_AGENT as Record<string, unknown>),
        capabilities: ['run:deploy'],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('not routable');
  });

  it('createAgent quarantines re-registration when declared capabilities drift', async () => {
    const { deps } = createDeps();

    const machineWithTwoCapabilities = {
      ...(VALID_MACHINE as Record<string, unknown>),
      capabilities: ['run:workflow', 'run:sync'],
    };
    const firstAgent = {
      ...(VALID_AGENT as Record<string, unknown>),
      capabilities: ['run:workflow'],
    };
    const driftedAgent = {
      ...(VALID_AGENT as Record<string, unknown>),
      capabilities: ['run:sync'],
    };

    const machineRegistered = await registerMachine(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-machine-drift',
      machine: machineWithTwoCapabilities,
    });
    expect(machineRegistered.ok).toBe(true);

    const first = await createAgent(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-initial',
      agent: firstAgent,
    });
    expect(first.ok).toBe(true);

    const second = await createAgent(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-reregister',
      agent: driftedAgent,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.kind).toBe('Conflict');
    expect(second.error.message).toContain('quarantined');
    expect(second.error.message).toContain('added: run:sync');
    expect(second.error.message).toContain('removed: run:workflow');
  });

  it('updateAgentCapabilities validates policy tier constraints and writes evidence', async () => {
    const { deps, registry, evidenceAppends } = createDeps();
    await registry.saveMachineRegistration(
      TenantId('ws-1'),
      parseMachineRegistrationV1(VALID_MACHINE),
    );
    await registry.saveAgentConfig(TenantId('ws-1'), parseAgentConfigV1(VALID_AGENT));

    const invalid = await updateAgentCapabilities(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-update-invalid',
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      allowedTools: ['shell.exec'],
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.error.kind).toBe('ValidationFailed');

    const updated = await updateAgentCapabilities(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-update-ok',
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      allowedTools: ['classify', 'read:external'],
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.allowedTools).toEqual(['classify', 'read:external']);
    expect(evidenceAppends).toHaveLength(1);
    expect(evidenceAppends[0]!.summary).toContain('Updated allowed tools');
  });

  it('updateAgentCapabilities enforces workspace scope and agent existence', async () => {
    const { deps } = createDeps();
    const scoped = await updateAgentCapabilities(deps, makeCtx('ws-2'), {
      idempotencyKey: 'idem-agent-scope',
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      allowedTools: [],
    });
    expect(scoped.ok).toBe(false);
    if (scoped.ok) return;
    expect(scoped.error.kind).toBe('Forbidden');

    const missing = await updateAgentCapabilities(deps, makeCtx('ws-1'), {
      idempotencyKey: 'idem-agent-missing',
      workspaceId: 'ws-1',
      agentId: 'agent-404',
      allowedTools: [],
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.kind).toBe('NotFound');
  });
});

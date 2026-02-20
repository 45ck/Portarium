import { describe, expect, it } from 'vitest';

import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import type { RunV1 } from '../../domain/runs/run-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { toAppContext } from '../common/context.js';
import { startWorkflow } from '../commands/start-workflow.js';
import { getRun } from '../queries/get-run.js';
import { OutboxDispatcher } from '../services/outbox-dispatcher.js';
import type {
  AdapterRegistrationStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  OutboxEntry,
  OutboxPort,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
} from '../ports/index.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

const WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Integration Workflow',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [{ actionId: 'act-1', order: 1, portFamily: 'ItsmItOps', operation: 'workflow:simulate' }],
});

const ADAPTER_REGISTRATION = parseAdapterRegistrationV1({
  schemaVersion: 1,
  adapterId: 'adapter-1',
  workspaceId: 'ws-1',
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

class InMemoryRunStore implements RunStore {
  readonly #byId = new Map<string, RunV1>();

  public async getRunById(_tenantId: string, _workspaceId: string, runId: string): Promise<RunV1 | null> {
    return this.#byId.get(runId) ?? null;
  }

  public async saveRun(_tenantId: string, run: RunV1): Promise<void> {
    this.#byId.set(String(run.runId), run);
  }
}

class InMemoryWorkflowStore implements WorkflowStore {
  public async getWorkflowById(): Promise<ReturnType<WorkflowStore['getWorkflowById']> extends Promise<infer T> ? T : never> {
    return WORKFLOW;
  }

  public async listWorkflowsByName(): Promise<readonly [typeof WORKFLOW]> {
    return [WORKFLOW];
  }
}

class InMemoryAdapterRegistrationStore implements AdapterRegistrationStore {
  public async listByWorkspace(): Promise<readonly [typeof ADAPTER_REGISTRATION]> {
    return [ADAPTER_REGISTRATION];
  }
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();

  public async get<T>(key: IdempotencyKey): Promise<T | null> {
    return (this.#cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T) ?? null;
  }

  public async set<T>(key: IdempotencyKey, value: T): Promise<void> {
    this.#cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
  }
}

class InMemoryOutboxStore implements OutboxPort {
  readonly #entries = new Map<string, OutboxEntry>();
  #id = 0;

  public async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    this.#id += 1;
    const entry: OutboxEntry = {
      entryId: `entry-${this.#id}`,
      event,
      status: 'Pending',
      retryCount: 0,
    };
    this.#entries.set(entry.entryId, entry);
    return entry;
  }

  public async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    return [...this.#entries.values()]
      .filter((entry) => entry.status === 'Pending')
      .slice(0, Math.max(0, limit));
  }

  public async markPublished(entryId: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return;
    this.#entries.set(entryId, { ...current, status: 'Published' });
  }

  public async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return;
    this.#entries.set(entryId, {
      ...current,
      status: 'Pending',
      failedReason: reason,
      nextRetryAtIso,
      retryCount: current.retryCount + 1,
    });
  }

  public entries(): readonly OutboxEntry[] {
    return [...this.#entries.values()];
  }
}

function allowAllAuthorization(): AuthorizationPort {
  return { isAllowed: async () => true };
}

function fixedClock(nowIso: string): Clock {
  return { nowIso: () => nowIso };
}

function fixedIdGenerator(ids: readonly string[]): IdGenerator {
  let index = 0;
  return {
    generateId: () => {
      const value = ids[index] ?? ids[ids.length - 1] ?? 'id-fallback';
      index += 1;
      return value;
    },
  };
}

describe('application integration: startWorkflow + getRun + outbox dispatch', () => {
  it('covers happy path, idempotent replay, outbox dispatch, and transient orchestrator retry', async () => {
    const runStore = new InMemoryRunStore();
    const workflowStore = new InMemoryWorkflowStore();
    const adapterRegistrationStore = new InMemoryAdapterRegistrationStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      roles: ['operator'],
      correlationId: 'corr-run-1',
    });

    let failOrchestratorOnce = true;
    const deps = {
      authorization: allowAllAuthorization(),
      clock: fixedClock('2026-02-20T00:00:00.000Z'),
      idGenerator: fixedIdGenerator(['run-1', 'evt-1', 'run-2', 'evt-2']),
      idempotency,
      unitOfWork: { execute: async <T>(fn: () => Promise<T>) => fn() } satisfies UnitOfWork,
      workflowStore,
      adapterRegistrationStore,
      runStore,
      orchestrator: {
        startRun: async () => {
          if (failOrchestratorOnce) {
            failOrchestratorOnce = false;
            throw new Error('transient orchestrator failure');
          }
        },
      } satisfies WorkflowOrchestrator,
      eventPublisher: {
        publish: async (event: PortariumCloudEventV1) => {
          await outbox.enqueue(event);
        },
      } satisfies EventPublisher,
    };

    const first = await startWorkflow(deps, ctx, {
      idempotencyKey: 'idem-run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
    });
    expect(first.ok).toBe(false);
    if (first.ok) throw new Error('expected dependency failure');
    expect(first.error.kind).toBe('DependencyFailure');

    const second = await startWorkflow(deps, ctx, {
      idempotencyKey: 'idem-run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected retry success');
    const runId = String(second.value.runId);

    const replay = await startWorkflow(deps, ctx, {
      idempotencyKey: 'idem-run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error('expected idempotent replay');
    expect(String(replay.value.runId)).toBe(runId);

    const queried = await getRun(
      { authorization: allowAllAuthorization(), runStore },
      ctx,
      { workspaceId: 'ws-1', runId },
    );
    expect(queried.ok).toBe(true);
    if (!queried.ok) throw new Error('expected query success');
    expect(String(queried.value.runId)).toBe(runId);

    const delivered: PortariumCloudEventV1[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-20T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          delivered.push(event);
        },
      },
    });
    const sweep = await dispatcher.sweep();
    expect(sweep).toEqual({ published: 1, failed: 0 });
    expect(delivered).toHaveLength(1);

    const event = delivered[0];
    if (!event) throw new Error('expected cloud event');
    expect(event.specversion).toBe('1.0');
    expect(event.tenantid).toBe('tenant-1');
    expect(event.correlationid).toBe('corr-run-1');
    expect(event.type).toBe('com.portarium.run.RunStarted');
  });
});

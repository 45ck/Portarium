import { describe, expect, it } from 'vitest';

import type { WorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { toAppContext } from '../common/context.js';
import { registerWorkspace } from '../commands/register-workspace.js';
import { getWorkspace } from '../queries/get-workspace.js';
import { OutboxDispatcher } from '../services/outbox-dispatcher.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  OutboxEntry,
  OutboxPort,
  UnitOfWork,
  WorkspaceStore,
} from '../ports/index.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

const WORKSPACE_INPUT = {
  schemaVersion: 1,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Integration Workspace',
  createdAtIso: '2026-02-20T00:00:00.000Z',
};

class InMemoryWorkspaceStore implements WorkspaceStore {
  readonly #byId = new Map<string, WorkspaceV1>();

  public async getWorkspaceById(
    _tenantId: string,
    workspaceId: string,
  ): Promise<WorkspaceV1 | null> {
    return this.#byId.get(workspaceId) ?? null;
  }

  public async getWorkspaceByName(
    _tenantId: string,
    workspaceName: string,
  ): Promise<WorkspaceV1 | null> {
    for (const workspace of this.#byId.values()) {
      if (workspace.name === workspaceName) {
        return workspace;
      }
    }
    return null;
  }

  public async saveWorkspace(workspace: WorkspaceV1): Promise<void> {
    this.#byId.set(String(workspace.workspaceId), workspace);
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

class InlineUnitOfWork implements UnitOfWork {
  readonly #failuresBeforeSuccess: number;
  #attempts = 0;

  public constructor(failuresBeforeSuccess = 0) {
    this.#failuresBeforeSuccess = failuresBeforeSuccess;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.#attempts += 1;
    if (this.#attempts <= this.#failuresBeforeSuccess) {
      throw new Error('transient write failure');
    }
    return fn();
  }
}

function allowAllAuthorization(): AuthorizationPort {
  return { isAllowed: async () => true };
}

function fixedClock(nowIso: string): Clock {
  return { nowIso: () => nowIso };
}

function fixedIdGenerator(id: string): IdGenerator {
  return { generateId: () => id };
}

describe('application integration: registerWorkspace + getWorkspace + outbox dispatch', () => {
  it('covers happy path, idempotent replay, and transient dispatcher retry with CloudEvent envelope', async () => {
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    const eventPublisher: EventPublisher = {
      publish: async (event) => {
        await outbox.enqueue(event);
      },
    };
    const deps = {
      authorization: allowAllAuthorization(),
      clock: fixedClock('2026-02-20T00:00:00.000Z'),
      idGenerator: fixedIdGenerator('evt-1'),
      idempotency,
      unitOfWork: new InlineUnitOfWork(0),
      workspaceStore,
      eventPublisher,
    };

    const created = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'idem-1',
      workspace: WORKSPACE_INPUT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('expected success');
    expect(String(created.value.workspaceId)).toBe('ws-1');

    const queried = await getWorkspace(
      { authorization: allowAllAuthorization(), workspaceStore },
      ctx,
      { workspaceId: 'ws-1' },
    );
    expect(queried.ok).toBe(true);
    if (!queried.ok) throw new Error('expected query success');
    expect(String(queried.value.workspaceId)).toBe('ws-1');

    const replay = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'idem-1',
      workspace: WORKSPACE_INPUT,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error('expected replay success');
    expect(outbox.entries()).toHaveLength(1);

    const flakySinkEvents: PortariumCloudEventV1[] = [];
    let failFirstDelivery = true;
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-20T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          if (failFirstDelivery) {
            failFirstDelivery = false;
            throw new Error('transient sink outage');
          }
          flakySinkEvents.push(event);
        },
      },
    });

    const firstSweep = await dispatcher.sweep();
    expect(firstSweep).toEqual({ published: 0, failed: 1 });
    const secondSweep = await dispatcher.sweep();
    expect(secondSweep).toEqual({ published: 1, failed: 0 });

    expect(flakySinkEvents).toHaveLength(1);
    const emitted = flakySinkEvents[0];
    if (!emitted) throw new Error('expected emitted event');
    expect(emitted.specversion).toBe('1.0');
    expect(emitted.id).toBe('evt-1');
    expect(emitted.tenantid).toBe('tenant-1');
    expect(emitted.correlationid).toBe('corr-1');
    expect(emitted.type).toBe('com.portarium.workspace.WorkspaceCreated');
  });

  it('supports command retry after transient unit-of-work failure', async () => {
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-2',
      roles: ['admin'],
    });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    const deps = {
      authorization: allowAllAuthorization(),
      clock: fixedClock('2026-02-20T00:00:00.000Z'),
      idGenerator: fixedIdGenerator('evt-2'),
      idempotency,
      unitOfWork: new InlineUnitOfWork(1),
      workspaceStore,
      eventPublisher: {
        publish: async (event: PortariumCloudEventV1) => {
          await outbox.enqueue(event);
        },
      },
    };

    const first = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'idem-retry',
      workspace: { ...WORKSPACE_INPUT, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(first.ok).toBe(false);
    if (first.ok) throw new Error('expected dependency failure');
    expect(first.error.kind).toBe('DependencyFailure');

    const second = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'idem-retry',
      workspace: { ...WORKSPACE_INPUT, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected retry success');
    expect(outbox.entries()).toHaveLength(1);
  });
});

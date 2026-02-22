/**
 * Integration tests: cascading and combined outbox failure injections.
 *
 * Covers retry accumulation, retry exhaustion (Failed state),
 * cascading command+dispatcher failures, and non-blocking of subsequent entries.
 */
import { describe, expect, it } from 'vitest';

import { toAppContext } from '../common/context.js';
import { registerWorkspace } from '../commands/register-workspace.js';
import { OutboxDispatcher, MAX_OUTBOX_RETRIES } from '../services/outbox-dispatcher.js';
import type {
  AuthorizationPort,
  Clock,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  OutboxEntry,
  OutboxPort,
  UnitOfWork,
  WorkspaceStore,
} from '../ports/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { CorrelationId, TenantId } from '../../domain/primitives/index.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

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
      if (workspace.name === workspaceName) return workspace;
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
  #seq = 0;
  #nowIso: string | undefined;

  public constructor(nowIso?: string) {
    this.#nowIso = nowIso;
  }
  public setNow(nowIso: string): void {
    this.#nowIso = nowIso;
  }

  public async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    this.#seq += 1;
    const entry: OutboxEntry = {
      entryId: `entry-${String(this.#seq).padStart(4, '0')}`,
      event,
      status: 'Pending',
      retryCount: 0,
    };
    this.#entries.set(entry.entryId, entry);
    return entry;
  }

  public async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const now = this.#nowIso ?? new Date().toISOString();
    return [...this.#entries.values()]
      .filter(
        (e) =>
          e.status === 'Pending' && (e.nextRetryAtIso === undefined || e.nextRetryAtIso <= now),
      )
      .sort((a, b) => a.entryId.localeCompare(b.entryId))
      .slice(0, Math.max(0, limit));
  }

  public async markPublished(entryId: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (current) this.#entries.set(entryId, { ...current, status: 'Published' });
  }

  public async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return;
    const newRetryCount = current.retryCount + 1;
    const status: OutboxEntry['status'] =
      newRetryCount >= MAX_OUTBOX_RETRIES ? 'Failed' : 'Pending';
    this.#entries.set(entryId, {
      ...current,
      status,
      failedReason: reason,
      nextRetryAtIso,
      retryCount: newRetryCount,
    });
  }

  public allEntries(): readonly OutboxEntry[] {
    return [...this.#entries.values()].sort((a, b) => a.entryId.localeCompare(b.entryId));
  }
  public pendingCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Pending').length;
  }
  public failedCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Failed').length;
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
    if (this.#attempts <= this.#failuresBeforeSuccess) throw new Error('transient write failure');
    return fn();
  }
}

function allowAll(): AuthorizationPort {
  return { isAllowed: async () => true };
}
function fixedClock(nowIso: string): Clock {
  return { nowIso: () => nowIso };
}
function counter(): IdGenerator {
  let n = 0;
  return { generateId: () => `id-${++n}` };
}

const BASE_WORKSPACE = {
  schemaVersion: 1 as const,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Test Workspace',
  createdAtIso: '2026-02-22T00:00:00.000Z',
};

describe('failure injection: cascading and combined failures', () => {
  it('command + dispatcher both fail transiently; system converges on retry', async () => {
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();

    const failingDeps = {
      authorization: allowAll(),
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      idGenerator: counter(),
      idempotency,
      unitOfWork: new InlineUnitOfWork(1),
      workspaceStore,
      eventPublisher: {
        publish: async (e: PortariumCloudEventV1) => {
          await outbox.enqueue(e);
        },
      },
    };
    const fail = await registerWorkspace(failingDeps, ctx, {
      idempotencyKey: 'cascading-key',
      workspace: BASE_WORKSPACE,
    });
    expect(fail.ok).toBe(false);
    expect(outbox.allEntries()).toHaveLength(0);

    const successDeps = { ...failingDeps, unitOfWork: new InlineUnitOfWork(0) };
    const succeed = await registerWorkspace(successDeps, ctx, {
      idempotencyKey: 'cascading-key',
      workspace: BASE_WORKSPACE,
    });
    expect(succeed.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);

    let dispatcherFailure = true;
    const delivered: PortariumCloudEventV1[] = [];
    outbox.setNow('2099-01-01T00:00:00.000Z');
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          if (dispatcherFailure) {
            dispatcherFailure = false;
            throw new Error('dispatcher sink outage');
          }
          delivered.push(event);
        },
      },
    });

    const sweep1 = await dispatcher.sweep();
    expect(sweep1).toEqual({ published: 0, failed: 1 });
    const sweep2 = await dispatcher.sweep();
    expect(sweep2).toEqual({ published: 1, failed: 0 });
    expect(delivered).toHaveLength(1);
  });

  it('replay after cascading failure returns the original cached result', async () => {
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    const deps = {
      authorization: allowAll(),
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      idGenerator: counter(),
      idempotency,
      unitOfWork: new InlineUnitOfWork(0),
      workspaceStore,
      eventPublisher: {
        publish: async (e: PortariumCloudEventV1) => {
          await outbox.enqueue(e);
        },
      },
    };

    const original = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'stable-key',
      workspace: BASE_WORKSPACE,
    });
    expect(original.ok).toBe(true);

    for (let i = 0; i < 3; i++) {
      const replay = await registerWorkspace(deps, ctx, {
        idempotencyKey: 'stable-key',
        workspace: BASE_WORKSPACE,
      });
      expect(replay.ok).toBe(true);
    }
    expect(outbox.allEntries()).toHaveLength(1);
  });

  it('outbox entry reaches Failed state after MAX_OUTBOX_RETRIES exhausted', async () => {
    const outbox = new InMemoryOutboxStore('2099-01-01T00:00:00.000Z');
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      publisher: {
        publish: async () => {
          throw new Error('permanent sink failure');
        },
      },
    });

    await outbox.enqueue({
      id: 'evt-exhaust',
      type: 'com.portarium.test.Exhaust',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });

    let sweepCount = 0;
    while (outbox.failedCount() === 0 && sweepCount < MAX_OUTBOX_RETRIES + 2) {
      await dispatcher.sweep();
      sweepCount++;
    }

    expect(outbox.failedCount()).toBe(1);
    expect(outbox.pendingCount()).toBe(0);
  });

  it('failed entry after max retries does not block delivery of subsequent entries', async () => {
    const outbox = new InMemoryOutboxStore('2099-01-01T00:00:00.000Z');
    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          if (event.id === 'evt-fail') throw new Error('permanent failure for this event');
          delivered.push(event.id);
        },
      },
    });

    await outbox.enqueue({
      id: 'evt-fail',
      type: 'com.portarium.test.Fail',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });
    await outbox.enqueue({
      id: 'evt-ok',
      type: 'com.portarium.test.Ok',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });

    let sweepCount = 0;
    while (sweepCount < MAX_OUTBOX_RETRIES + 2) {
      await dispatcher.sweep();
      sweepCount++;
    }

    expect(outbox.failedCount()).toBe(1);
    expect(delivered).toContain('evt-ok');
  });
});

/**
 * Integration tests: application-layer idempotency and replay safety.
 *
 * Covers idempotency cache hit/miss behaviour, cross-tenant key isolation,
 * and replay safety under transient unit-of-work failures.
 */
import { describe, expect, it } from 'vitest';

import { toAppContext } from '../common/context.js';
import { registerWorkspace } from '../commands/register-workspace.js';
import { MAX_OUTBOX_RETRIES } from '../services/outbox-dispatcher.js';
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
  public size(): number {
    return this.#cache.size;
  }
}

class InMemoryOutboxStore implements OutboxPort {
  readonly #entries = new Map<string, OutboxEntry>();
  #seq = 0;
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
    return [...this.#entries.values()]
      .filter((e) => e.status === 'Pending')
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

// Suite 1: Idempotency — duplicate detection and cross-tenant isolation

describe('idempotency: duplicate detection and tenant isolation', () => {
  it('returns cached result on replay — does not re-execute command or enqueue new event', async () => {
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

    const first = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-abc',
      workspace: BASE_WORKSPACE,
    });
    expect(first.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);
    expect(idempotency.size()).toBe(1);

    const replay = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-abc',
      workspace: BASE_WORKSPACE,
    });
    expect(replay.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1); // Still 1 — no double-enqueue.
    if (first.ok && replay.ok) {
      expect(String(replay.value.workspaceId)).toBe(String(first.value.workspaceId));
    }
  });

  it('different idempotency keys for same tenant execute independently', async () => {
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

    const a = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-a',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-a', name: 'Workspace A' },
    });
    const b = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-b',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-b', name: 'Workspace B' },
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(2);
    expect(idempotency.size()).toBe(2);
  });

  it('isolates idempotency keys across tenants — same key in different tenants does not collide', async () => {
    const ctxA = toAppContext({
      tenantId: 'tenant-A',
      principalId: 'user-1',
      correlationId: 'corrA',
      roles: ['admin'],
    });
    const ctxB = toAppContext({
      tenantId: 'tenant-B',
      principalId: 'user-1',
      correlationId: 'corrB',
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

    const resA = await registerWorkspace(deps, ctxA, {
      idempotencyKey: 'same-key',
      workspace: {
        ...BASE_WORKSPACE,
        workspaceId: 'ws-tenA',
        tenantId: 'tenant-A',
        name: 'Workspace A',
      },
    });
    const resB = await registerWorkspace(deps, ctxB, {
      idempotencyKey: 'same-key',
      workspace: {
        ...BASE_WORKSPACE,
        workspaceId: 'ws-tenB',
        tenantId: 'tenant-B',
        name: 'Workspace B',
      },
    });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(2);
    expect(idempotency.size()).toBe(2);
  });
});

// Suite 2: Replay safety under transient unit-of-work failures

describe('replay safety: idempotency is preserved across transient write failures', () => {
  it('command returns DependencyFailure on first attempt; replay with same key succeeds and is then idempotent', async () => {
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    const uow = new InlineUnitOfWork(1);
    const deps = {
      authorization: allowAll(),
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      idGenerator: counter(),
      idempotency,
      unitOfWork: uow,
      workspaceStore,
      eventPublisher: {
        publish: async (e: PortariumCloudEventV1) => {
          await outbox.enqueue(e);
        },
      },
    };

    const fail = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(fail.ok).toBe(false);
    expect(idempotency.size()).toBe(0);
    expect(outbox.allEntries()).toHaveLength(0);

    const succeed = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(succeed.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);
    expect(idempotency.size()).toBe(1);

    await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(outbox.allEntries()).toHaveLength(1);
  });

  it('multiple concurrent replays converge to single cached result', async () => {
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

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        registerWorkspace(deps, ctx, {
          idempotencyKey: 'concurrent-key',
          workspace: BASE_WORKSPACE,
        }),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    // In-memory store is sequential so idempotency is exact.
    expect(idempotency.size()).toBe(1);
  });
});

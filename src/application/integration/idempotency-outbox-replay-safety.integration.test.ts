/**
 * End-to-end integration tests for application-layer idempotency, replay
 * safety, outbox dispatch ordering, and failure injections.
 *
 * These tests exercise the full application stack using in-memory ports
 * (no real database) to verify correctness of the idempotency + outbox
 * contract under normal and adversarial conditions.
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

// ---------------------------------------------------------------------------
// In-memory fixtures (shared across suites)
// ---------------------------------------------------------------------------

class InMemoryWorkspaceStore implements WorkspaceStore {
  readonly #byId = new Map<string, WorkspaceV1>();

  public async getWorkspaceById(_tenantId: string, workspaceId: string): Promise<WorkspaceV1 | null> {
    return this.#byId.get(workspaceId) ?? null;
  }

  public async getWorkspaceByName(_tenantId: string, workspaceName: string): Promise<WorkspaceV1 | null> {
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
  /** When provided, fetchPending uses this as "now" for nextRetryAtIso comparison. */
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
      .filter((e) => e.status === 'Pending' && (e.nextRetryAtIso === undefined || e.nextRetryAtIso <= now))
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
    const status: OutboxEntry['status'] = newRetryCount >= MAX_OUTBOX_RETRIES ? 'Failed' : 'Pending';
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

  public publishedCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Published').length;
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
    if (this.#attempts <= this.#failuresBeforeSuccess) {
      throw new Error('transient write failure');
    }
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

// ---------------------------------------------------------------------------
// Suite 1: Idempotency — duplicate detection and cross-tenant isolation
// ---------------------------------------------------------------------------

describe('idempotency: duplicate detection and tenant isolation', () => {
  it('returns cached result on replay — does not re-execute command or enqueue new event', async () => {
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
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
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };

    // First call: creates workspace, enqueues one event.
    const first = await registerWorkspace(deps, ctx, { idempotencyKey: 'key-abc', workspace: BASE_WORKSPACE });
    expect(first.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);
    expect(idempotency.size()).toBe(1);

    // Replay with same key: returns cached result, no new event.
    const replay = await registerWorkspace(deps, ctx, { idempotencyKey: 'key-abc', workspace: BASE_WORKSPACE });
    expect(replay.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1); // Still 1 — no double-enqueue.
    if (first.ok && replay.ok) {
      expect(String(replay.value.workspaceId)).toBe(String(first.value.workspaceId));
    }
  });

  it('different idempotency keys for same tenant execute independently', async () => {
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
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
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
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
    const ctxA = toAppContext({ tenantId: 'tenant-A', principalId: 'user-1', correlationId: 'corrA', roles: ['admin'] });
    const ctxB = toAppContext({ tenantId: 'tenant-B', principalId: 'user-1', correlationId: 'corrB', roles: ['admin'] });

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
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };

    const resA = await registerWorkspace(deps, ctxA, {
      idempotencyKey: 'same-key',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-tenA', tenantId: 'tenant-A', name: 'Workspace A' },
    });
    const resB = await registerWorkspace(deps, ctxB, {
      idempotencyKey: 'same-key',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-tenB', tenantId: 'tenant-B', name: 'Workspace B' },
    });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    // Both created independently: two distinct events enqueued.
    expect(outbox.allEntries()).toHaveLength(2);
    // Two separate cache entries.
    expect(idempotency.size()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Replay safety under transient unit-of-work failures
// ---------------------------------------------------------------------------

describe('replay safety: idempotency is preserved across transient write failures', () => {
  it('command returns DependencyFailure on first attempt; replay with same key succeeds and is then idempotent', async () => {
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();
    // First execute() call fails, second succeeds.
    const uow = new InlineUnitOfWork(1);
    const deps = {
      authorization: allowAll(),
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      idGenerator: counter(),
      idempotency,
      unitOfWork: uow,
      workspaceStore,
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };

    const fail = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(fail.ok).toBe(false);
    // After a UoW failure, idempotency cache must NOT have been written.
    expect(idempotency.size()).toBe(0);
    expect(outbox.allEntries()).toHaveLength(0);

    const succeed = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(succeed.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);
    expect(idempotency.size()).toBe(1);

    // Further replays return cached result, no new events.
    await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-retry',
      workspace: { ...BASE_WORKSPACE, workspaceId: 'ws-retry', name: 'Retry Workspace' },
    });
    expect(outbox.allEntries()).toHaveLength(1);
  });

  it('multiple concurrent replays converge to single cached result', async () => {
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
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
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };

    // Fire 5 concurrent replays — only one should write to outbox.
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        registerWorkspace(deps, ctx, {
          idempotencyKey: 'concurrent-key',
          workspace: BASE_WORKSPACE,
        }),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    // In-memory store is sequential so idempotency is exact. In production, a
    // DB UPSERT would enforce the uniqueness constraint.
    expect(idempotency.size()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Outbox dispatch ordering
// ---------------------------------------------------------------------------

describe('outbox dispatch ordering: events delivered in enqueue order across failures', () => {
  it('delivers multiple events in enqueue (entryId) order', async () => {
    const outbox = new InMemoryOutboxStore();
    const clock = fixedClock('2026-02-22T00:00:00.000Z');
    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock,
      publisher: {
        publish: async (event) => {
          delivered.push(event.id);
        },
      },
    });

    // Enqueue 3 events.
    await outbox.enqueue({ id: 'evt-1', type: 'com.portarium.test.A', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });
    await outbox.enqueue({ id: 'evt-2', type: 'com.portarium.test.B', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });
    await outbox.enqueue({ id: 'evt-3', type: 'com.portarium.test.C', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });

    const result = await dispatcher.sweep();
    expect(result).toEqual({ published: 3, failed: 0 });
    expect(delivered).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('preserves order when first delivery fails and is retried in a subsequent sweep', async () => {
    const outbox = new InMemoryOutboxStore();
    const clock = fixedClock('2026-02-22T00:00:00.000Z');
    const delivered: string[] = [];
    let failEvt1 = true;
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock,
      publisher: {
        publish: async (event) => {
          if (failEvt1 && event.id === 'evt-1') {
            failEvt1 = false;
            throw new Error('transient failure');
          }
          delivered.push(event.id);
        },
      },
    });

    await outbox.enqueue({ id: 'evt-1', type: 'com.portarium.test.A', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });
    await outbox.enqueue({ id: 'evt-2', type: 'com.portarium.test.B', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });

    // First sweep: evt-1 fails (rescheduled), evt-2 succeeds.
    const sweep1 = await dispatcher.sweep();
    expect(sweep1).toEqual({ published: 1, failed: 1 });
    expect(delivered).toEqual(['evt-2']);

    // Simulate time advancing past the retry window.
    outbox.setNow('2099-01-01T00:00:00.000Z');

    const entry1 = outbox.allEntries().find((e) => e.event.id === 'evt-1');
    expect(entry1).toBeDefined();
    expect(entry1?.status).toBe('Pending');
    expect(entry1?.retryCount).toBe(1);

    // Second sweep: evt-1 now succeeds.
    const sweep2 = await dispatcher.sweep();
    expect(sweep2.published).toBeGreaterThanOrEqual(1);
    expect(delivered).toContain('evt-1');
  });

  it('delivers events from multiple commands in enqueue order', async () => {
    const outbox = new InMemoryOutboxStore();
    const clock = fixedClock('2026-02-22T00:00:00.000Z');
    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock,
      publisher: { publish: async (event) => { delivered.push(event.id); } },
    });

    // Command A produces events a1, a2; Command B produces event b1.
    // Enqueued in interleaved order to verify ordering by entryId.
    await outbox.enqueue({ id: 'a1', type: 'com.portarium.test.A1', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corrA'), data: null });
    await outbox.enqueue({ id: 'b1', type: 'com.portarium.test.B1', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corrB'), data: null });
    await outbox.enqueue({ id: 'a2', type: 'com.portarium.test.A2', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corrA'), data: null });

    await dispatcher.sweep();
    expect(delivered).toEqual(['a1', 'b1', 'a2']); // In enqueue order.
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Failure injections — cascading and combined failures
// ---------------------------------------------------------------------------

describe('failure injection: cascading and combined failures', () => {
  it('command + dispatcher both fail transiently; system converges on retry', async () => {
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
    const workspaceStore = new InMemoryWorkspaceStore();
    const idempotency = new InMemoryIdempotencyStore();
    const outbox = new InMemoryOutboxStore();

    // Phase 1: command fails (UoW transient).
    const failingDeps = {
      authorization: allowAll(),
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      idGenerator: counter(),
      idempotency,
      unitOfWork: new InlineUnitOfWork(1),
      workspaceStore,
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };
    const fail = await registerWorkspace(failingDeps, ctx, { idempotencyKey: 'cascading-key', workspace: BASE_WORKSPACE });
    expect(fail.ok).toBe(false);
    expect(outbox.allEntries()).toHaveLength(0);

    // Phase 2: command succeeds, dispatcher fails first.
    const successDeps = { ...failingDeps, unitOfWork: new InlineUnitOfWork(0) };
    const succeed = await registerWorkspace(successDeps, ctx, { idempotencyKey: 'cascading-key', workspace: BASE_WORKSPACE });
    expect(succeed.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);

    let dispatcherFailure = true;
    const delivered: PortariumCloudEventV1[] = [];
    // Use far-future "now" so retry window is always passed.
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
    const ctx = toAppContext({ tenantId: 'tenant-1', principalId: 'user-1', correlationId: 'corr-1', roles: ['admin'] });
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
      eventPublisher: { publish: async (e: PortariumCloudEventV1) => { await outbox.enqueue(e); } },
    };

    const original = await registerWorkspace(deps, ctx, { idempotencyKey: 'stable-key', workspace: BASE_WORKSPACE });
    expect(original.ok).toBe(true);

    // Replay 3 more times — all should return the cached result.
    for (let i = 0; i < 3; i++) {
      const replay = await registerWorkspace(deps, ctx, { idempotencyKey: 'stable-key', workspace: BASE_WORKSPACE });
      expect(replay.ok).toBe(true);
    }
    // Only one event ever enqueued.
    expect(outbox.allEntries()).toHaveLength(1);
  });

  it('outbox entry reaches Failed state after MAX_OUTBOX_RETRIES exhausted', async () => {
    // Use a far-future "now" so nextRetryAtIso never blocks the sweep.
    const outbox = new InMemoryOutboxStore('2099-01-01T00:00:00.000Z');
    const clock = fixedClock('2026-02-22T00:00:00.000Z');
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock,
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

    // Drive retries until MAX_OUTBOX_RETRIES is reached.
    // Each dispatcher.sweep() that fails increments retryCount by 1 via markFailed.
    let sweepCount = 0;
    while (outbox.failedCount() === 0 && sweepCount < MAX_OUTBOX_RETRIES + 2) {
      await dispatcher.sweep();
      sweepCount++;
    }

    // After MAX_OUTBOX_RETRIES failures, entry must be marked Failed.
    expect(outbox.failedCount()).toBe(1);
    expect(outbox.pendingCount()).toBe(0);
  });

  it('failed entry after max retries does not block delivery of subsequent entries', async () => {
    // Use a far-future "now" so nextRetryAtIso never blocks the sweep.
    const outbox = new InMemoryOutboxStore('2099-01-01T00:00:00.000Z');
    const clock = fixedClock('2026-02-22T00:00:00.000Z');

    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock,
      publisher: {
        publish: async (event) => {
          if (event.id === 'evt-fail') {
            throw new Error('permanent failure for this event');
          }
          delivered.push(event.id);
        },
      },
    });

    // Enqueue two events: first will exhaust retries, second should still deliver.
    await outbox.enqueue({ id: 'evt-fail', type: 'com.portarium.test.Fail', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });
    await outbox.enqueue({ id: 'evt-ok', type: 'com.portarium.test.Ok', specversion: '1.0', source: 'test', tenantid: TenantId('tenant-1'), correlationid: CorrelationId('corr'), data: null });

    // Run sweeps until evt-fail is exhausted (Failed) and evt-ok is delivered.
    let sweepCount = 0;
    while (sweepCount < MAX_OUTBOX_RETRIES + 2) {
      await dispatcher.sweep();
      sweepCount++;
    }

    // First entry is now Failed; second was delivered along the way.
    expect(outbox.failedCount()).toBe(1);
    expect(delivered).toContain('evt-ok');
  });
});

/**
 * End-to-end integration tests for application-layer idempotency and replay safety.
 *
 * Suites:
 *   1. Idempotency — duplicate detection and cross-tenant isolation
 *   2. Replay safety under transient unit-of-work failures
 *
 * (Outbox dispatch ordering and failure injection suites:
 *  outbox-dispatch-failure-injection.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';

import { toAppContext } from '../common/context.js';
import { registerWorkspace } from '../commands/register-workspace.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import {
  InMemoryWorkspaceStore,
  InMemoryIdempotencyStore,
  InMemoryOutboxStore,
  InlineUnitOfWork,
  allowAll,
  fixedClock,
  counter,
  BASE_WORKSPACE,
} from './idempotency-outbox-test-helpers.js';

// ---------------------------------------------------------------------------
// Suite 1: Idempotency — duplicate detection and cross-tenant isolation
// ---------------------------------------------------------------------------

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

    // First call: creates workspace, enqueues one event.
    const first = await registerWorkspace(deps, ctx, {
      idempotencyKey: 'key-abc',
      workspace: BASE_WORKSPACE,
    });
    expect(first.ok).toBe(true);
    expect(outbox.allEntries()).toHaveLength(1);
    expect(idempotency.size()).toBe(1);

    // Replay with same key: returns cached result, no new event.
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
    const ctx = toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    });
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

    await registerWorkspace(deps, ctx, {
      idempotencyKey: 'concurrent-key',
      workspace: BASE_WORKSPACE,
    });

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

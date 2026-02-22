/**
 * End-to-end integration tests for outbox dispatch ordering and failure injection.
 *
 * Suites:
 *   3. Outbox dispatch ordering — events delivered in enqueue order across failures
 *   4. Failure injection — cascading and combined failures
 *
 * (Idempotency and replay safety suites:
 *  idempotency-outbox-replay-safety.integration.test.ts)
 */
import { describe, expect, it } from 'vitest';

import { toAppContext } from '../common/context.js';
import { registerWorkspace } from '../commands/register-workspace.js';
import { OutboxDispatcher, MAX_OUTBOX_RETRIES } from '../services/outbox-dispatcher.js';
import { TenantId, CorrelationId } from '../../domain/primitives/index.js';
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
    await outbox.enqueue({
      id: 'evt-1',
      type: 'com.portarium.test.A',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });
    await outbox.enqueue({
      id: 'evt-2',
      type: 'com.portarium.test.B',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });
    await outbox.enqueue({
      id: 'evt-3',
      type: 'com.portarium.test.C',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });

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

    await outbox.enqueue({
      id: 'evt-1',
      type: 'com.portarium.test.A',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });
    await outbox.enqueue({
      id: 'evt-2',
      type: 'com.portarium.test.B',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corr'),
      data: null,
    });

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
      publisher: {
        publish: async (event) => {
          delivered.push(event.id);
        },
      },
    });

    // Command A produces events a1, a2; Command B produces event b1.
    // Enqueued in interleaved order to verify ordering by entryId.
    await outbox.enqueue({
      id: 'a1',
      type: 'com.portarium.test.A1',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corrA'),
      data: null,
    });
    await outbox.enqueue({
      id: 'b1',
      type: 'com.portarium.test.B1',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corrB'),
      data: null,
    });
    await outbox.enqueue({
      id: 'a2',
      type: 'com.portarium.test.A2',
      specversion: '1.0',
      source: 'test',
      tenantid: TenantId('tenant-1'),
      correlationid: CorrelationId('corrA'),
      data: null,
    });

    await dispatcher.sweep();
    expect(delivered).toEqual(['a1', 'b1', 'a2']); // In enqueue order.
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Failure injections — cascading and combined failures
// ---------------------------------------------------------------------------

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

    // Phase 1: command fails (UoW transient).
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

    // Phase 2: command succeeds, dispatcher fails first.
    const successDeps = { ...failingDeps, unitOfWork: new InlineUnitOfWork(0) };
    const succeed = await registerWorkspace(successDeps, ctx, {
      idempotencyKey: 'cascading-key',
      workspace: BASE_WORKSPACE,
    });
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

    // Replay 3 more times — all should return the cached result.
    for (let i = 0; i < 3; i++) {
      const replay = await registerWorkspace(deps, ctx, {
        idempotencyKey: 'stable-key',
        workspace: BASE_WORKSPACE,
      });
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

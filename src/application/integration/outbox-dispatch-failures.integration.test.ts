/**
 * Integration tests: outbox dispatch ordering.
 *
 * Covers FIFO event delivery and partial-batch failure ordering.
 */
import { describe, expect, it } from 'vitest';

import { OutboxDispatcher, MAX_OUTBOX_RETRIES } from '../services/outbox-dispatcher.js';
import type { OutboxEntry, OutboxPort } from '../ports/index.js';
import { CorrelationId, TenantId } from '../../domain/primitives/index.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

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
}

function fixedClock(nowIso: string) {
  return { nowIso: () => nowIso };
}

function makeEvent(id: string, type: string): PortariumCloudEventV1 {
  return {
    id,
    type,
    specversion: '1.0',
    source: 'test',
    tenantid: TenantId('tenant-1'),
    correlationid: CorrelationId('corr'),
    data: null,
  };
}

describe('outbox dispatch ordering: events delivered in enqueue order across failures', () => {
  it('delivers multiple events in enqueue (entryId) order', async () => {
    const outbox = new InMemoryOutboxStore();
    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          delivered.push(event.id);
        },
      },
    });

    await outbox.enqueue(makeEvent('evt-1', 'com.portarium.test.A'));
    await outbox.enqueue(makeEvent('evt-2', 'com.portarium.test.B'));
    await outbox.enqueue(makeEvent('evt-3', 'com.portarium.test.C'));

    const result = await dispatcher.sweep();
    expect(result).toEqual({ published: 3, failed: 0 });
    expect(delivered).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('preserves order when first delivery fails and is retried in a subsequent sweep', async () => {
    const outbox = new InMemoryOutboxStore();
    const delivered: string[] = [];
    let failEvt1 = true;
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
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

    await outbox.enqueue(makeEvent('evt-1', 'com.portarium.test.A'));
    await outbox.enqueue(makeEvent('evt-2', 'com.portarium.test.B'));

    const sweep1 = await dispatcher.sweep();
    expect(sweep1).toEqual({ published: 1, failed: 1 });
    expect(delivered).toEqual(['evt-2']);

    outbox.setNow('2099-01-01T00:00:00.000Z');

    const entry1 = outbox.allEntries().find((e) => e.event.id === 'evt-1');
    expect(entry1).toBeDefined();
    expect(entry1?.status).toBe('Pending');
    expect(entry1?.retryCount).toBe(1);

    const sweep2 = await dispatcher.sweep();
    expect(sweep2.published).toBeGreaterThanOrEqual(1);
    expect(delivered).toContain('evt-1');
  });

  it('delivers events from multiple commands in enqueue order', async () => {
    const outbox = new InMemoryOutboxStore();
    const delivered: string[] = [];
    const dispatcher = new OutboxDispatcher({
      outbox,
      clock: fixedClock('2026-02-22T00:00:00.000Z'),
      publisher: {
        publish: async (event) => {
          delivered.push(event.id);
        },
      },
    });

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
    expect(delivered).toEqual(['a1', 'b1', 'a2']);
  });
});

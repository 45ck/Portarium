import { describe, it, expect, beforeEach, vi } from 'vitest';

import { OutboxDispatcher, computeNextRetryIso } from './outbox-dispatcher.js';
import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { OutboxEntry, OutboxPort } from '../../application/ports/outbox.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { TenantId, CorrelationId } from '../../domain/primitives/index.js';

function makeEvent(id: string): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    id,
    source: 'portarium/test',
    type: 'com.portarium.test.created',
    tenantid: TenantId('ws-test'),
    correlationid: CorrelationId('corr-001'),
  };
}

function makeEntry(id: string, overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    entryId: id,
    event: makeEvent(`evt-${id}`),
    status: 'Pending',
    retryCount: 0,
    ...overrides,
  };
}

class InMemoryOutbox implements OutboxPort {
  entries: OutboxEntry[] = [];

  async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    const entry = makeEntry(`entry-${this.entries.length}`, { event });
    this.entries.push(entry);
    return entry;
  }

  async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const now = new Date().toISOString();
    return this.entries
      .filter((e) => e.status === 'Pending')
      .filter((e) => !e.nextRetryAtIso || e.nextRetryAtIso <= now)
      .slice(0, limit);
  }

  async markPublished(entryId: string): Promise<void> {
    const entry = this.entries.find((e) => e.entryId === entryId);
    if (!entry) throw new Error(`Not found: ${entryId}`);
    (entry as Record<string, unknown>)['status'] = 'Published';
  }

  async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const entry = this.entries.find((e) => e.entryId === entryId);
    if (!entry) throw new Error(`Not found: ${entryId}`);
    const mut = entry as Record<string, unknown>;
    mut['status'] = 'Failed';
    mut['failedReason'] = reason;
    mut['nextRetryAtIso'] = nextRetryAtIso;
    mut['retryCount'] = (entry.retryCount) + 1;
  }
}

describe('OutboxDispatcher', () => {
  let outbox: InMemoryOutbox;
  let publisher: EventPublisher;
  let published: PortariumCloudEventV1[];

  beforeEach(() => {
    outbox = new InMemoryOutbox();
    published = [];
    publisher = {
      publish: vi.fn(async (event: PortariumCloudEventV1) => {
        published.push(event);
      }),
    };
  });

  it('pollOnce publishes pending entries and marks them Published', async () => {
    outbox.entries.push(makeEntry('e1'));
    outbox.entries.push(makeEntry('e2'));

    const dispatcher = new OutboxDispatcher(outbox, publisher);
    const processed = await dispatcher.pollOnce();

    expect(processed).toBe(2);
    expect(published).toHaveLength(2);
    expect(outbox.entries[0]!.status).toBe('Published');
    expect(outbox.entries[1]!.status).toBe('Published');
  });

  it('pollOnce marks entries as Failed when publisher throws', async () => {
    outbox.entries.push(makeEntry('e1'));

    const failingPublisher: EventPublisher = {
      publish: vi.fn(async () => {
        throw new Error('NATS connection refused');
      }),
    };

    const dispatcher = new OutboxDispatcher(outbox, failingPublisher);
    const processed = await dispatcher.pollOnce();

    expect(processed).toBe(0);
    expect(outbox.entries[0]!.status).toBe('Failed');
    expect(outbox.entries[0]!.failedReason).toBe('NATS connection refused');
    expect(outbox.entries[0]!.retryCount).toBe(1);
  });

  it('skips entries that exceed maxRetries', async () => {
    outbox.entries.push(makeEntry('e1', { retryCount: 10 }));

    const dispatcher = new OutboxDispatcher(outbox, publisher, { maxRetries: 10 });
    const processed = await dispatcher.pollOnce();

    expect(processed).toBe(0);
    expect(published).toHaveLength(0);
  });

  it('start/stop controls the dispatch loop', () => {
    const dispatcher = new OutboxDispatcher(outbox, publisher, { pollIntervalMs: 50 });
    dispatcher.start();
    dispatcher.start(); // idempotent
    dispatcher.stop();
    dispatcher.stop(); // idempotent
  });
});

describe('computeNextRetryIso', () => {
  it('uses exponential backoff', () => {
    const base = 1000;
    const now = Date.now();

    const retry0 = new Date(computeNextRetryIso(0, base)).getTime();
    const retry1 = new Date(computeNextRetryIso(1, base)).getTime();
    const retry2 = new Date(computeNextRetryIso(2, base)).getTime();

    expect(retry0).toBeGreaterThanOrEqual(now + 900);
    expect(retry1 - retry0).toBeGreaterThanOrEqual(900);
    expect(retry2 - retry1).toBeGreaterThanOrEqual(1800);
  });

  it('caps at 5 minutes', () => {
    const base = 1000;
    const now = Date.now();

    const retryHigh = new Date(computeNextRetryIso(20, base)).getTime();
    expect(retryHigh - now).toBeLessThanOrEqual(5 * 60 * 1000 + 500);
  });
});

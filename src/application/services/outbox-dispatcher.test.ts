import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import type { Clock } from '../ports/clock.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { OutboxEntry, OutboxPort } from '../ports/outbox.js';
import {
  DEFAULT_OUTBOX_BATCH_SIZE,
  MAX_OUTBOX_RETRIES,
  OutboxDispatcher,
} from './outbox-dispatcher.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(id: string): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    id,
    source: 'portarium.test',
    type: 'com.portarium.test.Event',
    tenantid: 'tenant-1',
    correlationid: 'corr-1',
  } as unknown as PortariumCloudEventV1;
}

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    entryId: 'entry-1',
    event: makeEvent('evt-1'),
    status: 'Pending',
    retryCount: 0,
    ...overrides,
  };
}

function makeOutbox(entries: OutboxEntry[] = []): OutboxPort {
  return {
    enqueue: vi.fn(async (event) => makeEntry({ event })),
    fetchPending: vi.fn(async () => entries),
    markPublished: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  };
}

function makePublisher(failWith?: Error): EventPublisher {
  return {
    publish: failWith
      ? vi.fn(async () => {
          throw failWith;
        })
      : vi.fn(async () => undefined),
  };
}

function makeClock(iso = '2026-02-18T12:00:00.000Z'): Clock {
  return { nowIso: vi.fn(() => iso) };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('module constants', () => {
  it('MAX_OUTBOX_RETRIES is 10', () => {
    expect(MAX_OUTBOX_RETRIES).toBe(10);
  });

  it('DEFAULT_OUTBOX_BATCH_SIZE is 50', () => {
    expect(DEFAULT_OUTBOX_BATCH_SIZE).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// sweep — happy path
// ---------------------------------------------------------------------------

describe('OutboxDispatcher.sweep — successful delivery', () => {
  let outbox: OutboxPort;
  let publisher: EventPublisher;
  let clock: Clock;

  beforeEach(() => {
    outbox = makeOutbox([makeEntry({ entryId: 'e-1' }), makeEntry({ entryId: 'e-2' })]);
    publisher = makePublisher();
    clock = makeClock();
  });

  it('publishes all pending entries and returns correct counts', async () => {
    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock });
    const result = await dispatcher.sweep();

    expect(result.published).toBe(2);
    expect(result.failed).toBe(0);
    expect(publisher.publish).toHaveBeenCalledTimes(2);
  });

  it('marks each entry as published after successful delivery', async () => {
    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock });
    await dispatcher.sweep();

    expect(outbox.markPublished).toHaveBeenCalledWith('e-1');
    expect(outbox.markPublished).toHaveBeenCalledWith('e-2');
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('returns empty sweep result when no pending entries', async () => {
    outbox = makeOutbox([]);
    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock });
    const result = await dispatcher.sweep();

    expect(result.published).toBe(0);
    expect(result.failed).toBe(0);
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// sweep — transient bus failure / retry
// ---------------------------------------------------------------------------

describe('OutboxDispatcher.sweep — delivery failure', () => {
  it('marks entry as failed with reason and next retry timestamp when publisher throws', async () => {
    const busError = new Error('connection refused');
    const outbox = makeOutbox([makeEntry({ entryId: 'e-fail', retryCount: 0 })]);
    const publisher = makePublisher(busError);
    const clock = makeClock('2026-02-18T12:00:00.000Z');

    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock });
    const result = await dispatcher.sweep();

    expect(result.published).toBe(0);
    expect(result.failed).toBe(1);
    expect(outbox.markFailed).toHaveBeenCalledWith(
      'e-fail',
      'connection refused',
      expect.any(String),
    );
    expect(outbox.markPublished).not.toHaveBeenCalled();
  });

  it('schedules a later retry for entries with higher retryCount (back-off)', async () => {
    const outbox0 = makeOutbox([makeEntry({ entryId: 'e-0', retryCount: 0 })]);
    const outbox3 = makeOutbox([makeEntry({ entryId: 'e-3', retryCount: 3 })]);
    const busError = new Error('bus down');
    const now = '2026-02-18T12:00:00.000Z';

    const disp0 = new OutboxDispatcher({
      outbox: outbox0,
      publisher: makePublisher(busError),
      clock: makeClock(now),
    });
    const disp3 = new OutboxDispatcher({
      outbox: outbox3,
      publisher: makePublisher(busError),
      clock: makeClock(now),
    });

    await disp0.sweep();
    await disp3.sweep();

    const retry0Call = vi.mocked(outbox0.markFailed).mock.calls[0];
    const retry3Call = vi.mocked(outbox3.markFailed).mock.calls[0];

    const retryAt0 = new Date(retry0Call?.[2] ?? '').getTime();
    const retryAt3 = new Date(retry3Call?.[2] ?? '').getTime();

    // Higher retryCount should result in a later next retry
    expect(retryAt3).toBeGreaterThan(retryAt0);
  });

  it('survives transient failure on one entry and continues processing others', async () => {
    const entries = [
      makeEntry({ entryId: 'ok-1' }),
      makeEntry({ entryId: 'fail-1' }),
      makeEntry({ entryId: 'ok-2' }),
    ];
    const outbox = makeOutbox(entries);
    // Publisher succeeds for ok-1 and ok-2, fails for fail-1
    let callIdx = 0;
    const publisher: EventPublisher = {
      publish: vi.fn(async () => {
        const idx = callIdx++;
        if (idx === 1) throw new Error('transient');
      }),
    };
    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock: makeClock() });
    const result = await dispatcher.sweep();

    expect(result.published).toBe(2);
    expect(result.failed).toBe(1);
    expect(outbox.markPublished).toHaveBeenCalledWith('ok-1');
    expect(outbox.markPublished).toHaveBeenCalledWith('ok-2');
    expect(outbox.markFailed).toHaveBeenCalledWith('fail-1', 'transient', expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// In-order delivery
// ---------------------------------------------------------------------------

describe('OutboxDispatcher — in-order delivery', () => {
  it('publishes events in the order returned by fetchPending', async () => {
    const events = ['evt-a', 'evt-b', 'evt-c'].map((id, i) =>
      makeEntry({ entryId: `e-${i}`, event: makeEvent(id) }),
    );
    const outbox = makeOutbox(events);
    const published: string[] = [];
    const publisher: EventPublisher = {
      publish: vi.fn(async (evt: PortariumCloudEventV1) => {
        published.push(evt.id);
      }),
    };

    const dispatcher = new OutboxDispatcher({ outbox, publisher, clock: makeClock() });
    await dispatcher.sweep();

    expect(published).toEqual(['evt-a', 'evt-b', 'evt-c']);
  });
});

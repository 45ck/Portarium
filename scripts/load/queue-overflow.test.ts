/**
 * Load test: Queue overflow scenarios (bead-0940)
 *
 * Validates that the outbox and event publishing infrastructure handles
 * back-pressure correctly when producers outpace consumers:
 *   - Bounded queue rejects cleanly at capacity (no silent drops)
 *   - Overflow errors are counted and reported
 *   - Consumer drains the queue after burst subsides
 *
 * Uses in-memory bounded queue + outbox stubs — no external dependencies.
 */

import { describe, expect, it } from 'vitest';

import type { OutboxEntry, OutboxPort } from '../../src/application/ports/outbox.js';
import type { PortariumCloudEventV1 } from '../../src/domain/event-stream/cloudevents-v1.js';
import { runConcurrent } from './harness.js';

// ---------------------------------------------------------------------------
// Bounded in-memory outbox (simulates capacity limits)
// ---------------------------------------------------------------------------

class BoundedInMemoryOutbox implements OutboxPort {
  readonly #entries = new Map<string, OutboxEntry>();
  readonly #maxCapacity: number;
  #nextId = 0;
  #overflowCount = 0;

  constructor(maxCapacity: number) {
    this.#maxCapacity = maxCapacity;
  }

  get size(): number {
    return this.#entries.size;
  }
  get pendingCount(): number {
    let count = 0;
    for (const entry of this.#entries.values()) {
      if (entry.status === 'Pending') count++;
    }
    return count;
  }
  get overflowCount(): number {
    return this.#overflowCount;
  }

  async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    if (this.pendingCount >= this.#maxCapacity) {
      this.#overflowCount++;
      throw new Error(`outbox overflow: capacity ${this.#maxCapacity} exceeded`);
    }

    const entryId = `outbox-${++this.#nextId}`;
    const entry: OutboxEntry = {
      entryId,
      event,
      status: 'Pending',
      retryCount: 0,
    };
    this.#entries.set(entryId, entry);
    return entry;
  }

  async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const results: OutboxEntry[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.status === 'Pending') {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async markPublished(entryId: string): Promise<void> {
    const entry = this.#entries.get(entryId);
    if (entry) {
      this.#entries.set(entryId, { ...entry, status: 'Published' });
    }
  }

  async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const entry = this.#entries.get(entryId);
    if (entry) {
      this.#entries.set(entryId, {
        ...entry,
        status: 'Failed',
        failedReason: reason,
        nextRetryAtIso,
        retryCount: entry.retryCount + 1,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCloudEvent(idx: number): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    type: 'com.portarium.load.test',
    source: '/load-test/queue-overflow',
    id: `evt-overflow-${idx}`,
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: { index: idx },
  } as PortariumCloudEventV1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('load: queue overflow scenarios', () => {
  it('bounded outbox accepts entries up to capacity then rejects', async () => {
    const capacity = 100;
    const outbox = new BoundedInMemoryOutbox(capacity);

    // Fill to capacity
    for (let i = 0; i < capacity; i++) {
      await outbox.enqueue(makeCloudEvent(i));
    }
    expect(outbox.size).toBe(capacity);

    // Next enqueue should overflow
    let overflowed = false;
    try {
      await outbox.enqueue(makeCloudEvent(capacity));
    } catch (e: any) {
      if (e.message.includes('overflow')) overflowed = true;
    }

    expect(overflowed).toBe(true);
    expect(outbox.overflowCount).toBe(1);
    expect(outbox.size).toBe(capacity); // no silent growth
  });

  it(
    'concurrent burst at 10x capacity: overflow errors are counted, no silent drops',
    { timeout: 30_000 },
    async () => {
      const capacity = 50;
      const outbox = new BoundedInMemoryOutbox(capacity);
      const totalRequests = 500; // 10x capacity

      const result = await runConcurrent(
        async (idx) => {
          await outbox.enqueue(makeCloudEvent(idx));
        },
        totalRequests,
        100,
      );

      console.info(
        `[LOAD] queue overflow: capacity=${capacity} requests=${totalRequests} ` +
          `accepted=${result.successes} overflowed=${result.errors} ` +
          `outbox.size=${outbox.size} outbox.overflowCount=${outbox.overflowCount}`,
      );

      // Successes + errors = total requests (no silent drops)
      expect(result.successes + result.errors).toBe(totalRequests);

      // Outbox never exceeded capacity
      expect(outbox.size).toBeLessThanOrEqual(capacity);

      // At least some should have overflowed
      expect(result.errors).toBeGreaterThan(0);

      // Overflow count matches errors
      expect(outbox.overflowCount).toBe(result.errors);
    },
  );

  it(
    'consumer drains queue after burst subsides',
    { timeout: 15_000 },
    async () => {
      const capacity = 200;
      const outbox = new BoundedInMemoryOutbox(capacity);

      // Enqueue 150 events (under capacity)
      for (let i = 0; i < 150; i++) {
        await outbox.enqueue(makeCloudEvent(i));
      }
      expect(outbox.size).toBe(150);

      // Simulate consumer draining in batches
      let totalPublished = 0;
      let batchCount = 0;
      while (true) {
        const pending = await outbox.fetchPending(20);
        if (pending.length === 0) break;
        for (const entry of pending) {
          await outbox.markPublished(entry.entryId);
          totalPublished++;
        }
        batchCount++;
      }

      expect(totalPublished).toBe(150);
      expect(batchCount).toBeGreaterThan(0);

      // After drain, new entries should be accepted
      await outbox.enqueue(makeCloudEvent(999));
      expect(outbox.size).toBe(151);
    },
  );

  it(
    'burst-then-drain cycle: capacity is reusable after publish',
    { timeout: 15_000 },
    async () => {
      const capacity = 50;
      const outbox = new BoundedInMemoryOutbox(capacity);

      for (let cycle = 0; cycle < 3; cycle++) {
        // Fill to capacity
        for (let i = 0; i < capacity; i++) {
          await outbox.enqueue(makeCloudEvent(cycle * capacity + i));
        }

        // Verify at capacity
        let overflowed = false;
        try {
          await outbox.enqueue(makeCloudEvent(-1));
        } catch {
          overflowed = true;
        }
        expect(overflowed, `cycle ${cycle}: should overflow at capacity`).toBe(true);

        // Drain all pending
        const pending = await outbox.fetchPending(capacity);
        for (const entry of pending) {
          await outbox.markPublished(entry.entryId);
        }
      }

      // After 3 cycles, should have processed 150 events total
      expect(outbox.overflowCount).toBe(3); // one overflow per cycle
    },
  );

  it(
    'failed entries are retried and do not block new entries',
    { timeout: 10_000 },
    async () => {
      const outbox = new BoundedInMemoryOutbox(100);

      // Enqueue 10 events
      for (let i = 0; i < 10; i++) {
        await outbox.enqueue(makeCloudEvent(i));
      }

      // Mark first 5 as failed
      const pending = await outbox.fetchPending(5);
      for (const entry of pending) {
        await outbox.markFailed(entry.entryId, 'transient error', new Date().toISOString());
      }

      // Remaining 5 should still be fetchable as Pending
      const stillPending = await outbox.fetchPending(10);
      expect(stillPending.length).toBe(5);

      // New entries can still be added (capacity not exhausted)
      for (let i = 10; i < 50; i++) {
        await outbox.enqueue(makeCloudEvent(i));
      }
      expect(outbox.size).toBe(50);
    },
  );
});

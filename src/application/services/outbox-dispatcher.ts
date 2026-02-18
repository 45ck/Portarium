import type { Clock } from '../ports/clock.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { OutboxEntry, OutboxPort } from '../ports/outbox.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Retry back-off schedule in milliseconds (index = retryCount, capped at last). */
const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000, 600_000] as const;

/** Maximum retries before an entry is permanently marked Failed. */
export const MAX_OUTBOX_RETRIES = 10 as const;

/** Default fetch batch size per dispatch sweep. */
export const DEFAULT_OUTBOX_BATCH_SIZE = 50 as const;

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type DispatchSweepResult = Readonly<{
  /** Number of entries successfully published in this sweep. */
  published: number;
  /** Number of entries that failed delivery and were rescheduled or exhausted. */
  failed: number;
}>;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface OutboxDispatcherDeps {
  outbox: OutboxPort;
  publisher: EventPublisher;
  clock: Clock;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Application service that delivers pending outbox entries to the event bus.
 *
 * Call sweep() periodically (or on a Temporal schedule / Node.js interval) to
 * forward Pending entries.  Transient bus failures reschedule the entry with
 * exponential back-off.  Entries that exceed MAX_OUTBOX_RETRIES are marked
 * Failed and require manual intervention or a separate dead-letter process.
 */
export class OutboxDispatcher {
  private readonly outbox: OutboxPort;
  private readonly publisher: EventPublisher;
  private readonly clock: Clock;
  private readonly batchSize: number;

  public constructor(deps: OutboxDispatcherDeps, batchSize = DEFAULT_OUTBOX_BATCH_SIZE) {
    this.outbox = deps.outbox;
    this.publisher = deps.publisher;
    this.clock = deps.clock;
    this.batchSize = batchSize;
  }

  /**
   * Perform one delivery sweep: fetch a batch of Pending entries and attempt
   * to publish each one.  Returns a summary of the sweep.
   */
  public async sweep(): Promise<DispatchSweepResult> {
    const entries = await this.outbox.fetchPending(this.batchSize);
    let published = 0;
    let failed = 0;

    for (const entry of entries) {
      const succeeded = await this.deliverOne(entry);
      if (succeeded) {
        published++;
      } else {
        failed++;
      }
    }

    return { published, failed };
  }

  private async deliverOne(entry: OutboxEntry): Promise<boolean> {
    try {
      await this.publisher.publish(entry.event);
      await this.outbox.markPublished(entry.entryId);
      return true;
    } catch (error) {
      const nextRetryAtIso = this.computeNextRetry(entry.retryCount);
      const reason = error instanceof Error ? error.message : 'Unknown publish error';
      await this.outbox.markFailed(entry.entryId, reason, nextRetryAtIso);
      return false;
    }
  }

  private computeNextRetry(retryCount: number): string {
    const backoffMs =
      RETRY_BACKOFF_MS[Math.min(retryCount, RETRY_BACKOFF_MS.length - 1)] ??
      RETRY_BACKOFF_MS.at(-1) ??
      600_000;
    const nowMs = new Date(this.clock.nowIso()).getTime();
    return new Date(nowMs + backoffMs).toISOString();
  }
}

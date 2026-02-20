import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { OutboxPort } from '../../application/ports/outbox.js';

/**
 * OutboxDispatcher reads Pending entries from the outbox and publishes them
 * to the event bus. Failed deliveries are retried with exponential backoff.
 *
 * The dispatcher runs as a periodic poll loop and is typically started as a
 * background task in the control-plane process.
 */
export interface OutboxDispatcherOptions {
  /** Maximum number of entries to fetch per poll cycle. Default: 100. */
  readonly batchSize?: number;
  /** Poll interval in milliseconds. Default: 1000. */
  readonly pollIntervalMs?: number;
  /** Base delay for exponential backoff in milliseconds. Default: 1000. */
  readonly baseRetryDelayMs?: number;
  /** Maximum number of retries before an entry is abandoned. Default: 10. */
  readonly maxRetries?: number;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_BASE_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRIES = 10;

export class OutboxDispatcher {
  readonly #outbox: OutboxPort;
  readonly #publisher: EventPublisher;
  readonly #batchSize: number;
  readonly #pollIntervalMs: number;
  readonly #baseRetryDelayMs: number;
  readonly #maxRetries: number;

  #running = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    outbox: OutboxPort,
    publisher: EventPublisher,
    options?: OutboxDispatcherOptions,
  ) {
    this.#outbox = outbox;
    this.#publisher = publisher;
    this.#batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
    this.#pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.#baseRetryDelayMs = options?.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;
    this.#maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Start the dispatcher loop. Returns immediately; polling runs in background.
   */
  public start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#scheduleNext();
  }

  /**
   * Stop the dispatcher loop gracefully.
   */
  public stop(): void {
    this.#running = false;
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  /**
   * Execute a single poll cycle. Useful for testing without starting the loop.
   * Returns the number of entries processed.
   */
  public async pollOnce(): Promise<number> {
    const entries = await this.#outbox.fetchPending(this.#batchSize);
    let processed = 0;

    for (const entry of entries) {
      if (entry.retryCount >= this.#maxRetries) {
        continue;
      }

      try {
        await this.#publisher.publish(entry.event);
        await this.#outbox.markPublished(entry.entryId);
        processed++;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : String(error);
        const nextRetryAtIso = computeNextRetryIso(
          entry.retryCount,
          this.#baseRetryDelayMs,
        );
        await this.#outbox.markFailed(entry.entryId, reason, nextRetryAtIso);
      }
    }

    return processed;
  }

  #scheduleNext(): void {
    if (!this.#running) return;
    const tick = async (): Promise<void> => {
      try {
        await this.pollOnce();
      } catch {
        // Swallow errors from the poll cycle; next cycle will retry.
      }
      this.#scheduleNext();
    };
    this.#timer = setTimeout(() => { void tick(); }, this.#pollIntervalMs);
  }
}

/**
 * Compute the next retry timestamp using exponential backoff.
 * Delay = baseDelay * 2^retryCount, capped at 5 minutes.
 */
export function computeNextRetryIso(retryCount: number, baseDelayMs: number): string {
  const MAX_DELAY_MS = 5 * 60 * 1000;
  const delayMs = Math.min(baseDelayMs * 2 ** retryCount, MAX_DELAY_MS);
  return new Date(Date.now() + delayMs).toISOString();
}

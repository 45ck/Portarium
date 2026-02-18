import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

// ---------------------------------------------------------------------------
// Outbox entry
// ---------------------------------------------------------------------------

export type OutboxEntryStatus = 'Pending' | 'Published' | 'Failed';

/**
 * A CloudEvent envelope held in the transactional outbox.
 *
 * An entry is written atomically alongside the business state change that
 * produced the event.  The OutboxDispatcher reads Pending entries and
 * delivers them to the event bus, handling transient failures with
 * exponential back-off.
 */
export type OutboxEntry = Readonly<{
  /** Stable identifier for this outbox record (not the CloudEvent id). */
  entryId: string;
  /** The CloudEvent to deliver. */
  event: PortariumCloudEventV1;
  /** Current delivery status. */
  status: OutboxEntryStatus;
  /** Number of delivery attempts made so far. */
  retryCount: number;
  /**
   * ISO-8601 timestamp before which the dispatcher must not retry.
   * Absent if no retry delay is required (first attempt or just published).
   */
  nextRetryAtIso?: string;
  /** Human-readable failure reason from the last attempt. */
  failedReason?: string;
}>;

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

/**
 * Port for the transactional outbox store.
 *
 * Infrastructure adapters persist entries in the same datastore as the
 * business aggregates so that enqueue() participates in the same ACID
 * transaction.
 */
export interface OutboxPort {
  /**
   * Atomically enqueue an event for later delivery.
   * Must be called within the same unit-of-work transaction as the business write.
   */
  enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry>;

  /**
   * Fetch entries ready for delivery (status=Pending and nextRetryAtIso <= now).
   * Results are ordered by entryId ascending for in-order delivery.
   */
  fetchPending(limit: number): Promise<readonly OutboxEntry[]>;

  /** Mark an entry as successfully published. */
  markPublished(entryId: string): Promise<void>;

  /** Record a delivery failure and schedule the next retry. */
  markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void>;
}

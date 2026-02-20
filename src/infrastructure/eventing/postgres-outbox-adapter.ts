import { randomUUID } from 'node:crypto';

import type {
  OutboxEntry,
  OutboxPort,
} from '../../application/ports/outbox.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { parsePortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

/**
 * Postgres-backed implementation of the OutboxPort.
 *
 * Uses a simple SQL-based approach: entries are stored in a dedicated outbox
 * table and queried by status + retry schedule. This adapter is designed to
 * participate in the same ACID transaction as the business write.
 *
 * For the MVP, this wraps the PostgresJsonDocumentStore; a future bead may
 * migrate to a dedicated SQL table for better query performance.
 */
export interface OutboxSqlClient {
  query<TRow>(sql: string, params: unknown[]): Promise<readonly TRow[]>;
}

export class PostgresOutboxAdapter implements OutboxPort {
  readonly #client: OutboxSqlClient;

  public constructor(client: OutboxSqlClient) {
    this.#client = client;
  }

  public async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    const parsedEvent = parsePortariumCloudEventV1(event);
    const entry: OutboxEntry = {
      entryId: randomUUID(),
      event: parsedEvent,
      status: 'Pending',
      retryCount: 0,
    };

    await this.#client.query(
      `INSERT INTO outbox (entry_id, payload, status, retry_count, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [entry.entryId, JSON.stringify(entry), entry.status, entry.retryCount],
    );

    return entry;
  }

  public async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const safeLimit = Math.max(0, Math.min(limit, 1000));
    const rows = await this.#client.query<{ payload: OutboxEntry }>(
      `SELECT payload FROM outbox
       WHERE status = 'Pending'
         AND (payload->>'nextRetryAtIso' IS NULL OR payload->>'nextRetryAtIso' <= $1)
       ORDER BY entry_id ASC
       LIMIT $2`,
      [new Date().toISOString(), safeLimit],
    );

    return rows.map((row) => row.payload);
  }

  public async markPublished(entryId: string): Promise<void> {
    const rows = await this.#client.query<{ payload: OutboxEntry }>(
      'SELECT payload FROM outbox WHERE entry_id = $1',
      [entryId],
    );

    if (rows.length === 0) {
      throw new Error(`Outbox entry not found: ${entryId}`);
    }

    const current = rows[0]!.payload;
    const updated: OutboxEntry = { ...current, status: 'Published' };

    await this.#client.query(
      `UPDATE outbox SET payload = $1, status = $2 WHERE entry_id = $3`,
      [JSON.stringify(updated), 'Published', entryId],
    );
  }

  public async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const rows = await this.#client.query<{ payload: OutboxEntry }>(
      'SELECT payload FROM outbox WHERE entry_id = $1',
      [entryId],
    );

    if (rows.length === 0) {
      throw new Error(`Outbox entry not found: ${entryId}`);
    }

    const current = rows[0]!.payload;
    const updated: OutboxEntry = {
      ...current,
      status: 'Failed',
      failedReason: reason,
      nextRetryAtIso,
      retryCount: current.retryCount + 1,
    };

    await this.#client.query(
      `UPDATE outbox SET payload = $1, status = $2 WHERE entry_id = $3`,
      [JSON.stringify(updated), 'Failed', entryId],
    );
  }
}

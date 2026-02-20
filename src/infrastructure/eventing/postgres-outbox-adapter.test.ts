import { describe, it, expect, beforeEach } from 'vitest';

import type { OutboxSqlClient } from './postgres-outbox-adapter.js';
import { PostgresOutboxAdapter } from './postgres-outbox-adapter.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { TenantId, CorrelationId } from '../../domain/primitives/index.js';
import type { OutboxEntry } from '../../application/ports/outbox.js';

function makeEvent(overrides?: Partial<PortariumCloudEventV1>): PortariumCloudEventV1 {
  return {
    specversion: '1.0',
    id: 'evt-001',
    source: 'portarium/test',
    type: 'com.portarium.test.created',
    tenantid: TenantId('ws-test'),
    correlationid: CorrelationId('corr-001'),
    ...overrides,
  };
}

class InMemorySqlClient implements OutboxSqlClient {
  readonly rows = new Map<string, { entry_id: string; payload: OutboxEntry; status: string }>();

  async query<TRow>(sql: string, params: unknown[]): Promise<readonly TRow[]> {
    if (sql.startsWith('INSERT')) {
      const entryId = params[0] as string;
      const payload = JSON.parse(params[1] as string) as OutboxEntry;
      const status = params[2] as string;
      this.rows.set(entryId, { entry_id: entryId, payload, status });
      return [] as unknown as readonly TRow[];
    }

    if (sql.includes('WHERE status =')) {
      const results = [...this.rows.values()]
        .filter((r) => r.payload.status === 'Pending')
        .filter((r) => {
          const nextRetry = r.payload.nextRetryAtIso;
          if (!nextRetry) return true;
          return nextRetry <= (params[0] as string);
        })
        .sort((a, b) => a.entry_id.localeCompare(b.entry_id))
        .slice(0, params[1] as number);
      return results as unknown as readonly TRow[];
    }

    if (sql.startsWith('SELECT')) {
      const entryId = params[0] as string;
      const row = this.rows.get(entryId);
      return row ? [row as unknown as TRow] : ([] as unknown as readonly TRow[]);
    }

    if (sql.startsWith('UPDATE')) {
      const payload = JSON.parse(params[0] as string) as OutboxEntry;
      const entryId = params[2] as string;
      const existing = this.rows.get(entryId);
      if (existing) {
        existing.payload = payload;
        existing.status = params[1] as string;
      }
      return [] as unknown as readonly TRow[];
    }

    return [] as unknown as readonly TRow[];
  }
}

describe('PostgresOutboxAdapter', () => {
  let client: InMemorySqlClient;
  let adapter: PostgresOutboxAdapter;

  beforeEach(() => {
    client = new InMemorySqlClient();
    adapter = new PostgresOutboxAdapter(client);
  });

  it('enqueue creates a Pending entry', async () => {
    const event = makeEvent();
    const entry = await adapter.enqueue(event);

    expect(entry.status).toBe('Pending');
    expect(entry.retryCount).toBe(0);
    expect(entry.event.tenantid).toBe('ws-test');
    expect(entry.entryId).toBeTruthy();
  });

  it('fetchPending returns only Pending entries', async () => {
    await adapter.enqueue(makeEvent({ id: 'evt-1' }));
    await adapter.enqueue(makeEvent({ id: 'evt-2' }));

    const pending = await adapter.fetchPending(10);
    expect(pending).toHaveLength(2);
    expect(pending.every((e) => e.status === 'Pending')).toBe(true);
  });

  it('markPublished transitions entry to Published', async () => {
    const entry = await adapter.enqueue(makeEvent());
    await adapter.markPublished(entry.entryId);

    const pending = await adapter.fetchPending(10);
    expect(pending).toHaveLength(0);
  });

  it('markFailed records reason and increments retryCount', async () => {
    const entry = await adapter.enqueue(makeEvent());
    const futureIso = new Date(Date.now() + 60_000).toISOString();
    await adapter.markFailed(entry.entryId, 'connection refused', futureIso);

    const row = client.rows.get(entry.entryId);
    expect(row?.payload.status).toBe('Failed');
    expect(row?.payload.failedReason).toBe('connection refused');
    expect(row?.payload.retryCount).toBe(1);
    expect(row?.payload.nextRetryAtIso).toBe(futureIso);
  });

  it('markPublished throws for unknown entryId', async () => {
    await expect(adapter.markPublished('nonexistent')).rejects.toThrow('Outbox entry not found');
  });

  it('markFailed throws for unknown entryId', async () => {
    await expect(adapter.markFailed('nonexistent', 'reason', new Date().toISOString())).rejects.toThrow(
      'Outbox entry not found',
    );
  });
});

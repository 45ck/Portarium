import { randomUUID } from 'node:crypto';

import type {
  EvidenceEntryAppendInput,
  EvidenceQueryStore,
  EvidenceLogPort,
  EventPublisher,
  IdGenerator,
  ListEvidenceQuery,
  OutboxEntry,
  OutboxPort,
} from '../../application/ports/index.js';
import type { Page } from '../../application/common/query.js';
import { appendEvidenceEntryV1 } from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { parsePortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { PostgresJsonDocumentStore } from './postgres-json-document-store.js';
import { pageByCursor } from './postgres-cursor-page.js';
import type { SqlClient } from './sql-client.js';

const COLLECTION_EVIDENCE_LOG = 'evidence-log';
const COLLECTION_OUTBOX = 'outbox';
const OUTBOX_TENANT = '__global__';

export class PostgresEvidenceLog implements EvidenceLogPort, EvidenceQueryStore {
  readonly #documents: PostgresJsonDocumentStore;
  readonly #hasher = new NodeCryptoEvidenceHasher();

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async appendEntry(
    tenantId: string,
    entry: EvidenceEntryAppendInput,
  ): Promise<EvidenceEntryV1> {
    const existingPayloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(entry.workspaceId),
      collection: COLLECTION_EVIDENCE_LOG,
      limit: 10_000, // evidence chains are ordered by hash; load all to find the tail
    });

    const existingEntries = existingPayloads
      .map((payload) => payload as EvidenceEntryV1)
      .sort((left, right) => String(left.occurredAtIso).localeCompare(String(right.occurredAtIso)));

    const next = appendEvidenceEntryV1({
      previous: existingEntries.at(-1),
      next: entry,
      hasher: this.#hasher,
    });

    await this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(entry.workspaceId),
      collection: COLLECTION_EVIDENCE_LOG,
      documentId: String(entry.evidenceId),
      payload: next,
    });

    return next;
  }

  public async listEvidenceEntries(
    tenantId: string,
    workspaceId: string,
    query: ListEvidenceQuery,
  ): Promise<Page<EvidenceEntryV1>> {
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_EVIDENCE_LOG,
      limit: 10_000,
    });

    const { filter } = query;
    const items = payloads
      .map((payload) => payload as EvidenceEntryV1)
      .filter((entry) => String(entry.workspaceId) === String(workspaceId))
      .filter((entry) => (filter.runId ? String(entry.links?.runId) === filter.runId : true))
      .filter((entry) => (filter.planId ? String(entry.links?.planId) === filter.planId : true))
      .filter((entry) =>
        filter.workItemId ? String(entry.links?.workItemId) === filter.workItemId : true,
      )
      .filter((entry) => (filter.category ? entry.category === filter.category : true))
      .sort((left, right) => String(left.occurredAtIso).localeCompare(String(right.occurredAtIso)));

    return pageByCursor(
      items,
      (entry) => String(entry.evidenceId),
      query.pagination.limit,
      query.pagination.cursor,
    );
  }
}

export class PostgresOutboxStore implements OutboxPort {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    const parsedEvent = parsePortariumCloudEventV1(event);
    const entry: OutboxEntry = {
      entryId: randomUUID(),
      event: parsedEvent,
      status: 'Pending',
      retryCount: 0,
    };

    await this.#documents.upsert({
      tenantId: OUTBOX_TENANT,
      collection: COLLECTION_OUTBOX,
      documentId: entry.entryId,
      payload: entry,
    });

    return entry;
  }

  public async fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const payloads = await this.#documents.list({
      tenantId: OUTBOX_TENANT,
      collection: COLLECTION_OUTBOX,
      limit: limit * 4 + 1, // fetch more than needed to account for non-pending entries
    });

    const now = new Date().toISOString();
    return payloads
      .map((payload) => payload as OutboxEntry)
      .filter((entry) => entry.status === 'Pending' && isRetryDue(entry, now))
      .sort((left, right) => left.entryId.localeCompare(right.entryId))
      .slice(0, Math.max(0, limit));
  }

  public async markPublished(entryId: string): Promise<void> {
    const current = await this.#requireOutboxEntry(entryId);
    await this.#documents.upsert({
      tenantId: OUTBOX_TENANT,
      collection: COLLECTION_OUTBOX,
      documentId: entryId,
      payload: {
        ...current,
        status: 'Published',
      } satisfies OutboxEntry,
    });
  }

  public async markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const current = await this.#requireOutboxEntry(entryId);
    await this.#documents.upsert({
      tenantId: OUTBOX_TENANT,
      collection: COLLECTION_OUTBOX,
      documentId: entryId,
      payload: {
        ...current,
        status: 'Failed',
        failedReason: reason,
        nextRetryAtIso,
        retryCount: current.retryCount + 1,
      } satisfies OutboxEntry,
    });
  }

  async #requireOutboxEntry(entryId: string): Promise<OutboxEntry> {
    const payload = await this.#documents.get(OUTBOX_TENANT, COLLECTION_OUTBOX, entryId);
    if (payload === null) {
      throw new Error(`Outbox entry not found: ${entryId}`);
    }
    return payload as OutboxEntry;
  }
}

export class PostgresOutboxEventPublisher implements EventPublisher {
  readonly #outbox: OutboxPort;

  public constructor(outbox: OutboxPort) {
    this.#outbox = outbox;
  }

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    await this.#outbox.enqueue(event);
  }
}

export class CryptoIdGenerator implements IdGenerator {
  public generateId(): string {
    return randomUUID();
  }
}

function isRetryDue(entry: OutboxEntry, nowIso: string): boolean {
  if (entry.nextRetryAtIso === undefined) {
    return true;
  }
  return entry.nextRetryAtIso <= nowIso;
}

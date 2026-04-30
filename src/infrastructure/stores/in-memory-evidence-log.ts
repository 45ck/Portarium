/**
 * In-memory implementation of EvidenceLogPort for local development and testing.
 *
 * Hash-chains evidence entries using canonical JSON serialization (RFC 8785 JCS)
 * to match PostgresEvidenceLog behavior. Hashes are deterministic and reproducible
 * across implementations and runs.
 */

import { createHash } from 'node:crypto';

import type { Page } from '../../application/common/query.js';
import type { TenantId } from '../../domain/primitives/index.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import { canonicalizeJson } from '../../domain/evidence/canonical-json.js';
import type {
  EvidenceEntryAppendInput,
  EvidenceQueryStore,
  ListEvidenceQuery,
  EvidenceLogPort,
} from '../../application/ports/evidence-log.js';
import { pageByCursor } from '../postgresql/postgres-cursor-page.js';

export class InMemoryEvidenceLog implements EvidenceLogPort, EvidenceQueryStore {
  readonly #entries = new Map<string, EvidenceEntryV1[]>();

  async appendEntry(tenantId: TenantId, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1> {
    const key = String(tenantId);
    const chain = this.#entries.get(key) ?? [];

    const prev = chain[chain.length - 1];
    const previousHash = prev?.hashSha256;

    const hashInput = canonicalizeJson({
      ...entry,
      ...(previousHash !== undefined ? { previousHash } : {}),
    });
    const hashSha256 = HashSha256(`sha256:${createHash('sha256').update(hashInput).digest('hex')}`);

    const record: EvidenceEntryV1 = {
      ...entry,
      ...(previousHash !== undefined ? { previousHash } : {}),
      hashSha256,
    };

    chain.push(record);
    this.#entries.set(key, chain);

    return record;
  }

  listEntries(tenantId: TenantId): EvidenceEntryV1[] {
    return [...(this.#entries.get(String(tenantId)) ?? [])];
  }

  async listEvidenceEntries(
    tenantId: TenantId,
    workspaceId: string,
    query: ListEvidenceQuery,
  ): Promise<Page<EvidenceEntryV1>> {
    const { filter } = query;
    const items = this.listEntries(tenantId)
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

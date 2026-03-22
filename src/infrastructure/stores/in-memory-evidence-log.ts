import { createHash } from 'node:crypto';

import type { TenantId } from '../../domain/primitives/index.js';
import { HashSha256 } from '../../domain/primitives/index.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type {
  EvidenceEntryAppendInput,
  EvidenceLogPort,
} from '../../application/ports/evidence-log.js';

export class InMemoryEvidenceLog implements EvidenceLogPort {
  readonly #entries = new Map<string, EvidenceEntryV1[]>();

  async appendEntry(tenantId: TenantId, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1> {
    const key = String(tenantId);
    const chain = this.#entries.get(key) ?? [];

    const prev = chain[chain.length - 1];
    const previousHash = prev?.hashSha256;

    const hashInput = JSON.stringify({
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
}

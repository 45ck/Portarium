import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export type EvidenceEntryAppendInput = Omit<
  EvidenceEntryV1,
  'previousHash' | 'hashSha256' | 'signatureBase64'
>;

export interface EvidenceLogPort {
  appendEntry(tenantId: TenantId, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1>;
}

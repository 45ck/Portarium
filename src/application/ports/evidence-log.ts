import type { Page, PaginationParams } from '../common/query.js';
import type { EvidenceCategory, EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';

export type EvidenceEntryAppendInput = Omit<
  EvidenceEntryV1,
  'previousHash' | 'hashSha256' | 'signatureBase64'
>;

export interface EvidenceLogPort {
  appendEntry(tenantId: TenantId, entry: EvidenceEntryAppendInput): Promise<EvidenceEntryV1>;
}

export type EvidenceFieldFilter = Readonly<{
  runId?: string;
  planId?: string;
  workItemId?: string;
  category?: EvidenceCategory;
}>;

export type ListEvidenceQuery = Readonly<{
  filter: EvidenceFieldFilter;
  pagination: PaginationParams;
}>;

export interface EvidenceQueryStore {
  listEvidenceEntries(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    query: ListEvidenceQuery,
  ): Promise<Page<EvidenceEntryV1>>;
}

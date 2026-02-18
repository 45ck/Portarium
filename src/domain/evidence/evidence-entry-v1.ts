import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import type {
  AdapterId,
  EvidenceId,
  HashSha256,
  MachineId,
  PlanId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
} from '../primitives/index.js';

export type EvidenceCategory = 'Plan' | 'Action' | 'Approval' | 'Policy' | 'System';

export type EvidenceActor =
  | Readonly<{ kind: 'User'; userId: UserId }>
  | Readonly<{ kind: 'Machine'; machineId: MachineId }>
  | Readonly<{ kind: 'Adapter'; adapterId: AdapterId }>
  | Readonly<{ kind: 'System' }>;

export type EvidenceLinks = Readonly<{
  runId?: RunId;
  planId?: PlanId;
  workItemId?: WorkItemId;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export type EvidencePayloadRef = Readonly<{
  kind: 'Artifact' | 'Snapshot' | 'Diff' | 'Log';
  uri: string;
  contentType?: string;
  sha256?: HashSha256;
}>;

export type EvidenceEntryV1 = Readonly<{
  schemaVersion: 1;
  evidenceId: EvidenceId;
  workspaceId: WorkspaceId;
  occurredAtIso: string;
  category: EvidenceCategory;
  summary: string;
  actor: EvidenceActor;
  links?: EvidenceLinks;
  payloadRefs?: readonly EvidencePayloadRef[];
  previousHash?: HashSha256;
  hashSha256: HashSha256;
  /**
   * Optional digital signature over the canonical JSON of this entry
   * (excluding `signatureBase64` itself).  Produced by an EvidenceSigner hook.
   */
  signatureBase64?: string;
}>;

/**
 * Entry fields used as input to hash computation.
 * Excludes both `hashSha256` and `signatureBase64` so that adding a signature
 * after the fact does not invalidate the stored hash.
 */
export type EvidenceEntryV1WithoutHash = Omit<EvidenceEntryV1, 'hashSha256' | 'signatureBase64'>;

/** Entry with hash but without a signature — canonical input for signing. */
export type EvidenceEntryV1WithoutSignature = Omit<EvidenceEntryV1, 'signatureBase64'>;

export const EVIDENCE_ENTRY_V1_SCHEMA_VERSION = 1 as const;

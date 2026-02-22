/**
 * Evidence durability policy domain model (bead-f908).
 *
 * Combines retention, export, deletion, and tamper-evidence settings into a
 * single composable policy value object.  All fields follow the domain rule
 * that evidence must be immutable once written (WORM) unless legal-hold is
 * lifted and the retention period has expired.
 *
 * Design decisions:
 *  - Deletion is NEVER permitted while a legal-hold is active.
 *  - Forensic class evidence may never be soft-deleted; only hard-delete
 *    after the retention period expires (and with an explicit override).
 *  - Export is always permitted for audit purposes; format is advisory.
 *  - Tamper-evidence level controls the hashing/signing enforcement.
 */

import { readBoolean, readEnum, readRecord } from '../validation/parse-utils.js';
import type { RetentionClass } from './retention-schedule-v1.js';
import { RETENTION_CLASSES } from './retention-schedule-v1.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Controls which hash / signing algorithm is required to verify tamper-evidence.
 *  - `hash-only`   : SHA-256 content hash per entry (default, already in place).
 *  - `chain-hash`  : Chained previous-hash in addition to per-entry hash.
 *  - `signed-chain`: Cryptographic signature over each entry (highest assurance).
 */
export type TamperEvidenceLevel = 'hash-only' | 'chain-hash' | 'signed-chain';

const TAMPER_EVIDENCE_LEVELS = ['hash-only', 'chain-hash', 'signed-chain'] as const;

/**
 * Permitted export formats for evidence bundles.
 *  - `json-lines`  : Newline-delimited JSON (default machine-readable format).
 *  - `csv`         : Comma-separated values (spreadsheet / compliance tools).
 *  - `pdf-audit`   : Rendered PDF report suitable for human auditors.
 */
export type EvidenceExportFormat = 'json-lines' | 'csv' | 'pdf-audit';

const EVIDENCE_EXPORT_FORMATS = ['json-lines', 'csv', 'pdf-audit'] as const;

/**
 * Controls when and how evidence entries can be permanently removed.
 *  - `prohibited`       : Evidence can never be deleted (strictest).
 *  - `after-retention`  : Permitted only once the retention period has expired
 *                         and no legal-hold is active.
 *  - `on-request`       : Permitted on explicit operator request once retention
 *                         period has expired and legal-hold is inactive.
 */
export type DeletionPolicy = 'prohibited' | 'after-retention' | 'on-request';

const DELETION_POLICIES = ['prohibited', 'after-retention', 'on-request'] as const;

/**
 * Full evidence durability policy for a workspace or per-run override.
 *
 * Invariants enforced at parse-time:
 *  - Forensic retention class → deletion must be 'prohibited'.
 *  - legalHoldSuspendsDeletion must be true when deletion is not 'prohibited'.
 */
export type EvidenceDurabilityPolicyV1 = Readonly<{
  schemaVersion: 1;
  /** Retention class from the retention schedule domain. */
  retentionClass: RetentionClass;
  /** How entry hashes / signatures are verified. */
  tamperEvidenceLevel: TamperEvidenceLevel;
  /** Whether export is permitted at all (default: true). */
  exportPermitted: boolean;
  /** Advisory preferred export format; consumers may support multiple. */
  preferredExportFormat: EvidenceExportFormat;
  /** Controls when deletion of evidence entries is allowed. */
  deletionPolicy: DeletionPolicy;
  /**
   * When true (and it MUST be true unless deletion is 'prohibited'), any
   * active legal-hold blocks deletion regardless of the deletion policy.
   */
  legalHoldSuspendsDeletion: boolean;
}>;

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

export class EvidenceDurabilityPolicyParseError extends Error {
  public override readonly name = 'EvidenceDurabilityPolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseEvidenceDurabilityPolicyV1(value: unknown): EvidenceDurabilityPolicyV1 {
  const record = readRecord(value, 'EvidenceDurabilityPolicy', EvidenceDurabilityPolicyParseError);

  const retentionClass = readEnum(
    record,
    'retentionClass',
    RETENTION_CLASSES,
    EvidenceDurabilityPolicyParseError,
  );

  const tamperEvidenceLevel = readEnum(
    record,
    'tamperEvidenceLevel',
    TAMPER_EVIDENCE_LEVELS,
    EvidenceDurabilityPolicyParseError,
  );

  const exportPermitted = readBoolean(record, 'exportPermitted', EvidenceDurabilityPolicyParseError);

  const preferredExportFormat = readEnum(
    record,
    'preferredExportFormat',
    EVIDENCE_EXPORT_FORMATS,
    EvidenceDurabilityPolicyParseError,
  );

  const deletionPolicy = readEnum(
    record,
    'deletionPolicy',
    DELETION_POLICIES,
    EvidenceDurabilityPolicyParseError,
  );

  const legalHoldSuspendsDeletion = readBoolean(
    record,
    'legalHoldSuspendsDeletion',
    EvidenceDurabilityPolicyParseError,
  );

  // Domain invariant: Forensic evidence may never be deleted.
  if (retentionClass === 'Forensic' && deletionPolicy !== 'prohibited') {
    throw new EvidenceDurabilityPolicyParseError(
      'Forensic evidence requires deletionPolicy="prohibited".',
    );
  }

  // Domain invariant: If deletion is not prohibited, legal-hold must suspend it.
  if (deletionPolicy !== 'prohibited' && !legalHoldSuspendsDeletion) {
    throw new EvidenceDurabilityPolicyParseError(
      'legalHoldSuspendsDeletion must be true when deletionPolicy is not "prohibited".',
    );
  }

  return {
    schemaVersion: 1,
    retentionClass,
    tamperEvidenceLevel,
    exportPermitted,
    preferredExportFormat,
    deletionPolicy,
    legalHoldSuspendsDeletion,
  };
}

// ---------------------------------------------------------------------------
// Domain guards
// ---------------------------------------------------------------------------

/**
 * Returns true if the policy permits deletion given the current legal-hold
 * state and whether the retention period has expired.
 */
export function isDeletionPermitted(
  policy: EvidenceDurabilityPolicyV1,
  opts: {
    retentionExpired: boolean;
    legalHoldActive: boolean;
  },
): boolean {
  if (policy.deletionPolicy === 'prohibited') return false;
  if (policy.legalHoldSuspendsDeletion && opts.legalHoldActive) return false;
  return opts.retentionExpired;
}

/**
 * Returns true if the tamper-evidence level requires a chained hash
 * (i.e., `previousHash` must be present on every non-first entry).
 */
export function requiresChainHash(policy: EvidenceDurabilityPolicyV1): boolean {
  return (
    policy.tamperEvidenceLevel === 'chain-hash' ||
    policy.tamperEvidenceLevel === 'signed-chain'
  );
}

/**
 * Returns true if the tamper-evidence level requires a cryptographic signature.
 */
export function requiresSignature(policy: EvidenceDurabilityPolicyV1): boolean {
  return policy.tamperEvidenceLevel === 'signed-chain';
}

// ---------------------------------------------------------------------------
// Canonical defaults
// ---------------------------------------------------------------------------

/**
 * Baseline policy for operational (non-compliance) workspaces.
 * Suitable for development and low-risk workflows.
 */
export const OPERATIONAL_DURABILITY_POLICY: EvidenceDurabilityPolicyV1 = {
  schemaVersion: 1,
  retentionClass: 'Operational',
  tamperEvidenceLevel: 'chain-hash',
  exportPermitted: true,
  preferredExportFormat: 'json-lines',
  deletionPolicy: 'after-retention',
  legalHoldSuspendsDeletion: true,
};

/**
 * Default policy for compliance workspaces.
 * Stronger tamper-evidence, restricted deletion.
 */
export const COMPLIANCE_DURABILITY_POLICY: EvidenceDurabilityPolicyV1 = {
  schemaVersion: 1,
  retentionClass: 'Compliance',
  tamperEvidenceLevel: 'chain-hash',
  exportPermitted: true,
  preferredExportFormat: 'json-lines',
  deletionPolicy: 'on-request',
  legalHoldSuspendsDeletion: true,
};

/**
 * Strictest policy for forensic evidence.
 * Deletion is prohibited; signed-chain provides maximum assurance.
 */
export const FORENSIC_DURABILITY_POLICY: EvidenceDurabilityPolicyV1 = {
  schemaVersion: 1,
  retentionClass: 'Forensic',
  tamperEvidenceLevel: 'signed-chain',
  exportPermitted: true,
  preferredExportFormat: 'pdf-audit',
  deletionPolicy: 'prohibited',
  legalHoldSuspendsDeletion: true,
};

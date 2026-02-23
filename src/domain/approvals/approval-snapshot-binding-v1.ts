/**
 * Approval Snapshot Binding (bead-0808).
 *
 * Implements the Universal Decision Surface requirement:
 *   "Approvals bind to immutable snapshots (the thing approved cannot
 *    silently change)."
 *
 * An `ApprovalSnapshotBindingV1` captures the cryptographic identity of
 * the content being approved at the moment the approval is created.
 * At decision time, the content is re-hashed and compared to detect drift.
 *
 * Design:
 *   - The binding stores a canonical JSON hash of the approval subject
 *     (payload, configuration, diff, etc.) — not the content itself.
 *   - Content is serialized via RFC 8785 JCS (canonical-json.ts) before
 *     hashing, ensuring cross-language reproducibility.
 *   - The `EvidenceHasher` interface provides the SHA-256 implementation
 *     (injected from infrastructure, keeping domain layer pure).
 *   - Drift detection is a simple hash comparison — no content diffing.
 *     If drift is detected, the caller can build a DiffBlock or
 *     ComparisonBlock from presentation-blocks-extended-v1.ts.
 */

import type { HashSha256 as HashSha256Type } from '../primitives/index.js';
import { HashSha256 } from '../primitives/index.js';
import { canonicalizeJson } from '../evidence/canonical-json.js';
import type { EvidenceHasher } from '../evidence/evidence-hasher.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What kind of content is being snapshot-bound. */
export type SnapshotSubjectKind =
  | 'approval_payload'
  | 'deployment_config'
  | 'policy_document'
  | 'code_diff'
  | 'financial_transaction'
  | 'access_grant'
  | 'custom';

/**
 * The immutable binding between an approval and the content it covers.
 *
 * Created when the approval is opened.  Verified when the decision is made.
 * If the content changes between creation and decision, the binding is
 * invalid and the approval must be re-created or explicitly acknowledged.
 */
export type ApprovalSnapshotBindingV1 = Readonly<{
  schemaVersion: 1;
  /** What kind of content is bound. */
  subjectKind: SnapshotSubjectKind;
  /** Human-readable label describing the bound content. */
  subjectLabel: string;
  /** SHA-256 hash of the canonical JSON of the bound content. */
  contentHash: HashSha256Type;
  /** ISO-8601 timestamp when the snapshot was captured. */
  capturedAtIso: string;
  /** Optional: URI to the full content for audit retrieval. */
  contentUri?: string;
  /** Optional: schema or version of the content format. */
  contentSchemaVersion?: string;
}>;

/**
 * Result of verifying an approval snapshot against current content.
 */
export type SnapshotVerificationResultV1 = Readonly<
  | {
      /** Content has not changed. */
      status: 'verified';
      binding: ApprovalSnapshotBindingV1;
      verifiedAtIso: string;
    }
  | {
      /** Content has changed since the snapshot was captured. */
      status: 'drifted';
      binding: ApprovalSnapshotBindingV1;
      currentHash: HashSha256Type;
      verifiedAtIso: string;
    }
>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an immutable snapshot binding for approval content.
 *
 * The content is canonicalized (RFC 8785 JCS) then hashed with SHA-256.
 * The binding is deep-frozen.
 *
 * @param hasher      - SHA-256 hasher (injected from infrastructure).
 * @param content     - The content to bind (must be JSON-serializable).
 * @param subjectKind - What kind of content this is.
 * @param subjectLabel - Human-readable description.
 * @param capturedAtIso - When the snapshot was captured.
 * @param contentUri  - Optional URI for audit retrieval.
 * @param contentSchemaVersion - Optional schema version.
 */
export function createSnapshotBinding(params: {
  hasher: EvidenceHasher;
  content: unknown;
  subjectKind: SnapshotSubjectKind;
  subjectLabel: string;
  capturedAtIso: string;
  contentUri?: string;
  contentSchemaVersion?: string;
}): ApprovalSnapshotBindingV1 {
  const canonical = canonicalizeJson(params.content);
  const contentHash = params.hasher.sha256Hex(canonical);

  const binding: ApprovalSnapshotBindingV1 = {
    schemaVersion: 1,
    subjectKind: params.subjectKind,
    subjectLabel: params.subjectLabel,
    contentHash,
    capturedAtIso: params.capturedAtIso,
    ...(params.contentUri !== undefined ? { contentUri: params.contentUri } : {}),
    ...(params.contentSchemaVersion !== undefined
      ? { contentSchemaVersion: params.contentSchemaVersion }
      : {}),
  };

  return deepFreeze(binding);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify that the current content still matches the snapshot binding.
 *
 * Re-canonicalizes and re-hashes the content, then compares with the
 * stored hash.  Returns `verified` if identical, `drifted` if changed.
 */
export function verifySnapshotBinding(params: {
  hasher: EvidenceHasher;
  binding: ApprovalSnapshotBindingV1;
  currentContent: unknown;
  verifiedAtIso: string;
}): SnapshotVerificationResultV1 {
  const canonical = canonicalizeJson(params.currentContent);
  const currentHash = params.hasher.sha256Hex(canonical);

  if (currentHash === params.binding.contentHash) {
    return Object.freeze({
      status: 'verified' as const,
      binding: params.binding,
      verifiedAtIso: params.verifiedAtIso,
    });
  }

  return Object.freeze({
    status: 'drifted' as const,
    binding: params.binding,
    currentHash,
    verifiedAtIso: params.verifiedAtIso,
  });
}

// ---------------------------------------------------------------------------
// Multi-binding support
// ---------------------------------------------------------------------------

/**
 * An approval may bind to multiple snapshots (e.g., a deployment approval
 * binds to both the code diff and the deployment config).
 *
 * This type represents the full set of bindings for an approval.
 */
export type ApprovalSnapshotSetV1 = Readonly<{
  schemaVersion: 1;
  /** All bindings for this approval, keyed by subject label. */
  bindings: readonly ApprovalSnapshotBindingV1[];
  /** SHA-256 hash of the canonical JSON of all bindings (compound hash). */
  compoundHash: HashSha256Type;
  /** ISO-8601 timestamp when the set was created. */
  createdAtIso: string;
}>;

/**
 * Create a snapshot set from multiple bindings.
 *
 * The compound hash is computed over the canonical JSON of all individual
 * binding hashes (sorted by subject label for determinism).
 */
export function createSnapshotSet(params: {
  hasher: EvidenceHasher;
  bindings: readonly ApprovalSnapshotBindingV1[];
  createdAtIso: string;
}): ApprovalSnapshotSetV1 {
  if (params.bindings.length === 0) {
    throw new Error('Snapshot set must contain at least one binding');
  }

  // Sort by subjectLabel for deterministic compound hash
  const sorted = [...params.bindings].sort((a, b) =>
    a.subjectLabel < b.subjectLabel ? -1 : a.subjectLabel > b.subjectLabel ? 1 : 0,
  );

  // Compound hash is SHA-256 of the sorted binding hashes concatenated
  const hashInput = sorted.map((b) => String(b.contentHash)).join(':');
  const compoundHash = params.hasher.sha256Hex(hashInput);

  return deepFreeze({
    schemaVersion: 1,
    bindings: sorted,
    compoundHash,
    createdAtIso: params.createdAtIso,
  });
}

/**
 * Verify all bindings in a snapshot set against current content.
 *
 * Returns verification results for each binding.  The set is considered
 * drifted if any individual binding has drifted.
 */
export function verifySnapshotSet(params: {
  hasher: EvidenceHasher;
  snapshotSet: ApprovalSnapshotSetV1;
  currentContents: ReadonlyMap<string, unknown>;
  verifiedAtIso: string;
}): {
  allVerified: boolean;
  results: readonly SnapshotVerificationResultV1[];
} {
  const results: SnapshotVerificationResultV1[] = [];

  for (const binding of params.snapshotSet.bindings) {
    const content = params.currentContents.get(binding.subjectLabel);
    if (content === undefined) {
      // Missing content = drifted (content was removed)
      results.push(
        Object.freeze({
          status: 'drifted' as const,
          binding,
          currentHash: HashSha256('0'.repeat(64)),
          verifiedAtIso: params.verifiedAtIso,
        }),
      );
    } else {
      results.push(
        verifySnapshotBinding({
          hasher: params.hasher,
          binding,
          currentContent: content,
          verifiedAtIso: params.verifiedAtIso,
        }),
      );
    }
  }

  return Object.freeze({
    allVerified: results.every((r) => r.status === 'verified'),
    results: Object.freeze(results),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}

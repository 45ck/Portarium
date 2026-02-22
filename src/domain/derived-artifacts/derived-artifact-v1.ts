/**
 * bead-0769: Domain model for Derived Artifacts.
 *
 * A DerivedArtifact is a computed artefact produced from one or more
 * EvidenceEntryV1 records. Examples: semantic embeddings, graph nodes,
 * chunk indexes.
 *
 * Invariants:
 * 1. Every DerivedArtifact has exactly one source evidence entry (single-entry provenance)
 *    OR references a run for multi-entry provenance.
 * 2. DerivedArtifacts are immutable once created (append-only).
 * 3. Expired artefacts (expiresAtIso < now) must not be served to clients.
 * 4. Kind is a closed enumeration — new kinds require a schema version bump.
 */

import {
  type WorkspaceId,
  type RunId,
  type EvidenceId,
  WorkspaceId as WorkspaceIdBrand,
  RunId as RunIdBrand,
  type Branded,
  brand,
} from '../primitives/index.js';
import {
  readRecord,
  readString,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
} from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Branded primitive
// ---------------------------------------------------------------------------

export type DerivedArtifactId = Branded<string, 'DerivedArtifactId'>;
export const DerivedArtifactId = (value: string): DerivedArtifactId =>
  brand<string, 'DerivedArtifactId'>(value) as DerivedArtifactId;

// ---------------------------------------------------------------------------
// Artifact kind
// ---------------------------------------------------------------------------

export type DerivedArtifactKind =
  | 'embedding' //    Dense vector embedding of the source text
  | 'graph-node' //   Entity node in the workflow knowledge graph
  | 'graph-edge' //   Relationship edge in the workflow knowledge graph
  | 'chunk-index'; // Text chunk for RAG retrieval

export const DERIVED_ARTIFACT_KINDS: readonly DerivedArtifactKind[] = [
  'embedding',
  'graph-node',
  'graph-edge',
  'chunk-index',
] as const;

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Provenance describes the source(s) from which this artefact was derived.
 * At minimum, the workspace and run are required.
 * The specific evidence entry is optional (some artefacts span an entire run).
 */
export type DerivedArtifactProvenanceV1 = Readonly<{
  workspaceId: WorkspaceId;
  runId: RunId;
  evidenceId?: EvidenceId;
  projectorVersion: string; // semver of the projector that created this artefact
}>;

// ---------------------------------------------------------------------------
// Retention policy
// ---------------------------------------------------------------------------

export type RetentionPolicy =
  | 'indefinite' // never expires
  | 'run-lifetime' // expires when the source run is archived
  | 'ttl'; // expires at a fixed expiresAtIso

// ---------------------------------------------------------------------------
// Main type
// ---------------------------------------------------------------------------

export type DerivedArtifactV1 = Readonly<{
  schemaVersion: 1;
  artifactId: DerivedArtifactId;
  workspaceId: WorkspaceId;
  kind: DerivedArtifactKind;
  provenance: DerivedArtifactProvenanceV1;
  retentionPolicy: RetentionPolicy;
  createdAtIso: string;
  expiresAtIso?: string;
}>;

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

export class DerivedArtifactParseError extends Error {
  public override readonly name = 'DerivedArtifactParseError';
  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseDerivedArtifactV1(value: unknown): DerivedArtifactV1 {
  const record = readRecord(value, 'DerivedArtifact', DerivedArtifactParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', DerivedArtifactParseError);
  if (schemaVersion !== 1) {
    throw new DerivedArtifactParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const artifactId = DerivedArtifactId(readString(record, 'artifactId', DerivedArtifactParseError));
  const workspaceId = WorkspaceIdBrand(readString(record, 'workspaceId', DerivedArtifactParseError));
  const kind = readKind(record);
  const provenance = readProvenance(record);
  const retentionPolicy = readRetentionPolicy(record);
  const createdAtIso = readIsoString(record, 'createdAtIso', DerivedArtifactParseError);
  const expiresAtIso = readOptionalIsoString(record, 'expiresAtIso', DerivedArtifactParseError);

  // Invariant: TTL retention must have expiresAtIso
  if (retentionPolicy === 'ttl' && expiresAtIso === undefined) {
    throw new DerivedArtifactParseError(
      'DerivedArtifact with retentionPolicy "ttl" must have expiresAtIso',
    );
  }

  // Invariant: expiresAtIso must be after createdAtIso
  if (expiresAtIso !== undefined && expiresAtIso <= createdAtIso) {
    throw new DerivedArtifactParseError(
      'DerivedArtifact expiresAtIso must be after createdAtIso',
    );
  }

  return {
    schemaVersion: 1,
    artifactId,
    workspaceId,
    kind,
    provenance,
    retentionPolicy,
    createdAtIso,
    ...(expiresAtIso !== undefined ? { expiresAtIso } : {}),
  };
}

// ---------------------------------------------------------------------------
// Domain predicates
// ---------------------------------------------------------------------------

/** Returns true if the artefact has expired (expiresAtIso < nowIso). */
export function isDerivedArtifactExpired(
  artifact: DerivedArtifactV1,
  nowIso: string,
): boolean {
  if (artifact.expiresAtIso === undefined) return false;
  return artifact.expiresAtIso < nowIso;
}

/** Returns true if the kind is a valid member of the closed enum. */
export function isValidDerivedArtifactKind(kind: string): kind is DerivedArtifactKind {
  return (DERIVED_ARTIFACT_KINDS as readonly string[]).includes(kind);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readKind(record: Record<string, unknown>): DerivedArtifactKind {
  const raw = readString(record, 'kind', DerivedArtifactParseError);
  if (!isValidDerivedArtifactKind(raw)) {
    throw new DerivedArtifactParseError(
      `Invalid DerivedArtifactKind: "${raw}". Must be one of: ${DERIVED_ARTIFACT_KINDS.join(', ')}`,
    );
  }
  return raw;
}

const RETENTION_POLICIES: readonly RetentionPolicy[] = ['indefinite', 'run-lifetime', 'ttl'];

function readRetentionPolicy(record: Record<string, unknown>): RetentionPolicy {
  const raw = readString(record, 'retentionPolicy', DerivedArtifactParseError);
  if (!(RETENTION_POLICIES as readonly string[]).includes(raw)) {
    throw new DerivedArtifactParseError(
      `Invalid RetentionPolicy: "${raw}". Must be one of: ${RETENTION_POLICIES.join(', ')}`,
    );
  }
  return raw as RetentionPolicy;
}

function readProvenance(record: Record<string, unknown>): DerivedArtifactProvenanceV1 {
  const raw = readRecord(record['provenance'], 'provenance', DerivedArtifactParseError);
  const evidenceId = readOptionalString(raw, 'evidenceId', DerivedArtifactParseError) as EvidenceId | undefined;
  return {
    workspaceId: WorkspaceIdBrand(readString(raw, 'workspaceId', DerivedArtifactParseError)),
    runId: RunIdBrand(readString(raw, 'runId', DerivedArtifactParseError)),
    ...(evidenceId !== undefined ? { evidenceId } : {}),
    projectorVersion: readString(raw, 'projectorVersion', DerivedArtifactParseError),
  };
}

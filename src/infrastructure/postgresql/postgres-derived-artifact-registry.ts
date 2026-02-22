/**
 * bead-0772: PostgreSQL adapter for DerivedArtifactRegistryPort.
 *
 * Persists derived artifacts and projection checkpoints to the
 * derived_artifacts and projection_checkpoints tables (migrations 0011, 0012).
 */

import type {
  DerivedArtifactRegistryPort,
  ProjectionCheckpointV1,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import {
  DerivedArtifactId,
  parseDerivedArtifactV1,
  type DerivedArtifactV1,
} from '../../domain/derived-artifacts/derived-artifact-v1.js';
import { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { SqlClient } from './sql-client.js';

interface DerivedArtifactRow extends Record<string, unknown> {
  tenant_id: string;
  workspace_id: string;
  artifact_id: string;
  kind: string;
  run_id: string;
  evidence_id: string | null;
  projector_version: string;
  retention_policy: string;
  created_at: Date;
  expires_at: Date | null;
}

interface CheckpointRow extends Record<string, unknown> {
  tenant_id: string;
  workspace_id: string;
  run_id: string;
  last_processed_evidence_id: string;
  last_processed_at: Date;
  projector_version: string;
}

function rowToArtifact(row: DerivedArtifactRow): DerivedArtifactV1 {
  return parseDerivedArtifactV1({
    schemaVersion: 1,
    artifactId: row.artifact_id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    provenance: {
      workspaceId: row.workspace_id,
      runId: row.run_id,
      ...(row.evidence_id !== null ? { evidenceId: row.evidence_id } : {}),
      projectorVersion: row.projector_version,
    },
    retentionPolicy: row.retention_policy,
    createdAtIso: row.created_at.toISOString(),
    ...(row.expires_at !== null ? { expiresAtIso: row.expires_at.toISOString() } : {}),
  });
}

function rowToCheckpoint(row: CheckpointRow, tenantId: string): ProjectionCheckpointV1 {
  void tenantId; // not part of domain type; used for storage only
  return {
    workspaceId: WorkspaceId(row.workspace_id),
    runId: RunId(row.run_id),
    lastProcessedEvidenceId: EvidenceId(row.last_processed_evidence_id),
    lastProcessedAtIso: row.last_processed_at.toISOString(),
    projectorVersion: row.projector_version,
  };
}

export class PostgresDerivedArtifactRegistry implements DerivedArtifactRegistryPort {
  readonly #client: SqlClient;
  readonly #tenantId: string;

  public constructor(client: SqlClient, tenantId: string) {
    this.#client = client;
    this.#tenantId = tenantId;
  }

  public async save(artifact: DerivedArtifactV1): Promise<void> {
    await this.#client.query(
      `INSERT INTO derived_artifacts
         (tenant_id, workspace_id, artifact_id, kind, run_id, evidence_id,
          projector_version, retention_policy, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tenant_id, workspace_id, artifact_id) DO NOTHING`,
      [
        this.#tenantId,
        String(artifact.workspaceId),
        String(artifact.artifactId),
        artifact.kind,
        String(artifact.provenance.runId),
        artifact.provenance.evidenceId !== undefined
          ? String(artifact.provenance.evidenceId)
          : null,
        artifact.provenance.projectorVersion,
        artifact.retentionPolicy,
        artifact.createdAtIso,
        artifact.expiresAtIso ?? null,
      ],
    );
  }

  public async findById(
    artifactId: string,
    workspaceId: WorkspaceId,
  ): Promise<DerivedArtifactV1 | undefined> {
    const result = await this.#client.query<DerivedArtifactRow>(
      `SELECT tenant_id, workspace_id, artifact_id, kind, run_id, evidence_id,
              projector_version, retention_policy, created_at, expires_at
         FROM derived_artifacts
        WHERE tenant_id = $1 AND workspace_id = $2 AND artifact_id = $3`,
      [this.#tenantId, String(workspaceId), artifactId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return rowToArtifact(row);
  }

  public async findByRun(
    runId: RunId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DerivedArtifactV1[]> {
    const result = await this.#client.query<DerivedArtifactRow>(
      `SELECT tenant_id, workspace_id, artifact_id, kind, run_id, evidence_id,
              projector_version, retention_policy, created_at, expires_at
         FROM derived_artifacts
        WHERE tenant_id = $1 AND workspace_id = $2 AND run_id = $3
        ORDER BY created_at ASC`,
      [this.#tenantId, String(workspaceId), String(runId)],
    );
    return result.rows.map(rowToArtifact);
  }

  public async saveCheckpoint(checkpoint: ProjectionCheckpointV1): Promise<void> {
    await this.#client.query(
      `INSERT INTO projection_checkpoints
         (tenant_id, workspace_id, run_id, last_processed_evidence_id,
          last_processed_at, projector_version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (tenant_id, workspace_id, run_id) DO UPDATE SET
         last_processed_evidence_id = EXCLUDED.last_processed_evidence_id,
         last_processed_at          = EXCLUDED.last_processed_at,
         projector_version          = EXCLUDED.projector_version,
         updated_at                 = NOW()`,
      [
        this.#tenantId,
        String(checkpoint.workspaceId),
        String(checkpoint.runId),
        String(checkpoint.lastProcessedEvidenceId),
        checkpoint.lastProcessedAtIso,
        checkpoint.projectorVersion,
      ],
    );
  }

  public async loadCheckpoint(
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<ProjectionCheckpointV1 | undefined> {
    const result = await this.#client.query<CheckpointRow>(
      `SELECT tenant_id, workspace_id, run_id, last_processed_evidence_id,
              last_processed_at, projector_version
         FROM projection_checkpoints
        WHERE tenant_id = $1 AND workspace_id = $2 AND run_id = $3`,
      [this.#tenantId, String(workspaceId), String(runId)],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return rowToCheckpoint(row, this.#tenantId);
  }

  public async purgeExpired(beforeIso: string): Promise<number> {
    const result = await this.#client.query(
      `DELETE FROM derived_artifacts
        WHERE tenant_id = $1
          AND expires_at IS NOT NULL
          AND expires_at < $2::timestamptz`,
      [this.#tenantId, beforeIso],
    );
    return result.rowCount;
  }
}

// Re-export branded type helpers used in tests
export { DerivedArtifactId };

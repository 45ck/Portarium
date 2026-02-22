/**
 * bead-0776: pgvector fallback adapter for SemanticIndexPort.
 *
 * Implements SemanticIndexPort using PostgreSQL + pgvector extension as a
 * fallback/parity backend to Weaviate. This adapter is suitable for
 * environments where Weaviate is not available (e.g., local dev, CI, smaller
 * deployments).
 *
 * Table convention: one shared table `semantic_index` with workspace_id
 * scoping. Uses HNSW index for fast approximate nearest-neighbour search.
 *
 * Idempotency: upsert uses INSERT ... ON CONFLICT (artifact_id, workspace_id)
 * DO UPDATE, so repeated calls are safe.
 *
 * Prerequisites: pgvector extension must be installed in the Postgres cluster.
 */

import type {
  SemanticIndexEntry,
  SemanticIndexPort,
  SemanticSearchParams,
  SemanticSearchResult,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { WorkspaceId } from '../../domain/primitives/index.js';
import { EvidenceId, RunId } from '../../domain/primitives/index.js';
import type { SqlClient, SqlRow } from '../postgresql/sql-client.js';

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface SemanticIndexRow extends SqlRow {
  artifact_id: string;
  workspace_id: string;
  run_id: string;
  evidence_id: string | null;
  text: string;
  vector: string; // pgvector returns as string '[0.1,0.2,...]'
  metadata: string; // JSON blob
  score?: number; // only present in search results
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PgvectorSemanticIndexAdapterConfig {
  /** PostgreSQL client */
  client: SqlClient;
  /**
   * Embedding function — called for query strings during search.
   * Returns a float array (the dense vector).
   */
  embed: (text: string) => Promise<readonly number[]>;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class PgvectorSemanticIndexAdapter implements SemanticIndexPort {
  readonly #client: SqlClient;
  readonly #embed: (text: string) => Promise<readonly number[]>;

  public constructor(config: PgvectorSemanticIndexAdapterConfig) {
    this.#client = config.client;
    this.#embed = config.embed;
  }

  /**
   * Upsert a semantic index entry. Idempotent.
   */
  public async upsert(entry: SemanticIndexEntry): Promise<void> {
    const vector = pgvectorLiteral(entry.vector);
    const metadata = JSON.stringify(entry.metadata);

    await this.#client.query(
      `
      INSERT INTO semantic_index
        (artifact_id, workspace_id, run_id, evidence_id, text, embedding, metadata)
      VALUES
        ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
      ON CONFLICT (artifact_id, workspace_id)
      DO UPDATE SET
        run_id      = EXCLUDED.run_id,
        evidence_id = EXCLUDED.evidence_id,
        text        = EXCLUDED.text,
        embedding   = EXCLUDED.embedding,
        metadata    = EXCLUDED.metadata,
        updated_at  = NOW()
      `,
      [
        entry.artifactId,
        String(entry.workspaceId),
        String(entry.runId),
        entry.evidenceId !== undefined ? String(entry.evidenceId) : null,
        entry.text,
        vector,
        metadata,
      ],
    );
  }

  /**
   * Vector similarity search scoped to a workspace using cosine distance.
   */
  public async search(params: SemanticSearchParams): Promise<readonly SemanticSearchResult[]> {
    const vector = await this.#embed(params.query);
    const vectorLiteral = pgvectorLiteral(vector);
    const minScore = params.minScore ?? 0;

    const result = await this.#client.query<SemanticIndexRow>(
      `
      SELECT
        artifact_id,
        workspace_id,
        run_id,
        evidence_id,
        text,
        metadata,
        1 - (embedding <=> $1::vector) AS score
      FROM semantic_index
      WHERE workspace_id = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
      `,
      [vectorLiteral, String(params.workspaceId), minScore, params.topK],
    );

    return result.rows.map((row) => mapRowToSearchResult(row, params.workspaceId));
  }

  /**
   * Delete all index entries for a given artifact in a workspace.
   */
  public async delete(artifactId: string, workspaceId: WorkspaceId): Promise<void> {
    await this.#client.query(
      `DELETE FROM semantic_index WHERE artifact_id = $1 AND workspace_id = $2`,
      [artifactId, String(workspaceId)],
    );
  }

  /**
   * Health check: verify the semantic_index table and pgvector extension exist.
   */
  public async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.#client.query(`SELECT 1 FROM semantic_index LIMIT 0`, []);
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}

// ---------------------------------------------------------------------------
// Migration DDL (informational — not applied by this adapter)
// ---------------------------------------------------------------------------

/**
 * SQL to create the semantic_index table.
 * Include this in a migration when deploying the pgvector backend.
 *
 * Requires: CREATE EXTENSION IF NOT EXISTS vector;
 */
export const SEMANTIC_INDEX_DDL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS semantic_index (
  artifact_id   TEXT        NOT NULL,
  workspace_id  TEXT        NOT NULL,
  run_id        TEXT        NOT NULL,
  evidence_id   TEXT        NULL,
  text          TEXT        NOT NULL,
  embedding     VECTOR(1536) NOT NULL,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artifact_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_semantic_index_workspace
  ON semantic_index USING hnsw (embedding vector_cosine_ops)
  WHERE workspace_id IS NOT NULL;
`.trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a number array to a pgvector literal string '[0.1,0.2,...]'. */
function pgvectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

function mapRowToSearchResult(
  row: SemanticIndexRow,
  workspaceId: WorkspaceId,
): SemanticSearchResult {
  const metadata =
    typeof row.metadata === 'string'
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : (row.metadata as Record<string, unknown>);

  return {
    artifactId: row.artifact_id,
    score: typeof row.score === 'number' ? row.score : 0,
    text: row.text,
    metadata,
    provenance: {
      workspaceId,
      runId: RunId(row.run_id),
      ...(row.evidence_id !== null && row.evidence_id !== undefined
        ? { evidenceId: EvidenceId(row.evidence_id) }
        : {}),
    },
  };
}

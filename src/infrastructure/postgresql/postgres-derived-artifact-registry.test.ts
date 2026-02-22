/**
 * bead-0772: Unit tests for PostgresDerivedArtifactRegistry.
 *
 * Uses an in-memory stub SqlClient — no real Postgres required.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresDerivedArtifactRegistry } from './postgres-derived-artifact-registry.js';
import type { SqlClient, SqlQueryResult, SqlRow } from './sql-client.js';
import {
  DerivedArtifactId,
  type DerivedArtifactV1,
  type DerivedArtifactKind,
} from '../../domain/derived-artifacts/derived-artifact-v1.js';
import { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { ProjectionCheckpointV1 } from '../../domain/derived-artifacts/retrieval-ports.js';

// ---------------------------------------------------------------------------
// Stub SQL client
// ---------------------------------------------------------------------------

interface ArtifactStoreRow extends Record<string, unknown> {
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

interface CheckpointStoreRow extends Record<string, unknown> {
  tenant_id: string;
  workspace_id: string;
  run_id: string;
  last_processed_evidence_id: string;
  last_processed_at: Date;
  projector_version: string;
}

class StubSqlClient implements SqlClient {
  readonly artifacts = new Map<string, ArtifactStoreRow>();
  readonly checkpoints = new Map<string, CheckpointStoreRow>();

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  public query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    const s = statement.trim();

    if (s.startsWith('INSERT INTO derived_artifacts')) {
      const [
        tenantId,
        workspaceId,
        artifactId,
        kind,
        runId,
        evidenceId,
        projectorVersion,
        retentionPolicy,
        createdAt,
        expiresAt,
      ] = params;
      const key = `${tenantId}|${workspaceId}|${artifactId}`;
      if (!this.artifacts.has(key)) {
        this.artifacts.set(key, {
          tenant_id: String(tenantId),
          workspace_id: String(workspaceId),
          artifact_id: String(artifactId),
          kind: String(kind),
          run_id: String(runId),
          evidence_id: evidenceId != null ? String(evidenceId) : null,
          projector_version: String(projectorVersion),
          retention_policy: String(retentionPolicy),
          created_at: new Date(String(createdAt)),
          expires_at: expiresAt != null ? new Date(String(expiresAt)) : null,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 } as SqlQueryResult<Row>);
    }

    if (
      s.startsWith('SELECT') &&
      s.includes('FROM derived_artifacts') &&
      s.includes('artifact_id = $3')
    ) {
      const [tenantId, workspaceId, artifactId] = params;
      const key = `${tenantId}|${workspaceId}|${artifactId}`;
      const row = this.artifacts.get(key);
      const rows = row ? [row as unknown as Row] : [];
      return Promise.resolve({ rows, rowCount: rows.length });
    }

    if (
      s.startsWith('SELECT') &&
      s.includes('FROM derived_artifacts') &&
      s.includes('run_id = $3')
    ) {
      const [tenantId, workspaceId, runId] = params;
      const rows = [...this.artifacts.values()]
        .filter(
          (r) => r.tenant_id === tenantId && r.workspace_id === workspaceId && r.run_id === runId,
        )
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime()) as unknown as Row[];
      return Promise.resolve({ rows, rowCount: rows.length });
    }

    if (s.startsWith('INSERT INTO projection_checkpoints')) {
      const [tenantId, workspaceId, runId, lastEvidenceId, lastAt, projectorVersion] = params;
      const key = `${tenantId}|${workspaceId}|${runId}`;
      this.checkpoints.set(key, {
        tenant_id: String(tenantId),
        workspace_id: String(workspaceId),
        run_id: String(runId),
        last_processed_evidence_id: String(lastEvidenceId),
        last_processed_at: new Date(String(lastAt)),
        projector_version: String(projectorVersion),
      });
      return Promise.resolve({ rows: [], rowCount: 1 } as SqlQueryResult<Row>);
    }

    if (s.startsWith('SELECT') && s.includes('FROM projection_checkpoints')) {
      const [tenantId, workspaceId, runId] = params;
      const key = `${tenantId}|${workspaceId}|${runId}`;
      const row = this.checkpoints.get(key);
      const rows = row ? [row as unknown as Row] : [];
      return Promise.resolve({ rows, rowCount: rows.length });
    }

    if (s.startsWith('DELETE FROM derived_artifacts')) {
      const [tenantId, beforeIso] = params;
      const before = new Date(String(beforeIso));
      let deleted = 0;
      for (const [key, row] of this.artifacts.entries()) {
        if (row.tenant_id === tenantId && row.expires_at !== null && row.expires_at < before) {
          this.artifacts.delete(key);
          deleted++;
        }
      }
      return Promise.resolve({ rows: [], rowCount: deleted } as SqlQueryResult<Row>);
    }

    throw new Error(`StubSqlClient: unsupported SQL: ${s.slice(0, 60)}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT = 'tenant-test';
const WS = WorkspaceId('ws-001');
const RUN = RunId('run-abc');
const EV = EvidenceId('ev-xyz');

function makeArtifact(overrides: Partial<DerivedArtifactV1> = {}): DerivedArtifactV1 {
  const base: DerivedArtifactV1 = {
    schemaVersion: 1,
    artifactId: DerivedArtifactId('artifact-1'),
    workspaceId: WS,
    kind: 'embedding' as DerivedArtifactKind,
    provenance: {
      workspaceId: WS,
      runId: RUN,
      evidenceId: EV,
      projectorVersion: '1.0.0',
    },
    retentionPolicy: 'indefinite',
    createdAtIso: '2026-02-22T10:00:00.000Z',
  };
  return { ...base, ...overrides };
}

function makeCheckpoint(): ProjectionCheckpointV1 {
  return {
    workspaceId: WS,
    runId: RUN,
    lastProcessedEvidenceId: EV,
    lastProcessedAtIso: '2026-02-22T10:05:00.000Z',
    projectorVersion: '1.0.0',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PostgresDerivedArtifactRegistry', () => {
  let client: StubSqlClient;
  let registry: PostgresDerivedArtifactRegistry;

  beforeEach(() => {
    client = new StubSqlClient();
    registry = new PostgresDerivedArtifactRegistry(client, TENANT);
  });

  describe('save / findById', () => {
    it('saves and retrieves an artifact by id', async () => {
      const artifact = makeArtifact();
      await registry.save(artifact);
      const found = await registry.findById(String(artifact.artifactId), WS);
      expect(found).toBeDefined();
      expect(found?.artifactId).toBe(artifact.artifactId);
      expect(found?.kind).toBe('embedding');
      expect(found?.provenance.runId).toBe(RUN);
    });

    it('returns undefined for missing artifact', async () => {
      const found = await registry.findById('nonexistent', WS);
      expect(found).toBeUndefined();
    });

    it('is idempotent (ON CONFLICT DO NOTHING)', async () => {
      const artifact = makeArtifact();
      await registry.save(artifact);
      await registry.save(artifact); // second save should not throw
      expect(client.artifacts.size).toBe(1);
    });

    it('preserves expiresAtIso for ttl artifacts', async () => {
      const artifact = makeArtifact({
        artifactId: DerivedArtifactId('ttl-art'),
        retentionPolicy: 'ttl',
        expiresAtIso: '2026-12-31T23:59:59.000Z',
      });
      await registry.save(artifact);
      const found = await registry.findById('ttl-art', WS);
      expect(found?.expiresAtIso).toBe('2026-12-31T23:59:59.000Z');
    });

    it('handles artifact without evidenceId', async () => {
      const artifact = makeArtifact({
        artifactId: DerivedArtifactId('no-ev'),
        provenance: { workspaceId: WS, runId: RUN, projectorVersion: '1.0.0' },
      });
      await registry.save(artifact);
      const found = await registry.findById('no-ev', WS);
      expect(found?.provenance.evidenceId).toBeUndefined();
    });
  });

  describe('findByRun', () => {
    it('returns all artifacts for a run in creation order', async () => {
      const a1 = makeArtifact({
        artifactId: DerivedArtifactId('a1'),
        createdAtIso: '2026-02-22T10:00:00.000Z',
      });
      const a2 = makeArtifact({
        artifactId: DerivedArtifactId('a2'),
        kind: 'graph-node',
        createdAtIso: '2026-02-22T10:01:00.000Z',
      });
      await registry.save(a1);
      await registry.save(a2);
      const results = await registry.findByRun(RUN, WS);
      expect(results.length).toBe(2);
      expect(results[0]?.artifactId).toBe(DerivedArtifactId('a1'));
      expect(results[1]?.artifactId).toBe(DerivedArtifactId('a2'));
    });

    it('returns empty array when no artifacts exist for run', async () => {
      const results = await registry.findByRun(RunId('unknown-run'), WS);
      expect(results).toHaveLength(0);
    });
  });

  describe('saveCheckpoint / loadCheckpoint', () => {
    it('saves and loads a checkpoint', async () => {
      const checkpoint = makeCheckpoint();
      await registry.saveCheckpoint(checkpoint);
      const loaded = await registry.loadCheckpoint(WS, RUN);
      expect(loaded).toBeDefined();
      expect(loaded?.lastProcessedEvidenceId).toBe(EV);
      expect(loaded?.projectorVersion).toBe('1.0.0');
    });

    it('returns undefined when no checkpoint exists', async () => {
      const loaded = await registry.loadCheckpoint(WorkspaceId('ws-unknown'), RUN);
      expect(loaded).toBeUndefined();
    });

    it('upserts checkpoint on second save', async () => {
      const c1 = makeCheckpoint();
      await registry.saveCheckpoint(c1);
      const c2: ProjectionCheckpointV1 = {
        ...c1,
        lastProcessedEvidenceId: EvidenceId('ev-updated'),
        lastProcessedAtIso: '2026-02-22T11:00:00.000Z',
      };
      await registry.saveCheckpoint(c2);
      const loaded = await registry.loadCheckpoint(WS, RUN);
      expect(loaded?.lastProcessedEvidenceId).toBe(EvidenceId('ev-updated'));
    });
  });

  describe('purgeExpired', () => {
    it('purges artifacts whose expires_at is before the cutoff', async () => {
      const expired = makeArtifact({
        artifactId: DerivedArtifactId('exp-1'),
        retentionPolicy: 'ttl',
        expiresAtIso: '2026-01-01T00:00:00.000Z',
      });
      const live = makeArtifact({
        artifactId: DerivedArtifactId('live-1'),
        retentionPolicy: 'ttl',
        expiresAtIso: '2026-12-31T00:00:00.000Z',
      });
      await registry.save(expired);
      await registry.save(live);
      const purged = await registry.purgeExpired('2026-06-01T00:00:00.000Z');
      expect(purged).toBe(1);
      expect(client.artifacts.size).toBe(1);
    });

    it('returns 0 when nothing to purge', async () => {
      const purged = await registry.purgeExpired('2026-01-01T00:00:00.000Z');
      expect(purged).toBe(0);
    });

    it('does not purge indefinite artifacts', async () => {
      const indefinite = makeArtifact({ artifactId: DerivedArtifactId('keep-forever') });
      await registry.save(indefinite);
      const purged = await registry.purgeExpired('2099-01-01T00:00:00.000Z');
      expect(purged).toBe(0);
      expect(client.artifacts.size).toBe(1);
    });
  });
});

/**
 * bead-0776: Unit tests for PgvectorSemanticIndexAdapter.
 *
 * Uses a stub SqlClient — no real Postgres or pgvector required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgvectorSemanticIndexAdapter } from './pgvector-semantic-index-adapter.js';
import type {
  SemanticIndexEntry,
  SemanticSearchParams,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeStubClient(rows: SqlRow[] = []): SqlClient {
  const client: SqlClient = {
    query: vi.fn().mockResolvedValue({
      rows,
      rowCount: rows.length,
    } satisfies SqlQueryResult),
    withTransaction: vi
      .fn()
      .mockImplementation((fn: (tx: SqlClient) => Promise<unknown>) => fn(client)),
  };
  return client;
}

function makeAdapter(client: SqlClient): PgvectorSemanticIndexAdapter {
  return new PgvectorSemanticIndexAdapter({
    client,
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  });
}

function makeEntry(overrides: Partial<SemanticIndexEntry> = {}): SemanticIndexEntry {
  return {
    artifactId: 'art-001',
    workspaceId: WorkspaceId('ws001'),
    runId: RunId('run-001'),
    evidenceId: EvidenceId('ev-001'),
    text: 'Hello world',
    vector: [0.1, 0.2, 0.3],
    metadata: { source: 'test' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PgvectorSemanticIndexAdapter', () => {
  let client: SqlClient;
  let adapter: PgvectorSemanticIndexAdapter;

  beforeEach(() => {
    client = makeStubClient();
    adapter = makeAdapter(client);
  });

  describe('upsert', () => {
    it('calls query with INSERT ... ON CONFLICT', async () => {
      await adapter.upsert(makeEntry());

      expect(client.query).toHaveBeenCalledOnce();
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO semantic_index');
      expect(sql).toContain('ON CONFLICT');
      expect(params[0]).toBe('art-001');
      expect(params[1]).toBe('ws001');
    });

    it('passes vector as pgvector literal', async () => {
      await adapter.upsert(makeEntry({ vector: [0.5, 0.6] }));

      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[5]).toBe('[0.5,0.6]');
    });

    it('passes null for evidenceId when absent', async () => {
      const { evidenceId: _unused, ...rest } = makeEntry();
      const entry: SemanticIndexEntry = rest;
      await adapter.upsert(entry);

      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[3]).toBeNull();
    });

    it('passes metadata as JSON string', async () => {
      await adapter.upsert(makeEntry({ metadata: { key: 'value' } }));

      const [, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(params[6]).toBe('{"key":"value"}');
    });
  });

  describe('search', () => {
    it('calls embed and issues SELECT with cosine distance', async () => {
      const embedFn = vi.fn().mockResolvedValue([0.5, 0.6]);
      const localAdapter = new PgvectorSemanticIndexAdapter({
        client,
        embed: embedFn,
      });

      const params: SemanticSearchParams = {
        workspaceId: WorkspaceId('ws001'),
        query: 'test query',
        topK: 5,
      };

      await localAdapter.search(params);

      expect(embedFn).toHaveBeenCalledWith('test query');
      expect(client.query).toHaveBeenCalledOnce();
      const [sql, queryParams] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('semantic_index');
      expect(sql).toContain('<=>');
      expect(queryParams[1]).toBe('ws001');
      expect(queryParams[3]).toBe(5);
    });

    it('returns empty array when no rows', async () => {
      const results = await adapter.search({
        workspaceId: WorkspaceId('ws001'),
        query: 'nothing',
        topK: 3,
      });

      expect(results).toEqual([]);
    });

    it('maps DB rows to SemanticSearchResult', async () => {
      const localClient = makeStubClient([
        {
          artifact_id: 'art-002',
          workspace_id: 'ws001',
          run_id: 'run-001',
          evidence_id: 'ev-002',
          text: 'Some text',
          metadata: '{"source":"db"}',
          score: 0.92,
        },
      ]);
      const localAdapter = makeAdapter(localClient);

      const results = await localAdapter.search({
        workspaceId: WorkspaceId('ws001'),
        query: 'test',
        topK: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.artifactId).toBe('art-002');
      expect(results[0]?.score).toBe(0.92);
      expect(results[0]?.text).toBe('Some text');
      expect(results[0]?.provenance.runId).toBe('run-001');
      expect(results[0]?.provenance.evidenceId).toBe('ev-002');
    });

    it('handles null evidence_id in result row', async () => {
      const localClient = makeStubClient([
        {
          artifact_id: 'art-003',
          workspace_id: 'ws001',
          run_id: 'run-002',
          evidence_id: null,
          text: 'text',
          metadata: '{}',
          score: 0.8,
        },
      ]);
      const localAdapter = makeAdapter(localClient);

      const results = await localAdapter.search({
        workspaceId: WorkspaceId('ws001'),
        query: 'x',
        topK: 1,
      });

      expect(results[0]?.provenance.evidenceId).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('calls DELETE query with correct params', async () => {
      await adapter.delete('art-001', WorkspaceId('ws001'));

      expect(client.query).toHaveBeenCalledOnce();
      const [sql, params] = vi.mocked(client.query).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('DELETE FROM semantic_index');
      expect(params[0]).toBe('art-001');
      expect(params[1]).toBe('ws001');
    });
  });

  describe('healthCheck', () => {
    it('returns ok=true when query succeeds', async () => {
      const result = await adapter.healthCheck();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok=false when query throws', async () => {
      const errorClient: SqlClient = {
        query: vi.fn().mockRejectedValue(new Error('relation "semantic_index" does not exist')),
        withTransaction: vi.fn(),
      };
      const errorAdapter = makeAdapter(errorClient);

      const result = await errorAdapter.healthCheck();
      expect(result.ok).toBe(false);
    });
  });
});

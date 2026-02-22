/**
 * bead-0774: Unit tests for WeaviateSemanticIndexAdapter.
 *
 * Uses a stub WeaviateHttpClient — no real Weaviate required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  WeaviateHttpClient,
  WeaviateHttpResponse,
} from './weaviate-semantic-index-adapter.js';
import { WeaviateSemanticIndexAdapter } from './weaviate-semantic-index-adapter.js';
import type {
  SemanticIndexEntry,
  SemanticSearchParams,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { PortariumLogger } from '../observability/logger.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeLogger(): PortariumLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => makeLogger(),
  };
}

function makeStubClient(
  responses: Partial<Record<string, WeaviateHttpResponse>> = {},
): WeaviateHttpClient {
  return {
    get: vi.fn().mockResolvedValue(responses['get'] ?? { status: 200, body: { version: '1.0' } }),
    put: vi.fn().mockResolvedValue(responses['put'] ?? { status: 200, body: {} }),
    post: vi.fn().mockResolvedValue(
      responses['post'] ?? {
        status: 200,
        body: { data: { Get: { Portarium_ws001: [] } } },
      },
    ),
    delete: vi.fn().mockResolvedValue(responses['delete'] ?? { status: 204, body: '' }),
  };
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

function makeAdapter(client: WeaviateHttpClient) {
  return new WeaviateSemanticIndexAdapter({
    client,
    logger: makeLogger(),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeaviateSemanticIndexAdapter', () => {
  let client: WeaviateHttpClient;
  let adapter: WeaviateSemanticIndexAdapter;

  beforeEach(() => {
    client = makeStubClient();
    adapter = makeAdapter(client);
  });

  describe('upsert', () => {
    it('calls PUT with correct path and object', async () => {
      const entry = makeEntry();
      await adapter.upsert(entry);

      expect(client.put).toHaveBeenCalledOnce();
      const [path, body] = vi.mocked(client.put).mock.calls[0] as [string, unknown];
      expect(path).toMatch(/^\/v1\/objects\/Portarium_ws001\//);
      expect((body as Record<string, unknown>)['class']).toBe('Portarium_ws001');
      expect(
        ((body as Record<string, unknown>)['properties'] as Record<string, unknown>)['artifactId'],
      ).toBe('art-001');
    });

    it('throws when PUT returns 4xx', async () => {
      const errorClient = makeStubClient({ put: { status: 422, body: { error: 'invalid' } } });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.upsert(makeEntry())).rejects.toThrow('HTTP 422');
    });

    it('handles entry without evidenceId', async () => {
      const { evidenceId: _unused, ...rest } = makeEntry();
      const entry: SemanticIndexEntry = rest;
      await expect(adapter.upsert(entry)).resolves.not.toThrow();

      const [, body] = vi.mocked(client.put).mock.calls[0] as [string, unknown];
      expect(
        ((body as Record<string, unknown>)['properties'] as Record<string, unknown>)['evidenceId'],
      ).toBeNull();
    });
  });

  describe('search', () => {
    it('calls embed and POST graphql', async () => {
      const embedFn = vi.fn().mockResolvedValue([0.5, 0.6]);
      const localAdapter = new WeaviateSemanticIndexAdapter({
        client,
        logger: makeLogger(),
        embed: embedFn,
      });

      const params: SemanticSearchParams = {
        workspaceId: WorkspaceId('ws001'),
        query: 'test query',
        topK: 5,
      };

      await localAdapter.search(params);

      expect(embedFn).toHaveBeenCalledWith('test query');
      expect(client.post).toHaveBeenCalledWith(
        '/v1/graphql',
        expect.objectContaining({ query: expect.any(String) }),
      );
    });

    it('returns empty array when no results', async () => {
      const results = await adapter.search({
        workspaceId: WorkspaceId('ws001'),
        query: 'nothing',
        topK: 3,
      });

      expect(results).toEqual([]);
    });

    it('maps Weaviate objects to SemanticSearchResult', async () => {
      const mockClient = makeStubClient({
        post: {
          status: 200,
          body: {
            data: {
              Get: {
                Portarium_ws001: [
                  {
                    artifactId: 'art-002',
                    workspaceId: 'ws001',
                    runId: 'run-001',
                    evidenceId: 'ev-002',
                    text: 'Search result text',
                    _additional: { certainty: 0.95 },
                  },
                ],
              },
            },
          },
        },
      });
      const localAdapter = makeAdapter(mockClient);

      const results = await localAdapter.search({
        workspaceId: WorkspaceId('ws001'),
        query: 'test',
        topK: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.artifactId).toBe('art-002');
      expect(results[0]?.score).toBe(0.95);
      expect(results[0]?.text).toBe('Search result text');
    });

    it('throws when POST returns 4xx', async () => {
      const errorClient = makeStubClient({ post: { status: 500, body: {} } });
      const errorAdapter = makeAdapter(errorClient);

      await expect(
        errorAdapter.search({ workspaceId: WorkspaceId('ws001'), query: 'q', topK: 5 }),
      ).rejects.toThrow('HTTP 500');
    });

    it('throws when GraphQL response has errors', async () => {
      const errorClient = makeStubClient({
        post: {
          status: 200,
          body: { errors: [{ message: 'class not found' }] },
        },
      });
      const errorAdapter = makeAdapter(errorClient);

      await expect(
        errorAdapter.search({ workspaceId: WorkspaceId('ws001'), query: 'q', topK: 5 }),
      ).rejects.toThrow('class not found');
    });
  });

  describe('delete', () => {
    it('calls DELETE with correct path', async () => {
      await adapter.delete('art-001', WorkspaceId('ws001'));

      expect(client.delete).toHaveBeenCalledOnce();
      const [path] = vi.mocked(client.delete).mock.calls[0] as [string];
      expect(path).toMatch(/^\/v1\/objects\/Portarium_ws001\//);
    });

    it('does not throw on 404 (already deleted)', async () => {
      const notFoundClient = makeStubClient({ delete: { status: 404, body: '' } });
      const localAdapter = makeAdapter(notFoundClient);

      await expect(localAdapter.delete('art-gone', WorkspaceId('ws001'))).resolves.not.toThrow();
    });

    it('throws on 5xx error', async () => {
      const errorClient = makeStubClient({ delete: { status: 500, body: {} } });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.delete('art-001', WorkspaceId('ws001'))).rejects.toThrow(
        'HTTP 500',
      );
    });
  });

  describe('healthCheck', () => {
    it('returns ok=true when meta endpoint responds 200', async () => {
      const result = await adapter.healthCheck();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(client.get).toHaveBeenCalledWith('/v1/meta');
    });

    it('returns ok=false when meta endpoint returns 5xx', async () => {
      const errorClient = makeStubClient({ get: { status: 503, body: {} } });
      const errorAdapter = makeAdapter(errorClient);

      const result = await errorAdapter.healthCheck();
      expect(result.ok).toBe(false);
    });

    it('returns ok=false when request throws', async () => {
      const throwingClient: WeaviateHttpClient = {
        get: vi.fn().mockRejectedValue(new Error('connection refused')),
        put: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
      };
      const localAdapter = makeAdapter(throwingClient);

      const result = await localAdapter.healthCheck();
      expect(result.ok).toBe(false);
    });
  });
});

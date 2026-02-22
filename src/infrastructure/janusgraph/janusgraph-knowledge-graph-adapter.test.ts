/**
 * bead-0777: Unit tests for JanusGraphKnowledgeGraphAdapter.
 *
 * Uses a stub GremlinHttpClient — no real JanusGraph required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JanusGraphKnowledgeGraphAdapter,
  type GremlinHttpClient,
  type GremlinHttpResponse,
} from './janusgraph-knowledge-graph-adapter.js';
import type {
  GraphNodeV1,
  GraphEdgeV1,
  GraphTraversalParams,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { WorkspaceId } from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeStubClient(
  response: GremlinHttpResponse = {
    status: 200,
    body: { status: { code: 200 }, result: { data: [] } },
  },
): GremlinHttpClient {
  return {
    run: vi.fn().mockResolvedValue(response),
    healthCheck: vi.fn().mockResolvedValue({ status: 200, body: {} }),
  };
}

function makeAdapter(client: GremlinHttpClient): JanusGraphKnowledgeGraphAdapter {
  return new JanusGraphKnowledgeGraphAdapter({
    client,
    logger: {
      child: vi.fn().mockReturnThis(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as never,
  });
}

function makeNode(overrides: Partial<GraphNodeV1> = {}): GraphNodeV1 {
  return {
    nodeId: 'node-001',
    workspaceId: WorkspaceId('ws001'),
    kind: 'run',
    label: 'Test Node',
    properties: {},
    ...overrides,
  };
}

function makeEdge(overrides: Partial<GraphEdgeV1> = {}): GraphEdgeV1 {
  return {
    edgeId: 'edge-001',
    fromNodeId: 'node-001',
    toNodeId: 'node-002',
    relation: 'DEPENDS_ON',
    workspaceId: WorkspaceId('ws001'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JanusGraphKnowledgeGraphAdapter', () => {
  let client: GremlinHttpClient;
  let adapter: JanusGraphKnowledgeGraphAdapter;

  beforeEach(() => {
    client = makeStubClient();
    adapter = makeAdapter(client);
  });

  describe('upsertNode', () => {
    it('calls client.run with a gremlin script containing coalesce', async () => {
      await adapter.upsertNode(makeNode());

      expect(client.run).toHaveBeenCalledOnce();
      const [gremlin, bindings] = vi.mocked(client.run).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(gremlin).toContain('coalesce');
      expect(gremlin).toContain('addV');
      expect(bindings['nodeId']).toBe('node-001');
      expect(bindings['workspaceId']).toBe('ws001');
    });

    it('sanitizes kind to a safe label', async () => {
      await adapter.upsertNode(makeNode({ kind: 'run' }));

      const [, bindings] = vi.mocked(client.run).mock.calls[0] as [string, Record<string, unknown>];
      expect(bindings['kindLabel']).toBe('run');
    });

    it('throws on HTTP error response', async () => {
      const errorClient = makeStubClient({ status: 500, body: {} });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.upsertNode(makeNode())).rejects.toThrow(/upsertNode/);
    });

    it('throws on Gremlin-level error code', async () => {
      const errorClient = makeStubClient({
        status: 200,
        body: { status: { code: 500, message: 'internal error' }, result: { data: null } },
      });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.upsertNode(makeNode())).rejects.toThrow(/500/);
    });
  });

  describe('upsertEdge', () => {
    it('calls client.run with a gremlin script containing coalesce and addE', async () => {
      await adapter.upsertEdge(makeEdge());

      expect(client.run).toHaveBeenCalledOnce();
      const [gremlin, bindings] = vi.mocked(client.run).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(gremlin).toContain('coalesce');
      expect(gremlin).toContain('addE');
      expect(bindings['edgeId']).toBe('edge-001');
      expect(bindings['fromNodeId']).toBe('node-001');
      expect(bindings['toNodeId']).toBe('node-002');
      expect(bindings['workspaceId']).toBe('ws001');
    });

    it('sanitizes relation to a safe label', async () => {
      await adapter.upsertEdge(makeEdge({ relation: 'DEPENDS ON' }));

      const [, bindings] = vi.mocked(client.run).mock.calls[0] as [string, Record<string, unknown>];
      expect(bindings['relLabel']).toBe('DEPENDS_ON');
    });

    it('throws on HTTP error', async () => {
      const errorClient = makeStubClient({ status: 400, body: {} });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.upsertEdge(makeEdge())).rejects.toThrow(/upsertEdge/);
    });
  });

  describe('traverse', () => {
    const baseParams: GraphTraversalParams = {
      rootNodeId: 'node-001',
      workspaceId: WorkspaceId('ws001'),
      maxDepth: 2,
      direction: 'outbound',
    };

    it('calls client.run with rootNodeId and workspaceId bindings', async () => {
      await adapter.traverse(baseParams);

      expect(client.run).toHaveBeenCalledOnce();
      const [, bindings] = vi.mocked(client.run).mock.calls[0] as [string, Record<string, unknown>];
      expect(bindings['rootNodeId']).toBe('node-001');
      expect(bindings['workspaceId']).toBe('ws001');
      expect(bindings['maxDepth']).toBe(2);
    });

    it('returns empty result when response data is empty', async () => {
      const result = await adapter.traverse(baseParams);

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('returns empty result when data length < 2', async () => {
      const sparseClient = makeStubClient({
        status: 200,
        body: { status: { code: 200 }, result: { data: [[]] } },
      });
      const sparseAdapter = makeAdapter(sparseClient);

      const result = await sparseAdapter.traverse(baseParams);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('maps nodes and edges from response data', async () => {
      const richClient = makeStubClient({
        status: 200,
        body: {
          status: { code: 200 },
          result: {
            data: [
              [{ nodeId: 'node-001', workspaceId: 'ws001', kind: 'run', label: 'Node 1' }],
              [
                {
                  edgeId: 'edge-001',
                  fromNodeId: 'node-001',
                  toNodeId: 'node-002',
                  relation: 'DEPENDS_ON',
                  workspaceId: 'ws001',
                },
              ],
            ],
          },
        },
      });
      const richAdapter = makeAdapter(richClient);

      const result = await richAdapter.traverse(baseParams);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.nodeId).toBe('node-001');
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.edgeId).toBe('edge-001');
    });

    it('throws on HTTP error', async () => {
      const errorClient = makeStubClient({ status: 500, body: {} });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.traverse(baseParams)).rejects.toThrow(/traverse/);
    });

    it('uses "in" direction for inbound traversal', async () => {
      await adapter.traverse({ ...baseParams, direction: 'inbound' });

      const [gremlin] = vi.mocked(client.run).mock.calls[0] as [string, Record<string, unknown>];
      expect(gremlin).toContain('in(');
    });

    it('uses "both" direction for both traversal', async () => {
      await adapter.traverse({ ...baseParams, direction: 'both' });

      const [gremlin] = vi.mocked(client.run).mock.calls[0] as [string, Record<string, unknown>];
      expect(gremlin).toContain('both(');
    });
  });

  describe('deleteWorkspaceData', () => {
    it('calls client.run with workspaceId and drop()', async () => {
      await adapter.deleteWorkspaceData(WorkspaceId('ws001'));

      expect(client.run).toHaveBeenCalledOnce();
      const [gremlin, bindings] = vi.mocked(client.run).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(gremlin).toContain('drop()');
      expect(bindings['workspaceId']).toBe('ws001');
    });

    it('throws on HTTP error', async () => {
      const errorClient = makeStubClient({ status: 500, body: {} });
      const errorAdapter = makeAdapter(errorClient);

      await expect(errorAdapter.deleteWorkspaceData(WorkspaceId('ws001'))).rejects.toThrow(
        /deleteWorkspaceData/,
      );
    });
  });

  describe('healthCheck', () => {
    it('returns ok=true when healthCheck succeeds with status < 400', async () => {
      const result = await adapter.healthCheck();

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns ok=false when healthCheck returns status >= 400', async () => {
      const errorClient: GremlinHttpClient = {
        run: vi.fn(),
        healthCheck: vi.fn().mockResolvedValue({ status: 503, body: {} }),
      };
      const errorAdapter = makeAdapter(errorClient);

      const result = await errorAdapter.healthCheck();
      expect(result.ok).toBe(false);
    });

    it('returns ok=false when healthCheck throws', async () => {
      const errorClient: GremlinHttpClient = {
        run: vi.fn(),
        healthCheck: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
      };
      const errorAdapter = makeAdapter(errorClient);

      const result = await errorAdapter.healthCheck();
      expect(result.ok).toBe(false);
    });
  });
});

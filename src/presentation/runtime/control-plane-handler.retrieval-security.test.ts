/**
 * bead-0780: Tests for retrieval security utilities and handler-level security
 * integration (input limits, response redaction, tenant isolation).
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';

import {
  RETRIEVAL_LIMITS,
  validateQueryLength,
  validateTopK,
  validateMaxDepth,
  redactHits,
  redactGraphNodes,
  redactGraphEdges,
  filterHitsToWorkspace,
  filterNodesToWorkspace,
  filterEdgesToWorkspace,
} from './control-plane-handler.retrieval-security.js';
import type { RetrievalHit } from '../../application/services/retrieval-query-router.js';
import type {
  SemanticIndexPort,
  SemanticIndexEntry,
  SemanticSearchResult,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  GraphTraversalParams,
  EmbeddingPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { WorkspaceId, RunId } from '../../domain/primitives/index.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import { handleRetrievalSearch, handleGraphQuery } from './control-plane-handler.retrieval.js';

// ---------------------------------------------------------------------------
// Unit tests: validateQueryLength
// ---------------------------------------------------------------------------

describe('validateQueryLength', () => {
  it('returns null for a query within the limit', () => {
    expect(validateQueryLength('hello world')).toBeNull();
  });

  it('returns null for a query exactly at the limit', () => {
    expect(validateQueryLength('a'.repeat(RETRIEVAL_LIMITS.maxQueryLength))).toBeNull();
  });

  it('returns an error message for a query exceeding the limit', () => {
    const error = validateQueryLength('a'.repeat(RETRIEVAL_LIMITS.maxQueryLength + 1));
    expect(error).not.toBeNull();
    expect(error).toContain(String(RETRIEVAL_LIMITS.maxQueryLength));
  });
});

// ---------------------------------------------------------------------------
// Unit tests: validateTopK
// ---------------------------------------------------------------------------

describe('validateTopK', () => {
  it('returns null for a topK within the limit', () => {
    expect(validateTopK(10)).toBeNull();
    expect(validateTopK(RETRIEVAL_LIMITS.maxTopK)).toBeNull();
  });

  it('returns an error message when topK exceeds the limit', () => {
    const error = validateTopK(RETRIEVAL_LIMITS.maxTopK + 1);
    expect(error).not.toBeNull();
    expect(error).toContain(String(RETRIEVAL_LIMITS.maxTopK));
  });
});

// ---------------------------------------------------------------------------
// Unit tests: validateMaxDepth
// ---------------------------------------------------------------------------

describe('validateMaxDepth', () => {
  it('returns null for a maxDepth within the limit', () => {
    expect(validateMaxDepth(3)).toBeNull();
    expect(validateMaxDepth(RETRIEVAL_LIMITS.maxDepth)).toBeNull();
  });

  it('returns an error message when maxDepth exceeds the limit', () => {
    const error = validateMaxDepth(RETRIEVAL_LIMITS.maxDepth + 1);
    expect(error).not.toBeNull();
    expect(error).toContain(String(RETRIEVAL_LIMITS.maxDepth));
  });
});

// ---------------------------------------------------------------------------
// Unit tests: redactHits
// ---------------------------------------------------------------------------

describe('redactHits', () => {
  const wsId = 'ws-test' as WorkspaceId;
  const runId = 'run-1' as RunId;

  it('redacts Bearer tokens from hit text', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'art-1',
        // cspell:disable-next-line
        text: 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.sig',
        metadata: {},
        provenance: { workspaceId: wsId, runId: runId as unknown as string },
      },
    ];
    const result = redactHits(hits);
    expect(result[0]!.text).toContain('[REDACTED]');
    expect(result[0]!.text).not.toContain('eyJhbGciOiJSUzI1NiJ9');
  });

  it('redacts sensitive keys from hit metadata', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'art-2',
        metadata: {
          token: 'sk-secret-value',
          password: 'hunter2',
          category: 'Approval',
        },
        provenance: { workspaceId: wsId, runId: runId as unknown as string },
      },
    ];
    const result = redactHits(hits);
    expect(result[0]!.metadata['token']).toBe('[REDACTED]');
    expect(result[0]!.metadata['password']).toBe('[REDACTED]');
    expect(result[0]!.metadata['category']).toBe('Approval');
  });

  it('preserves hits without secrets unchanged', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'art-3',
        text: 'Deployment approved for service v2.4.1',
        metadata: { runId: 'run-1', category: 'Action' },
        provenance: { workspaceId: wsId, runId: runId as unknown as string },
      },
    ];
    const result = redactHits(hits);
    expect(result[0]!.text).toBe('Deployment approved for service v2.4.1');
    expect(result[0]!.metadata['runId']).toBe('run-1');
  });

  it('handles hits without a text field', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'art-4',
        metadata: { category: 'Plan' },
        provenance: { workspaceId: wsId, runId: runId as unknown as string },
      },
    ];
    const result = redactHits(hits);
    expect(result[0]!.text).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unit tests: redactGraphNodes / redactGraphEdges
// ---------------------------------------------------------------------------

describe('redactGraphNodes', () => {
  const wsId = 'ws-1' as WorkspaceId;

  it('redacts sensitive properties on graph nodes', () => {
    const nodes: GraphNodeV1[] = [
      {
        nodeId: 'n1',
        workspaceId: wsId,
        kind: 'run',
        label: 'Run 1',
        properties: { token: 'secret-token', status: 'active' },
      },
    ];
    const result = redactGraphNodes(nodes);
    expect(result[0]!.properties['token']).toBe('[REDACTED]');
    expect(result[0]!.properties['status']).toBe('active');
  });

  it('leaves safe node properties unchanged', () => {
    const nodes: GraphNodeV1[] = [
      {
        nodeId: 'n2',
        workspaceId: wsId,
        kind: 'approval',
        label: 'Approval',
        properties: { approver: 'alice', decision: 'approved' },
      },
    ];
    const result = redactGraphNodes(nodes);
    expect(result[0]!.properties).toEqual({ approver: 'alice', decision: 'approved' });
  });
});

describe('redactGraphEdges', () => {
  const wsId = 'ws-1' as WorkspaceId;

  it('redacts sensitive properties on graph edges', () => {
    const edges: GraphEdgeV1[] = [
      {
        edgeId: 'e1',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        relation: 'TRIGGERED_BY',
        workspaceId: wsId,
        // api_key key matches the sensitive-key pattern → value becomes '[REDACTED]'
        properties: { api_key: 'secret-key', weight: 1 },
      },
    ];
    const result = redactGraphEdges(edges);
    expect(result[0]!.properties!['api_key']).toBe('[REDACTED]');
    expect(result[0]!.properties!['weight']).toBe(1);
  });

  it('handles edges without properties', () => {
    const edges: GraphEdgeV1[] = [
      {
        edgeId: 'e2',
        fromNodeId: 'n1',
        toNodeId: 'n2',
        relation: 'PRODUCED_EVIDENCE',
        workspaceId: wsId,
      },
    ];
    const result = redactGraphEdges(edges);
    expect(result[0]!.properties).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unit tests: tenant isolation filters
// ---------------------------------------------------------------------------

describe('filterHitsToWorkspace', () => {
  const wsA = 'ws-a' as WorkspaceId;
  const wsB = 'ws-b' as WorkspaceId;

  it('keeps only hits belonging to the requested workspace', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'a1',
        metadata: {},
        provenance: { workspaceId: wsA, runId: 'run-1' },
      },
      {
        artifactId: 'b1',
        metadata: {},
        provenance: { workspaceId: wsB, runId: 'run-2' },
      },
    ];
    const result = filterHitsToWorkspace(hits, wsA);
    expect(result).toHaveLength(1);
    expect(result[0]!.artifactId).toBe('a1');
  });

  it('returns empty array when no hits match the workspace', () => {
    const hits: RetrievalHit[] = [
      {
        artifactId: 'b1',
        metadata: {},
        provenance: { workspaceId: wsB, runId: 'run-1' },
      },
    ];
    expect(filterHitsToWorkspace(hits, wsA)).toHaveLength(0);
  });
});

describe('filterNodesToWorkspace / filterEdgesToWorkspace', () => {
  const wsA = 'ws-a' as WorkspaceId;
  const wsB = 'ws-b' as WorkspaceId;

  it('filters out nodes from other workspaces', () => {
    const nodes: GraphNodeV1[] = [
      { nodeId: 'na', workspaceId: wsA, kind: 'run', label: 'A', properties: {} },
      { nodeId: 'nb', workspaceId: wsB, kind: 'run', label: 'B', properties: {} },
    ];
    const result = filterNodesToWorkspace(nodes, wsA);
    expect(result).toHaveLength(1);
    expect(result[0]!.nodeId).toBe('na');
  });

  it('filters out edges from other workspaces', () => {
    const edges: GraphEdgeV1[] = [
      { edgeId: 'ea', fromNodeId: 'n1', toNodeId: 'n2', relation: 'R', workspaceId: wsA },
      { edgeId: 'eb', fromNodeId: 'n3', toNodeId: 'n4', relation: 'R', workspaceId: wsB },
    ];
    const result = filterEdgesToWorkspace(edges, wsA);
    expect(result).toHaveLength(1);
    expect(result[0]!.edgeId).toBe('ea');
  });
});

// ---------------------------------------------------------------------------
// Stub ports and HTTP helpers (reused from retrieval handler tests)
// ---------------------------------------------------------------------------

class StubSemanticIndex implements SemanticIndexPort {
  searchResults: SemanticSearchResult[] = [];

  async upsert(_entry: SemanticIndexEntry) {}
  async search() {
    return this.searchResults;
  }
  async delete(_artifactId: string, _wsId: WorkspaceId) {}
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubKnowledgeGraph implements KnowledgeGraphPort {
  traverseResult: { nodes: GraphNodeV1[]; edges: GraphEdgeV1[] } = { nodes: [], edges: [] };

  async upsertNode(_node: GraphNodeV1) {}
  async upsertEdge(_edge: GraphEdgeV1) {}
  async traverse(_params: GraphTraversalParams) {
    return this.traverseResult;
  }
  async deleteWorkspaceData(_workspaceId: WorkspaceId) {}
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  async embed(_request: { text: string }) {
    return { vector: [0.1, 0.2, 0.3], model: 'stub-v1', dimensions: 3 };
  }
  async embedBatch(requests: readonly { text: string }[]) {
    return Promise.all(requests.map((r) => this.embed(r)));
  }
  async healthCheck() {
    return { ok: true, model: 'stub-v1' };
  }
}

function makeAuthDeps(
  wsId = 'ws-test',
): Pick<ControlPlaneDeps, 'authentication' | 'authorization'> {
  return {
    authentication: {
      authenticateBearerToken: async () => ({
        ok: true as const,
        value: { tenantId: wsId, userId: 'user-1', roles: ['admin'] },
      }),
    } as unknown as ControlPlaneDeps['authentication'],
    authorization: {
      isAllowed: async () => true,
    } as unknown as ControlPlaneDeps['authorization'],
  };
}

function makeReqRes(body?: unknown): {
  req: IncomingMessage;
  res: ServerResponse;
  responseBody: () => string;
  statusCode: () => number;
} {
  const chunks: Buffer[] = [];
  let statusCode = 0;

  const req = Object.assign(Object.create(IncomingMessage.prototype), {
    method: 'POST',
    url: '/',
    headers: { authorization: 'Bearer dev-token' },
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    },
  }) as IncomingMessage;

  const res = Object.assign(Object.create(ServerResponse.prototype), {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(Buffer.from(chunk));
    },
  }) as ServerResponse;

  Object.defineProperty(res, 'statusCode', {
    get() {
      return statusCode;
    },
    set(v) {
      statusCode = v;
    },
    configurable: true,
  });

  return {
    req,
    res,
    responseBody: () => Buffer.concat(chunks).toString('utf8'),
    statusCode: () => statusCode,
  };
}

// ---------------------------------------------------------------------------
// Handler integration tests: input limits
// ---------------------------------------------------------------------------

describe('handleRetrievalSearch – input limits', () => {
  const wsId = 'ws-limit';

  function makeArgs(body: unknown) {
    const { req, res, responseBody, statusCode } = makeReqRes(body);
    const authDeps = makeAuthDeps(wsId);
    const semantic = new StubSemanticIndex();
    const graph = new StubKnowledgeGraph();
    const embedding = new StubEmbedding();
    return {
      req,
      res,
      responseBody,
      statusCode,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsId}/retrieval/search`,
      workspaceId: wsId,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        semanticIndexPort: semantic,
        knowledgeGraphPort: graph,
        embeddingPort: embedding,
      } as unknown as ControlPlaneDeps,
    };
  }

  it('returns 400 when query exceeds maxQueryLength', async () => {
    const body = {
      strategy: 'semantic',
      semantic: { query: 'x'.repeat(RETRIEVAL_LIMITS.maxQueryLength + 1), topK: 5 },
    };
    const args = makeArgs(body);
    await handleRetrievalSearch(args);
    expect(args.statusCode()).toBe(400);
    const detail = JSON.parse(args.responseBody()).detail as string;
    expect(detail).toContain(String(RETRIEVAL_LIMITS.maxQueryLength));
  });

  it('returns 400 when topK exceeds maxTopK', async () => {
    const body = {
      strategy: 'semantic',
      semantic: { query: 'hello', topK: RETRIEVAL_LIMITS.maxTopK + 1 },
    };
    const args = makeArgs(body);
    await handleRetrievalSearch(args);
    expect(args.statusCode()).toBe(400);
    const detail = JSON.parse(args.responseBody()).detail as string;
    expect(detail).toContain(String(RETRIEVAL_LIMITS.maxTopK));
  });
});

describe('handleGraphQuery – input limits', () => {
  const wsId = 'ws-limit-graph';

  function makeGraphArgs(body: unknown) {
    const { req, res, responseBody, statusCode } = makeReqRes(body);
    const authDeps = makeAuthDeps(wsId);
    const graph = new StubKnowledgeGraph();
    return {
      req,
      res,
      responseBody,
      statusCode,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsId}/graph/query`,
      workspaceId: wsId,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        knowledgeGraphPort: graph,
      } as unknown as ControlPlaneDeps,
    };
  }

  it('returns 400 when maxDepth exceeds the limit', async () => {
    const body = {
      rootNodeId: 'node-1',
      direction: 'outbound',
      maxDepth: RETRIEVAL_LIMITS.maxDepth + 1,
    };
    const args = makeGraphArgs(body);
    await handleGraphQuery(args);
    expect(args.statusCode()).toBe(400);
    const detail = JSON.parse(args.responseBody()).detail as string;
    expect(detail).toContain(String(RETRIEVAL_LIMITS.maxDepth));
  });
});

// ---------------------------------------------------------------------------
// Handler integration tests: response redaction
// ---------------------------------------------------------------------------

describe('handleRetrievalSearch – response redaction', () => {
  const wsId = 'ws-redact';

  it('redacts Bearer tokens in search result text before returning to client', async () => {
    const semantic = new StubSemanticIndex();
    // cspell:disable-next-line
    semantic.searchResults = [
      {
        artifactId: 'art-1',
        score: 0.9,
        // cspell:disable-next-line
        text: 'System token: Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig',
        metadata: { category: 'Action' },
        provenance: { workspaceId: wsId as WorkspaceId, runId: 'run-1' as RunId },
      },
    ];
    const graph = new StubKnowledgeGraph();
    const embedding = new StubEmbedding();
    const authDeps = makeAuthDeps(wsId);

    const body = { strategy: 'semantic', semantic: { query: 'system token', topK: 5 } };
    const { req, res, responseBody, statusCode } = makeReqRes(body);

    await handleRetrievalSearch({
      req,
      res,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsId}/retrieval/search`,
      workspaceId: wsId,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        semanticIndexPort: semantic,
        knowledgeGraphPort: graph,
        embeddingPort: embedding,
      } as unknown as ControlPlaneDeps,
    });

    expect(statusCode()).toBe(200);
    const body2 = JSON.parse(responseBody()) as { hits: { text: string }[] };
    expect(body2.hits[0]!.text).toContain('[REDACTED]');
    expect(body2.hits[0]!.text).not.toContain('eyJhbGciOiJSUzI1NiJ9');
  });

  it('redacts sensitive metadata keys in search results', async () => {
    const semantic = new StubSemanticIndex();
    semantic.searchResults = [
      {
        artifactId: 'art-2',
        score: 0.8,
        text: 'Safe text',
        metadata: { api_key: 'sk-prod-secret', category: 'Plan' },
        provenance: { workspaceId: wsId as WorkspaceId, runId: 'run-1' as RunId },
      },
    ];
    const graph = new StubKnowledgeGraph();
    const embedding = new StubEmbedding();
    const authDeps = makeAuthDeps(wsId);

    const body = { strategy: 'semantic', semantic: { query: 'deployment', topK: 5 } };
    const { req, res, responseBody, statusCode } = makeReqRes(body);

    await handleRetrievalSearch({
      req,
      res,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsId}/retrieval/search`,
      workspaceId: wsId,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        semanticIndexPort: semantic,
        knowledgeGraphPort: graph,
        embeddingPort: embedding,
      } as unknown as ControlPlaneDeps,
    });

    expect(statusCode()).toBe(200);
    const body2 = JSON.parse(responseBody()) as {
      hits: { metadata: Record<string, unknown> }[];
    };
    // api_key key matches the sensitive-key pattern → redactMetadata replaces value with '[REDACTED]'
    expect(body2.hits[0]!.metadata['api_key']).toBe('[REDACTED]');
    expect(body2.hits[0]!.metadata['category']).toBe('Plan');
  });
});

// ---------------------------------------------------------------------------
// Handler integration tests: tenant isolation (defense-in-depth)
// ---------------------------------------------------------------------------

describe('handleRetrievalSearch – tenant isolation', () => {
  it('removes results that belong to a different workspace', async () => {
    const wsA = 'ws-a';
    const wsB = 'ws-b';

    const semantic = new StubSemanticIndex();
    semantic.searchResults = [
      {
        artifactId: 'art-a',
        score: 0.9,
        text: 'Workspace A result',
        metadata: {},
        provenance: { workspaceId: wsA as WorkspaceId, runId: 'run-a' as RunId },
      },
      {
        artifactId: 'art-b',
        score: 0.8,
        text: 'Workspace B leak',
        metadata: {},
        provenance: { workspaceId: wsB as WorkspaceId, runId: 'run-b' as RunId },
      },
    ];
    const graph = new StubKnowledgeGraph();
    const embedding = new StubEmbedding();
    const authDeps = makeAuthDeps(wsA);

    const body = { strategy: 'semantic', semantic: { query: 'result', topK: 10 } };
    const { req, res, responseBody, statusCode } = makeReqRes(body);

    await handleRetrievalSearch({
      req,
      res,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsA}/retrieval/search`,
      workspaceId: wsA,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        semanticIndexPort: semantic,
        knowledgeGraphPort: graph,
        embeddingPort: embedding,
      } as unknown as ControlPlaneDeps,
    });

    expect(statusCode()).toBe(200);
    const parsed = JSON.parse(responseBody()) as { hits: { artifactId: string }[] };
    expect(parsed.hits).toHaveLength(1);
    expect(parsed.hits[0]!.artifactId).toBe('art-a');
  });
});

describe('handleGraphQuery – tenant isolation', () => {
  it('removes graph nodes that belong to a different workspace', async () => {
    const wsA = 'ws-graph-a';
    const wsB = 'ws-graph-b';

    const graph = new StubKnowledgeGraph();
    graph.traverseResult = {
      nodes: [
        { nodeId: 'na', workspaceId: wsA as WorkspaceId, kind: 'run', label: 'A', properties: {} },
        { nodeId: 'nb', workspaceId: wsB as WorkspaceId, kind: 'run', label: 'B', properties: {} },
      ],
      edges: [
        {
          edgeId: 'ea',
          fromNodeId: 'na',
          toNodeId: 'nb',
          relation: 'R',
          workspaceId: wsA as WorkspaceId,
        },
        {
          edgeId: 'eb',
          fromNodeId: 'nb',
          toNodeId: 'na',
          relation: 'R',
          workspaceId: wsB as WorkspaceId,
        },
      ],
    };
    const authDeps = makeAuthDeps(wsA);

    const body = { rootNodeId: 'na', direction: 'outbound', maxDepth: 2 };
    const { req, res, responseBody, statusCode } = makeReqRes(body);

    await handleGraphQuery({
      req,
      res,
      correlationId: 'corr',
      pathname: `/v1/workspaces/${wsA}/graph/query`,
      workspaceId: wsA,
      traceContext: { traceparent: '00-abc-def-01' },
      deps: {
        ...authDeps,
        knowledgeGraphPort: graph,
      } as unknown as ControlPlaneDeps,
    });

    expect(statusCode()).toBe(200);
    const parsed = JSON.parse(responseBody()) as {
      nodes: { nodeId: string }[];
      edges: { edgeId: string }[];
    };
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]!.nodeId).toBe('na');
    expect(parsed.edges).toHaveLength(1);
    expect(parsed.edges[0]!.edgeId).toBe('ea');
  });
});

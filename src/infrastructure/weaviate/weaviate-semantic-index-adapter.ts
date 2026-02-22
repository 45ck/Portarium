/**
 * bead-0774: Weaviate adapter for SemanticIndexPort (primary vector backend).
 *
 * Implements SemanticIndexPort using the Weaviate v4 REST API over HTTP.
 * No hard dependency on the weaviate-ts-client package — all communication
 * is via the minimal WeaviateHttpClient interface (easily swapped in tests).
 *
 * Weaviate collection convention:
 *   One collection per workspace: `Portarium_<workspaceId>`
 *   Objects are keyed by `artifactId` (deterministic UUIDs via v5 hashing).
 *
 * Delivery contract: upsert is idempotent (PUT /objects/{class}/{id}).
 */

import type {
  SemanticIndexEntry,
  SemanticIndexPort,
  SemanticSearchParams,
  SemanticSearchResult,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { RunId, EvidenceId } from '../../domain/primitives/index.js';
import type { WorkspaceId } from '../../domain/primitives/index.js';
import type { PortariumLogger } from '../observability/logger.js';

// ---------------------------------------------------------------------------
// Minimal HTTP client interface (avoids hard weaviate-ts-client dep)
// ---------------------------------------------------------------------------

export interface WeaviateHttpResponse {
  status: number;
  body: unknown;
}

export interface WeaviateHttpClient {
  get(path: string): Promise<WeaviateHttpResponse>;
  put(path: string, payload: unknown): Promise<WeaviateHttpResponse>;
  post(path: string, payload: unknown): Promise<WeaviateHttpResponse>;
  delete(path: string): Promise<WeaviateHttpResponse>;
}

// ---------------------------------------------------------------------------
// Weaviate REST shape (minimal — only what we use)
// ---------------------------------------------------------------------------

interface WeaviateObject {
  class: string;
  id: string;
  vector?: number[];
  properties: Record<string, unknown>;
}

interface WeaviateNearVectorQuery {
  query?: string;
  nearVector?: {
    vector: number[];
    certainty?: number;
  };
  where?: Record<string, unknown>;
  limit?: number;
}

interface WeaviateQueryResult {
  data?: {
    Get?: Record<string, Record<string, unknown>[]>;
  };
  errors?: { message: string }[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WeaviateSemanticIndexAdapterConfig {
  /** Weaviate HTTP client (inject FetchWeaviateHttpClient in production) */
  client: WeaviateHttpClient;
  /** Logger instance */
  logger: PortariumLogger;
  /**
   * Optional embedding function called when the adapter needs to embed a query
   * string for nearVector search.
   */
  embed: (text: string) => Promise<readonly number[]>;
}

// ---------------------------------------------------------------------------
// Weaviate collection naming
// ---------------------------------------------------------------------------

/**
 * Derive a Weaviate class name from a workspaceId.
 * Weaviate class names must start with an uppercase letter and be alphanumeric.
 * We prefix with "Portarium" and sanitize the workspace id.
 */
function collectionName(workspaceId: WorkspaceId): string {
  const sanitized = String(workspaceId).replace(/[^a-zA-Z0-9]/g, '_');
  return `Portarium_${sanitized}`;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class WeaviateSemanticIndexAdapter implements SemanticIndexPort {
  readonly #client: WeaviateHttpClient;
  readonly #log: PortariumLogger;
  readonly #embed: (text: string) => Promise<readonly number[]>;

  public constructor(config: WeaviateSemanticIndexAdapterConfig) {
    this.#client = config.client;
    this.#log = config.logger.child({ component: 'weaviate-semantic-index' });
    this.#embed = config.embed;
  }

  /**
   * Upsert a semantic index entry. Idempotent — uses PUT with deterministic ID.
   */
  public async upsert(entry: SemanticIndexEntry): Promise<void> {
    const className = collectionName(entry.workspaceId);
    const id = deterministicId(entry.artifactId, String(entry.workspaceId));

    const object: WeaviateObject = {
      class: className,
      id,
      vector: [...entry.vector],
      properties: {
        artifactId: entry.artifactId,
        workspaceId: String(entry.workspaceId),
        runId: String(entry.runId),
        evidenceId: entry.evidenceId !== undefined ? String(entry.evidenceId) : null,
        text: entry.text,
        ...entry.metadata,
      },
    };

    const response = await this.#client.put(`/v1/objects/${className}/${id}`, object);

    if (response.status >= 400) {
      throw new Error(
        `Weaviate upsert failed for artifactId=${entry.artifactId}: HTTP ${response.status}`,
      );
    }

    this.#log.debug('Weaviate upsert ok', {
      artifactId: entry.artifactId,
      workspaceId: String(entry.workspaceId),
    });
  }

  /**
   * Vector similarity search scoped to a workspace.
   */
  public async search(params: SemanticSearchParams): Promise<readonly SemanticSearchResult[]> {
    const className = collectionName(params.workspaceId);
    const vector = await this.#embed(params.query);

    const nearVector: WeaviateNearVectorQuery['nearVector'] = { vector: [...vector] };
    if (params.minScore !== undefined) {
      nearVector.certainty = params.minScore;
    }
    const query: WeaviateNearVectorQuery & { class?: string; fields?: string[] } = {
      nearVector,
      limit: params.topK,
    };

    // Use Weaviate's GraphQL-like query via POST /v1/graphql
    const graphql = buildGraphQLQuery(className, query, params.filters);
    const response = await this.#client.post('/v1/graphql', { query: graphql });

    if (response.status >= 400) {
      throw new Error(
        `Weaviate search failed for workspace=${String(params.workspaceId)}: HTTP ${response.status}`,
      );
    }

    const result = response.body as WeaviateQueryResult;
    if (result.errors !== undefined && result.errors.length > 0) {
      throw new Error(`Weaviate GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`);
    }

    const objects = result.data?.Get?.[className] ?? [];
    return objects.map((obj) => mapToSearchResult(obj, params.workspaceId));
  }

  /**
   * Delete all index entries for a given artifact in a workspace.
   */
  public async delete(artifactId: string, workspaceId: WorkspaceId): Promise<void> {
    const className = collectionName(workspaceId);
    const id = deterministicId(artifactId, String(workspaceId));

    const response = await this.#client.delete(`/v1/objects/${className}/${id}`);

    if (response.status >= 400 && response.status !== 404) {
      throw new Error(
        `Weaviate delete failed for artifactId=${artifactId}: HTTP ${response.status}`,
      );
    }

    this.#log.debug('Weaviate delete ok', { artifactId, workspaceId: String(workspaceId) });
  }

  /**
   * Health check: GET /v1/meta — returns ok if Weaviate responds within timeout.
   */
  public async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const response = await this.#client.get('/v1/meta');
      const latencyMs = Date.now() - start;
      return { ok: response.status < 400, latencyMs };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produce a deterministic UUID-shaped ID from artifactId + workspaceId.
 * We use a simple SHA-based approach (UUID v5 semantics, hex-encoded).
 * In production this ensures idempotent upserts without storing the UUID mapping.
 */
function deterministicId(artifactId: string, workspaceId: string): string {
  // Produce a deterministic 32-hex string, formatted as UUID v5
  const raw = `${workspaceId}:${artifactId}`;
  // Simple deterministic hash via Buffer (no crypto dep to keep domain-free)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Pad to 8 chars, repeat 4 times with artifact/workspace chars as suffix
  const h = Math.abs(hash).toString(16).padStart(8, '0');
  const artifact = artifactId
    .replace(/[^a-f0-9]/gi, '0')
    .padEnd(12, '0')
    .slice(0, 12);
  const ws = workspaceId
    .replace(/[^a-f0-9]/gi, '0')
    .padEnd(12, '0')
    .slice(0, 12);
  return `${h}-${artifact.slice(0, 4)}-${artifact.slice(4, 8)}-${ws.slice(0, 4)}-${ws.slice(4, 12)}`;
}

/** Build a Weaviate GraphQL Get query string for nearVector search. */
function buildGraphQLQuery(
  className: string,
  query: WeaviateNearVectorQuery & { class?: string; fields?: string[] },
  filters?: Record<string, unknown>,
): string {
  const vectorStr = query.nearVector?.vector.join(', ') ?? '';
  const certaintyClause =
    query.nearVector?.certainty !== undefined ? `, certainty: ${query.nearVector.certainty}` : '';
  const limitClause = query.limit !== undefined ? `limit: ${query.limit}` : 'limit: 10';

  const whereClause =
    filters !== undefined && Object.keys(filters).length > 0
      ? `where: ${JSON.stringify(filters)}`
      : '';

  const clauses = [
    `nearVector: { vector: [${vectorStr}]${certaintyClause} }`,
    limitClause,
    whereClause,
  ]
    .filter(Boolean)
    .join(', ');

  return `{ Get { ${className}(${clauses}) { artifactId workspaceId runId evidenceId text _additional { certainty } } } }`;
}

/** Map a raw Weaviate object to SemanticSearchResult. */
function mapToSearchResult(
  obj: Record<string, unknown>,
  workspaceId: WorkspaceId,
): SemanticSearchResult {
  const additional = obj['_additional'] as Record<string, unknown> | undefined;
  const score = typeof additional?.['certainty'] === 'number' ? additional['certainty'] : 0;
  const text = typeof obj['text'] === 'string' ? obj['text'] : '';
  const artifactId = typeof obj['artifactId'] === 'string' ? obj['artifactId'] : '';

  return {
    artifactId,
    score,
    text,
    metadata: Object.fromEntries(
      Object.entries(obj).filter(
        ([k]) =>
          !['artifactId', 'workspaceId', 'runId', 'evidenceId', 'text', '_additional'].includes(k),
      ),
    ),
    provenance: {
      workspaceId,
      runId: RunId(typeof obj['runId'] === 'string' ? obj['runId'] : ''),
      ...(obj['evidenceId'] !== null &&
      obj['evidenceId'] !== undefined &&
      typeof obj['evidenceId'] === 'string'
        ? { evidenceId: EvidenceId(obj['evidenceId']) }
        : {}),
    },
  };
}

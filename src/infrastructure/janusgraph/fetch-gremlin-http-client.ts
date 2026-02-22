/**
 * bead-0777: Production Gremlin Server HTTP client using Node.js fetch.
 *
 * Sends Gremlin scripts to a Gremlin Server via the HTTP REST API:
 *   POST /gremlin
 *   Content-Type: application/json
 *   Body: { "gremlin": "<script>", "bindings": { ... } }
 */

import type {
  GremlinHttpClient,
  GremlinHttpResponse,
} from './janusgraph-knowledge-graph-adapter.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface FetchGremlinHttpClientConfig {
  /** Base URL of the Gremlin Server, e.g. http://localhost:8182 */
  baseUrl: string;
  /**
   * Optional request timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class FetchGremlinHttpClient implements GremlinHttpClient {
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  public constructor(config: FetchGremlinHttpClientConfig) {
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#timeoutMs = config.timeoutMs ?? 10_000;
  }

  public async run(
    gremlin: string,
    bindings: Record<string, unknown>,
  ): Promise<GremlinHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(`${this.#baseUrl}/gremlin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gremlin, bindings }),
        signal: controller.signal,
      });

      const body: unknown = await response.json().catch(() => ({}));
      return { status: response.status, body };
    } finally {
      clearTimeout(timer);
    }
  }

  public async healthCheck(): Promise<GremlinHttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(`${this.#baseUrl}/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => ({}));
      return { status: response.status, body };
    } finally {
      clearTimeout(timer);
    }
  }
}

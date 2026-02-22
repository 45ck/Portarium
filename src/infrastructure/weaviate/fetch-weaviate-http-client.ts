/**
 * bead-0774: Fetch-based Weaviate HTTP client.
 *
 * Production implementation of WeaviateHttpClient using the Node.js
 * built-in fetch API. No third-party HTTP library required.
 */

import type {
  WeaviateHttpClient,
  WeaviateHttpResponse,
} from './weaviate-semantic-index-adapter.js';

export interface FetchWeaviateHttpClientConfig {
  /** Weaviate base URL, e.g. 'http://weaviate:8080' */
  baseUrl: string;
  /** Optional API key for Weaviate authentication */
  apiKey?: string;
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number;
}

export class FetchWeaviateHttpClient implements WeaviateHttpClient {
  readonly #baseUrl: string;
  readonly #headers: Record<string, string>;
  readonly #timeoutMs: number;

  public constructor(config: FetchWeaviateHttpClientConfig) {
    this.#baseUrl = config.baseUrl.replace(/\/$/, '');
    this.#timeoutMs = config.timeoutMs ?? 10_000;
    this.#headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (config.apiKey !== undefined) {
      this.#headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  public async get(path: string): Promise<WeaviateHttpResponse> {
    return this.#request('GET', path, undefined);
  }

  public async put(path: string, payload: unknown): Promise<WeaviateHttpResponse> {
    return this.#request('PUT', path, payload);
  }

  public async post(path: string, payload: unknown): Promise<WeaviateHttpResponse> {
    return this.#request('POST', path, payload);
  }

  public async delete(path: string): Promise<WeaviateHttpResponse> {
    return this.#request('DELETE', path, undefined);
  }

  async #request(method: string, path: string, payload: unknown): Promise<WeaviateHttpResponse> {
    const url = `${this.#baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers: this.#headers,
        signal: controller.signal,
      };
      if (payload !== undefined) {
        init.body = JSON.stringify(payload);
      }
      const response = await fetch(url, init);

      let body: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return { status: response.status, body };
    } finally {
      clearTimeout(timer);
    }
  }
}

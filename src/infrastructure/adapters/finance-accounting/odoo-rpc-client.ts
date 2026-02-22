/**
 * Lightweight Odoo JSON-RPC 2.0 client used by the OdooFinanceAccountingAdapter.
 * Handles authentication, search_read, create, and arbitrary call_kw calls.
 * Bead: bead-0422
 */

type FetchFn = typeof fetch;

export interface OdooRpcConfig {
  baseUrl: string;
  database: string;
  username: string;
  apiKey: string;
  timeoutMs?: number;
}

export class OdooRpcClient {
  readonly #config: OdooRpcConfig;
  readonly #fetch: FetchFn;
  #uid: number | null = null;

  constructor(config: OdooRpcConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
  }

  async ensureAuthenticated(): Promise<number> {
    if (this.#uid !== null) return this.#uid;
    const res = await this.rpc<{ uid: number }>('/web/session/authenticate', {
      db: this.#config.database,
      login: this.#config.username,
      password: this.#config.apiKey,
    });
    this.#uid = res.uid;
    return this.#uid;
  }

  async searchRead<T>(
    model: string,
    domain: unknown[],
    fields: string[],
    options: { limit?: number; offset?: number } = {},
  ): Promise<T[]> {
    await this.ensureAuthenticated();
    const res = await this.callKw(model, 'search_read', [domain], {
      fields,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });
    return res as T[];
  }

  async create(model: string, values: Record<string, unknown>): Promise<number> {
    await this.ensureAuthenticated();
    const res = await this.callKw(model, 'create', [values], {});
    return res as number;
  }

  async callKw(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<unknown> {
    const uid = this.#uid ?? (await this.ensureAuthenticated());
    return this.rpc<unknown>('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs: {
        context: { lang: 'en_US', tz: 'UTC', uid },
        ...kwargs,
      },
    });
  }

  async rpc<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = `${this.#config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 15_000);

    try {
      const res = await this.#fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // API key auth (Odoo 16+): X-API-Key header.
          ...(path !== '/web/session/authenticate' ? { 'X-API-Key': this.#config.apiKey } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Odoo (${path}): ${text}`);
      }

      const json = (await res.json()) as {
        result?: T;
        error?: { message: string; data?: { message: string } };
      };
      if (json.error) {
        throw new Error(json.error.data?.message ?? json.error.message);
      }
      return json.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

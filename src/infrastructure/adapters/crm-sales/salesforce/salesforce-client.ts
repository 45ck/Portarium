import { mapSalesforceHttpError } from './salesforce-error-handler.js';

export type SalesforceClientConfig = Readonly<{
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  apiVersion?: string;
}>;

type TokenResponse = Readonly<{
  access_token: string;
  instance_url: string;
  token_type: string;
}>;

type SalesforceQueryResponse<T> = Readonly<{
  totalSize: number;
  done: boolean;
  records: readonly T[];
}>;

type SalesforceCreateResponse = Readonly<{
  id: string;
  success: boolean;
  errors: readonly unknown[];
}>;

type FetchFn = typeof globalThis.fetch;

export type SalesforceClientDeps = Readonly<{
  fetch?: FetchFn;
}>;

export class SalesforceClient {
  readonly #config: SalesforceClientConfig;
  readonly #apiVersion: string;
  readonly #fetch: FetchFn;
  #accessToken: string | null = null;

  public constructor(config: SalesforceClientConfig, deps?: SalesforceClientDeps) {
    this.#config = config;
    this.#apiVersion = config.apiVersion ?? 'v58.0';
    this.#fetch = deps?.fetch ?? globalThis.fetch;
  }

  async #authenticate(): Promise<string> {
    if (this.#accessToken) return this.#accessToken;

    const tokenUrl = `${this.#config.instanceUrl}/services/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.#config.clientId,
      client_secret: this.#config.clientSecret,
    });

    const response = await this.#fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new SalesforceAuthError(
        `OAuth2 token request failed: ${response.status} ${JSON.stringify(errorBody)}`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    this.#accessToken = data.access_token;
    return this.#accessToken;
  }

  #baseUrl(): string {
    return `${this.#config.instanceUrl}/services/data/${this.#apiVersion}`;
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.#authenticate();
    const url = `${this.#baseUrl()}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await this.#fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => []);

      // On 401, clear token and retry once
      if (response.status === 401 && this.#accessToken !== null) {
        this.#accessToken = null;
        return this.#requestNoRetry<T>(method, path, body);
      }

      const mapped = mapSalesforceHttpError(response.status, errorBody);
      throw new SalesforceApiError(mapped.message, mapped.error, response.status);
    }

    // 204 No Content (e.g. PATCH success)
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  async #requestNoRetry<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.#authenticate();
    const url = `${this.#baseUrl()}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await this.#fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => []);
      const mapped = mapSalesforceHttpError(response.status, errorBody);
      throw new SalesforceApiError(mapped.message, mapped.error, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  public async query<T>(soql: string): Promise<readonly T[]> {
    const encoded = encodeURIComponent(soql);
    const result = await this.#request<SalesforceQueryResponse<T>>('GET', `/query?q=${encoded}`);
    return result.records;
  }

  public async getRecord<T>(sobject: string, id: string, fields?: readonly string[]): Promise<T> {
    const fieldParam = fields?.length ? `?fields=${fields.join(',')}` : '';
    return this.#request<T>('GET', `/sobjects/${sobject}/${id}${fieldParam}`);
  }

  public async createRecord(sobject: string, data: Record<string, unknown>): Promise<string> {
    const result = await this.#request<SalesforceCreateResponse>(
      'POST',
      `/sobjects/${sobject}`,
      data,
    );
    return result.id;
  }

  public async updateRecord(
    sobject: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.#request<void>('PATCH', `/sobjects/${sobject}/${id}`, data);
  }

  public clearToken(): void {
    this.#accessToken = null;
  }
}

export class SalesforceAuthError extends Error {
  public override readonly name = 'SalesforceAuthError';

  public constructor(message: string) {
    super(message);
  }
}

export class SalesforceApiError extends Error {
  public override readonly name = 'SalesforceApiError';
  public readonly errorType: 'not_found' | 'validation_error' | 'provider_error';
  public readonly statusCode: number;

  public constructor(
    message: string,
    errorType: 'not_found' | 'validation_error' | 'provider_error',
    statusCode: number,
  ) {
    super(message);
    this.errorType = errorType;
    this.statusCode = statusCode;
  }
}

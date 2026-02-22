/**
 * Hello Connector — minimal Portarium integration scaffold.
 *
 * Demonstrates the full connector pattern:
 *   1. Define an adapter port interface (operations your system supports).
 *   2. Implement a live adapter that calls the external system.
 *   3. Provide a stub adapter for deterministic unit tests.
 *
 * Copy this file, rename the types, and replace the fetch calls with
 * your system's SDK to build any Portarium connector.
 *
 * Bead: bead-0730
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type HelloConnectorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface HelloConnectorStatus {
  connected: boolean;
  uptime: number; // seconds
  version?: string;
}

/** The adapter port: defines exactly what this connector can do. */
export interface HelloConnectorAdapterPort {
  /** Health-check: returns true if the remote system is reachable. */
  ping(): Promise<HelloConnectorResult<{ latencyMs: number }>>;

  /** Send a message to the external system. */
  sendMessage(message: string): Promise<HelloConnectorResult<{ delivered: boolean }>>;

  /** Retrieve current connection status from the external system. */
  getStatus(): Promise<HelloConnectorResult<HelloConnectorStatus>>;
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface HelloConnectorConfig {
  /** Base URL of the target system, e.g. https://api.example.com */
  baseUrl: string;
  /** Bearer token for authentication. */
  token: string;
  /** Per-request timeout in milliseconds. Default: 5000. */
  timeoutMs?: number;
}

// ── Live adapter ──────────────────────────────────────────────────────────────

/**
 * Live implementation that calls a real HTTP endpoint.
 * Replace the fetch calls here with your system's SDK calls.
 */
export class HelloConnectorAdapter implements HelloConnectorAdapterPort {
  readonly #config: Required<HelloConnectorConfig>;

  constructor(config: HelloConnectorConfig) {
    this.#config = { timeoutMs: 5_000, ...config };
  }

  async ping(): Promise<HelloConnectorResult<{ latencyMs: number }>> {
    const start = Date.now();
    try {
      const res = await this.#fetch('GET', '/ping');
      if (!res.ok) return { ok: false, error: `ping failed: HTTP ${res.status}` };
      return { ok: true, value: { latencyMs: Date.now() - start } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async sendMessage(message: string): Promise<HelloConnectorResult<{ delivered: boolean }>> {
    try {
      const res = await this.#fetch('POST', '/messages', { message });
      if (!res.ok) return { ok: false, error: `sendMessage failed: HTTP ${res.status}` };
      return { ok: true, value: { delivered: true } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async getStatus(): Promise<HelloConnectorResult<HelloConnectorStatus>> {
    try {
      const res = await this.#fetch('GET', '/status');
      if (!res.ok) return { ok: false, error: `getStatus failed: HTTP ${res.status}` };
      const body = (await res.json()) as HelloConnectorStatus;
      return { ok: true, value: body };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  #fetch(method: string, path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#config.timeoutMs);

    return fetch(`${this.#config.baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#config.token}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }).finally(() => clearTimeout(timeoutId));
  }
}

// ── Stub adapter (for tests) ──────────────────────────────────────────────────

export interface StubHelloConnectorState {
  reachable: boolean;
  status: HelloConnectorStatus;
  messages: string[];
}

/**
 * In-memory stub that fulfills the same port contract.
 * Use this in tests — no network required.
 *
 * @example
 * const stub = new StubHelloConnector();
 * stub.state.reachable = false;
 * const result = await stub.ping();
 * expect(result.ok).toBe(false);
 */
export class StubHelloConnector implements HelloConnectorAdapterPort {
  readonly state: StubHelloConnectorState = {
    reachable: true,
    status: { connected: true, uptime: 0 },
    messages: [],
  };

  async ping(): Promise<HelloConnectorResult<{ latencyMs: number }>> {
    if (!this.state.reachable) return { ok: false, error: 'stub: not reachable' };
    return { ok: true, value: { latencyMs: 0 } };
  }

  async sendMessage(message: string): Promise<HelloConnectorResult<{ delivered: boolean }>> {
    if (!this.state.reachable) return { ok: false, error: 'stub: not reachable' };
    this.state.messages.push(message);
    return { ok: true, value: { delivered: true } };
  }

  async getStatus(): Promise<HelloConnectorResult<HelloConnectorStatus>> {
    if (!this.state.reachable) return { ok: false, error: 'stub: not reachable' };
    return { ok: true, value: { ...this.state.status } };
  }
}

// ── Demo entrypoint (run directly: npx tsx connector.ts) ──────────────────────

async function demo(): Promise<void> {
  const baseUrl = process.env['HELLO_BASE_URL'] ?? 'http://localhost:9000';
  const token = process.env['HELLO_TOKEN'] ?? 'dev-token';

  console.log(`[hello-connector] connecting to ${baseUrl}`);
  const connector = new HelloConnectorAdapter({ baseUrl, token });

  const pingResult = await connector.ping();
  if (pingResult.ok) {
    console.log(`[hello-connector] ping → ok (${pingResult.value.latencyMs} ms)`);
  } else {
    console.error(`[hello-connector] ping → ${pingResult.error}`);
  }

  const msgResult = await connector.sendMessage('hello from Portarium');
  console.log(msgResult.ok ? '[hello-connector] sendMessage → delivered' : `[hello-connector] sendMessage → ${msgResult.error}`);

  const statusResult = await connector.getStatus();
  if (statusResult.ok) {
    console.log('[hello-connector] getStatus →', JSON.stringify(statusResult.value));
  } else {
    console.error(`[hello-connector] getStatus → ${statusResult.error}`);
  }
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith('connector.ts') || process.argv[1]?.endsWith('connector.js');
if (isMain) void demo();

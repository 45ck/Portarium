import type {
  AgentGatewayStatus,
  BridgeOperationResult,
  OpenClawManagementBridgePort,
} from '../../application/ports/openclaw-management-bridge-port.js';
import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';
import { describeNetworkError, mapGatewayResponse } from './openclaw-http-error-policy.js';

type FetchImpl = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

export type OpenClawManagementBridgeConfig = Readonly<{
  /**
   * Base URL of the OpenClaw management API, e.g. "https://openclaw.example.com".
   * Trailing slashes are stripped automatically.
   */
  baseUrl: string;
  /**
   * Resolves a bearer token for the given machine. Returns undefined if no
   * credential is available (operations will return a soft failure).
   */
  resolveBearerToken: (input: {
    tenantId: TenantId;
    machineId: MachineId;
  }) => Promise<string | undefined>;
  fetchImpl?: FetchImpl;
  requestTimeoutMs?: number;
  sleep?: SleepFn;
}>;

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * HTTP implementation of OpenClawManagementBridgePort.
 *
 * All operations are soft-fail: network/gateway errors resolve to a
 * { ok: false, reason: '...' } rather than throwing, so callers can treat
 * failures as advisory rather than fatal.
 *
 * Management API surface assumed (v1):
 *   PUT    /v1/management/agents/:agentId          — syncAgentRegistration
 *   DELETE /v1/management/agents/:agentId          — deregisterAgent
 *   GET    /v1/management/agents/:agentId/status   — getAgentGatewayStatus
 *
 * All requests carry:
 *   Authorization: Bearer <token>
 *   X-Portarium-Tenant-Id: <tenantId>
 *   X-Portarium-Machine-Id: <machineId>
 */
export class OpenClawManagementBridge implements OpenClawManagementBridgePort {
  readonly #baseUrl: string;
  readonly #resolveBearerToken: OpenClawManagementBridgeConfig['resolveBearerToken'];
  readonly #fetchImpl: FetchImpl;
  readonly #requestTimeoutMs: number;

  public constructor(config: OpenClawManagementBridgeConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl);
    this.#resolveBearerToken = config.resolveBearerToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
    this.#requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  public async syncAgentRegistration(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
    capabilities: readonly string[],
  ): Promise<BridgeOperationResult> {
    const token = await this.#resolveToken(tenantId, machineId);
    if (token === undefined) {
      return { ok: false, reason: 'Missing bearer-token credential for management bridge.' };
    }

    const path = `/v1/management/agents/${encodeURIComponent(String(agentId))}`;
    try {
      const response = await this.#fetchWithTimeout(this.#baseUrl + path, {
        method: 'PUT',
        headers: this.#buildHeaders(token, tenantId, machineId, {
          'content-type': 'application/json',
        }),
        body: JSON.stringify({ capabilities }),
      });
      return mapGatewayResponse(response, 'syncAgentRegistration');
    } catch (error) {
      return { ok: false, reason: describeNetworkError(error) };
    }
  }

  public async deregisterAgent(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<BridgeOperationResult> {
    const token = await this.#resolveToken(tenantId, machineId);
    if (token === undefined) {
      return { ok: false, reason: 'Missing bearer-token credential for management bridge.' };
    }

    const path = `/v1/management/agents/${encodeURIComponent(String(agentId))}`;
    try {
      const response = await this.#fetchWithTimeout(this.#baseUrl + path, {
        method: 'DELETE',
        headers: this.#buildHeaders(token, tenantId, machineId),
      });
      // 404 on DELETE is idempotent success — the agent is already absent.
      if (response.status === 404) return { ok: true };
      return mapGatewayResponse(response, 'deregisterAgent');
    } catch (error) {
      return { ok: false, reason: describeNetworkError(error) };
    }
  }

  public async getAgentGatewayStatus(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<AgentGatewayStatus> {
    const token = await this.#resolveToken(tenantId, machineId);
    if (token === undefined) return 'unknown';

    const path = `/v1/management/agents/${encodeURIComponent(String(agentId))}/status`;
    try {
      const response = await this.#fetchWithTimeout(this.#baseUrl + path, {
        method: 'GET',
        headers: this.#buildHeaders(token, tenantId, machineId),
      });
      return parseAgentStatusResponse(response);
    } catch {
      return 'unknown';
    }
  }

  async #resolveToken(tenantId: TenantId, machineId: MachineId): Promise<string | undefined> {
    try {
      const token = await this.#resolveBearerToken({ tenantId, machineId });
      return typeof token === 'string' && token.trim().length > 0 ? token : undefined;
    } catch {
      return undefined;
    }
  }

  #buildHeaders(
    bearerToken: string,
    tenantId: TenantId,
    machineId: MachineId,
    extra: Record<string, string> = {},
  ): Record<string, string> {
    return {
      authorization: `Bearer ${bearerToken}`,
      'x-portarium-tenant-id': String(tenantId),
      'x-portarium-machine-id': String(machineId),
      ...extra,
    };
  }

  async #fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      return await this.#fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(handle);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseAgentStatusResponse(response: Response): Promise<AgentGatewayStatus> {
  if (response.status === 404) return 'unregistered';
  if (!response.ok) return 'unknown';

  try {
    const body = await response.text();
    if (body.trim() === '') return 'registered';
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'status' in parsed) {
      const status = (parsed as { status: unknown }).status;
      if (status === 'registered' || status === 'unregistered') return status;
    }
    // Successful response with unrecognized body — assume registered.
    return 'registered';
  } catch {
    return 'unknown';
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new Error('OpenClawManagementBridge requires a non-empty baseUrl.');
  return trimmed.replace(/\/+$/, '');
}

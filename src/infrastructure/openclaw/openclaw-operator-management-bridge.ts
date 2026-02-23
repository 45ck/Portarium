/**
 * HTTP adapter implementing OpenClawManagementBridgePort via the OpenClaw
 * operator management REST API.
 *
 * Design decisions:
 * - All operations are soft-fail: network/server errors return ok:false instead of throwing.
 * - deregisterAgent treats 404 as success (idempotent delete).
 * - getAgentGatewayStatus returns 'unknown' on any non-deterministic failure.
 * - A single API token is used for all management-plane calls (no per-machine resolver).
 *
 * @see bead-0793
 */

import type {
  AgentGatewayStatus,
  BridgeOperationResult,
  OpenClawManagementBridgePort,
} from '../../application/ports/openclaw-management-bridge-port.js';
import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';
import { describeNetworkError, mapGatewayResponse } from './openclaw-http-error-policy.js';

export type OpenClawOperatorManagementBridgeConfig = Readonly<{
  /**
   * Base URL of the OpenClaw operator management API (e.g. `https://operator.example.com`).
   * Trailing slashes are normalized away.
   */
  baseUrl: string;
  /** Bearer token for the OpenClaw operator management API. */
  apiToken: string;
  /** Injectable fetch implementation (defaults to global `fetch`). */
  fetchImpl?: typeof fetch;
  /** Request timeout in milliseconds (default: 10 000). */
  requestTimeoutMs?: number;
}>;

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export class OpenClawOperatorManagementBridge implements OpenClawManagementBridgePort {
  readonly #baseUrl: string;
  readonly #apiToken: string;
  readonly #fetchImpl: typeof fetch;
  readonly #requestTimeoutMs: number;

  public constructor(config: OpenClawOperatorManagementBridgeConfig) {
    if (typeof config.baseUrl !== 'string' || config.baseUrl.trim() === '') {
      throw new Error('OpenClawOperatorManagementBridge requires a non-empty baseUrl.');
    }
    if (typeof config.apiToken !== 'string' || config.apiToken.trim() === '') {
      throw new Error('OpenClawOperatorManagementBridge requires a non-empty apiToken.');
    }
    this.#baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.#apiToken = config.apiToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
    this.#requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  public async syncAgentRegistration(
    _tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
    capabilities: readonly string[],
  ): Promise<BridgeOperationResult> {
    const url = this.#agentUrl(machineId, agentId);
    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.#apiToken}`,
        },
        body: JSON.stringify({ capabilities }),
      });
      return mapGatewayResponse(response, 'syncAgentRegistration');
    } catch (error) {
      return { ok: false, reason: describeNetworkError(error) };
    }
  }

  public async deregisterAgent(
    _tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<BridgeOperationResult> {
    const url = this.#agentUrl(machineId, agentId);
    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${this.#apiToken}` },
      });
      // 404 is treated as success — agent already absent, deregistration is idempotent.
      if (response.ok || response.status === 404) return { ok: true };
      return mapGatewayResponse(response, 'deregisterAgent');
    } catch (error) {
      return { ok: false, reason: describeNetworkError(error) };
    }
  }

  public async getAgentGatewayStatus(
    _tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<AgentGatewayStatus> {
    const url = `${this.#agentUrl(machineId, agentId)}/status`;
    try {
      const response = await this.#fetchWithTimeout(url, {
        method: 'GET',
        headers: { authorization: `Bearer ${this.#apiToken}` },
      });
      if (response.ok) return 'registered';
      if (response.status === 404) return 'unregistered';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  #agentUrl(machineId: MachineId, agentId: AgentId): string {
    return (
      `${this.#baseUrl}/v1/operator/machines/` +
      `${encodeURIComponent(String(machineId))}/agents/${encodeURIComponent(String(agentId))}`
    );
  }

  async #fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      return await this.#fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}

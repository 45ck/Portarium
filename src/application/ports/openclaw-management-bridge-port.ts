import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';

/**
 * Result of a bridge operation against the OpenClaw gateway.
 *
 * On success, the gateway has confirmed the change.
 * On failure, the detail explains the reason (e.g. gateway unreachable, agent not found).
 */
export type BridgeOperationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string }>;

/**
 * Current registration status of an agent as reported by the OpenClaw gateway.
 *
 * - registered: gateway has an active binding for this agent.
 * - unregistered: gateway has no binding for this agent.
 * - unknown: gateway is unreachable or returned an unexpected response.
 */
export type AgentGatewayStatus = 'registered' | 'unregistered' | 'unknown';

/**
 * Port interface for management-plane operations against an OpenClaw gateway.
 *
 * Implementations (infrastructure layer) call the OpenClaw management API.
 * All operations are fire-and-soft-fail: callers treat gateway failures as
 * warnings, not hard errors — Portarium's own registry is the source of truth.
 */
export interface OpenClawManagementBridgePort {
  /**
   * Registers or re-registers an agent on the OpenClaw gateway, ensuring the
   * gateway's agent binding reflects the current Portarium configuration.
   */
  syncAgentRegistration(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
    capabilities: readonly string[],
  ): Promise<BridgeOperationResult>;

  /**
   * Instructs the OpenClaw gateway to remove the agent binding.
   * Safe to call even if the agent is already absent on the gateway.
   */
  deregisterAgent(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<BridgeOperationResult>;

  /**
   * Queries the gateway for the current registration status of an agent.
   * Returns 'unknown' if the gateway is unreachable.
   */
  getAgentGatewayStatus(
    tenantId: TenantId,
    machineId: MachineId,
    agentId: AgentId,
  ): Promise<AgentGatewayStatus>;
}

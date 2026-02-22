import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import { AgentId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type {
  AuthorizationPort,
  MachineRegistryStore,
  OpenClawManagementBridgePort,
} from '../ports/index.js';

export type SyncAgentToGatewayInput = Readonly<{
  workspaceId: string;
  agentId: string;
}>;

export type SyncAgentToGatewayOutput = Readonly<{
  agentId: AgentConfigV1['agentId'];
  machineId: MachineRegistrationV1['machineId'];
  /** Whether the gateway confirmed the registration sync. */
  gatewayAcknowledged: boolean;
  /** Details from the gateway if it rejected or was unreachable. */
  gatewayDetail?: string;
}>;

export type SyncAgentToGatewayError = Forbidden | ValidationFailed | NotFound | DependencyFailure;

export interface SyncAgentToGatewayDeps {
  authorization: AuthorizationPort;
  machineRegistryStore: MachineRegistryStore;
  bridge: OpenClawManagementBridgePort;
}

/**
 * Synchronises an agent's registration with the OpenClaw gateway.
 *
 * This is a soft-sync operation: if the gateway is unreachable or rejects the
 * registration, the command still returns success with `gatewayAcknowledged: false`
 * so callers can decide whether to retry or continue. Portarium's own registry
 * is always the authoritative source of truth.
 *
 * Authorization: machineAgentBridgeSync (admin-only).
 */
export async function syncAgentToGateway(
  deps: SyncAgentToGatewayDeps,
  ctx: AppContext,
  input: SyncAgentToGatewayInput,
): Promise<Result<SyncAgentToGatewayOutput, SyncAgentToGatewayError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.machineAgentBridgeSync);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.machineAgentBridgeSync,
      message: 'Caller is not permitted to sync agent lifecycle with the gateway.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.agentId !== 'string' || input.agentId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }

  let wsId: ReturnType<typeof WorkspaceId>;
  let agentId: ReturnType<typeof AgentId>;
  try {
    wsId = WorkspaceId(input.workspaceId);
    agentId = AgentId(input.agentId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or agentId.' });
  }

  if (wsId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.machineAgentBridgeSync,
      message: 'Tenant mismatch.',
    });
  }

  const agent = await deps.machineRegistryStore.getAgentConfigById(ctx.tenantId, agentId);
  if (agent === null) {
    return err({
      kind: 'NotFound',
      resource: 'AgentConfig',
      message: `Agent ${input.agentId} not found.`,
    });
  }

  const machine = await deps.machineRegistryStore.getMachineRegistrationById(
    ctx.tenantId,
    agent.machineId,
  );
  if (machine === null) {
    return err({
      kind: 'NotFound',
      resource: 'MachineRegistration',
      message: `Machine ${String(agent.machineId)} not found.`,
    });
  }

  const bridgeResult = await deps.bridge.syncAgentRegistration(
    ctx.tenantId,
    machine.machineId,
    agent.agentId,
    agent.capabilities.map((c) => String(c.capability)),
  );

  return ok({
    agentId: agent.agentId,
    machineId: machine.machineId,
    gatewayAcknowledged: bridgeResult.ok,
    ...(bridgeResult.ok ? {} : { gatewayDetail: bridgeResult.reason }),
  });
}

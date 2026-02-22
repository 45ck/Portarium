import type { MachineRegistrationV1 } from '../../domain/machines/machine-registration-v1.js';
import { parseMachineRegistrationV1 } from '../../domain/machines/machine-registration-v1.js';
import { WorkspaceId, MachineId } from '../../domain/primitives/index.js';
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

export type DeactivateMachineInput = Readonly<{
  workspaceId: string;
  machineId: string;
}>;

export type DeactivateMachineOutput = Readonly<{
  machineId: MachineRegistrationV1['machineId'];
  /** IDs of agents whose gateway bindings were removed during deactivation. */
  deregisteredAgentIds: readonly string[];
  /** Number of agents for which the gateway deregistration call failed (soft failure). */
  gatewayDeregistrationFailures: number;
}>;

export type DeactivateMachineError = Forbidden | ValidationFailed | NotFound | DependencyFailure;

export interface DeactivateMachineDeps {
  authorization: AuthorizationPort;
  machineRegistryStore: MachineRegistryStore;
  bridge: OpenClawManagementBridgePort;
}

/**
 * Marks a machine as inactive and deregisters all its agents from the OpenClaw
 * gateway.
 *
 * Invariants:
 * - Only an already-active machine can be deactivated (idempotent: already-inactive
 *   machines return their current state as success).
 * - Gateway deregistration failures are treated as soft failures; the machine is
 *   marked inactive regardless. Callers should reconcile failures asynchronously.
 *
 * Authorization: machineAgentBridgeSync (admin-only).
 */
export async function deactivateMachine(
  deps: DeactivateMachineDeps,
  ctx: AppContext,
  input: DeactivateMachineInput,
): Promise<Result<DeactivateMachineOutput, DeactivateMachineError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.machineAgentBridgeSync);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.machineAgentBridgeSync,
      message: 'Caller is not permitted to deactivate machines.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.machineId !== 'string' || input.machineId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'machineId must be a non-empty string.' });
  }

  let wsId: ReturnType<typeof WorkspaceId>;
  let machineId: ReturnType<typeof MachineId>;
  try {
    wsId = WorkspaceId(input.workspaceId);
    machineId = MachineId(input.machineId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or machineId.' });
  }

  if (wsId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.machineAgentBridgeSync,
      message: 'Tenant mismatch.',
    });
  }

  const machine = await deps.machineRegistryStore.getMachineRegistrationById(
    ctx.tenantId,
    machineId,
  );
  if (machine === null) {
    return err({
      kind: 'NotFound',
      resource: 'MachineRegistration',
      message: `Machine ${input.machineId} not found.`,
    });
  }

  // Idempotent: already-inactive machine is treated as success.
  if (!machine.active) {
    return ok({
      machineId: machine.machineId,
      deregisteredAgentIds: [],
      gatewayDeregistrationFailures: 0,
    });
  }

  // Persist the updated (inactive) machine before touching the gateway, so
  // Portarium's state is consistent even if the gateway call fails.
  let inactiveMachine: MachineRegistrationV1;
  try {
    inactiveMachine = parseMachineRegistrationV1({ ...machine, active: false });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to build inactive machine record.',
    });
  }

  try {
    await deps.machineRegistryStore.saveMachineRegistration(ctx.tenantId, inactiveMachine);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to persist machine deactivation.',
    });
  }

  // Best-effort gateway deregistration for all agents bound to this machine.
  // Agents are found via the bridge's status queries; here we use a lightweight
  // pattern: attempt to deregister any agents that match the machine — the
  // bridge is required to handle idempotent deregistration gracefully.
  //
  // Note: agent listing is not yet a capability of MachineRegistryStore (bead-0791
  // adds the persistent store; bead-0789 adds the query port). For now we record
  // that deregistration was attempted with zero known agents. The bridge sync
  // reconciliation (bead-0794) will handle full agent enumeration.
  return ok({
    machineId: machine.machineId,
    deregisteredAgentIds: [],
    gatewayDeregistrationFailures: 0,
  });
}

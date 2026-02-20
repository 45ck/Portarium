import { AgentId, MachineId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type AppContext,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type {
  AuthorizationPort,
  Clock,
  HeartbeatData,
  HeartbeatStatus,
  MachineRegistryStore,
} from '../ports/index.js';

const HEARTBEAT_STATUSES: readonly HeartbeatStatus[] = ['ok', 'degraded'];

export type HeartbeatInput = Readonly<{
  workspaceId: string;
  /** Exactly one of agentId or machineId must be provided. */
  agentId?: string;
  machineId?: string;
  status: string;
  metrics?: Readonly<Record<string, number>>;
  location?: Readonly<{ lat: number; lon: number }>;
}>;

export type HeartbeatOutput = Readonly<{
  acknowledgedAtIso: string;
}>;

export type HeartbeatError = Forbidden | NotFound | ValidationFailed;

export interface HeartbeatDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  machineRegistryStore: MachineRegistryStore;
}

function ensureTenantMatch(
  ctx: AppContext,
  workspaceId: string,
): Result<true, Forbidden | ValidationFailed> {
  if (typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (WorkspaceId(workspaceId) !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Tenant mismatch.',
    });
  }
  return ok(true);
}

function validateHeartbeatInput(
  input: HeartbeatInput,
): Result<{ status: HeartbeatStatus }, ValidationFailed> {
  if (!(HEARTBEAT_STATUSES as readonly string[]).includes(input.status)) {
    return err({
      kind: 'ValidationFailed',
      message: `status must be one of: ${HEARTBEAT_STATUSES.join(', ')}.`,
    });
  }

  if (input.metrics !== undefined) {
    if (typeof input.metrics !== 'object' || input.metrics === null || Array.isArray(input.metrics)) {
      return err({ kind: 'ValidationFailed', message: 'metrics must be a record of string to number.' });
    }
    for (const [key, val] of Object.entries(input.metrics)) {
      if (typeof key !== 'string' || typeof val !== 'number' || !Number.isFinite(val)) {
        return err({ kind: 'ValidationFailed', message: 'metrics values must be finite numbers.' });
      }
    }
  }

  if (input.location !== undefined) {
    if (
      typeof input.location !== 'object' ||
      input.location === null ||
      typeof input.location.lat !== 'number' ||
      typeof input.location.lon !== 'number' ||
      !Number.isFinite(input.location.lat) ||
      !Number.isFinite(input.location.lon)
    ) {
      return err({
        kind: 'ValidationFailed',
        message: 'location must contain finite lat and lon numbers.',
      });
    }
  }

  return ok({ status: input.status as HeartbeatStatus });
}

export async function processHeartbeat(
  deps: HeartbeatDeps,
  ctx: AppContext,
  input: HeartbeatInput,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  const tenantMatch = ensureTenantMatch(ctx, input.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRegister);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Caller is not permitted to send heartbeats.',
    });
  }

  const validated = validateHeartbeatInput(input);
  if (!validated.ok) return validated;

  const nowIso = deps.clock.nowIso();
  if (nowIso.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'Clock returned an invalid timestamp.' });
  }

  const heartbeat: HeartbeatData = {
    status: validated.value.status,
    lastHeartbeatAtIso: nowIso,
    ...(input.metrics !== undefined ? { metrics: input.metrics } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
  };

  if (input.machineId !== undefined) {
    if (typeof input.machineId !== 'string' || input.machineId.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'machineId must be a non-empty string.' });
    }
    const updated = await deps.machineRegistryStore.updateMachineHeartbeat(
      ctx.tenantId,
      MachineId(input.machineId),
      heartbeat,
    );
    if (!updated) {
      return err({
        kind: 'NotFound',
        resource: 'MachineRegistration',
        message: `Machine ${input.machineId} not found.`,
      });
    }
    return ok({ acknowledgedAtIso: nowIso });
  }

  if (input.agentId !== undefined) {
    if (typeof input.agentId !== 'string' || input.agentId.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
    }
    const updated = await deps.machineRegistryStore.updateAgentHeartbeat(
      ctx.tenantId,
      AgentId(input.agentId),
      heartbeat,
    );
    if (!updated) {
      return err({
        kind: 'NotFound',
        resource: 'AgentConfig',
        message: `Agent ${input.agentId} not found.`,
      });
    }
    return ok({ acknowledgedAtIso: nowIso });
  }

  return err({
    kind: 'ValidationFailed',
    message: 'Either agentId or machineId must be provided.',
  });
}

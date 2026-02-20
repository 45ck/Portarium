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
      action: APP_ACTIONS.agentHeartbeat,
      message: 'Tenant mismatch.',
    });
  }
  return ok(true);
}

function validateMetrics(
  metrics: Readonly<Record<string, number>> | undefined,
): Result<true, ValidationFailed> {
  if (metrics === undefined) return ok(true);
  if (typeof metrics !== 'object' || metrics === null || Array.isArray(metrics)) {
    return err({
      kind: 'ValidationFailed',
      message: 'metrics must be a record of string to number.',
    });
  }
  for (const [key, val] of Object.entries(metrics)) {
    if (typeof key !== 'string' || typeof val !== 'number' || !Number.isFinite(val)) {
      return err({ kind: 'ValidationFailed', message: 'metrics values must be finite numbers.' });
    }
  }
  return ok(true);
}

function validateLocation(
  location: Readonly<{ lat: number; lon: number }> | undefined,
): Result<true, ValidationFailed> {
  if (location === undefined) return ok(true);
  if (
    typeof location !== 'object' ||
    location === null ||
    typeof location.lat !== 'number' ||
    typeof location.lon !== 'number' ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lon)
  ) {
    return err({
      kind: 'ValidationFailed',
      message: 'location must contain finite lat and lon numbers.',
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

  const metricsResult = validateMetrics(input.metrics);
  if (!metricsResult.ok) return metricsResult;

  const locationResult = validateLocation(input.location);
  if (!locationResult.ok) return locationResult;

  return ok({ status: input.status as HeartbeatStatus });
}

type HeartbeatDispatchContext = Readonly<{
  store: HeartbeatDeps['machineRegistryStore'];
  ctx: AppContext;
  heartbeat: HeartbeatData;
  nowIso: string;
}>;

async function dispatchMachineHeartbeat(
  dc: HeartbeatDispatchContext,
  machineId: string,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  if (typeof machineId !== 'string' || machineId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'machineId must be a non-empty string.' });
  }
  const updated = await dc.store.updateMachineHeartbeat(
    dc.ctx.tenantId,
    MachineId(machineId),
    dc.heartbeat,
  );
  if (!updated) {
    return err({
      kind: 'NotFound',
      resource: 'MachineRegistration',
      message: `Machine ${machineId} not found.`,
    });
  }
  return ok({ acknowledgedAtIso: dc.nowIso });
}

async function dispatchAgentHeartbeat(
  dc: HeartbeatDispatchContext,
  agentId: string,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  if (typeof agentId !== 'string' || agentId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }
  const updated = await dc.store.updateAgentHeartbeat(
    dc.ctx.tenantId,
    AgentId(agentId),
    dc.heartbeat,
  );
  if (!updated) {
    return err({
      kind: 'NotFound',
      resource: 'AgentConfig',
      message: `Agent ${agentId} not found.`,
    });
  }
  return ok({ acknowledgedAtIso: dc.nowIso });
}

export async function processHeartbeat(
  deps: HeartbeatDeps,
  ctx: AppContext,
  input: HeartbeatInput,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  const tenantMatch = ensureTenantMatch(ctx, input.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.agentHeartbeat);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentHeartbeat,
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

  const dc: HeartbeatDispatchContext = {
    store: deps.machineRegistryStore,
    ctx,
    heartbeat,
    nowIso,
  };

  if (input.machineId !== undefined) {
    return dispatchMachineHeartbeat(dc, input.machineId);
  }

  if (input.agentId !== undefined) {
    return dispatchAgentHeartbeat(dc, input.agentId);
  }

  return err({
    kind: 'ValidationFailed',
    message: 'Either agentId or machineId must be provided.',
  });
}

import { AgentId, MachineId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type AppContext,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type {
  AuthorizationPort,
  Clock,
  HeartbeatData,
  MachineRegistryStore,
} from '../ports/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeartbeatInput = Readonly<{
  workspaceId: string;
  status: string;
  metrics?: Readonly<Record<string, number>>;
  location?: Readonly<{ lat: number; lon: number }>;
}>;

export type MachineHeartbeatInput = HeartbeatInput &
  Readonly<{ machineId: string }>;

export type AgentHeartbeatInput = HeartbeatInput &
  Readonly<{ agentId: string }>;

export type HeartbeatOutput = Readonly<{
  lastHeartbeatAtIso: string;
}>;

export type HeartbeatError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | DependencyFailure;

export interface HeartbeatDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  machineRegistryStore: MachineRegistryStore;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = ['ok', 'degraded'] as const;

function validateHeartbeatInput(
  input: HeartbeatInput,
): Result<true, ValidationFailed> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(input.status)) {
    return err({
      kind: 'ValidationFailed',
      message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
    });
  }
  if (input.metrics !== undefined) {
    if (typeof input.metrics !== 'object' || input.metrics === null || Array.isArray(input.metrics)) {
      return err({ kind: 'ValidationFailed', message: 'metrics must be a record of numbers.' });
    }
    for (const [key, value] of Object.entries(input.metrics)) {
      if (typeof key !== 'string' || key.trim() === '') {
        return err({ kind: 'ValidationFailed', message: 'metrics keys must be non-empty strings.' });
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return err({ kind: 'ValidationFailed', message: `metrics["${key}"] must be a finite number.` });
      }
    }
  }
  if (input.location !== undefined) {
    if (
      typeof input.location !== 'object' ||
      input.location === null ||
      typeof input.location.lat !== 'number' ||
      typeof input.location.lon !== 'number'
    ) {
      return err({ kind: 'ValidationFailed', message: 'location must have numeric lat and lon.' });
    }
    if (input.location.lat < -90 || input.location.lat > 90) {
      return err({ kind: 'ValidationFailed', message: 'location.lat must be between -90 and 90.' });
    }
    if (input.location.lon < -180 || input.location.lon > 180) {
      return err({ kind: 'ValidationFailed', message: 'location.lon must be between -180 and 180.' });
    }
  }
  return ok(true);
}

function ensureTenantMatch(
  ctx: AppContext,
  workspaceId: string,
): Result<true, Forbidden> {
  if (WorkspaceId(workspaceId) !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: 'Tenant mismatch.',
    });
  }
  return ok(true);
}

function buildHeartbeatData(
  input: HeartbeatInput,
  nowIso: string,
): HeartbeatData {
  return {
    status: input.status as HeartbeatData['status'],
    lastHeartbeatAtIso: nowIso,
    ...(input.metrics !== undefined ? { metrics: input.metrics } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function processMachineHeartbeat(
  deps: HeartbeatDeps,
  ctx: AppContext,
  input: MachineHeartbeatInput,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  const valid = validateHeartbeatInput(input);
  if (!valid.ok) return valid;

  if (typeof input.machineId !== 'string' || input.machineId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'machineId must be a non-empty string.' });
  }

  const tenantMatch = ensureTenantMatch(ctx, input.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: 'Caller is not permitted to send heartbeats.',
    });
  }

  const nowIso = deps.clock.nowIso();
  if (nowIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const heartbeat = buildHeartbeatData(input, nowIso);

  try {
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

    return ok({ lastHeartbeatAtIso: nowIso });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to update machine heartbeat.',
    });
  }
}

export async function processAgentHeartbeat(
  deps: HeartbeatDeps,
  ctx: AppContext,
  input: AgentHeartbeatInput,
): Promise<Result<HeartbeatOutput, HeartbeatError>> {
  const valid = validateHeartbeatInput(input);
  if (!valid.ok) return valid;

  if (typeof input.agentId !== 'string' || input.agentId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }

  const tenantMatch = ensureTenantMatch(ctx, input.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: 'Caller is not permitted to send heartbeats.',
    });
  }

  const nowIso = deps.clock.nowIso();
  if (nowIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const heartbeat = buildHeartbeatData(input, nowIso);

  try {
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

    return ok({ lastHeartbeatAtIso: nowIso });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to update agent heartbeat.',
    });
  }
}

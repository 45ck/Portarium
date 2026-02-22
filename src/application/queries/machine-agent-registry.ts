import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import {
  AgentId,
  MachineId,
  WorkspaceId,
  type AgentId as AgentIdType,
  type MachineId as MachineIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type Forbidden,
  type NotFound,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type { Page, PaginationParams } from '../common/query.js';
import type { AuthorizationPort, MachineQueryStore } from '../ports/index.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function ensureReadAllowed(
  authorization: AuthorizationPort,
  ctx: AppContext,
): Promise<Result<true, Forbidden>> {
  const allowed = await authorization.isAllowed(ctx, APP_ACTIONS.machineAgentRead);
  if (allowed) return ok(true);
  return err({
    kind: 'Forbidden',
    action: APP_ACTIONS.machineAgentRead,
    message: 'Caller is not permitted to read machine/agent resources.',
  });
}

function parseWorkspaceId(raw: string): Result<WorkspaceIdType, ValidationFailed> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  try {
    return ok(WorkspaceId(raw));
  } catch {
    return err({ kind: 'ValidationFailed', message: 'workspaceId is not a valid identifier.' });
  }
}

function parseMachineId(raw: string): Result<MachineIdType, ValidationFailed> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'machineId must be a non-empty string.' });
  }
  try {
    return ok(MachineId(raw));
  } catch {
    return err({ kind: 'ValidationFailed', message: 'machineId is not a valid identifier.' });
  }
}

function parseAgentId(raw: string): Result<AgentIdType, ValidationFailed> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }
  try {
    return ok(AgentId(raw));
  } catch {
    return err({ kind: 'ValidationFailed', message: 'agentId is not a valid identifier.' });
  }
}

function parsePagination(raw: Readonly<{ limit?: unknown; cursor?: unknown }>): PaginationParams {
  const p: { limit?: number; cursor?: string } = {};
  if (typeof raw.limit === 'number') p.limit = raw.limit;
  if (typeof raw.cursor === 'string') p.cursor = raw.cursor;
  return p;
}

// ---------------------------------------------------------------------------
// getMachine
// ---------------------------------------------------------------------------

export type GetMachineInput = Readonly<{
  workspaceId: string;
  machineId: string;
}>;

export type GetMachineOutput = Readonly<MachineRegistrationV1>;

export type GetMachineError = Forbidden | ValidationFailed | NotFound;

export interface GetMachineDeps {
  authorization: AuthorizationPort;
  machineQueryStore: MachineQueryStore;
}

export async function getMachine(
  deps: GetMachineDeps,
  ctx: AppContext,
  input: GetMachineInput,
): Promise<Result<GetMachineOutput, GetMachineError>> {
  const allowed = await ensureReadAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  const wsId = parseWorkspaceId(input.workspaceId);
  if (!wsId.ok) return wsId;
  const machineId = parseMachineId(input.machineId);
  if (!machineId.ok) return machineId;

  const machine = await deps.machineQueryStore.getMachineRegistrationById(
    ctx.tenantId,
    wsId.value,
    machineId.value,
  );
  if (machine === null) {
    return err({
      kind: 'NotFound',
      resource: 'MachineRegistration',
      message: `Machine ${input.machineId} not found.`,
    });
  }
  return ok(machine);
}

// ---------------------------------------------------------------------------
// listMachines
// ---------------------------------------------------------------------------

export type ListMachinesInput = Readonly<{
  workspaceId: string;
  active?: boolean;
  limit?: number;
  cursor?: string;
}>;

export type ListMachinesOutput = Readonly<Page<MachineRegistrationV1>>;

export type ListMachinesError = Forbidden | ValidationFailed;

export interface ListMachinesDeps {
  authorization: AuthorizationPort;
  machineQueryStore: MachineQueryStore;
}

export async function listMachines(
  deps: ListMachinesDeps,
  ctx: AppContext,
  input: ListMachinesInput,
): Promise<Result<ListMachinesOutput, ListMachinesError>> {
  const allowed = await ensureReadAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  const wsId = parseWorkspaceId(input.workspaceId);
  if (!wsId.ok) return wsId;

  const page = await deps.machineQueryStore.listMachineRegistrations(ctx.tenantId, {
    workspaceId: wsId.value,
    ...(input.active !== undefined ? { active: input.active } : {}),
    pagination: parsePagination(input),
  });
  return ok(page);
}

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

export type GetAgentInput = Readonly<{
  workspaceId: string;
  agentId: string;
}>;

export type GetAgentOutput = Readonly<AgentConfigV1>;

export type GetAgentError = Forbidden | ValidationFailed | NotFound;

export interface GetAgentDeps {
  authorization: AuthorizationPort;
  machineQueryStore: MachineQueryStore;
}

export async function getAgent(
  deps: GetAgentDeps,
  ctx: AppContext,
  input: GetAgentInput,
): Promise<Result<GetAgentOutput, GetAgentError>> {
  const allowed = await ensureReadAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  const wsId = parseWorkspaceId(input.workspaceId);
  if (!wsId.ok) return wsId;
  const agentId = parseAgentId(input.agentId);
  if (!agentId.ok) return agentId;

  const agent = await deps.machineQueryStore.getAgentConfigById(
    ctx.tenantId,
    wsId.value,
    agentId.value,
  );
  if (agent === null) {
    return err({
      kind: 'NotFound',
      resource: 'AgentConfig',
      message: `Agent ${input.agentId} not found.`,
    });
  }
  return ok(agent);
}

// ---------------------------------------------------------------------------
// listAgents
// ---------------------------------------------------------------------------

export type ListAgentsInput = Readonly<{
  workspaceId: string;
  machineId?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListAgentsOutput = Readonly<Page<AgentConfigV1>>;

export type ListAgentsError = Forbidden | ValidationFailed;

export interface ListAgentsDeps {
  authorization: AuthorizationPort;
  machineQueryStore: MachineQueryStore;
}

export async function listAgents(
  deps: ListAgentsDeps,
  ctx: AppContext,
  input: ListAgentsInput,
): Promise<Result<ListAgentsOutput, ListAgentsError>> {
  const allowed = await ensureReadAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  const wsId = parseWorkspaceId(input.workspaceId);
  if (!wsId.ok) return wsId;

  let machineId: MachineIdType | undefined;
  if (input.machineId !== undefined) {
    const mid = parseMachineId(input.machineId);
    if (!mid.ok) return mid;
    machineId = mid.value;
  }

  const page = await deps.machineQueryStore.listAgentConfigs(ctx.tenantId, {
    workspaceId: wsId.value,
    ...(machineId !== undefined ? { machineId } : {}),
    pagination: parsePagination(input),
  });
  return ok(page);
}

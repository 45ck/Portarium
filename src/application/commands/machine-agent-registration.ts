import {
  parseAgentConfigV1,
  parseMachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import {
  evaluateCapabilityDriftQuarantinePolicyV1,
  summarizeCapabilityDriftV1,
} from '../../domain/machines/capability-drift-quarantine-policy-v1.js';
import { establishCapabilityHandshakeV1 } from '../../domain/machines/capability-handshake-v1.js';
import { AgentId, EvidenceId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type AppContext,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type {
  AuthorizationPort,
  Clock,
  EvidenceEntryAppendInput,
  EvidenceLogPort,
  IdGenerator,
  IdempotencyStore,
  MachineRegistryStore,
  UnitOfWork,
} from '../ports/index.js';
import type { IdempotencyKey } from '../ports/idempotency.js';

const REGISTER_MACHINE_COMMAND = 'RegisterMachine';
const CREATE_AGENT_COMMAND = 'CreateAgent';
const UPDATE_AGENT_CAPABILITIES_COMMAND = 'UpdateAgentCapabilities';

export type RegisterMachineInput = Readonly<{
  idempotencyKey: string;
  machine: unknown;
}>;

export type RegisterMachineOutput = Readonly<{
  machineId: MachineRegistrationV1['machineId'];
}>;

export type CreateAgentInput = Readonly<{
  idempotencyKey: string;
  agent: unknown;
}>;

export type CreateAgentOutput = Readonly<{
  agentId: AgentConfigV1['agentId'];
}>;

export type UpdateAgentCapabilitiesInput = Readonly<{
  idempotencyKey: string;
  workspaceId: string;
  agentId: string;
  allowedTools: readonly string[];
}>;

export type UpdateAgentCapabilitiesOutput = Readonly<{
  agentId: AgentConfigV1['agentId'];
  allowedTools: readonly string[];
}>;

export type MachineAgentRegistrationError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface MachineAgentRegistrationDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
  machineRegistryStore: MachineRegistryStore;
  evidenceLog: EvidenceLogPort;
}

function validateIdempotencyKey(key: string): Result<string, ValidationFailed> {
  if (typeof key !== 'string' || key.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'idempotencyKey must be a non-empty string.' });
  }
  return ok(key);
}

function toDependencyFailure(error: unknown, fallback: string): DependencyFailure {
  return {
    kind: 'DependencyFailure',
    message: error instanceof Error ? error.message : fallback,
  };
}

function newCommandKey(ctx: AppContext, commandName: string, requestKey: string): IdempotencyKey {
  return {
    tenantId: ctx.tenantId,
    commandName,
    requestKey,
  };
}

function nextGeneratedId(
  idGenerator: IdGenerator,
  kind: 'event' | 'evidence',
): Result<string, DependencyFailure> {
  const value = idGenerator.generateId();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: `Unable to generate ${kind} identifier.` });
}

function currentIso(clock: Clock): Result<string, DependencyFailure> {
  const value = clock.nowIso();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
}

function buildEvidenceEntry(
  deps: Pick<MachineAgentRegistrationDeps, 'clock' | 'idGenerator'>,
  ctx: AppContext,
  summary: string,
): Result<EvidenceEntryAppendInput, DependencyFailure> {
  const occurredAtIso = currentIso(deps.clock);
  if (!occurredAtIso.ok) return occurredAtIso;
  const evidenceId = nextGeneratedId(deps.idGenerator, 'evidence');
  if (!evidenceId.ok) return evidenceId;

  return ok({
    schemaVersion: 1,
    evidenceId: EvidenceId(evidenceId.value),
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    occurredAtIso: occurredAtIso.value,
    category: 'Action',
    summary,
    actor: { kind: 'User', userId: ctx.principalId },
  });
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
      action: APP_ACTIONS.machineAgentRegister,
      message: 'Tenant mismatch.',
    });
  }
  return ok(true);
}

function ensureAllowedToolsShape(allowedTools: readonly string[]): Result<true, ValidationFailed> {
  if (!Array.isArray(allowedTools)) {
    return err({ kind: 'ValidationFailed', message: 'allowedTools must be an array.' });
  }
  if (!allowedTools.every((tool) => typeof tool === 'string' && tool.trim() !== '')) {
    return err({
      kind: 'ValidationFailed',
      message: 'allowedTools entries must be non-empty strings.',
    });
  }
  return ok(true);
}

async function ensureWorkspaceRegisterAllowed(
  authorization: AuthorizationPort,
  ctx: AppContext,
): Promise<Result<true, Forbidden>> {
  const allowed = await authorization.isAllowed(ctx, APP_ACTIONS.machineAgentRegister);
  if (allowed) return ok(true);
  return err({
    kind: 'Forbidden',
    action: APP_ACTIONS.machineAgentRegister,
    message: 'Caller is not permitted to register machine/agent resources.',
  });
}

export async function registerMachine(
  deps: MachineAgentRegistrationDeps,
  ctx: AppContext,
  input: RegisterMachineInput,
): Promise<Result<RegisterMachineOutput, MachineAgentRegistrationError>> {
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey.ok) return idempotencyKey;

  const allowed = await ensureWorkspaceRegisterAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  let machine: MachineRegistrationV1;
  try {
    machine = parseMachineRegistrationV1(input.machine);
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message: error instanceof Error ? error.message : 'Invalid machine registration payload.',
    });
  }

  const tenantMatch = ensureTenantMatch(ctx, machine.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const commandKey = newCommandKey(ctx, REGISTER_MACHINE_COMMAND, idempotencyKey.value);
  const cached = await deps.idempotency.get<RegisterMachineOutput>(commandKey);
  if (cached) return ok(cached);

  const existingMachine = await deps.machineRegistryStore.getMachineRegistrationById(
    ctx.tenantId,
    machine.machineId,
  );
  if (existingMachine !== null) {
    return err({
      kind: 'Conflict',
      message: `Machine ${machine.machineId} already exists.`,
    });
  }

  const evidence = buildEvidenceEntry(deps, ctx, `Registered machine ${machine.machineId}.`);
  if (!evidence.ok) return evidence;

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.machineRegistryStore.saveMachineRegistration(ctx.tenantId, machine);
      await deps.evidenceLog.appendEntry(ctx.tenantId, evidence.value);
      const output: RegisterMachineOutput = { machineId: machine.machineId };
      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    return err(toDependencyFailure(error, 'Failed to register machine.'));
  }
}

function checkCapabilityRoutability(
  agent: AgentConfigV1,
  machine: MachineRegistrationV1,
): Result<true, ValidationFailed> {
  const handshake = establishCapabilityHandshakeV1({
    machineCapabilities: machine.capabilities,
    agentCapabilities: agent.capabilities,
  });
  if (handshake.nonRoutableAgentCapabilities.length > 0) {
    const nonRoutable = handshake.nonRoutableAgentCapabilities
      .map((descriptor) => String(descriptor.capability))
      .join(', ');
    return err({
      kind: 'ValidationFailed',
      message: `Agent capabilities are not routable on machine ${agent.machineId}: ${nonRoutable}.`,
    });
  }
  return ok(true);
}

function checkAgentConflict(
  agent: AgentConfigV1,
  existingAgent: AgentConfigV1 | null,
): Result<true, Conflict | ValidationFailed> {
  if (existingAgent === null) return ok(true);
  const driftDecision = evaluateCapabilityDriftQuarantinePolicyV1({
    baselineCapabilities: existingAgent.capabilities,
    observedCapabilities: agent.capabilities,
    source: 'ReRegistration',
    reviewed: false,
  });
  if (driftDecision.decision === 'Quarantine') {
    const driftSummary = summarizeCapabilityDriftV1(driftDecision.drift);
    return err({
      kind: 'Conflict',
      message: `Agent ${agent.agentId} quarantined due to capability drift (${driftSummary}).`,
    });
  }
  return err({ kind: 'Conflict', message: `Agent ${agent.agentId} already exists.` });
}

export async function createAgent(
  deps: MachineAgentRegistrationDeps,
  ctx: AppContext,
  input: CreateAgentInput,
): Promise<Result<CreateAgentOutput, MachineAgentRegistrationError>> {
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey.ok) return idempotencyKey;

  const allowed = await ensureWorkspaceRegisterAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  let agent: AgentConfigV1;
  try {
    agent = parseAgentConfigV1(input.agent);
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message: error instanceof Error ? error.message : 'Invalid agent payload.',
    });
  }

  const tenantMatch = ensureTenantMatch(ctx, agent.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;

  const commandKey = newCommandKey(ctx, CREATE_AGENT_COMMAND, idempotencyKey.value);
  const cached = await deps.idempotency.get<CreateAgentOutput>(commandKey);
  if (cached) return ok(cached);

  const machine = await deps.machineRegistryStore.getMachineRegistrationById(
    ctx.tenantId, agent.machineId,
  );
  if (machine === null) {
    return err({ kind: 'NotFound', resource: 'MachineRegistration',
      message: `Machine ${agent.machineId} not found.` });
  }

  const routableResult = checkCapabilityRoutability(agent, machine);
  if (!routableResult.ok) return routableResult;

  const existingAgent = await deps.machineRegistryStore.getAgentConfigById(
    ctx.tenantId, agent.agentId,
  );
  const conflictResult = checkAgentConflict(agent, existingAgent);
  if (!conflictResult.ok) return conflictResult;

  const evidence = buildEvidenceEntry(deps, ctx, `Created agent ${agent.agentId}.`);
  if (!evidence.ok) return evidence;

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.machineRegistryStore.saveAgentConfig(ctx.tenantId, agent);
      await deps.evidenceLog.appendEntry(ctx.tenantId, evidence.value);
      const output: CreateAgentOutput = { agentId: agent.agentId };
      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    return err(toDependencyFailure(error, 'Failed to create agent.'));
  }
}

export async function updateAgentCapabilities(
  deps: MachineAgentRegistrationDeps,
  ctx: AppContext,
  input: UpdateAgentCapabilitiesInput,
): Promise<Result<UpdateAgentCapabilitiesOutput, MachineAgentRegistrationError>> {
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey.ok) return idempotencyKey;
  const tenantMatch = ensureTenantMatch(ctx, input.workspaceId);
  if (!tenantMatch.ok) return tenantMatch;
  const toolsShape = ensureAllowedToolsShape(input.allowedTools);
  if (!toolsShape.ok) return toolsShape;
  if (typeof input.agentId !== 'string' || input.agentId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }

  const allowed = await ensureWorkspaceRegisterAllowed(deps.authorization, ctx);
  if (!allowed.ok) return allowed;

  const commandKey = newCommandKey(ctx, UPDATE_AGENT_CAPABILITIES_COMMAND, idempotencyKey.value);
  const cached = await deps.idempotency.get<UpdateAgentCapabilitiesOutput>(commandKey);
  if (cached) return ok(cached);

  const agentId = AgentId(input.agentId);
  const existingAgent = await deps.machineRegistryStore.getAgentConfigById(ctx.tenantId, agentId);
  if (existingAgent === null) {
    return err({
      kind: 'NotFound',
      resource: 'AgentConfig',
      message: `Agent ${input.agentId} not found.`,
    });
  }

  const candidate = {
    ...existingAgent,
    allowedTools: [...input.allowedTools],
  };

  let updatedAgent: AgentConfigV1;
  try {
    updatedAgent = parseAgentConfigV1(candidate);
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message: error instanceof Error ? error.message : 'Invalid agent capabilities payload.',
    });
  }

  const evidence = buildEvidenceEntry(
    deps,
    ctx,
    `Updated allowed tools for agent ${updatedAgent.agentId}.`,
  );
  if (!evidence.ok) return evidence;

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.machineRegistryStore.saveAgentConfig(ctx.tenantId, updatedAgent);
      await deps.evidenceLog.appendEntry(ctx.tenantId, evidence.value);
      const output: UpdateAgentCapabilitiesOutput = {
        agentId: updatedAgent.agentId,
        allowedTools: updatedAgent.allowedTools,
      };
      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    return err(toDependencyFailure(error, 'Failed to update agent capabilities.'));
  }
}

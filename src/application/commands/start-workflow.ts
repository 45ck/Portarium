import { WorkspaceId, WorkflowId } from '../../domain/primitives/index.js';
import { parseRunV1, type RunV1 } from '../../domain/runs/index.js';
import { parseWorkflowTriggerV1, type WorkflowTriggerV1 } from '../../domain/schedule/index.js';
import type { WorkflowV1 } from '../../domain/workflows/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/index.js';
import {
  type AppContext,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  APP_ACTIONS,
  err,
  ok,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import {
  ensureRunIdIsUnique,
  ensureSingleActiveAdapterPerPort,
  ensureSingleActiveWorkflowVersion,
} from '../services/repository-aggregate-invariants.js';
import { executeStartWorkflowTransaction } from './start-workflow.execute-transaction.js';
import type {
  GeneratedValues as GeneratedValuesDef,
  NewStartWorkflowPlan as NewStartWorkflowPlanDef,
  ParsedIds as ParsedIdsDef,
  StartWorkflowDeps as StartWorkflowDepsDef,
  StartWorkflowError as StartWorkflowErrorDef,
  StartWorkflowInput as StartWorkflowInputDef,
  StartWorkflowOutput as StartWorkflowOutputDef,
} from './start-workflow.types.js';

const START_WORKFLOW_COMMAND = 'StartWorkflow';

type Err<E> = Readonly<{ ok: false; error: E }>;
export type StartWorkflowInput = StartWorkflowInputDef;
export type StartWorkflowOutput = StartWorkflowOutputDef;
export type StartWorkflowError = StartWorkflowErrorDef;
export type StartWorkflowDeps = StartWorkflowDepsDef;
export type ParsedIds = ParsedIdsDef;
export type GeneratedValues = GeneratedValuesDef;
export type NewStartWorkflowPlan = NewStartWorkflowPlanDef;

function requireNonEmpty(
  value: string | undefined | null,
  fieldName: string,
): Result<string, ValidationFailed> {
  if (typeof value !== 'string' || value.trim() === '') {
    return err({ kind: 'ValidationFailed', message: `${fieldName} must be a non-empty string.` });
  }
  return ok(value);
}

function validateInput(input: StartWorkflowInput): Result<ParsedIds, StartWorkflowError> {
  const wsCheck = requireNonEmpty(input.workspaceId, 'workspaceId');
  if (!wsCheck.ok) return wsCheck;
  const wfCheck = requireNonEmpty(input.workflowId, 'workflowId');
  if (!wfCheck.ok) return wfCheck;

  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      workflowId: WorkflowId(input.workflowId),
    });
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workflow identifiers.' });
  }
}

function parseTriggerFromInput(
  raw: unknown,
  ids: ParsedIds,
): Result<WorkflowTriggerV1 | undefined, ValidationFailed> {
  if (raw === undefined || raw === null) {
    return ok(undefined);
  }

  let trigger: WorkflowTriggerV1;
  try {
    trigger = parseWorkflowTriggerV1(raw);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid trigger payload.' });
  }

  if (
    trigger.workspaceId.toString() !== ids.workspaceId.toString() ||
    trigger.workflowId.toString() !== ids.workflowId.toString()
  ) {
    return err({
      kind: 'ValidationFailed',
      message: 'trigger workspaceId/workflowId must match the command workspaceId/workflowId.',
    });
  }

  return ok(trigger);
}

async function checkAuthorization(
  authorization: StartWorkflowDeps['authorization'],
  ctx: AppContext,
): Promise<Err<Forbidden> | null> {
  const allowed = await authorization.isAllowed(ctx, APP_ACTIONS.runStart);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runStart,
      message: 'Caller is not permitted to start runs.',
    });
  }
  return null;
}

async function resolveWorkflow(
  store: StartWorkflowDeps['workflowStore'],
  ctx: AppContext,
  ids: ParsedIds,
  rawWorkflowId: string,
): Promise<Result<WorkflowV1, StartWorkflowError>> {
  const workflow = await store.getWorkflowById(ctx.tenantId, ids.workspaceId, ids.workflowId);
  if (workflow === null) {
    return err({
      kind: 'NotFound',
      message: `Workflow ${rawWorkflowId} not found.`,
      resource: 'Workflow',
    });
  }

  let parsed: WorkflowV1;
  try {
    parsed = parseWorkflowV1(workflow);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Stored workflow is invalid.',
    });
  }

  if (!parsed.active) {
    return err({ kind: 'Conflict', message: `Workflow ${rawWorkflowId} is not active.` });
  }
  if (parsed.workspaceId !== ids.workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runStart,
      message: 'Workspace mismatch for workflow reference.',
    });
  }
  return ok(parsed);
}

function generateDepsValues(
  idGenerator: StartWorkflowDeps['idGenerator'],
  clock: StartWorkflowDeps['clock'],
): Result<GeneratedValues, DependencyFailure> {
  const runIdValue = idGenerator.generateId();
  if (runIdValue.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate run identifier.' });
  }

  const createdAtIso = clock.nowIso();
  if (createdAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an empty timestamp.' });
  }

  const eventIdValue = idGenerator.generateId();
  if (eventIdValue.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate event identifier.' });
  }

  return ok({ runIdValue, createdAtIso, eventIdValue });
}

function buildRun(
  ctx: AppContext,
  ids: ParsedIds,
  workflow: WorkflowV1,
  generated: GeneratedValues,
): Result<RunV1, ValidationFailed> {
  try {
    return ok(
      parseRunV1({
        schemaVersion: 1,
        runId: generated.runIdValue,
        workspaceId: ids.workspaceId.toString(),
        workflowId: ids.workflowId.toString(),
        correlationId: ctx.correlationId.toString(),
        executionTier: workflow.executionTier,
        initiatedByUserId: ctx.principalId.toString(),
        status: 'Pending',
        createdAtIso: generated.createdAtIso,
      }),
    );
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message: error instanceof Error ? error.message : 'Unable to construct run payload.',
    });
  }
}

type CachedStartWorkflowPlan = Readonly<{
  kind: 'cached';
  output: StartWorkflowOutput;
}>;

type StartWorkflowPlan = CachedStartWorkflowPlan | NewStartWorkflowPlan;

function resolvePlanInput(
  input: StartWorkflowInput,
): Result<Readonly<{ idempotencyKey: string; ids: ParsedIds }>, StartWorkflowError> {
  const keyCheck = requireNonEmpty(input.idempotencyKey, 'idempotencyKey');
  if (!keyCheck.ok) return keyCheck;
  const idsResult = validateInput(input);
  if (!idsResult.ok) return idsResult;
  return ok({ idempotencyKey: keyCheck.value, ids: idsResult.value });
}

async function ensureRepositoryAggregateConflicts(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  ids: ParsedIds,
  workflow: WorkflowV1,
): Promise<Err<Conflict> | null> {
  const workflowVersions = await deps.workflowStore.listWorkflowsByName(
    ctx.tenantId,
    ids.workspaceId,
    workflow.name,
  );
  const workflowVersionConflict = ensureSingleActiveWorkflowVersion({
    workflowName: workflow.name,
    selectedWorkflowId: workflow.workflowId,
    workflowVersions,
  });
  if (workflowVersionConflict) return err(workflowVersionConflict);

  const adapterRegistrations = await deps.adapterRegistrationStore.listByWorkspace(
    ctx.tenantId,
    ids.workspaceId,
  );
  const adapterConflict = ensureSingleActiveAdapterPerPort({
    portFamilies: workflow.actions.map((action) => action.portFamily),
    adapterRegistrations,
  });
  return adapterConflict ? err(adapterConflict) : null;
}

async function buildNewRunState(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  ids: ParsedIds,
  workflow: WorkflowV1,
): Promise<Result<Readonly<{ generated: GeneratedValues; run: RunV1 }>, StartWorkflowError>> {
  const genResult = generateDepsValues(deps.idGenerator, deps.clock);
  if (!genResult.ok) return genResult;

  const runResult = buildRun(ctx, ids, workflow, genResult.value);
  if (!runResult.ok) return runResult;

  const existingRun = await deps.runStore.getRunById(
    ctx.tenantId,
    ids.workspaceId,
    runResult.value.runId,
  );
  const runConflict = ensureRunIdIsUnique(existingRun, runResult.value.runId);
  if (runConflict) return err(runConflict);
  return ok({ generated: genResult.value, run: runResult.value });
}

async function buildStartWorkflowPlan(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  input: StartWorkflowInput,
): Promise<Result<StartWorkflowPlan, StartWorkflowError>> {
  const planInput = resolvePlanInput(input);
  if (!planInput.ok) return planInput;
  const { idempotencyKey, ids } = planInput.value;

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: START_WORKFLOW_COMMAND,
    requestKey: idempotencyKey,
  };

  const cached = await deps.idempotency.get<StartWorkflowOutput>(commandKey);
  if (cached) {
    return ok({ kind: 'cached', output: cached });
  }

  const triggerResult = parseTriggerFromInput(input.trigger, ids);
  if (!triggerResult.ok) return triggerResult;

  const workflowResult = await resolveWorkflow(deps.workflowStore, ctx, ids, input.workflowId);
  if (!workflowResult.ok) return workflowResult;

  const conflict = await ensureRepositoryAggregateConflicts(deps, ctx, ids, workflowResult.value);
  if (conflict) return conflict;

  const runState = await buildNewRunState(deps, ctx, ids, workflowResult.value);
  if (!runState.ok) return runState;

  return ok({
    kind: 'new',
    ids,
    workflow: workflowResult.value,
    generated: runState.value.generated,
    run: runState.value.run,
    commandKey,
    ...(triggerResult.value !== undefined ? { trigger: triggerResult.value } : {}),
  });
}

export async function startWorkflow(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  input: StartWorkflowInput,
): Promise<Result<StartWorkflowOutput, StartWorkflowError>> {
  const authErr = await checkAuthorization(deps.authorization, ctx);
  if (authErr) return authErr;

  const planResult = await buildStartWorkflowPlan(deps, ctx, input);
  if (!planResult.ok) return planResult;
  const plan = planResult.value;

  if (plan.kind === 'cached') {
    return ok(plan.output);
  }

  const txResult = await executeStartWorkflowTransaction(deps, ctx, plan);
  if (!txResult.ok) return txResult;

  if (plan.trigger && deps.triggerRouter) {
    await deps.triggerRouter.routeAtWorkflowStart({
      trigger: plan.trigger,
      tenantId: ctx.tenantId,
      runId: txResult.value.runId,
      correlationId: ctx.correlationId,
      payload: {
        workflowId: plan.ids.workflowId.toString(),
        workspaceId: plan.ids.workspaceId.toString(),
      },
    });
  }

  return txResult;
}

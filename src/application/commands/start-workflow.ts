import {
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkflowId as WorkflowIdType,
  WorkspaceId,
  WorkflowId,
} from '../../domain/primitives/index.js';
import { parseRunV1, type RunV1 } from '../../domain/runs/index.js';
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
  type NotFound,
} from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type {
  AdapterRegistrationStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyStore,
  IdempotencyKey,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
} from '../ports/index.js';
import {
  ensureRunIdIsUnique,
  ensureSingleActiveAdapterPerPort,
  ensureSingleActiveWorkflowVersion,
} from '../services/repository-aggregate-invariants.js';

const START_WORKFLOW_COMMAND = 'StartWorkflow';
const START_WORKFLOW_SOURCE = 'portarium.control-plane.workflow-runtime';

export type StartWorkflowInput = Readonly<{
  idempotencyKey: string;
  workspaceId: string;
  workflowId: string;
  trigger?: unknown;
}>;

export type StartWorkflowOutput = Readonly<{
  runId: RunIdType;
}>;

export type StartWorkflowError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface StartWorkflowDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
  workflowStore: WorkflowStore;
  adapterRegistrationStore: AdapterRegistrationStore;
  runStore: RunStore;
  orchestrator: WorkflowOrchestrator;
  eventPublisher: EventPublisher;
}

type Err<E> = Readonly<{ ok: false; error: E }>;

type ParsedIds = Readonly<{
  workspaceId: WorkspaceIdType;
  workflowId: WorkflowIdType;
}>;

type GeneratedValues = Readonly<{
  runIdValue: string;
  createdAtIso: string;
  eventIdValue: string;
}>;

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

async function checkAuthorization(
  authorization: AuthorizationPort,
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
  store: WorkflowStore,
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
  idGenerator: IdGenerator,
  clock: Clock,
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

async function executeTransaction(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  plan: NewStartWorkflowPlan,
): Promise<Result<StartWorkflowOutput, DependencyFailure>> {
  const domainEvent: DomainEventV1 = {
    schemaVersion: 1,
    eventId: plan.generated.eventIdValue,
    eventType: 'RunStarted',
    aggregateKind: 'Run',
    aggregateId: plan.run.runId,
    occurredAtIso: plan.generated.createdAtIso,
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    actorUserId: ctx.principalId,
    payload: {
      runId: plan.run.runId,
      workflowId: plan.ids.workflowId.toString(),
      workspaceId: plan.ids.workspaceId.toString(),
    },
  };

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.runStore.saveRun(ctx.tenantId, plan.run);
      await deps.orchestrator.startRun({
        runId: plan.run.runId,
        tenantId: ctx.tenantId,
        workflowId: plan.ids.workflowId,
        workflow: plan.workflow,
        initiatedByUserId: ctx.principalId,
        correlationId: ctx.correlationId,
        ...(ctx.traceparent ? { traceparent: ctx.traceparent } : {}),
        ...(ctx.tracestate ? { tracestate: ctx.tracestate } : {}),
        executionTier: plan.workflow.executionTier,
        idempotencyKey: plan.commandKey.requestKey,
      });
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, START_WORKFLOW_SOURCE),
      );
      const output: StartWorkflowOutput = { runId: plan.run.runId };
      await deps.idempotency.set(plan.commandKey, output);
      return ok(output);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Workflow start failed due to a dependency failure.';
    return err({ kind: 'DependencyFailure', message });
  }
}

type NewStartWorkflowPlan = Readonly<{
  kind: 'new';
  ids: ParsedIds;
  workflow: WorkflowV1;
  generated: GeneratedValues;
  run: RunV1;
  commandKey: IdempotencyKey;
}>;

type CachedStartWorkflowPlan = Readonly<{
  kind: 'cached';
  output: StartWorkflowOutput;
}>;

type StartWorkflowPlan = CachedStartWorkflowPlan | NewStartWorkflowPlan;

async function buildStartWorkflowPlan(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  input: StartWorkflowInput,
): Promise<Result<StartWorkflowPlan, StartWorkflowError>> {
  const keyCheck = requireNonEmpty(input.idempotencyKey, 'idempotencyKey');
  if (!keyCheck.ok) return keyCheck;

  const idsResult = validateInput(input);
  if (!idsResult.ok) return idsResult;

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: START_WORKFLOW_COMMAND,
    requestKey: keyCheck.value,
  };

  const cached = await deps.idempotency.get<StartWorkflowOutput>(commandKey);
  if (cached) {
    return ok({ kind: 'cached', output: cached });
  }

  const workflowResult = await resolveWorkflow(
    deps.workflowStore,
    ctx,
    idsResult.value,
    input.workflowId,
  );
  if (!workflowResult.ok) return workflowResult;

  const workflowVersions = await deps.workflowStore.listWorkflowsByName(
    ctx.tenantId,
    idsResult.value.workspaceId,
    workflowResult.value.name,
  );
  const workflowVersionConflict = ensureSingleActiveWorkflowVersion({
    workflowName: workflowResult.value.name,
    selectedWorkflowId: workflowResult.value.workflowId,
    workflowVersions,
  });
  if (workflowVersionConflict) return err(workflowVersionConflict);

  const adapterRegistrations = await deps.adapterRegistrationStore.listByWorkspace(
    ctx.tenantId,
    idsResult.value.workspaceId,
  );
  const adapterConflict = ensureSingleActiveAdapterPerPort({
    portFamilies: workflowResult.value.actions.map((action) => action.portFamily),
    adapterRegistrations,
  });
  if (adapterConflict) return err(adapterConflict);

  const genResult = generateDepsValues(deps.idGenerator, deps.clock);
  if (!genResult.ok) return genResult;

  const runResult = buildRun(ctx, idsResult.value, workflowResult.value, genResult.value);
  if (!runResult.ok) return runResult;

  const existingRun = await deps.runStore.getRunById(
    ctx.tenantId,
    idsResult.value.workspaceId,
    runResult.value.runId,
  );
  const runConflict = ensureRunIdIsUnique(existingRun, runResult.value.runId);
  if (runConflict) return err(runConflict);

  return ok({
    kind: 'new',
    ids: idsResult.value,
    workflow: workflowResult.value,
    generated: genResult.value,
    run: runResult.value,
    commandKey,
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

  return executeTransaction(deps, ctx, plan);
}

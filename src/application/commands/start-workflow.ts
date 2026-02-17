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
import { createPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyStore,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
} from '../ports/index.js';

const START_WORKFLOW_COMMAND = 'StartWorkflow';
const START_WORKFLOW_SOURCE = 'portarium.control-plane.workflow-runtime';

export type StartWorkflowInput = Readonly<{
  idempotencyKey: string;
  workspaceId: string;
  workflowId: string;
}>;

export type StartWorkflowOutput = Readonly<{
  runId: RunIdType;
}>;

export type StartWorkflowError = Forbidden | ValidationFailed | NotFound | Conflict | DependencyFailure;

export interface StartWorkflowDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
  workflowStore: WorkflowStore;
  runStore: RunStore;
  orchestrator: WorkflowOrchestrator;
  eventPublisher: EventPublisher;
}

export async function startWorkflow(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  input: StartWorkflowInput,
): Promise<Result<StartWorkflowOutput, StartWorkflowError>> {
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'idempotencyKey must be a non-empty string.' });
  }

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.runStart);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runStart,
      message: 'Caller is not permitted to start runs.',
    });
  }

  let workspaceId: WorkspaceIdType;
  let workflowId: WorkflowIdType;
  try {
    if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
    }
    if (typeof input.workflowId !== 'string' || input.workflowId.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'workflowId must be a non-empty string.' });
    }
    workspaceId = WorkspaceId(input.workspaceId);
    workflowId = WorkflowId(input.workflowId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workflow identifiers.' });
  }

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: START_WORKFLOW_COMMAND,
    requestKey: input.idempotencyKey,
  };

  const cached = await deps.idempotency.get<StartWorkflowOutput>(commandKey);
  if (cached) return ok(cached);

  const workflow = await deps.workflowStore.getWorkflowById(ctx.tenantId, workspaceId, workflowId);
  if (workflow === null) {
    return err({
      kind: 'NotFound',
      message: `Workflow ${input.workflowId} not found.`,
      resource: 'Workflow',
    });
  }

  let parsedWorkflow: WorkflowV1;
  try {
    parsedWorkflow = parseWorkflowV1(workflow);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Stored workflow is invalid.',
    });
  }

  if (!parsedWorkflow.active) {
    return err({
      kind: 'Conflict',
      message: `Workflow ${input.workflowId} is not active.`,
    });
  }
  if (parsedWorkflow.workspaceId !== workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runStart,
      message: 'Workspace mismatch for workflow reference.',
    });
  }

  const runIdValue = deps.idGenerator.generateId();
  if (runIdValue.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate run identifier.' });
  }

  const createdAtIso = deps.clock.nowIso();
  if (createdAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an empty timestamp.' });
  }

  let run: RunV1;
  try {
    run = parseRunV1({
      schemaVersion: 1,
      runId: runIdValue,
      workspaceId: workspaceId.toString(),
      workflowId: workflowId.toString(),
      correlationId: ctx.correlationId.toString(),
      executionTier: parsedWorkflow.executionTier,
      initiatedByUserId: ctx.principalId.toString(),
      status: 'Pending',
      createdAtIso,
    });
  } catch (error) {
    return err({
      kind: 'ValidationFailed',
      message: error instanceof Error ? error.message : 'Unable to construct run payload.',
    });
  }

  const eventIdValue = deps.idGenerator.generateId();
  if (eventIdValue.trim() === '') {
    return err({
      kind: 'DependencyFailure',
      message: 'Unable to generate event identifier.',
    });
  }

  const domainEvent = {
    schemaVersion: 1,
    eventId: eventIdValue,
    eventType: 'RunStarted',
    aggregateKind: 'Run',
    aggregateId: run.runId,
    occurredAtIso: createdAtIso,
    actorUserId: ctx.principalId,
    correlationId: ctx.correlationId,
    payload: {
      runId: run.runId,
      workflowId: workflowId.toString(),
      workspaceId: workspaceId.toString(),
    },
  };

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.runStore.saveRun(ctx.tenantId, run);
      await deps.orchestrator.startRun({
        runId: run.runId,
        tenantId: ctx.tenantId,
        workflowId,
        initiatedByUserId: ctx.principalId,
        correlationId: ctx.correlationId,
        executionTier: parsedWorkflow.executionTier,
      });
      await deps.eventPublisher.publish(
        createPortariumCloudEvent({
          source: START_WORKFLOW_SOURCE,
          eventType: `com.portarium.run.${domainEvent.eventType}`,
          eventId: eventIdValue,
          tenantId: ctx.tenantId,
          correlationId: ctx.correlationId,
          subject: `runs/${run.runId}`,
          occurredAtIso: createdAtIso,
          data: domainEvent,
        }),
      );
      const output: StartWorkflowOutput = { runId: run.runId };
      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Workflow start failed due to a dependency failure.';
    return err({ kind: 'DependencyFailure', message });
  }
}

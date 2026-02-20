import type {
  RunId as RunIdType,
  WorkflowId as WorkflowIdType,
  WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import { parseWorkflowTriggerV1, type WorkflowTriggerV1 } from '../../domain/schedule/index.js';
import {
  type AppContext,
  err,
  ok,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type { TriggerExecutionRouterPort } from '../services/trigger-execution-router.js';

type TriggerValidationInput = Readonly<{
  trigger?: unknown;
  workspaceId: WorkspaceIdType;
  workflowId: WorkflowIdType;
}>;

type TriggerRoutingInput = Readonly<{
  trigger: WorkflowTriggerV1 | undefined;
  triggerRouter: TriggerExecutionRouterPort | undefined;
  ctx: AppContext;
  runId: RunIdType;
  workflowId: WorkflowIdType;
  workspaceId: WorkspaceIdType;
}>;

export function parseStartWorkflowTrigger(
  input: TriggerValidationInput,
): Result<WorkflowTriggerV1 | undefined, ValidationFailed> {
  if (input.trigger === undefined) {
    return ok(undefined);
  }

  let trigger: WorkflowTriggerV1;
  try {
    trigger = parseWorkflowTriggerV1(input.trigger);
  } catch {
    return err({
      kind: 'ValidationFailed',
      message: 'Invalid workflow trigger payload.',
    });
  }

  if (trigger.workspaceId !== input.workspaceId || trigger.workflowId !== input.workflowId) {
    return err({
      kind: 'ValidationFailed',
      message: 'trigger workspaceId/workflowId must match command identifiers.',
    });
  }

  return ok(trigger);
}

export async function maybeRouteTriggerAtWorkflowStart(input: TriggerRoutingInput): Promise<void> {
  if (input.trigger === undefined || input.triggerRouter === undefined) {
    return;
  }

  await input.triggerRouter.routeAtWorkflowStart({
    trigger: input.trigger,
    tenantId: input.ctx.tenantId,
    runId: input.runId,
    correlationId: input.ctx.correlationId,
    payload: {
      workflowId: input.workflowId.toString(),
      workspaceId: input.workspaceId.toString(),
    },
  });
}

import type { ExecutionTier } from '../../domain/primitives/index.js';
import { WorkspaceId } from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
import {
  err,
  type Result,
  type ValidationFailed,
  type DependencyFailure,
  type Conflict,
  type Forbidden,
  type NotFound,
} from '../common/index.js';
import {
  startWorkflow,
  type StartWorkflowDeps,
  type StartWorkflowError,
} from './start-workflow.js';

const EXECUTION_TIERS: readonly ExecutionTier[] = [
  'Auto',
  'Assisted',
  'HumanApprove',
  'ManualOnly',
];

export type CreateRunInput = Readonly<{
  workspaceId: string;
  workflowId: string;
  idempotencyKey: string;
  parameters?: Readonly<Record<string, unknown>>;
  executionTier?: ExecutionTier;
}>;

export type CreateRunOutput = RunV1;

export type CreateRunError = Forbidden | ValidationFailed | NotFound | Conflict | DependencyFailure;

export type CreateRunDeps = StartWorkflowDeps;

function validateInput(input: CreateRunInput): Result<CreateRunInput, ValidationFailed> {
  if (input.parameters !== undefined) {
    if (
      typeof input.parameters !== 'object' ||
      input.parameters === null ||
      Array.isArray(input.parameters)
    ) {
      return err({
        kind: 'ValidationFailed',
        message: 'parameters must be a JSON object when present.',
      });
    }
  }
  if (input.executionTier !== undefined && !EXECUTION_TIERS.includes(input.executionTier)) {
    return err({
      kind: 'ValidationFailed',
      message: `executionTier must be one of: ${EXECUTION_TIERS.join(', ')}.`,
    });
  }
  return { ok: true, value: input };
}

export async function createRun(
  deps: CreateRunDeps,
  ctx: Parameters<typeof startWorkflow>[1],
  input: CreateRunInput,
): Promise<Result<CreateRunOutput, CreateRunError>> {
  const validation = validateInput(input);
  if (!validation.ok) return validation;

  const started = await startWorkflow(deps, ctx, {
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    idempotencyKey: input.idempotencyKey,
  });
  if (!started.ok) return started as Result<CreateRunOutput, StartWorkflowError>;

  const run = await deps.runStore.getRunById(
    ctx.tenantId,
    WorkspaceId(input.workspaceId),
    started.value.runId,
  );
  if (run === null) {
    return err({
      kind: 'DependencyFailure',
      message: `Started run ${String(started.value.runId)} could not be reloaded.`,
    });
  }

  return { ok: true, value: run };
}

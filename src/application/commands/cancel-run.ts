import {
  CorrelationId,
  EvidenceId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { parseRunV1, type RunV1 } from '../../domain/runs/index.js';
import { assertValidRunStatusTransition } from '../../domain/services/run-status-transitions.js';
import {
  type AppContext,
  APP_ACTIONS,
  err,
  ok,
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
  EvidenceLogPort,
  IdGenerator,
  RunStore,
  UnitOfWork,
} from '../ports/index.js';

const CANCEL_RUN_COMMAND = 'CancelRun';

export type CancelRunInput = Readonly<{
  workspaceId: string;
  runId: string;
  rationale?: string;
}>;

export type CancelRunOutput = RunV1;

export type CancelRunError = Forbidden | ValidationFailed | NotFound | Conflict | DependencyFailure;

export type CancelRunDeps = Readonly<{
  authorization: AuthorizationPort;
  runStore: RunStore;
  unitOfWork: UnitOfWork;
  clock: Clock;
  idGenerator: IdGenerator;
  evidenceLog?: EvidenceLogPort;
}>;

type ParsedCancelRunInput = Readonly<{
  workspaceId: ReturnType<typeof WorkspaceId>;
  runId: ReturnType<typeof RunId>;
  rationale?: string;
}>;

function validateInput(input: CancelRunInput): Result<ParsedCancelRunInput, ValidationFailed> {
  const errors: { field: string; message: string }[] = [];
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    errors.push({ field: 'workspaceId', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    errors.push({ field: 'runId', message: 'runId must be a non-empty string.' });
  }
  if (input.rationale !== undefined) {
    if (typeof input.rationale !== 'string' || input.rationale.trim() === '') {
      errors.push({ field: 'rationale', message: 'rationale must be a non-empty string.' });
    }
  }

  if (errors.length > 0) {
    return err({
      kind: 'ValidationFailed',
      message: 'Cancel run payload is invalid.',
      errors,
    });
  }

  return ok({
    workspaceId: WorkspaceId(input.workspaceId),
    runId: RunId(input.runId),
    ...(input.rationale !== undefined ? { rationale: input.rationale.trim() } : {}),
  });
}

function buildCancelledRun(run: RunV1, endedAtIso: string): Result<RunV1, Conflict> {
  if (run.status === 'Cancelled') {
    return ok(run);
  }

  try {
    assertValidRunStatusTransition(run.status, 'Cancelled');
  } catch {
    return err({
      kind: 'Conflict',
      message: `Cannot cancel Run ${String(run.runId)} from status ${run.status}.`,
    });
  }

  const { controlState: _controlState, operatorOwnerId: _operatorOwnerId, ...baseRun } = run;
  try {
    return ok(
      parseRunV1({
        ...baseRun,
        status: 'Cancelled',
        endedAtIso,
      }),
    );
  } catch (error) {
    return err({
      kind: 'Conflict',
      message: error instanceof Error ? error.message : 'Unable to construct cancelled run state.',
    });
  }
}

function buildEvidenceSummary(ctx: AppContext, run: RunV1, rationale: string | undefined): string {
  const because = rationale ? ` rationale=${rationale}` : '';
  return `${CANCEL_RUN_COMMAND}: actor=${String(ctx.principalId)} transition=${run.status}->Cancelled${because}`;
}

export async function cancelRun(
  deps: CancelRunDeps,
  ctx: AppContext,
  input: CancelRunInput,
): Promise<Result<CancelRunOutput, CancelRunError>> {
  const parsed = validateInput(input);
  if (!parsed.ok) return parsed;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.runIntervene);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runIntervene,
      message: 'Caller is not permitted to cancel runs.',
    });
  }

  const run = await deps.runStore.getRunById(
    ctx.tenantId,
    parsed.value.workspaceId,
    parsed.value.runId,
  );
  if (run === null) {
    return err({
      kind: 'NotFound',
      resource: 'Run',
      message: `Run ${input.runId} not found.`,
    });
  }

  if (String(run.workspaceId) !== String(parsed.value.workspaceId)) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runIntervene,
      message: 'Run workspace does not match requested workspace.',
    });
  }

  const endedAtIso = deps.clock.nowIso();
  if (endedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const cancelledRun = buildCancelledRun(run, endedAtIso);
  if (!cancelledRun.ok) return cancelledRun;

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.runStore.saveRun(ctx.tenantId, cancelledRun.value);
      if (deps.evidenceLog && run.status !== 'Cancelled') {
        const evidenceIdRaw = deps.idGenerator.generateId();
        if (evidenceIdRaw.trim() === '') {
          throw new Error('Unable to generate evidence identifier.');
        }
        await deps.evidenceLog.appendEntry(ctx.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(evidenceIdRaw),
          workspaceId: parsed.value.workspaceId,
          correlationId: CorrelationId(String(run.correlationId)),
          occurredAtIso: endedAtIso,
          category: 'System',
          summary: buildEvidenceSummary(ctx, run, parsed.value.rationale),
          actor: { kind: 'User', userId: UserId(String(ctx.principalId)) },
          links: { runId: parsed.value.runId },
        });
      }
      return ok(cancelledRun.value);
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Unable to cancel run.',
    });
  }
}

import {
  PlanId,
  WorkspaceId,
  type PlanId as PlanIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { PlanV1 } from '../../domain/plan/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
  err,
  ok,
} from '../common/index.js';
import type { AuthorizationPort, PlanQueryStore } from '../ports/index.js';

export type GetPlanInput = Readonly<{
  workspaceId: string;
  planId: string;
}>;

export type GetPlanOutput = Readonly<PlanV1>;

export type GetPlanError = Forbidden | ValidationFailed | NotFound;

export interface GetPlanDeps {
  authorization: AuthorizationPort;
  planQueryStore: PlanQueryStore;
}

export async function getPlan(
  deps: GetPlanDeps,
  ctx: AppContext,
  input: GetPlanInput,
): Promise<Result<GetPlanOutput, GetPlanError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.planRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.planRead,
      message: 'Caller is not permitted to read plans.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.planId !== 'string' || input.planId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'planId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let planId: PlanIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    planId = PlanId(input.planId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or planId.' });
  }

  const plan = await deps.planQueryStore.getPlanById(ctx.tenantId, workspaceId, planId);
  if (plan === null) {
    return err({
      kind: 'NotFound',
      resource: 'Plan',
      message: `Plan ${input.planId} not found.`,
    });
  }

  return ok(plan);
}

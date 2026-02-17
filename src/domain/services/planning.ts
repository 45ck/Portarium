import type { WorkflowV1, WorkflowActionV1 } from '../workflows/workflow-v1.js';
import type { PlanV1, PlannedEffectV1 } from '../plan/plan-v1.js';
import type {
  PlanId as PlanIdType,
  UserId as UserIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type PlanValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; duplicateEffectIds: readonly string[] }>;

export function buildPlanFromWorkflow(params: {
  workflow: WorkflowV1;
  workspaceId: WorkspaceIdType;
  createdByUserId: UserIdType;
  planId: PlanIdType;
  createdAtIso: string;
  effectFactory: (action: WorkflowActionV1) => PlannedEffectV1;
}): PlanV1 {
  const { workflow, workspaceId, createdByUserId, planId, createdAtIso, effectFactory } = params;

  const plannedEffects = workflow.actions.map((action) => effectFactory(action));

  return {
    schemaVersion: 1,
    planId,
    workspaceId,
    createdAtIso,
    createdByUserId,
    plannedEffects,
  };
}

export function validatePlanEffectIds(plan: PlanV1): PlanValidationResult {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const effect of plan.plannedEffects) {
    const id = effect.effectId as string;
    if (seen.has(id)) {
      if (!duplicates.includes(id)) {
        duplicates.push(id);
      }
    } else {
      seen.add(id);
    }
  }

  if (duplicates.length > 0) {
    return { ok: false, duplicateEffectIds: duplicates };
  }

  return { ok: true };
}

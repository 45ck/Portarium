import {
  parseProjectIntentV1,
  type IntentTriggerSource,
  type ProjectIntentV1,
} from '../../domain/beads/index.js';
import { UserId, WorkspaceId } from '../../domain/primitives/index.js';
import { planBeadsForIntent, type BeadPlannerResult } from './bead-planner.js';

export type RouteIntentInput = Readonly<{
  workspaceId: string;
  triggerText: string;
  actorUserId: string;
  source?: IntentTriggerSource;
  constraints?: readonly string[];
}>;

export type IntentRouterDeps = Readonly<{
  clock: { nowIso: () => string };
  idGenerator: { generateId: () => string };
}>;

export type IntentRouterResult = Readonly<{
  intent: ProjectIntentV1;
}> &
  BeadPlannerResult;

export class IntentRouterValidationError extends Error {
  public override readonly name = 'IntentRouterValidationError';
}

export function routeProjectIntent(
  input: RouteIntentInput,
  deps: IntentRouterDeps,
): IntentRouterResult {
  const normalizedGoal = normalizeGoal(input.triggerText);
  if (normalizedGoal.length < 8) {
    throw new IntentRouterValidationError('triggerText must describe the work to plan.');
  }

  const intent = parseProjectIntentV1({
    schemaVersion: 1,
    intentId: `intent-${deps.idGenerator.generateId()}`,
    workspaceId: WorkspaceId(input.workspaceId),
    createdAtIso: deps.clock.nowIso(),
    createdByUserId: UserId(input.actorUserId),
    source: input.source ?? 'Human',
    prompt: input.triggerText,
    normalizedGoal,
    constraints: input.constraints ?? [],
  });

  return {
    intent,
    ...planBeadsForIntent(intent, deps),
  };
}

function normalizeGoal(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

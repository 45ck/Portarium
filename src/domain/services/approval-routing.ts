import type { WorkflowV1 } from '../workflows/workflow-v1.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import type { UserId as UserIdType } from '../primitives/index.js';

export type ApprovalReason =
  | 'ExecutionTierRequiresApproval'
  | 'MakerCheckerRequired'
  | 'DistinctApproversRequired';

export type ApprovalRequirementV1 = Readonly<{
  reason: ApprovalReason;
  minimumApprovers: number;
  excludedUserIds: readonly UserIdType[];
}>;

export function determineRequiredApprovals(params: {
  workflow: WorkflowV1;
  initiatorUserId: UserIdType;
  policies: readonly PolicyV1[];
}): readonly ApprovalRequirementV1[] {
  const { workflow, initiatorUserId, policies } = params;
  const requirements: ApprovalRequirementV1[] = [];

  requirements.push(...tierRequirements(workflow));
  requirements.push(...sodRequirements(policies, initiatorUserId));

  return deduplicateRequirements(requirements);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPROVAL_TIERS = new Set(['HumanApprove', 'ManualOnly']);

function tierRequirements(workflow: WorkflowV1): readonly ApprovalRequirementV1[] {
  const requirements: ApprovalRequirementV1[] = [];

  if (APPROVAL_TIERS.has(workflow.executionTier)) {
    requirements.push(makeTierRequirement());
  }

  for (const action of workflow.actions) {
    if (action.executionTierOverride && APPROVAL_TIERS.has(action.executionTierOverride)) {
      requirements.push(makeTierRequirement());
    }
  }

  return requirements;
}

function makeTierRequirement(): ApprovalRequirementV1 {
  return { reason: 'ExecutionTierRequiresApproval', minimumApprovers: 1, excludedUserIds: [] };
}

function sodRequirements(
  policies: readonly PolicyV1[],
  initiatorUserId: UserIdType,
): readonly ApprovalRequirementV1[] {
  const requirements: ApprovalRequirementV1[] = [];
  let hasMakerChecker = false;
  let maxDistinctApprovers = 0;

  for (const policy of policies) {
    if (!policy.sodConstraints) continue;

    for (const constraint of policy.sodConstraints) {
      if (constraint.kind === 'MakerChecker') {
        hasMakerChecker = true;
      } else if (
        constraint.kind === 'DistinctApprovers' &&
        constraint.minimumApprovers > maxDistinctApprovers
      ) {
        maxDistinctApprovers = constraint.minimumApprovers;
      }
    }
  }

  if (hasMakerChecker) {
    requirements.push({
      reason: 'MakerCheckerRequired',
      minimumApprovers: 1,
      excludedUserIds: [initiatorUserId],
    });
  }

  if (maxDistinctApprovers > 0) {
    requirements.push({
      reason: 'DistinctApproversRequired',
      minimumApprovers: maxDistinctApprovers,
      excludedUserIds: [],
    });
  }

  return requirements;
}

function deduplicateRequirements(
  requirements: readonly ApprovalRequirementV1[],
): readonly ApprovalRequirementV1[] {
  const seen = new Set<ApprovalReason>();
  const result: ApprovalRequirementV1[] = [];

  for (const req of requirements) {
    if (seen.has(req.reason)) continue;
    seen.add(req.reason);
    result.push(req);
  }

  return result;
}

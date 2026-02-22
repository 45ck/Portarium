// cspell:ignore haxl
/**
 * Policy Evaluation Pipeline with Explainability (bead-haxl).
 *
 * Wraps the existing policy evaluators to produce:
 *   - Per-policy outcomes (Pass | Fail | NeedsHuman)
 *   - Human-readable traces explaining why each rule/constraint/hazard triggered
 *   - Responsibility mappings (required roles, min approvers, separation requirements)
 *   - An immutable `PolicyEvaluationSnapshotV1` captured at approval-creation time
 *
 * Goal: every approval decision is grounded in policy + evidence — no "approvals as vibes".
 *
 * Design:
 *   evaluatePolicyPipelineV1() → PolicyEvaluationSnapshotV1
 *     ↳ evaluatePolicy()   (per-policy, from policy-evaluation.ts)
 *       ↳ SoD violation traces
 *       ↳ Safety hazard traces
 *       ↳ Inline rule traces
 *     ↳ buildResponsibilityMapping() — scans all policy SoD constraints
 *     ↳ deepFreeze() — immutable snapshot
 */

import type { PolicyId as PolicyIdType } from '../primitives/index.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import type { SodConstraintV1, SodViolationV1 } from '../policy/sod-constraints-v1.js';
import type {
  HazardClassificationV1,
  SafetyTierRecommendation,
} from './policy-safety-evaluation.js';
import {
  evaluatePolicy,
  type PolicyDecisionV1,
  type PolicyEvaluationContextV1,
  type PolicyEvaluationResultV1,
} from './policy-evaluation.js';

// ---------------------------------------------------------------------------
// Outcome type
// ---------------------------------------------------------------------------

/**
 * The per-policy outcome after evaluation.
 *
 * - `Pass`       — policy is satisfied; no gates triggered.
 * - `Fail`       — policy is violated in a way that cannot be resolved by adding approvers.
 * - `NeedsHuman` — policy requires human approval (one or more SoD/safety gates triggered).
 */
export type PolicyEvaluationOutcomeV1 = 'Pass' | 'Fail' | 'NeedsHuman';

// ---------------------------------------------------------------------------
// Trace types
// ---------------------------------------------------------------------------

/** The category of evaluation step that produced a trace entry. */
export type PolicyTraceEntryKindV1 = 'InlineRule' | 'SodConstraint' | 'SafetyHazard';

/**
 * A single entry in the evaluation trace.
 *
 * Each entry records one reason why a policy gate triggered (or passed).
 * The `explanation` field is human-readable and intended for display in the
 * approval UI so approvers understand why they are being asked to review.
 */
export type PolicyTraceEntryV1 = Readonly<{
  /** Category of the evaluation element that produced this trace. */
  kind: PolicyTraceEntryKindV1;
  /**
   * Stable identifier for the triggering element.
   * - InlineRule:   the `ruleId` from the policy rule.
   * - SodConstraint: the constraint kind (e.g. `'MakerChecker'`).
   * - SafetyHazard:  the hazard classification code (e.g. `'RobotEstopRequest'`).
   */
  triggerId: string;
  /** Human-readable explanation of why this element triggered. */
  explanation: string;
  /** The outcome this element contributed. */
  outcome: PolicyEvaluationOutcomeV1;
}>;

// ---------------------------------------------------------------------------
// Per-policy result
// ---------------------------------------------------------------------------

/**
 * The evaluation result for a single `PolicyV1`.
 * Contains the aggregate outcome for that policy and the detailed trace.
 */
export type PolicyEvaluationPolicyResultV1 = Readonly<{
  policyId: PolicyIdType;
  policyName: string;
  /** Aggregate outcome for this policy. */
  outcome: PolicyEvaluationOutcomeV1;
  /** Ordered trace: one entry per triggered rule/constraint/hazard. */
  traces: readonly PolicyTraceEntryV1[];
}>;

// ---------------------------------------------------------------------------
// Responsibility mapping
// ---------------------------------------------------------------------------

/**
 * Responsibility requirements derived from policy evaluation.
 *
 * Scanned from all active SoD constraints across all evaluated policies.
 * Intended to drive assignment UI: "who needs to approve this?".
 */
export type PolicyResponsibilityMappingV1 = Readonly<{
  /**
   * Union of all required roles (from `SpecialistApproval` constraints).
   * At least one approver must hold at least one of these roles.
   * Empty if no SpecialistApproval constraints apply.
   */
  requiredRoles: readonly string[];
  /**
   * Minimum number of distinct approvers required.
   * Derived from `DistinctApprovers` and `SafetyClassifiedZoneDualApproval` constraints.
   * Defaults to 1 if no explicit constraint is present.
   */
  minimumApprovers: number;
  /** `true` when any policy requires initiator ≠ approver (MakerChecker). */
  requiresMakerCheckerSeparation: boolean;
  /** `true` when SafetyClassifiedZoneDualApproval applies (min 2 approvers, safety-certified). */
  requiresDualApproval: boolean;
  /** `true` when RemoteEstopRequesterSeparation applies. */
  requiresEstopRequesterSeparation: boolean;
}>;

// ---------------------------------------------------------------------------
// Snapshot — the immutable record captured at approval-creation time
// ---------------------------------------------------------------------------

/**
 * An immutable snapshot of the policy evaluation captured at the moment an
 * approval request is created.
 *
 * This snapshot is stored with the approval record and never mutated.
 * It provides a durable audit trail: even if policies are later changed, the
 * approval record always reflects what was evaluated when it was opened.
 */
export type PolicyEvaluationSnapshotV1 = Readonly<{
  schemaVersion: 1;
  /** ISO-8601 timestamp when this snapshot was captured. */
  capturedAtIso: string;
  /** Aggregate outcome across all evaluated policies. */
  aggregateOutcome: PolicyEvaluationOutcomeV1;
  /** Per-policy breakdown — ordered by policy priority (ascending). */
  policyResults: readonly PolicyEvaluationPolicyResultV1[];
  /** Responsibility requirements derived from all policies. */
  responsibilityMapping: PolicyResponsibilityMappingV1;
  /** IDs of all evaluated policies (for cross-referencing audit records). */
  evaluatedPolicyIds: readonly PolicyIdType[];
  /** Optional safety tier recommendation (when safety hazards were detected). */
  safetyTierRecommendation?: SafetyTierRecommendation;
}>;

// ---------------------------------------------------------------------------
// Pipeline entry point
// ---------------------------------------------------------------------------

/**
 * Run the full policy evaluation pipeline and return an immutable snapshot.
 *
 * @param policies      Active policies sorted by `priority` (ascending, lowest first).
 *                      The caller is responsible for filtering to the relevant policy set.
 * @param context       Evaluation context (initiator, approvers, robot/safety context, etc.)
 * @param capturedAtIso ISO-8601 timestamp for the snapshot. Typically `new Date().toISOString()`.
 */
export function evaluatePolicyPipelineV1(params: {
  policies: readonly PolicyV1[];
  context: PolicyEvaluationContextV1;
  capturedAtIso: string;
}): PolicyEvaluationSnapshotV1 {
  const { policies, context, capturedAtIso } = params;

  // Evaluate each policy individually and build per-policy results with traces.
  const policyResults: PolicyEvaluationPolicyResultV1[] = [];
  const allPolicyIds: PolicyIdType[] = [];
  let worstOutcome: PolicyEvaluationOutcomeV1 = 'Pass';
  let safetyTierRecommendation: SafetyTierRecommendation | undefined;

  for (const policy of policies) {
    const result = evaluatePolicy({ policy, context });
    const traces = buildTraces(policy, result);
    const outcome = decisionToOutcome(result.decision);

    policyResults.push({
      policyId: policy.policyId,
      policyName: policy.name,
      outcome,
      traces,
    });

    allPolicyIds.push(policy.policyId);
    worstOutcome = mergeOutcome(worstOutcome, outcome);

    if (result.safetyTierRecommendation) {
      safetyTierRecommendation =
        safetyTierRecommendation === undefined ||
        tierSeverity(result.safetyTierRecommendation) > tierSeverity(safetyTierRecommendation)
          ? result.safetyTierRecommendation
          : safetyTierRecommendation;
    }
  }

  const responsibilityMapping = buildResponsibilityMapping(policies);

  const snapshot: PolicyEvaluationSnapshotV1 = {
    schemaVersion: 1,
    capturedAtIso,
    aggregateOutcome: worstOutcome,
    policyResults,
    responsibilityMapping,
    evaluatedPolicyIds: allPolicyIds,
    ...(safetyTierRecommendation ? { safetyTierRecommendation } : {}),
  };

  return deepFreezeSnapshot(snapshot);
}

// ---------------------------------------------------------------------------
// Trace builders
// ---------------------------------------------------------------------------

function buildTraces(
  policy: PolicyV1,
  result: PolicyEvaluationResultV1,
): readonly PolicyTraceEntryV1[] {
  const traces: PolicyTraceEntryV1[] = [];

  // Inline rule errors — reported as Fail entries
  if (result.inlineRuleErrors && result.inlineRuleErrors.length > 0) {
    for (const errorMsg of result.inlineRuleErrors) {
      traces.push({
        kind: 'InlineRule',
        triggerId: 'inline-rule-error',
        explanation: `Policy rule evaluation failed: ${errorMsg}`,
        outcome: 'Fail',
      });
    }
    return traces;
  }

  // SoD violation traces
  for (const violation of result.violations) {
    traces.push(buildViolationTrace(violation));
  }

  // Safety hazard traces
  if (result.hazardClassifications) {
    for (const hazard of result.hazardClassifications) {
      traces.push(buildHazardTrace(hazard));
    }
  }

  // Inline rule matches (Pass or Fail/NeedsHuman from matching rules)
  // We derive these from the policy rules + the final decision when no violations.
  // If there are no violations and no hazards, a matching Allow rule produced a Pass trace.
  if (
    traces.length === 0 &&
    result.decision === 'Allow' &&
    policy.rules &&
    policy.rules.length > 0
  ) {
    traces.push({
      kind: 'InlineRule',
      triggerId: 'inline-rules',
      explanation: `All inline rules evaluated to Allow.`,
      outcome: 'Pass',
    });
  } else if (traces.length === 0 && result.decision === 'Allow') {
    traces.push({
      kind: 'SodConstraint',
      triggerId: 'no-constraints',
      explanation: 'No active policy constraints; request passes automatically.',
      outcome: 'Pass',
    });
  }

  return traces;
}

function buildViolationTrace(violation: SodViolationV1): PolicyTraceEntryV1 {
  switch (violation.kind) {
    case 'MakerCheckerViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'MakerChecker',
        explanation:
          `Maker-checker: the initiator (${violation.initiatorUserId}) cannot also be the approver. ` +
          `A different user must approve this request.`,
        outcome: 'NeedsHuman',
      };

    case 'DistinctApproversViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'DistinctApprovers',
        explanation:
          `Distinct approvers: requires ${violation.requiredApprovers} distinct approver(s), ` +
          `but only ${violation.distinctApprovers} distinct approver(s) are present. ` +
          `Additional approvers must be added.`,
        outcome: 'NeedsHuman',
      };

    case 'IncompatibleDutiesViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'IncompatibleDuties',
        explanation:
          `Incompatible duties: user ${violation.userId} has performed duties ` +
          `[${violation.dutyKeys.join(', ')}] that conflict with this approval ` +
          `(constraint covers duties: [${violation.constraintDutyKeys.join(', ')}]).`,
        outcome: 'Fail',
      };

    case 'HazardousZoneNoSelfApprovalViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'HazardousZoneNoSelfApproval',
        explanation:
          `Hazardous zone: the mission proposer (${violation.missionProposerUserId}) ` +
          `cannot approve their own hazardous zone request. A separate approver is required.`,
        outcome: 'NeedsHuman',
      };

    case 'SafetyClassifiedZoneDualApprovalViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'SafetyClassifiedZoneDualApproval',
        explanation:
          `Safety-classified zone: dual approval required (2 distinct approvers). ` +
          `Currently ${violation.distinctApprovers} approver(s) present; ` +
          `${2 - violation.distinctApprovers} more required.`,
        outcome: 'NeedsHuman',
      };

    case 'RemoteEstopRequesterSeparationViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'RemoteEstopRequesterSeparation',
        explanation:
          `Remote E-Stop separation: the E-Stop requester (${violation.estopRequesterUserId}) ` +
          `cannot approve their own E-Stop request. A different operator must approve.`,
        outcome: 'NeedsHuman',
      };

    case 'SpecialistApprovalViolation':
      return {
        kind: 'SodConstraint',
        triggerId: 'SpecialistApproval',
        explanation:
          `Specialist approval required: ${violation.rationale} ` +
          `At least one approver must hold one of the following roles: ` +
          `[${violation.requiredRoles.join(', ')}].`,
        outcome: 'NeedsHuman',
      };
  }
}

function buildHazardTrace(hazard: HazardClassificationV1): PolicyTraceEntryV1 {
  const outcome: PolicyEvaluationOutcomeV1 =
    hazard.recommendedTier === 'ManualOnly' ? 'NeedsHuman' : 'NeedsHuman';
  return {
    kind: 'SafetyHazard',
    triggerId: hazard.code,
    explanation:
      `Safety hazard [${hazard.code}]: ${hazard.reason} ` +
      `(recommended tier: ${hazard.recommendedTier}, ref: ${hazard.standardsRef})`,
    outcome,
  };
}

// ---------------------------------------------------------------------------
// Responsibility mapping
// ---------------------------------------------------------------------------

function buildResponsibilityMapping(policies: readonly PolicyV1[]): PolicyResponsibilityMappingV1 {
  const allRoles: string[] = [];
  let minimumApprovers = 1;
  let requiresMakerCheckerSeparation = false;
  let requiresDualApproval = false;
  let requiresEstopRequesterSeparation = false;

  for (const policy of policies) {
    if (!policy.sodConstraints) continue;
    for (const constraint of policy.sodConstraints) {
      applyConstraintToMapping(constraint, {
        allRoles,
        onMinApprovers: (n) => {
          if (n > minimumApprovers) minimumApprovers = n;
        },
        onMakerChecker: () => {
          requiresMakerCheckerSeparation = true;
        },
        onDualApproval: () => {
          requiresDualApproval = true;
          if (minimumApprovers < 2) minimumApprovers = 2;
        },
        onEstopSeparation: () => {
          requiresEstopRequesterSeparation = true;
        },
      });
    }
  }

  // Deduplicate required roles
  const uniqueRoles = [...new Set(allRoles)];

  return Object.freeze({
    requiredRoles: Object.freeze(uniqueRoles),
    minimumApprovers,
    requiresMakerCheckerSeparation,
    requiresDualApproval,
    requiresEstopRequesterSeparation,
  });
}

function applyConstraintToMapping(
  constraint: SodConstraintV1,
  handlers: {
    allRoles: string[];
    onMinApprovers: (n: number) => void;
    onMakerChecker: () => void;
    onDualApproval: () => void;
    onEstopSeparation: () => void;
  },
): void {
  switch (constraint.kind) {
    case 'MakerChecker':
      handlers.onMakerChecker();
      break;
    case 'DistinctApprovers':
      handlers.onMinApprovers(constraint.minimumApprovers);
      break;
    case 'SpecialistApproval':
      handlers.allRoles.push(...constraint.requiredRoles);
      break;
    case 'SafetyClassifiedZoneDualApproval':
      handlers.onDualApproval();
      break;
    case 'RemoteEstopRequesterSeparation':
      handlers.onEstopSeparation();
      break;
    case 'IncompatibleDuties':
    case 'HazardousZoneNoSelfApproval':
      // These don't drive responsibility mapping (they are eligibility exclusions, not requirements).
      break;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decisionToOutcome(decision: PolicyDecisionV1): PolicyEvaluationOutcomeV1 {
  switch (decision) {
    case 'Allow':
      return 'Pass';
    case 'RequireApproval':
      return 'NeedsHuman';
    case 'Deny':
      return 'Fail';
  }
}

const OUTCOME_SEVERITY: Record<PolicyEvaluationOutcomeV1, number> = {
  Pass: 0,
  NeedsHuman: 1,
  Fail: 2,
};

function mergeOutcome(
  a: PolicyEvaluationOutcomeV1,
  b: PolicyEvaluationOutcomeV1,
): PolicyEvaluationOutcomeV1 {
  return OUTCOME_SEVERITY[a] >= OUTCOME_SEVERITY[b] ? a : b;
}

const TIER_SEVERITY: Record<SafetyTierRecommendation, number> = {
  HumanApprove: 1,
  ManualOnly: 2,
};

function tierSeverity(tier: SafetyTierRecommendation): number {
  return TIER_SEVERITY[tier];
}

function deepFreezeSnapshot(snapshot: PolicyEvaluationSnapshotV1): PolicyEvaluationSnapshotV1 {
  if (snapshot === null || typeof snapshot !== 'object') return snapshot;
  Object.freeze(snapshot);
  for (const key of Object.keys(snapshot as object)) {
    const child = (snapshot as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreezeObj(child);
    }
  }
  return snapshot;
}

function deepFreezeObj(obj: unknown): void {
  if (obj === null || typeof obj !== 'object') return;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreezeObj(child);
    }
  }
}

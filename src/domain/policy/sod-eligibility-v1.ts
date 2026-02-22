/**
 * Approver Eligibility Resolver (bead-7rlf).
 *
 * Translates a set of SoD constraints into a human-readable eligibility manifest
 * at **approval-creation time** — before any approver acts.
 *
 * This is the proactive counterpart to the reactive `evaluateSodConstraintsV1`,
 * which checks for violations at decision time.
 *
 * Usage:
 *   - At approval creation, call `resolveApproverEligibilityV1(constraints, robotContext)`
 *     to get the `SodEligibilityManifestV1`.
 *   - Surface `manifest.requirements` in the approval UI so approvers understand:
 *       • who is eligible to approve
 *       • why each approver type is required
 *       • what policy/rule is being satisfied
 *
 * See `sod-constraints-v1.ts` for the constraint types and violation evaluation.
 */

import type { RobotSodContextV1, SodConstraintV1 } from './sod-constraints-v1.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single eligibility requirement derived from one SoD constraint.
 * Each requirement answers: "What must be true of any valid approver?"
 */
export type SodEligibilityRequirementV1 =
  | Readonly<{
      kind: 'MustNotBeInitiator';
      /** Human-readable rationale shown in the approval UI. */
      rationale: string;
    }>
  | Readonly<{
      kind: 'MustBeDistinctFrom';
      /** Total number of distinct approvers needed across the approval lifecycle. */
      minimumDistinct: number;
      rationale: string;
    }>
  | Readonly<{
      kind: 'MustHaveOneOfRoles';
      /** At least one approver must hold at least one of these roles. */
      requiredRoles: readonly string[];
      /** Caller-supplied rationale (from the SpecialistApproval constraint). */
      rationale: string;
    }>
  | Readonly<{
      kind: 'MustNotHaveIncompatibleDuties';
      /** Duty keys that must not be combined on a single user's approval record. */
      dutyKeys: readonly string[];
      rationale: string;
    }>
  | Readonly<{
      kind: 'MustNotBeMissionProposer';
      rationale: string;
    }>
  | Readonly<{
      kind: 'RequiresDualApproval';
      /** Safety-classified zones require exactly 2 distinct approvers. */
      minimumDistinct: 2;
      rationale: string;
    }>
  | Readonly<{
      kind: 'MustNotBeEstopRequester';
      rationale: string;
    }>;

/**
 * Resolved eligibility manifest for an approval.
 *
 * Contains all requirements any approver must satisfy, derived from the policy
 * constraints attached to the approval at creation time.
 *
 * Surface `requirements` in the approval UI so stakeholders always know:
 *   - who is eligible to approve
 *   - why each requirement exists
 *   - which rule/policy is being satisfied or violated
 */
export type SodEligibilityManifestV1 = Readonly<{
  /** Ordered list of requirements.  Empty when there are no SoD constraints. */
  requirements: readonly SodEligibilityRequirementV1[];
}>;

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the approver eligibility manifest for a set of SoD constraints.
 *
 * Call this at approval-creation time to produce human-readable requirements
 * that can be surfaced in the UI.  The `robotContext` hint is used to activate
 * robot-specific requirements (hazardous zone, safety-classified zone, e-stop).
 *
 * @param constraints  The SoD constraints attached to the approval's policy.
 * @param robotContext Optional robot execution context (same context used during evaluation).
 */
export function resolveApproverEligibilityV1(
  constraints: readonly SodConstraintV1[],
  robotContext?: Pick<
    RobotSodContextV1,
    'hazardousZone' | 'safetyClassifiedZone' | 'remoteEstopRequest'
  >,
): SodEligibilityManifestV1 {
  const requirements: SodEligibilityRequirementV1[] = [];

  for (const constraint of constraints) {
    requirements.push(...constraintToRequirements(constraint, robotContext));
  }

  return Object.freeze({ requirements: Object.freeze(requirements) });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function constraintToRequirements(
  constraint: SodConstraintV1,
  robotContext?: Pick<
    RobotSodContextV1,
    'hazardousZone' | 'safetyClassifiedZone' | 'remoteEstopRequest'
  >,
): readonly SodEligibilityRequirementV1[] {
  switch (constraint.kind) {
    case 'MakerChecker':
      return [
        {
          kind: 'MustNotBeInitiator',
          rationale: 'The approver must be different from the user who initiated this request.',
        },
      ];

    case 'DistinctApprovers':
      return [
        {
          kind: 'MustBeDistinctFrom',
          minimumDistinct: constraint.minimumApprovers,
          rationale: `At least ${constraint.minimumApprovers} distinct approvers are required.`,
        },
      ];

    case 'IncompatibleDuties':
      return [
        {
          kind: 'MustNotHaveIncompatibleDuties',
          dutyKeys: constraint.dutyKeys,
          rationale: `A single user must not perform more than one of these duties: ${constraint.dutyKeys.join(', ')}.`,
        },
      ];

    case 'HazardousZoneNoSelfApproval':
      if (!robotContext?.hazardousZone) return [];
      return [
        {
          kind: 'MustNotBeMissionProposer',
          rationale:
            'Hazardous-zone operations require the approver to be different from the mission proposer.',
        },
      ];

    case 'SafetyClassifiedZoneDualApproval':
      if (!robotContext?.safetyClassifiedZone) return [];
      return [
        {
          kind: 'RequiresDualApproval',
          minimumDistinct: 2,
          rationale:
            'Safety-classified zone operations require approval from at least 2 distinct approvers.',
        },
      ];

    case 'RemoteEstopRequesterSeparation':
      if (!robotContext?.remoteEstopRequest) return [];
      return [
        {
          kind: 'MustNotBeEstopRequester',
          rationale:
            'Remote e-stop overrides require the approver to be different from the e-stop requester.',
        },
      ];

    case 'SpecialistApproval':
      return [
        {
          kind: 'MustHaveOneOfRoles',
          requiredRoles: constraint.requiredRoles,
          rationale: constraint.rationale,
        },
      ];

    default:
      return assertNever(constraint);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled SoD constraint in eligibility resolver: ${JSON.stringify(value)}`);
}

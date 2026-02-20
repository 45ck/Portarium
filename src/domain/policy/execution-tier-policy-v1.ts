import type { ExecutionTier, WorkspaceId as WorkspaceIdType } from '../primitives/index.js';

/**
 * Environment tiers define the enforcement strictness for a deployment.
 */
export type EnvironmentTier = 'dev' | 'staging' | 'prod';

/**
 * Environment-specific enforcement configuration for execution tiers.
 */
export type ExecutionTierEnforcementV1 = Readonly<{
  /** The environment tier this configuration applies to. */
  environmentTier: EnvironmentTier;
  /** Execution tier at or above which human approval is mandatory. */
  approvalRequiredAbove: ExecutionTier;
  /** Whether policy violations are hard-enforced (deny) or logged-only. */
  enforcement: 'strict' | 'logged';
  /** Whether tier override is permitted in this environment. */
  allowOverride: boolean;
}>;

/**
 * A tier override record with audit trail.
 */
export type TierOverrideV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  /** The original execution tier before override. */
  originalTier: ExecutionTier;
  /** The overridden execution tier. */
  overriddenTier: ExecutionTier;
  /** User who authorized the override. */
  authorizedBy: string;
  /** ISO 8601 timestamp of the override. */
  overriddenAtIso: string;
  /** Justification for the override. */
  reason: string;
}>;

const TIER_SEVERITY: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

/**
 * Default enforcement profiles for each environment tier.
 */
export const ENVIRONMENT_TIER_DEFAULTS: Record<EnvironmentTier, ExecutionTierEnforcementV1> = {
  dev: {
    environmentTier: 'dev',
    approvalRequiredAbove: 'ManualOnly',
    enforcement: 'logged',
    allowOverride: true,
  },
  staging: {
    environmentTier: 'staging',
    approvalRequiredAbove: 'HumanApprove',
    enforcement: 'strict',
    allowOverride: true,
  },
  prod: {
    environmentTier: 'prod',
    approvalRequiredAbove: 'Assisted',
    enforcement: 'strict',
    allowOverride: false,
  },
};

export type TierDecision = 'Allow' | 'RequireApproval' | 'Deny';

export type TierEvaluationResult = Readonly<{
  decision: TierDecision;
  enforcement: 'strict' | 'logged';
  overrideApplied: boolean;
}>;

/**
 * Evaluate whether a command at a given execution tier is allowed in the
 * specified environment.
 */
export function evaluateExecutionTierPolicy(params: {
  executionTier: ExecutionTier;
  environmentTier: EnvironmentTier;
  override?: TierOverrideV1;
  enforcementConfig?: ExecutionTierEnforcementV1;
}): TierEvaluationResult {
  const config = params.enforcementConfig ?? ENVIRONMENT_TIER_DEFAULTS[params.environmentTier];
  const effectiveTier = params.override ? params.override.overriddenTier : params.executionTier;
  const overrideApplied = params.override !== undefined;

  if (effectiveTier === 'ManualOnly') {
    return { decision: 'Deny', enforcement: config.enforcement, overrideApplied };
  }

  const tierLevel = TIER_SEVERITY[effectiveTier];
  const thresholdLevel = TIER_SEVERITY[config.approvalRequiredAbove];

  if (tierLevel >= thresholdLevel) {
    return { decision: 'RequireApproval', enforcement: config.enforcement, overrideApplied };
  }

  return { decision: 'Allow', enforcement: config.enforcement, overrideApplied };
}

/**
 * Validate that a tier override is permitted in the given environment.
 */
export function validateTierOverride(params: {
  environmentTier: EnvironmentTier;
  enforcementConfig?: ExecutionTierEnforcementV1;
}): boolean {
  const config = params.enforcementConfig ?? ENVIRONMENT_TIER_DEFAULTS[params.environmentTier];
  return config.allowOverride;
}

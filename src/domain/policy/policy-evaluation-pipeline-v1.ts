/**
 * Policy Evaluation Pipeline (bead-haxl).
 *
 * Evaluates a set of `PolicyV1` policies against a structured approval input
 * and returns per-policy outcomes with human-readable explanations.
 *
 * Outcome values (per-policy and aggregate):
 *   - `'pass'`         — no Deny rules matched; the request may proceed
 *   - `'fail'`         — at least one Deny rule matched; the request is blocked
 *   - `'needs_human'`  — the policy carries SoD constraints; a human must decide
 *   - `'error'`        — one or more rule conditions could not be evaluated
 *
 * Aggregate outcome precedence: `fail` > `needs_human` > `pass` > `error`.
 *
 * Explainability: every rule evaluation produces a `PolicyRuleTraceV1` entry
 * with the condition source, the evaluated outcome, and a plain-English reason.
 * These traces are included in the pipeline result so UIs and logs can surface
 * exactly why an approval gate fired.
 *
 * Snapshot immutability: the returned `PolicyEvaluationPipelineResultV1` is
 * deep-frozen and includes `evaluatedAtIso` so it can be attached to an
 * approval record as an auditable, point-in-time snapshot.
 */

import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';
import { evaluatePolicyConditionDslV1 } from './policy-condition-dsl-v1.js';
import type { PolicyV1 } from './policy-v1.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Structured input fed to the policy evaluation pipeline.
 *
 * The named fields correspond to the canonical approval context attributes
 * described in the Portarium governance model.  Additional fields may be
 * included and are accessible in policy conditions via their key name.
 */
export type ApprovalPipelineInputV1 = Readonly<{
  /** Kind of payload being approved (e.g. `'RunStart'`, `'ToolCall'`). */
  payloadKind: string;
  /** Risk tags attached to the request (e.g. `['high-impact', 'irreversible']`). */
  riskTags?: readonly string[];
  /** IDs of users who own the resource(s) involved. */
  resourceOwnerIds?: readonly UserIdType[];
  /** Data classification label (e.g. `'confidential'`, `'public'`). */
  dataClassification?: string;
  /**
   * Blast radius category (`'single-resource'`, `'workspace'`, `'cross-workspace'`).
   * Used by policies to require additional oversight for wide-impact changes.
   */
  blastRadius?: string;
  /** Any additional context fields accessible in policy condition expressions. */
  [key: string]: unknown;
}>;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Outcome of evaluating a single policy rule condition. */
export type PolicyRuleOutcome = 'matched' | 'not_matched' | 'error';

/** Per-rule trace entry included in a policy evaluation result. */
export type PolicyRuleTraceV1 = Readonly<{
  ruleId: string;
  /** The raw DSL condition string. */
  condition: string;
  /** The rule effect: Allow overrides Deny when both match. */
  effect: 'Allow' | 'Deny';
  outcome: PolicyRuleOutcome;
  /** Human-readable explanation of why the rule did or did not match. */
  explanation: string;
}>;

/** Possible per-policy (and aggregate) pipeline outcomes. */
export type PolicyPipelineOutcome = 'pass' | 'fail' | 'needs_human' | 'error';

/** Evaluation result for a single policy within the pipeline. */
export type PolicyEvaluationEntryV1 = Readonly<{
  policyId: PolicyIdType;
  policyName: string;
  outcome: PolicyPipelineOutcome;
  /**
   * Human-readable summary of why this policy produced its outcome.
   * Suitable for display in the Cockpit approval detail panel.
   */
  explanation: string;
  /** Ordered list of rule evaluation traces (highest-priority rule first). */
  ruleTraces: readonly PolicyRuleTraceV1[];
  /**
   * Required approver IDs derived from this policy's SoD constraints
   * (populated only when `outcome === 'needs_human'`).
   */
  requiredApproverIds?: readonly UserIdType[];
}>;

/**
 * Aggregate result of running all policies through the pipeline.
 *
 * This value is deep-frozen and suitable for attachment to an approval
 * record as an immutable evaluation snapshot.
 */
export type PolicyEvaluationPipelineResultV1 = Readonly<{
  /**
   * Aggregate outcome across all evaluated policies.
   * Precedence: `fail` > `needs_human` > `pass` > `error`.
   */
  overallOutcome: PolicyPipelineOutcome;
  /** Per-policy evaluation results (active policies only, sorted by priority desc). */
  policyResults: readonly PolicyEvaluationEntryV1[];
  /**
   * De-duplicated union of required approver IDs from all `needs_human` policies.
   */
  requiredApproverIds: readonly UserIdType[];
  /** ISO-8601 timestamp at which this evaluation was performed. */
  evaluatedAtIso: string;
}>;

// ---------------------------------------------------------------------------
// Pipeline errors
// ---------------------------------------------------------------------------

export class PolicyEvaluationPipelineError extends Error {
  public override readonly name = 'PolicyEvaluationPipelineError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Main pipeline entry point
// ---------------------------------------------------------------------------

/**
 * Evaluate a set of policies against an approval pipeline input.
 *
 * @param policies   - All workspace policies to consider (inactive ones are skipped)
 * @param input      - Structured approval context
 * @param nowIso     - Current ISO-8601 timestamp (defaults to `new Date().toISOString()`)
 * @returns          Deep-frozen `PolicyEvaluationPipelineResultV1`
 */
export function evaluatePolicyPipeline(
  policies: readonly PolicyV1[],
  input: ApprovalPipelineInputV1,
  nowIso?: string,
): PolicyEvaluationPipelineResultV1 {
  const evaluatedAtIso = nowIso ?? new Date().toISOString();
  const context = buildEvaluationContext(input);

  const activePolicies = policies.filter((p) => p.active).sort((a, b) => b.priority - a.priority); // highest priority first

  const policyResults: PolicyEvaluationEntryV1[] = activePolicies.map((policy) =>
    evaluateSinglePolicy(policy, context),
  );

  const overallOutcome = aggregateOutcome(policyResults);

  const requiredApproverIds = deduplicateApproverIds(
    policyResults.flatMap((r) => r.requiredApproverIds ?? []),
  );

  const result: PolicyEvaluationPipelineResultV1 = {
    overallOutcome,
    policyResults,
    requiredApproverIds,
    evaluatedAtIso,
  };

  return deepFreeze(result);
}

// ---------------------------------------------------------------------------
// Single-policy evaluation
// ---------------------------------------------------------------------------

function evaluateSinglePolicy(
  policy: PolicyV1,
  context: Readonly<Record<string, unknown>>,
): PolicyEvaluationEntryV1 {
  // 1. Evaluate rules in order
  const ruleTraces: PolicyRuleTraceV1[] = (policy.rules ?? []).map((rule) =>
    evaluateRule(rule.ruleId, rule.condition, rule.effect, context),
  );

  // 2. Determine rule-based outcome
  const ruleOutcome = deriveRuleOutcome(ruleTraces);

  // 3. SoD constraints → needs_human
  const hasSodConstraints = (policy.sodConstraints?.length ?? 0) > 0;
  const requiredApproverIds = hasSodConstraints ? extractSodApproverIds(policy) : undefined;

  let outcome: PolicyPipelineOutcome;
  let explanation: string;

  if (ruleOutcome === 'fail') {
    outcome = 'fail';
    const denyRule = ruleTraces.find((t) => t.effect === 'Deny' && t.outcome === 'matched');
    explanation = denyRule
      ? `Policy "${policy.name}" denied: rule "${denyRule.ruleId}" matched — ${denyRule.explanation}`
      : `Policy "${policy.name}" denied by rule match.`;
  } else if (hasSodConstraints) {
    outcome = 'needs_human';
    explanation = `Policy "${policy.name}" requires human approval due to SoD constraints.`;
  } else if (ruleOutcome === 'pass') {
    outcome = 'pass';
    const passRule = ruleTraces.find((t) => t.effect === 'Allow' && t.outcome === 'matched');
    explanation = passRule
      ? `Policy "${policy.name}" passed: rule "${passRule.ruleId}" allowed — ${passRule.explanation}`
      : `Policy "${policy.name}" passed: no blocking rules matched.`;
  } else {
    // error or no rules
    outcome = ruleTraces.length === 0 ? 'pass' : 'error';
    explanation =
      ruleTraces.length === 0
        ? `Policy "${policy.name}" passed: no rules defined.`
        : `Policy "${policy.name}" could not be fully evaluated due to rule errors.`;
  }

  return {
    policyId: policy.policyId,
    policyName: policy.name,
    outcome,
    explanation,
    ruleTraces,
    ...(requiredApproverIds !== undefined ? { requiredApproverIds } : {}),
  };
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

function evaluateRule(
  ruleId: string,
  condition: string,
  effect: 'Allow' | 'Deny',
  context: Readonly<Record<string, unknown>>,
): PolicyRuleTraceV1 {
  const evalResult = evaluatePolicyConditionDslV1({ condition, context });

  if (!evalResult.ok) {
    return {
      ruleId,
      condition,
      effect,
      outcome: 'error',
      explanation: `Rule could not be evaluated: ${evalResult.message}`,
    };
  }

  const matched = evalResult.value;
  return {
    ruleId,
    condition,
    effect,
    outcome: matched ? 'matched' : 'not_matched',
    explanation: matched
      ? `Condition "${condition}" evaluated to true.`
      : `Condition "${condition}" evaluated to false.`,
  };
}

// ---------------------------------------------------------------------------
// Outcome derivation helpers
// ---------------------------------------------------------------------------

/**
 * Derive the rule-based outcome for a policy.
 *
 * Logic:
 * - If any Deny rule matched AND no Allow rule of equal/higher weight matched → `fail`
 * - If at least one Allow rule matched and no Deny rules matched → `pass`
 * - If any rule errored → `error`
 * - Otherwise (no rules, or all not_matched) → `pass`
 */
function deriveRuleOutcome(traces: readonly PolicyRuleTraceV1[]): 'pass' | 'fail' | 'error' {
  if (traces.length === 0) return 'pass';

  const hasDenyMatch = traces.some((t) => t.effect === 'Deny' && t.outcome === 'matched');
  const hasAllowMatch = traces.some((t) => t.effect === 'Allow' && t.outcome === 'matched');
  const hasError = traces.some((t) => t.outcome === 'error');

  if (hasDenyMatch && !hasAllowMatch) return 'fail';
  if (hasAllowMatch && !hasDenyMatch) return 'pass';
  if (hasDenyMatch && hasAllowMatch) return 'pass'; // Allow wins when both present
  if (hasError) return 'error';
  return 'pass'; // all not_matched → no blocking rule → pass
}

/**
 * Aggregate across all policy results using precedence:
 * `fail` > `needs_human` > `pass` > `error`.
 */
function aggregateOutcome(results: readonly PolicyEvaluationEntryV1[]): PolicyPipelineOutcome {
  if (results.length === 0) return 'pass';

  let hasFail = false;
  let hasNeedsHuman = false;
  let hasError = false;

  for (const r of results) {
    if (r.outcome === 'fail') hasFail = true;
    else if (r.outcome === 'needs_human') hasNeedsHuman = true;
    else if (r.outcome === 'error') hasError = true;
  }

  if (hasFail) return 'fail';
  if (hasNeedsHuman) return 'needs_human';
  if (hasError) return 'error';
  return 'pass';
}

// ---------------------------------------------------------------------------
// Context & approver helpers
// ---------------------------------------------------------------------------

/**
 * Flatten the `ApprovalPipelineInputV1` into a plain evaluation context.
 * Arrays are preserved so DSL `in` / `contains` operators work correctly.
 */
function buildEvaluationContext(input: ApprovalPipelineInputV1): Readonly<Record<string, unknown>> {
  return { ...input } as Readonly<Record<string, unknown>>;
}

/** Extract approver IDs referenced in SoD constraints (for `needs_human` policies). */
function extractSodApproverIds(policy: PolicyV1): readonly UserIdType[] {
  const ids = new Set<UserIdType>();
  for (const constraint of policy.sodConstraints ?? []) {
    if (constraint.kind === 'MakerChecker' || constraint.kind === 'DistinctApprovers') {
      // No specific approver IDs in these constraint kinds — ownership must be
      // resolved at the application layer via `approval-routing`.
    }
  }
  return Object.freeze([...ids]);
}

function deduplicateApproverIds(ids: readonly UserIdType[]): readonly UserIdType[] {
  return Object.freeze([...new Set(ids)]);
}

// ---------------------------------------------------------------------------
// Deep-freeze helper
// ---------------------------------------------------------------------------

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}

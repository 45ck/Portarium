/**
 * Approval Policy Rules (bead-0812).
 *
 * Defines and evaluates policies that gate approval decisions.
 * Each rule is a pure predicate evaluated against an approval context
 * to produce a Pass / Fail / NeedsHuman outcome with a trace of
 * why that outcome was reached.
 *
 * The evaluation results feed into `PolicyEvaluationRefV1` in the
 * decision record (approval-decision-record-v1.ts, bead-0809).
 *
 * This is a domain value object module — no side effects, no external deps.
 */

import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The outcome of evaluating a single policy rule. */
export type PolicyRuleOutcome = 'Pass' | 'Fail' | 'NeedsHuman';

/** A single entry in the evaluation trace. */
export type PolicyTraceEntryV1 = Readonly<{
  /** Sequence number within the evaluation (0-based). */
  seq: number;
  /** What was checked. */
  check: string;
  /** The result of this check. */
  result: 'pass' | 'fail' | 'skip';
  /** Optional detail explaining the result. */
  detail?: string;
}>;

/** The full result of evaluating one policy rule. */
export type PolicyRuleEvaluationV1 = Readonly<{
  /** The policy that was evaluated. */
  policyId: PolicyIdType;
  /** Human-readable name of the policy. */
  policyName: string;
  /** The overall outcome. */
  outcome: PolicyRuleOutcome;
  /** Trace entries showing how the outcome was determined. */
  trace: readonly PolicyTraceEntryV1[];
  /** ISO-8601 timestamp of the evaluation. */
  evaluatedAtIso: string;
}>;

/** Risk level for policy context (mirrors DecisionRiskLevel). */
export type PolicyRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Context provided to policy rules for evaluation.
 * Contains the information a rule needs to make its determination.
 */
export type PolicyEvaluationContextV1 = Readonly<{
  /** Assessed risk level of the approval subject. */
  riskLevel: PolicyRiskLevel;
  /** The user requesting the approval. */
  requestedByUserId: UserIdType;
  /** The user(s) who can decide the approval. */
  approverUserIds: readonly UserIdType[];
  /** Whether evidence has been attached. */
  hasEvidence: boolean;
  /** Number of evidence items attached. */
  evidenceCount: number;
  /** Whether any evidence is marked as decisive. */
  hasDecisiveEvidence: boolean;
  /** ISO-8601 timestamp of the approval request. */
  requestedAtIso: string;
  /** ISO-8601 timestamp of the evaluation (now). */
  evaluatedAtIso: string;
  /** Optional: ISO-8601 expiry deadline. */
  expiresAtIso?: string;
  /** Optional: additional metadata for custom rules. */
  metadata?: Readonly<Record<string, unknown>>;
}>;

/**
 * A policy rule definition.
 *
 * Rules are pure functions: given a context, they produce an evaluation
 * result. Rules must not perform I/O or depend on external state.
 */
export type ApprovalPolicyRuleV1 = Readonly<{
  /** Unique policy ID. */
  policyId: PolicyIdType;
  /** Human-readable name. */
  name: string;
  /** Description of what this policy enforces. */
  description: string;
  /** The evaluation function. */
  evaluate: (context: PolicyEvaluationContextV1) => PolicyRuleEvaluationV1;
}>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PolicyRuleEvaluationError extends Error {
  public override readonly name = 'PolicyRuleEvaluationError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Trace builder
// ---------------------------------------------------------------------------

/**
 * Helper to build trace entries during policy evaluation.
 */
export class TraceBuilder {
  private readonly entries: PolicyTraceEntryV1[] = [];

  /** Record a passing check. */
  public pass(check: string, detail?: string): this {
    this.entries.push(this.entry(check, 'pass', detail));
    return this;
  }

  /** Record a failing check. */
  public fail(check: string, detail?: string): this {
    this.entries.push(this.entry(check, 'fail', detail));
    return this;
  }

  /** Record a skipped check. */
  public skip(check: string, detail?: string): this {
    this.entries.push(this.entry(check, 'skip', detail));
    return this;
  }

  /** Build the final readonly trace array. */
  public build(): readonly PolicyTraceEntryV1[] {
    return Object.freeze([...this.entries]);
  }

  private entry(
    check: string,
    result: 'pass' | 'fail' | 'skip',
    detail?: string,
  ): PolicyTraceEntryV1 {
    const entry: PolicyTraceEntryV1 = {
      seq: this.entries.length,
      check,
      result,
      ...(detail !== undefined ? { detail } : {}),
    };
    return Object.freeze(entry);
  }
}

// ---------------------------------------------------------------------------
// Built-in rule: risk threshold
// ---------------------------------------------------------------------------

/**
 * Creates a policy rule that requires human review for approvals at or above
 * a given risk level.
 *
 * - Below threshold: Pass
 * - At or above threshold: NeedsHuman
 */
export function createRiskThresholdRule(
  policyId: PolicyIdType,
  threshold: PolicyRiskLevel,
): ApprovalPolicyRuleV1 {
  const riskOrder: Record<PolicyRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const thresholdValue = riskOrder[threshold];

  return Object.freeze({
    policyId,
    name: `Risk threshold: ${threshold}`,
    description: `Requires human review when risk level is ${threshold} or above.`,
    evaluate(context: PolicyEvaluationContextV1): PolicyRuleEvaluationV1 {
      const trace = new TraceBuilder();
      const contextRiskValue = riskOrder[context.riskLevel];

      if (contextRiskValue >= thresholdValue) {
        trace.fail(
          'risk-level-check',
          `Risk "${context.riskLevel}" (${String(contextRiskValue)}) >= threshold "${threshold}" (${String(thresholdValue)})`,
        );
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'NeedsHuman',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      trace.pass(
        'risk-level-check',
        `Risk "${context.riskLevel}" (${String(contextRiskValue)}) < threshold "${threshold}" (${String(thresholdValue)})`,
      );
      return freeze({
        policyId,
        policyName: this.name,
        outcome: 'Pass',
        trace: trace.build(),
        evaluatedAtIso: context.evaluatedAtIso,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Built-in rule: separation of duties
// ---------------------------------------------------------------------------

/**
 * Creates a policy rule that enforces separation of duties: the requester
 * must not be the sole approver.
 *
 * - If requester is not in the approver list: Pass
 * - If requester is in the approver list but other approvers exist: Pass
 * - If requester is the only approver: Fail
 */
export function createSeparationOfDutiesRule(policyId: PolicyIdType): ApprovalPolicyRuleV1 {
  return Object.freeze({
    policyId,
    name: 'Separation of duties',
    description: 'The requester must not be the sole approver.',
    evaluate(context: PolicyEvaluationContextV1): PolicyRuleEvaluationV1 {
      const trace = new TraceBuilder();
      const requesterIsApprover = context.approverUserIds.includes(context.requestedByUserId);

      if (!requesterIsApprover) {
        trace.pass('requester-not-approver', 'Requester is not in the approver list.');
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Pass',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      trace.fail('requester-is-approver', 'Requester is in the approver list.');

      const otherApprovers = context.approverUserIds.filter(
        (id) => id !== context.requestedByUserId,
      );

      if (otherApprovers.length > 0) {
        trace.pass(
          'other-approvers-exist',
          `${String(otherApprovers.length)} other approver(s) available.`,
        );
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Pass',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      trace.fail('no-other-approvers', 'Requester is the sole approver — SoD violation.');
      return freeze({
        policyId,
        policyName: this.name,
        outcome: 'Fail',
        trace: trace.build(),
        evaluatedAtIso: context.evaluatedAtIso,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Built-in rule: evidence required
// ---------------------------------------------------------------------------

/**
 * Creates a policy rule that requires evidence to be attached before
 * an approval can proceed.
 *
 * @param policyId - Policy ID.
 * @param options - Configuration.
 * @param options.minCount - Minimum number of evidence items required (default 1).
 * @param options.requireDecisive - Whether at least one decisive evidence item is required.
 */
export function createEvidenceRequiredRule(
  policyId: PolicyIdType,
  options?: { minCount?: number; requireDecisive?: boolean },
): ApprovalPolicyRuleV1 {
  const minCount = options?.minCount ?? 1;
  const requireDecisive = options?.requireDecisive ?? false;

  return Object.freeze({
    policyId,
    name: 'Evidence required',
    description: `Requires at least ${String(minCount)} evidence item(s)${requireDecisive ? ', including decisive evidence' : ''}.`,
    evaluate(context: PolicyEvaluationContextV1): PolicyRuleEvaluationV1 {
      const trace = new TraceBuilder();

      if (!context.hasEvidence || context.evidenceCount < minCount) {
        trace.fail(
          'evidence-count-check',
          `Found ${String(context.evidenceCount)} evidence item(s), need at least ${String(minCount)}.`,
        );
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Fail',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      trace.pass(
        'evidence-count-check',
        `Found ${String(context.evidenceCount)} evidence item(s), meets minimum of ${String(minCount)}.`,
      );

      if (requireDecisive && !context.hasDecisiveEvidence) {
        trace.fail('decisive-evidence-check', 'No decisive evidence found.');
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Fail',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      if (requireDecisive) {
        trace.pass('decisive-evidence-check', 'Decisive evidence found.');
      } else {
        trace.skip('decisive-evidence-check', 'Decisive evidence not required by this rule.');
      }

      return freeze({
        policyId,
        policyName: this.name,
        outcome: 'Pass',
        trace: trace.build(),
        evaluatedAtIso: context.evaluatedAtIso,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Built-in rule: expiry check
// ---------------------------------------------------------------------------

/**
 * Creates a policy rule that checks whether the approval has expired.
 *
 * - If no expiry is set: Pass (with skip trace)
 * - If current time is before expiry: Pass
 * - If current time is at or after expiry: Fail
 */
export function createExpiryCheckRule(policyId: PolicyIdType): ApprovalPolicyRuleV1 {
  return Object.freeze({
    policyId,
    name: 'Expiry check',
    description: 'Fails if the approval has expired.',
    evaluate(context: PolicyEvaluationContextV1): PolicyRuleEvaluationV1 {
      const trace = new TraceBuilder();

      if (context.expiresAtIso === undefined) {
        trace.skip('expiry-check', 'No expiry deadline set.');
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Pass',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      const now = new Date(context.evaluatedAtIso).getTime();
      const expiry = new Date(context.expiresAtIso).getTime();

      if (now >= expiry) {
        trace.fail(
          'expiry-check',
          `Evaluation time ${context.evaluatedAtIso} is at or past expiry ${context.expiresAtIso}.`,
        );
        return freeze({
          policyId,
          policyName: this.name,
          outcome: 'Fail',
          trace: trace.build(),
          evaluatedAtIso: context.evaluatedAtIso,
        });
      }

      trace.pass(
        'expiry-check',
        `Evaluation time ${context.evaluatedAtIso} is before expiry ${context.expiresAtIso}.`,
      );
      return freeze({
        policyId,
        policyName: this.name,
        outcome: 'Pass',
        trace: trace.build(),
        evaluatedAtIso: context.evaluatedAtIso,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

/** Result of evaluating a policy set (multiple rules). */
export type PolicySetEvaluationV1 = Readonly<{
  /** Individual evaluation results for each rule. */
  results: readonly PolicyRuleEvaluationV1[];
  /** Aggregate outcome: Fail if any rule failed, NeedsHuman if any needs human, Pass otherwise. */
  aggregateOutcome: PolicyRuleOutcome;
  /** Total trace entry count across all rules. */
  totalTraceEntryCount: number;
  /** ISO-8601 timestamp of the evaluation. */
  evaluatedAtIso: string;
}>;

/**
 * Evaluate a set of policy rules against a given context.
 *
 * All rules are evaluated (no short-circuit) so the trace is complete.
 *
 * Aggregate outcome priority:
 *   Fail > NeedsHuman > Pass
 */
export function evaluatePolicySet(
  rules: readonly ApprovalPolicyRuleV1[],
  context: PolicyEvaluationContextV1,
): PolicySetEvaluationV1 {
  if (rules.length === 0) {
    throw new PolicyRuleEvaluationError('Policy set must contain at least one rule.');
  }

  const results: PolicyRuleEvaluationV1[] = [];

  for (const rule of rules) {
    results.push(rule.evaluate(context));
  }

  const hasFail = results.some((r) => r.outcome === 'Fail');
  const hasNeedsHuman = results.some((r) => r.outcome === 'NeedsHuman');

  const aggregateOutcome: PolicyRuleOutcome = hasFail
    ? 'Fail'
    : hasNeedsHuman
      ? 'NeedsHuman'
      : 'Pass';

  const totalTraceEntryCount = results.reduce((sum, r) => sum + r.trace.length, 0);

  return Object.freeze({
    results: Object.freeze(results),
    aggregateOutcome,
    totalTraceEntryCount,
    evaluatedAtIso: context.evaluatedAtIso,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freeze<T>(obj: T): T {
  return Object.freeze(obj);
}

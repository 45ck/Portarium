import type { ExecutionTier } from '../../domain/primitives/index.js';
import type { PolicyDecisionV1 } from '../../domain/services/policy-evaluation.js';
import { err, ok, type Result } from '../common/result.js';
import type { ValidationFailed } from '../common/errors.js';

/**
 * Pre-execution validation input representing a command about to be dispatched.
 */
export type CommandGuardrailInput = Readonly<{
  /** The command name or operation identifier. */
  commandName: string;
  /** Execution tier of the action/workflow step. */
  executionTier: ExecutionTier;
  /** Policy evaluation decision from the policy engine. */
  policyDecision: PolicyDecisionV1;
  /** Number of resources or operations affected. */
  blastRadius: number;
  /** Maximum blast radius permitted for this workspace. */
  blastRadiusLimit: number;
  /** Optional JSON schema to validate command payload against. */
  schema?: Readonly<Record<string, unknown>>;
  /** The command payload to validate. */
  payload?: unknown;
}>;

export type GuardrailViolation = Readonly<{
  code: 'SCHEMA_INVALID' | 'TIER_REQUIRES_APPROVAL' | 'BLAST_RADIUS_EXCEEDED' | 'POLICY_DENIED';
  message: string;
}>;

export type CommandGuardrailResult = Readonly<{
  allowed: boolean;
  requiresApproval: boolean;
  violations: readonly GuardrailViolation[];
}>;

/**
 * Pre-execution guardrail that validates a command before dispatch.
 *
 * Checks in order:
 * 1. Schema validation (if schema provided)
 * 2. Policy tier: HumanApprove tier requires human approval
 * 3. Blast-radius limit enforcement
 * 4. Policy decision integration
 */
export function evaluateCommandGuardrails(
  input: CommandGuardrailInput,
): CommandGuardrailResult {
  const violations: GuardrailViolation[] = [];
  let requiresApproval = false;

  // 1. Schema validation
  if (input.schema && input.payload !== undefined) {
    const schemaErrors = validatePayloadSchema(input.schema, input.payload);
    violations.push(...schemaErrors);
  }

  // 2. Policy tier checks
  if (input.executionTier === 'HumanApprove') {
    requiresApproval = true;
    violations.push({
      code: 'TIER_REQUIRES_APPROVAL',
      message: `Command "${input.commandName}" requires human approval (tier: HumanApprove).`,
    });
  }

  if (input.executionTier === 'ManualOnly') {
    violations.push({
      code: 'POLICY_DENIED',
      message: `Command "${input.commandName}" is manual-only and cannot be auto-dispatched.`,
    });
  }

  // 3. Blast-radius enforcement
  if (input.blastRadius > input.blastRadiusLimit) {
    violations.push({
      code: 'BLAST_RADIUS_EXCEEDED',
      message: `Blast radius ${input.blastRadius} exceeds limit ${input.blastRadiusLimit} for "${input.commandName}".`,
    });
  }

  // 4. Policy decision integration
  if (input.policyDecision === 'Deny') {
    violations.push({
      code: 'POLICY_DENIED',
      message: `Policy evaluation denied command "${input.commandName}".`,
    });
  } else if (input.policyDecision === 'RequireApproval') {
    requiresApproval = true;
  }

  const hasDeny = violations.some((v) => v.code === 'POLICY_DENIED');
  const hasSchemaError = violations.some((v) => v.code === 'SCHEMA_INVALID');
  const hasBlastRadiusExceeded = violations.some((v) => v.code === 'BLAST_RADIUS_EXCEEDED');
  const allowed = !hasDeny && !hasSchemaError && !hasBlastRadiusExceeded;

  return {
    allowed,
    requiresApproval,
    violations,
  };
}

/**
 * Convenience wrapper that returns a Result, suitable for use-case integration.
 */
export function assertCommandGuardrails(
  input: CommandGuardrailInput,
): Result<CommandGuardrailResult, ValidationFailed> {
  const result = evaluateCommandGuardrails(input);

  if (!result.allowed) {
    const messages = result.violations.map((v) => v.message).join('; ');
    return err({
      kind: 'ValidationFailed',
      message: `Command guardrail check failed: ${messages}`,
    });
  }

  return ok(result);
}

/**
 * Minimal structural schema validation for command payloads.
 * Validates required fields are present and type-checks basic primitives.
 */
function validatePayloadSchema(
  schema: Readonly<Record<string, unknown>>,
  payload: unknown,
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  if (typeof payload !== 'object' || payload === null) {
    violations.push({
      code: 'SCHEMA_INVALID',
      message: 'Payload must be a non-null object.',
    });
    return violations;
  }

  const required = schema['required'];
  if (Array.isArray(required)) {
    const record = payload as Record<string, unknown>;
    for (const field of required) {
      if (typeof field === 'string' && (record[field] === undefined || record[field] === null)) {
        violations.push({
          code: 'SCHEMA_INVALID',
          message: `Missing required field: ${field}.`,
        });
      }
    }
  }

  return violations;
}

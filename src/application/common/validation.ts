/**
 * Composable input-validation framework for the application command/query boundary.
 *
 * Design goals
 * ============
 * • Zero external dependencies (pure domain-layer logic).
 * • Collects *all* field violations in a single pass so callers can render
 *   RFC 9457 Problem Details with a complete `errors` extension array.
 * • Compatible with the existing `Result<T, ValidationFailed>` return convention.
 *
 * Usage
 * =====
 *   const result = validate(input, [
 *     requiredString('name'),
 *     minLength('name', 3),
 *     requiredString('workspaceId'),
 *   ]);
 *   if (!result.ok) return result; // Err<ValidationFailed> with per-field errors
 */

import type { FieldViolation, ValidationFailed } from './errors.js';
import { err, ok, type Result } from './result.js';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/**
 * A single validation rule.  Receives the raw input object and appends zero
 * or more violations to the shared `violations` accumulator.
 */
export type ValidationRule<TInput> = (input: TInput, violations: FieldViolation[]) => void;

// ---------------------------------------------------------------------------
// Rule runner
// ---------------------------------------------------------------------------

/**
 * Run `rules` against `input`.
 *
 * Returns `ok(input)` when there are no violations, otherwise returns
 * `err(ValidationFailed)` with the full `errors` array populated.
 */
export function validate<TInput>(
  input: TInput,
  rules: readonly ValidationRule<TInput>[],
): Result<TInput, ValidationFailed> {
  const violations: FieldViolation[] = [];
  for (const rule of rules) {
    rule(input, violations);
  }
  if (violations.length === 0) return ok(input);

  return err({
    kind: 'ValidationFailed',
    message:
      violations.length === 1 ? violations[0]!.message : `${violations.length} validation errors.`,
    errors: violations,
  });
}

// ---------------------------------------------------------------------------
// Internal field accessor
// ---------------------------------------------------------------------------

/** Read a named field from any object without requiring an index signature. */
function getField(input: object, field: string): unknown {
  return (input as Record<string, unknown>)[field];
}

// ---------------------------------------------------------------------------
// Built-in rules
// ---------------------------------------------------------------------------

/** Field must be a non-empty string (after trimming). */
export function requiredString<TInput extends object>(
  field: keyof TInput & string,
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (typeof v !== 'string' || v.trim() === '') {
      violations.push({ field, message: `${field} must be a non-empty string.` });
    }
  };
}

/** Field, if present, must be a non-empty string (after trimming). */
export function optionalString<TInput extends object>(
  field: keyof TInput & string,
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (v !== undefined && (typeof v !== 'string' || v.trim() === '')) {
      violations.push({ field, message: `${field} must be a non-empty string when provided.` });
    }
  };
}

/** String field must be at least `min` characters long. */
export function minLength<TInput extends object>(
  field: keyof TInput & string,
  min: number,
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (typeof v === 'string' && v.trim().length < min) {
      violations.push({ field, message: `${field} must be at least ${min} characters.` });
    }
  };
}

/** String field must be at most `max` characters long. */
export function maxLength<TInput extends object>(
  field: keyof TInput & string,
  max: number,
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (typeof v === 'string' && v.trim().length > max) {
      violations.push({ field, message: `${field} must be at most ${max} characters.` });
    }
  };
}

/** Field must be a finite number. */
export function requiredFiniteNumber<TInput extends object>(
  field: keyof TInput & string,
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      violations.push({ field, message: `${field} must be a finite number.` });
    }
  };
}

/** String field must match the allow-list of values. */
export function oneOf<TInput extends object>(
  field: keyof TInput & string,
  allowed: readonly string[],
): ValidationRule<TInput> {
  return (input, violations) => {
    const v = getField(input, field);
    if (typeof v === 'string' && !(allowed as readonly unknown[]).includes(v)) {
      violations.push({
        field,
        message: `${field} must be one of: ${allowed.join(', ')}.`,
      });
    }
  };
}

/**
 * Compose multiple rule-sets.  Useful when a base set of rules is shared
 * across command variants.
 */
export function composeRules<TInput>(
  ...ruleSets: (readonly ValidationRule<TInput>[])[]
): ValidationRule<TInput>[] {
  return ruleSets.flat();
}

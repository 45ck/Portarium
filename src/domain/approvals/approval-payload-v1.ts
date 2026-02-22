/**
 * Immutable Approval Payload domain model (bead-8w3q).
 *
 * An `ApprovalPayloadV1` is the content portion of an approval request —
 * the description of *what* is being asked for approval.  It is a value
 * object that:
 *
 *   1. Contains only the fields the approver needs to evaluate the request.
 *   2. Is deeply immutable: created with `Object.freeze()` and all nested
 *      arrays/objects are frozen too.
 *   3. Has no identity of its own (no approvalId/runId) — identity lives on
 *      `ApprovalV1`.  The payload can be attached to any approval or compared
 *      across approvals without confusion.
 *
 * Factory:   `createApprovalPayload(input)` — validates + freezes.
 * Parser:    `parseApprovalPayloadV1(value)` — deserializes from untrusted data.
 */

import {
  UserId,
  WorkItemId,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
} from '../primitives/index.js';
import { parseIsoDate, parseNonEmptyString, readString } from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single step in an escalation chain.
 *
 * Escalation steps are immutable once the payload is created.
 */
export type EscalationStepPayloadV1 = Readonly<{
  /** 1-based index defining execution order. Must be >= 1. */
  stepOrder: number;
  /** User to escalate to after `afterHours` hours of inactivity. */
  escalateToUserId: string;
  /** Hours of inactivity before escalation fires. Must be > 0. */
  afterHours: number;
}>;

/**
 * The immutable content of an approval request.
 *
 * Fields the approver sees and uses to make a decision.
 * All fields are `Readonly`; nested arrays are `readonly` too.
 * The factory `createApprovalPayload()` additionally applies `Object.freeze()`
 * recursively so that runtime mutation attempts are caught (strict mode) or
 * silently ignored (sloppy mode).
 */
export type ApprovalPayloadV1 = Readonly<{
  schemaVersion: 1;
  /**
   * Human-readable description of what is being approved.
   * Must be non-empty; trimmed before storage.
   */
  prompt: string;
  /** Optional: the cross-system work item this approval is attached to. */
  workItemId?: WorkItemIdType;
  /** Optional: the user pre-assigned as the approver. */
  assigneeUserId?: UserIdType;
  /** Optional: ISO-8601 deadline by which the approval must be decided. */
  dueAtIso?: string;
  /** Optional: ordered list of escalation steps (oldest-first). */
  escalationChain?: readonly EscalationStepPayloadV1[];
}>;

// ---------------------------------------------------------------------------
// Input types (raw, pre-validation)
// ---------------------------------------------------------------------------

/** Input shape accepted by `createApprovalPayload`. */
export interface ApprovalPayloadInput {
  prompt: string;
  workItemId?: string;
  assigneeUserId?: string;
  /**
   * Optional deadline. Must be a valid ISO-8601 date-time string.
   * Validated at creation time; stored verbatim if valid.
   */
  dueAtIso?: string;
  escalationChain?: readonly EscalationStepInput[];
}

/** Input shape for a single escalation step. */
export interface EscalationStepInput {
  stepOrder: number;
  escalateToUserId: string;
  afterHours: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApprovalPayloadValidationError extends Error {
  public override readonly name = 'ApprovalPayloadValidationError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an immutable `ApprovalPayloadV1` from a validated input.
 *
 * Validates all fields, constructs the value object, then deep-freezes it.
 * Throws `ApprovalPayloadValidationError` for any invariant violation.
 *
 * Invariants enforced:
 *   - `prompt` is non-empty after trimming.
 *   - `dueAtIso` is a parseable ISO-8601 date-time (if provided).
 *   - `assigneeUserId` is a non-empty string (if provided).
 *   - `workItemId` is a non-empty string (if provided).
 *   - Each escalation step has `stepOrder >= 1` and `afterHours > 0`.
 *   - Escalation steps are in ascending `stepOrder` order.
 *   - No duplicate `stepOrder` values.
 */
export function createApprovalPayload(input: ApprovalPayloadInput): ApprovalPayloadV1 {
  const prompt = parseNonEmptyString(input.prompt, 'prompt', ApprovalPayloadValidationError);

  const workItemId =
    input.workItemId !== undefined
      ? WorkItemId(
          parseNonEmptyString(input.workItemId, 'workItemId', ApprovalPayloadValidationError),
        )
      : undefined;

  const assigneeUserId =
    input.assigneeUserId !== undefined
      ? UserId(
          parseNonEmptyString(
            input.assigneeUserId,
            'assigneeUserId',
            ApprovalPayloadValidationError,
          ),
        )
      : undefined;

  let dueAtIso: string | undefined;
  if (input.dueAtIso !== undefined) {
    // Validates the string is a parseable ISO date; throws if not.
    parseIsoDate(input.dueAtIso, 'dueAtIso', ApprovalPayloadValidationError);
    dueAtIso = input.dueAtIso;
  }

  const escalationChain =
    input.escalationChain !== undefined ? buildEscalationChain(input.escalationChain) : undefined;

  const payload: ApprovalPayloadV1 = {
    schemaVersion: 1,
    prompt: prompt.trim(),
    ...(workItemId !== undefined ? { workItemId } : {}),
    ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
    ...(dueAtIso !== undefined ? { dueAtIso } : {}),
    ...(escalationChain !== undefined ? { escalationChain } : {}),
  };

  return deepFreeze(payload);
}

// ---------------------------------------------------------------------------
// Parser (untrusted / serialised data)
// ---------------------------------------------------------------------------

/**
 * Parse and validate an `ApprovalPayloadV1` from an untrusted value.
 *
 * Accepts the same JSON shape as `ApprovalPayloadV1`.
 * Throws `ApprovalPayloadValidationError` for invalid data.
 *
 * The returned object is deep-frozen, identical to the output of
 * `createApprovalPayload`.
 */
export function parseApprovalPayloadV1(value: unknown): ApprovalPayloadV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApprovalPayloadValidationError('ApprovalPayload must be an object.');
  }

  const record = value as Record<string, unknown>;

  const schemaVersion = record['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new ApprovalPayloadValidationError(
      `Unsupported ApprovalPayload schemaVersion: ${String(schemaVersion)}`,
    );
  }

  const input: ApprovalPayloadInput = { prompt: record['prompt'] as string };
  if (record['workItemId'] !== undefined) input.workItemId = record['workItemId'] as string;
  if (record['assigneeUserId'] !== undefined)
    input.assigneeUserId = record['assigneeUserId'] as string;
  if (record['dueAtIso'] !== undefined) input.dueAtIso = record['dueAtIso'] as string;
  const chain = parseRawEscalationChain(record['escalationChain']);
  if (chain !== undefined) input.escalationChain = chain;
  return createApprovalPayload(input);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildEscalationChain(
  steps: readonly EscalationStepInput[],
): readonly EscalationStepPayloadV1[] {
  if (steps.length === 0) {
    throw new ApprovalPayloadValidationError('escalationChain must not be empty if provided.');
  }

  const validated = steps.map((step, idx) => validateEscalationStep(step, idx));

  // Enforce ascending stepOrder with no duplicates
  const orders = validated.map((s) => s.stepOrder);
  for (let i = 1; i < orders.length; i++) {
    if (orders[i]! <= orders[i - 1]!) {
      throw new ApprovalPayloadValidationError(
        `escalationChain steps must be in strictly ascending stepOrder. ` +
          `Found stepOrder ${String(orders[i])} after ${String(orders[i - 1])}.`,
      );
    }
  }

  return Object.freeze(validated.map((s) => Object.freeze(s)));
}

function validateEscalationStep(step: EscalationStepInput, idx: number): EscalationStepPayloadV1 {
  const label = `escalationChain[${idx}]`;

  if (!Number.isSafeInteger(step.stepOrder) || step.stepOrder < 1) {
    throw new ApprovalPayloadValidationError(`${label}.stepOrder must be an integer >= 1.`);
  }

  const escalateToUserId = readString(
    step as unknown as Record<string, unknown>,
    'escalateToUserId',
    ApprovalPayloadValidationError,
  );
  if (escalateToUserId.trim() === '') {
    throw new ApprovalPayloadValidationError(`${label}.escalateToUserId must be non-empty.`);
  }

  if (!Number.isSafeInteger(step.afterHours) || step.afterHours <= 0) {
    throw new ApprovalPayloadValidationError(`${label}.afterHours must be a positive integer.`);
  }

  return {
    stepOrder: step.stepOrder,
    escalateToUserId,
    afterHours: step.afterHours,
  };
}

function parseRawEscalationChain(value: unknown): readonly EscalationStepInput[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new ApprovalPayloadValidationError('escalationChain must be an array.');
  }
  return value as EscalationStepInput[];
}

/**
 * Recursively freeze an object and all its enumerable properties.
 * Primitive values pass through unchanged.
 */
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

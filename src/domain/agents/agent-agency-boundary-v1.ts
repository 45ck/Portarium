/**
 * Agent agency boundary domain model (bead-tz6c).
 *
 * An "agency boundary" is the set of operations that an autonomous agent
 * (robot controller, LLM copilot, workflow orchestrator) is permitted to
 * initiate on behalf of a principal.  Boundaries are defined per-agent and
 * evaluated at the application boundary before any command is dispatched.
 *
 * Design:
 *  - Three canonical tiers encode the least-privilege ladder:
 *      ReadOnly   → observe only; no mutations.
 *      Standard   → submit decisions, escalate, read evidence.
 *      Privileged → additionally start workflows and submit map commands.
 *  - A boundary MAY carry explicit allow/deny overrides that refine the tier.
 *    Deny overrides always win over allow overrides and tier defaults.
 *  - The evaluator is a pure function with no I/O.
 */

import { readEnum, readRecord } from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Action catalogue
// ---------------------------------------------------------------------------

/**
 * Every operation that an autonomous agent can attempt to initiate.
 * Extend this union when new agent-driven operations are added to the system.
 */
export type AgentAction =
  | 'submit-approval'
  | 'start-workflow'
  | 'submit-map-command'
  | 'read-evidence'
  | 'escalate-task';

const AGENT_ACTIONS = [
  'submit-approval',
  'start-workflow',
  'submit-map-command',
  'read-evidence',
  'escalate-task',
] as const;

// ---------------------------------------------------------------------------
// Agency tiers
// ---------------------------------------------------------------------------

/**
 * Canonical privilege tiers for autonomous agents.
 *
 *  - `ReadOnly`   — only read operations; no state mutations.
 *  - `Standard`   — submit approvals, escalate tasks, read evidence.
 *  - `Privileged` — additionally start workflows and submit map commands.
 */
export type AgencyTier = 'ReadOnly' | 'Standard' | 'Privileged';

const AGENCY_TIERS = ['ReadOnly', 'Standard', 'Privileged'] as const;

/** Default allowed actions for each tier. */
const TIER_DEFAULT_ACTIONS: Readonly<Record<AgencyTier, readonly AgentAction[]>> = {
  ReadOnly: ['read-evidence'],
  Standard: ['submit-approval', 'read-evidence', 'escalate-task'],
  Privileged: [
    'submit-approval',
    'start-workflow',
    'submit-map-command',
    'read-evidence',
    'escalate-task',
  ],
};

// ---------------------------------------------------------------------------
// Boundary type
// ---------------------------------------------------------------------------

/**
 * The agency boundary assigned to an autonomous agent.
 *
 * `tier` is the baseline.  `allowedActions` and `deniedActions` are optional
 * overrides; `deniedActions` always takes precedence over everything else.
 */
export type AgencyBoundaryV1 = Readonly<{
  schemaVersion: 1;
  /** Baseline privilege tier. */
  tier: AgencyTier;
  /**
   * Explicit allow list that extends the tier's default permitted actions.
   * Has no effect on actions already permitted by the tier.
   * Superseded by `deniedActions` for any overlapping action.
   */
  allowedActions?: readonly AgentAction[];
  /**
   * Explicit deny list that prevents specific actions regardless of tier or
   * `allowedActions`.  Deny always wins.
   */
  deniedActions?: readonly AgentAction[];
}>;

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

export class AgencyBoundaryParseError extends Error {
  public override readonly name = 'AgencyBoundaryParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse and validate an `AgencyBoundaryV1` from an untrusted value.
 * Throws `AgencyBoundaryParseError` on invalid input.
 */
export function parseAgencyBoundaryV1(value: unknown): AgencyBoundaryV1 {
  const record = readRecord(value, 'AgencyBoundary', AgencyBoundaryParseError);

  const schemaVersion = record['schemaVersion'];
  if (schemaVersion !== 1) {
    throw new AgencyBoundaryParseError(
      `Unsupported AgencyBoundary schemaVersion: ${String(schemaVersion)}`,
    );
  }

  const tier = readEnum(record, 'tier', AGENCY_TIERS, AgencyBoundaryParseError);

  const allowedActions = parseOptionalActionList(record['allowedActions'], 'allowedActions');
  const deniedActions = parseOptionalActionList(record['deniedActions'], 'deniedActions');

  return {
    schemaVersion: 1,
    tier,
    ...(allowedActions.length > 0 ? { allowedActions } : {}),
    ...(deniedActions.length > 0 ? { deniedActions } : {}),
  };
}

function parseOptionalActionList(value: unknown, field: string): readonly AgentAction[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AgencyBoundaryParseError(`${field} must be an array if provided.`);
  }
  return value.map((item, idx) => {
    if (!AGENT_ACTIONS.includes(item as AgentAction)) {
      throw new AgencyBoundaryParseError(
        `${field}[${idx}] is not a known AgentAction: "${String(item)}".`,
      );
    }
    return item as AgentAction;
  });
}

// ---------------------------------------------------------------------------
// Violation type
// ---------------------------------------------------------------------------

export type AgencyViolation = Readonly<{
  action: AgentAction;
  tier: AgencyTier;
  /** Human-readable explanation of why the action was denied. */
  reason: string;
}>;

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate whether `action` is permitted by `boundary`.
 *
 * Returns an `AgencyViolation` if the action is denied, or `null` if it is
 * permitted.
 *
 * Evaluation order:
 *  1. If the action appears in `deniedActions` → DENY (always wins).
 *  2. If the action appears in `allowedActions` → ALLOW.
 *  3. If the action is in the tier's default allowed set → ALLOW.
 *  4. Otherwise → DENY.
 */
export function evaluateAgencyBoundary(
  action: AgentAction,
  boundary: AgencyBoundaryV1,
): AgencyViolation | null {
  // Step 1: explicit deny always wins.
  if (boundary.deniedActions?.includes(action)) {
    return {
      action,
      tier: boundary.tier,
      reason: `Action "${action}" is explicitly denied by agency boundary.`,
    };
  }

  // Step 2: explicit allow override.
  if (boundary.allowedActions?.includes(action)) return null;

  // Step 3: tier default.
  if ((TIER_DEFAULT_ACTIONS[boundary.tier] as readonly string[]).includes(action)) return null;

  // Step 4: not permitted.
  return {
    action,
    tier: boundary.tier,
    reason: `Action "${action}" is not permitted for agency tier "${boundary.tier}".`,
  };
}

// ---------------------------------------------------------------------------
// Canonical defaults
// ---------------------------------------------------------------------------

/** Minimal boundary for read-only observer agents. */
export const READ_ONLY_BOUNDARY: AgencyBoundaryV1 = {
  schemaVersion: 1,
  tier: 'ReadOnly',
};

/** Standard boundary for LLM copilot agents that submit decisions. */
export const STANDARD_AGENT_BOUNDARY: AgencyBoundaryV1 = {
  schemaVersion: 1,
  tier: 'Standard',
};

/** Full boundary for privileged orchestration agents. */
export const PRIVILEGED_AGENT_BOUNDARY: AgencyBoundaryV1 = {
  schemaVersion: 1,
  tier: 'Privileged',
};

/**
 * Core types for @portarium/engine — validation middleware for agent tool calls.
 */

// ---------------------------------------------------------------------------
// Execution tiers
// ---------------------------------------------------------------------------

/**
 * Execution tier defines how much autonomous authority an action has.
 * - auto:          executes without human review
 * - assisted:      executes but is logged and can be interrupted
 * - human-approve: requires explicit human approval before execution
 * - manual-only:   never executes autonomously; always requires a human
 */
export type ExecutionTier = 'auto' | 'assisted' | 'human-approve' | 'manual-only';

// ---------------------------------------------------------------------------
// Tool call validation
// ---------------------------------------------------------------------------

/** A single argument in a tool call. */
export type ToolArg = string | number | boolean | null | ToolArg[] | { [key: string]: ToolArg };

/** A tool call submitted by an agent for validation. */
export interface ToolCall {
  /** Unique ID for this tool call (idempotency key). */
  callId: string;
  /** The name of the tool being called. */
  toolName: string;
  /** Arguments passed to the tool. */
  args: Record<string, ToolArg>;
  /** Optional metadata for audit trail. */
  metadata?: {
    agentId?: string;
    sessionId?: string;
    workspaceId?: string;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Policy rules
// ---------------------------------------------------------------------------

/** A rule that matches tool calls and assigns a tier or blocks them. */
export interface PolicyRule {
  /** Human-readable label for audit logs. */
  name: string;
  /** If set, only apply this rule to tools matching this pattern (exact or glob-style). */
  matchTool?: string | RegExp;
  /** If set, only apply when args satisfy this predicate. */
  matchArgs?: (args: Record<string, ToolArg>) => boolean;
  /** The tier to assign when this rule matches. */
  tier: ExecutionTier;
}

/** A call limit rule — blocks tool calls once a threshold is reached. */
export interface CallLimitRule {
  /** Tool name (exact match). */
  toolName: string;
  /** Max number of calls allowed per session. */
  maxCallsPerSession: number;
}

// ---------------------------------------------------------------------------
// Audit hook
// ---------------------------------------------------------------------------

/** Payload passed to the audit hook on every validated call. */
export interface AuditEvent {
  callId: string;
  toolName: string;
  args: Record<string, ToolArg>;
  tier: ExecutionTier;
  decision: ValidationDecision;
  timestamp: string;
  metadata?: ToolCall['metadata'];
}

/** Audit hook function — called after every validation decision. */
export type AuditHook = (event: AuditEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/** Decision made by the engine for a tool call. */
export type ValidationDecision =
  | { outcome: 'allow'; tier: ExecutionTier }
  | { outcome: 'block'; reason: string }
  | { outcome: 'require-approval'; tier: 'human-approve' | 'manual-only'; reason: string };

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

/** Configuration for the Portarium engine instance. */
export interface EngineConfig {
  /** Policy rules evaluated in order. First match wins. */
  rules?: PolicyRule[];
  /** Call limit rules — block when threshold exceeded. */
  callLimits?: CallLimitRule[];
  /** Default tier when no rule matches. Defaults to 'auto'. */
  defaultTier?: ExecutionTier;
  /** Audit hook called after every validation decision. */
  onAudit?: AuditHook;
}

import type { ActionId, CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Result discriminated union
// ---------------------------------------------------------------------------

/** Action dispatch succeeded — optional output returned by the execution plane. */
export type ActionDispatchSuccess = Readonly<{
  ok: true;
  /** Optional output payload from the execution plane (JSON-serialisable). */
  output?: unknown;
}>;

export type ActionDispatchErrorKind =
  | 'Unauthorized'
  | 'RateLimited'
  | 'FlowNotFound'
  | 'Timeout'
  | 'RemoteError';

/** Action dispatch failed — discriminated by errorKind for upstream retry/escalation. */
export type ActionDispatchFailure = Readonly<{
  ok: false;
  errorKind: ActionDispatchErrorKind;
  message: string;
}>;

export type ActionDispatchResult = ActionDispatchSuccess | ActionDispatchFailure;

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Input for dispatching a workflow action to an external execution plane
 * (e.g. Activepieces, Langflow, Kestra, StackStorm).
 *
 * Implementations propagate the correlation envelope as HTTP headers so that
 * execution plane audit logs are traceable back to the Portarium run.
 */
export type ActionDispatchInput = Readonly<{
  /** Identifies this specific action step within the run. */
  actionId: ActionId;
  /** Tenant scope — used for routing and audit. */
  tenantId: TenantId;
  /** The parent run that triggered this action. */
  runId: RunId;
  /** Cross-aggregate correlation token for event traceability. */
  correlationId: CorrelationId;
  /**
   * Execution plane reference — execution plane adapters interpret this as a
   * flow ID, pipeline ID, or endpoint path.  Opaque to the application layer.
   */
  flowRef: string;
  /** Arbitrary action-specific input payload forwarded to the execution plane. */
  payload: Record<string, unknown>;
}>;

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

/**
 * Port for dispatching workflow actions to external execution planes.
 * Infrastructure adapters (e.g. ActivepiecesAdapter, LangflowAdapter)
 * implement this interface; no HTTP or SDK imports belong here.
 */
export interface ActionRunnerPort {
  /**
   * Dispatch an action to the execution plane identified by input.flowRef.
   * Implementations inject correlation headers and map execution plane errors
   * to the ActionDispatchResult discriminated union.
   */
  dispatchAction(input: ActionDispatchInput): Promise<ActionDispatchResult>;
}

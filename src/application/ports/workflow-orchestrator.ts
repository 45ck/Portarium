import {
  type CorrelationId,
  type RunId,
  type TenantId,
  type UserId,
  type WorkflowId,
  type ExecutionTier,
} from '../../domain/primitives/index.js';
import type { WorkflowV1 } from '../../domain/workflows/workflow-v1.js';

export interface WorkflowExecutionInput {
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  /** The workflow definition being executed (already validated by the control plane). */
  readonly workflow: WorkflowV1;
  readonly initiatedByUserId: UserId;
  readonly correlationId: CorrelationId;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly executionTier: ExecutionTier;
  /**
   * Caller-supplied idempotency key scoped to the tenant.
   * Used as the Temporal workflowId (`${tenantId}/${idempotencyKey}`) so that
   * concurrent retries with the same key hit the same Temporal execution rather
   * than spawning duplicates.
   */
  readonly idempotencyKey: string;
}

export interface WorkflowOrchestrator {
  startRun(input: WorkflowExecutionInput): Promise<void>;
}

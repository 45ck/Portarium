import {
  type CorrelationId,
  type RunId,
  type TenantId,
  type UserId,
  type WorkflowId,
  type ExecutionTier,
} from '../../domain/primitives/index.js';

export interface WorkflowExecutionInput {
  readonly runId: RunId;
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly initiatedByUserId: UserId;
  readonly correlationId: CorrelationId;
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

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
}

export interface WorkflowOrchestrator {
  startRun(input: WorkflowExecutionInput): Promise<void>;
}

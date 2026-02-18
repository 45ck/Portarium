import { Client, Connection } from '@temporalio/client';

import type {
  WorkflowExecutionInput,
  WorkflowOrchestrator,
} from '../../application/ports/workflow-orchestrator.js';

/**
 * Portarium workflow type identifier used for all run executions.
 *
 * Temporal requires a workflow type name that matches the registered worker workflow.
 * All Portarium runs share a single workflow type; the runId and workspaceId carried
 * in the input distinguish individual executions.
 */
export const PORTARIUM_WORKFLOW_TYPE = 'portarium-run' as const;

/**
 * Temporal namespace used for all Portarium workflow executions.
 *
 * Override via TemporalWorkflowOrchestratorConfig.namespace for multi-namespace deployments.
 */
export const DEFAULT_TEMPORAL_NAMESPACE = 'default' as const;

/** Default task queue for run execution workers. */
export const DEFAULT_TEMPORAL_TASK_QUEUE = 'portarium-runs' as const;

export type TemporalWorkflowOrchestratorConfig = Readonly<{
  /** gRPC address of the Temporal frontend service. Defaults to 127.0.0.1:7233. */
  address?: string;
  /** Temporal namespace. Defaults to 'default'. */
  namespace?: string;
  /** Task queue name for run workers. Defaults to 'portarium-runs'. */
  taskQueue?: string;
}>;

/**
 * WorkflowOrchestrator adapter backed by Temporal.
 *
 * Lifecycle:
 *   1. Construct with config.
 *   2. Call connect() before first use — returns the same instance.
 *   3. Call startRun() for each workflow execution.
 *   4. Call close() during graceful shutdown.
 */
export class TemporalWorkflowOrchestrator implements WorkflowOrchestrator {
  private client: Client | null = null;
  private readonly address: string;
  private readonly namespace: string;
  private readonly taskQueue: string;

  public constructor(config: TemporalWorkflowOrchestratorConfig = {}) {
    this.address = config.address ?? '127.0.0.1:7233';
    this.namespace = config.namespace ?? DEFAULT_TEMPORAL_NAMESPACE;
    this.taskQueue = config.taskQueue ?? DEFAULT_TEMPORAL_TASK_QUEUE;
  }

  /**
   * Opens the gRPC connection to Temporal.
   * Must be called before startRun().  Idempotent — safe to call multiple times.
   */
  public async connect(): Promise<this> {
    if (this.client !== null) return this;
    const connection = await Connection.connect({ address: this.address });
    this.client = new Client({ connection, namespace: this.namespace });
    return this;
  }

  /**
   * Dispatches a Temporal workflow execution for the given run.
   *
   * The Temporal workflowId is `${tenantId}/${idempotencyKey}` so that
   * concurrent retries with the same idempotency key resolve to the same
   * Temporal execution — preventing duplicate runs even when the application-layer
   * idempotency cache is not yet populated (concurrent window).
   *
   * `WorkflowExecutionAlreadyStartedError` is treated as idempotent success:
   * the existing execution continues uninterrupted.
   */
  public async startRun(input: WorkflowExecutionInput): Promise<void> {
    if (this.client === null) {
      throw new Error('TemporalWorkflowOrchestrator: connect() must be called before startRun().');
    }

    try {
      await this.client.workflow.start(PORTARIUM_WORKFLOW_TYPE, {
        taskQueue: this.taskQueue,
        workflowId: `${input.tenantId}/${input.idempotencyKey}`,
        args: [
          {
            runId: input.runId.toString(),
            tenantId: input.tenantId.toString(),
            workflowId: input.workflowId.toString(),
            initiatedByUserId: input.initiatedByUserId.toString(),
            correlationId: input.correlationId.toString(),
            executionTier: input.executionTier,
          },
        ],
      });
    } catch (error) {
      // Temporal throws WorkflowExecutionAlreadyStartedError when a workflow
      // with the same workflowId is already running.  This is idempotent
      // success — the existing execution carries the same idempotency key.
      if (error instanceof Error && error.name === 'WorkflowExecutionAlreadyStartedError') {
        return;
      }
      throw error;
    }
  }

  /**
   * Closes the underlying gRPC connection.
   * Call during application shutdown to release resources.
   */
  public async close(): Promise<void> {
    if (this.client === null) return;
    await this.client.connection.close();
    this.client = null;
  }
}

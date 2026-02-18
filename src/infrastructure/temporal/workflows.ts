import { log } from '@temporalio/workflow';

export type PortariumRunWorkflowInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  initiatedByUserId: string;
  correlationId: string;
  executionTier: 'Auto' | 'HumanApprove';
}>;

/**
 * Minimal Temporal workflow for Portarium run executions.
 *
 * This is intentionally a no-op placeholder: later beads implement the full
 * run state machine, activities, signals, and determinism boundaries.
 */
export function portariumRun(input: PortariumRunWorkflowInput): Promise<void> {
  // Deterministic logging only; no non-deterministic I/O inside workflows.
  log.info('Portarium run workflow started.', { ...input });
  return Promise.resolve();
}

import { condition, defineSignal, log, proxyActivities, setHandler } from '@temporalio/workflow';

import type * as activities from './activities.js';
import type { WorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { redactStructuredLogObject } from '../observability/structured-log.js';

export type PortariumRunWorkflowInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  workflow: WorkflowV1;
  initiatedByUserId: string;
  correlationId: string;
  traceparent?: string;
  tracestate?: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}>;

export type ApprovalDecision = 'Approved' | 'Denied' | 'RequestChanges';

export type ApprovalDecisionSignalPayload = Readonly<{
  decision: ApprovalDecision;
  approvalId?: string;
  decidedAtIso?: string;
  decidedByUserId?: string;
  rationale?: string;
}>;

export const approvalDecisionSignal =
  defineSignal<[ApprovalDecisionSignalPayload]>('approvalDecision');

type TemporalRunActivities = Readonly<{
  startRunActivity: typeof activities.startRunActivity;
  completeRunActivity: typeof activities.completeRunActivity;
}>;

const { startRunActivity, completeRunActivity }: TemporalRunActivities =
  proxyActivities<TemporalRunActivities>({
    startToCloseTimeout: '30 seconds',
    retry: {
      // Conservative default: quick retries with capped exponential backoff.
      // Per-activity policy will become explicit when actions are implemented.
      initialInterval: '1 second',
      backoffCoefficient: 2,
      maximumInterval: '30 seconds',
      maximumAttempts: 5,
    },
  });

export async function portariumRun(input: PortariumRunWorkflowInput): Promise<void> {
  // Deterministic workflow boundary:
  // - Do not use Date.now(), random UUIDs, network, filesystem, or process env here.
  // - Push all non-deterministic work into activities.
  log.info(
    'Portarium run workflow started.',
    redactStructuredLogObject({
      runId: input.runId,
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      initiatedByUserId: input.initiatedByUserId,
      correlationId: input.correlationId,
      traceparent: input.traceparent,
      tracestate: input.tracestate,
      executionTier: input.executionTier,
    }),
  );

  await startRunActivity({
    runId: input.runId,
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    workflow: input.workflow,
    initiatedByUserId: input.initiatedByUserId,
    correlationId: input.correlationId,
    ...(input.traceparent ? { traceparent: input.traceparent } : {}),
    ...(input.tracestate ? { tracestate: input.tracestate } : {}),
    executionTier: input.executionTier,
  });

  if (input.executionTier === 'HumanApprove' || input.executionTier === 'ManualOnly') {
    let decision: ApprovalDecisionSignalPayload | undefined;
    setHandler(approvalDecisionSignal, (payload) => {
      decision = payload;
    });

    await condition(() => decision !== undefined);

    log.info('Approval decision received.', {
      runId: input.runId,
      decision: decision!.decision,
      approvalId: decision!.approvalId,
    });

    // Only the "Approved" path continues execution.
    // (RequestChanges/Denied will be handled as explicit lifecycle transitions in later beads.)
    if (decision!.decision !== 'Approved') return;
  }

  await completeRunActivity({
    runId: input.runId,
    tenantId: input.tenantId,
    workflowId: input.workflowId,
    workflow: input.workflow,
    initiatedByUserId: input.initiatedByUserId,
    correlationId: input.correlationId,
    ...(input.traceparent ? { traceparent: input.traceparent } : {}),
    ...(input.tracestate ? { tracestate: input.tracestate } : {}),
  });
}

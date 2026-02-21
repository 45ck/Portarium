import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { AppContext, DependencyFailure, Result } from '../common/index.js';
import { err, ok } from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  NewStartWorkflowPlan,
  StartWorkflowDeps,
  StartWorkflowOutput,
} from './start-workflow.js';

const START_WORKFLOW_SOURCE = 'portarium.control-plane.workflow-runtime';

export async function executeStartWorkflowTransaction(
  deps: StartWorkflowDeps,
  ctx: AppContext,
  plan: NewStartWorkflowPlan,
): Promise<Result<StartWorkflowOutput, DependencyFailure>> {
  const domainEvent: DomainEventV1 = {
    schemaVersion: 1,
    eventId: plan.generated.eventIdValue,
    eventType: 'RunStarted',
    aggregateKind: 'Run',
    aggregateId: plan.run.runId,
    occurredAtIso: plan.generated.createdAtIso,
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    actorUserId: ctx.principalId,
    payload: {
      runId: plan.run.runId,
      workflowId: plan.ids.workflowId.toString(),
      workspaceId: plan.ids.workspaceId.toString(),
    },
  };

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.runStore.saveRun(ctx.tenantId, plan.run);
      await deps.orchestrator.startRun({
        runId: plan.run.runId,
        tenantId: ctx.tenantId,
        workflowId: plan.ids.workflowId,
        workflow: plan.workflow,
        initiatedByUserId: ctx.principalId,
        correlationId: ctx.correlationId,
        ...(ctx.traceparent ? { traceparent: ctx.traceparent } : {}),
        ...(ctx.tracestate ? { tracestate: ctx.tracestate } : {}),
        executionTier: plan.workflow.executionTier,
        idempotencyKey: plan.commandKey.requestKey,
      });
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, START_WORKFLOW_SOURCE),
      );
      const output: StartWorkflowOutput = { runId: plan.run.runId };
      await deps.idempotency.set(plan.commandKey, output);
      return ok(output);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Workflow start failed due to a dependency failure.';
    return err({ kind: 'DependencyFailure', message });
  }
}

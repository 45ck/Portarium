/**
 * Agent action proposal HTTP handlers for the control-plane runtime.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import { APP_ACTIONS } from '../../application/common/actions.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  proposeAgentAction,
  type ProposeAgentActionDeps,
  type ProposeAgentActionError,
  type ProposeAgentActionInput,
} from '../../application/commands/propose-agent-action.js';
import {
  proposalsTotal,
  policyEvaluationDuration,
} from '../../infrastructure/observability/prometheus-registry.js';
import {
  type ControlPlaneDeps,
  GENERIC_DEPENDENCY_FAILURE_DETAIL,
  type ProblemDetails,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';
import type { PortariumLogger } from '../../infrastructure/observability/logger.js';

type AgentActionArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
  log?: PortariumLogger;
}>;

function serviceUnavailableProblem(detail: string, instance: string): ProblemDetails {
  return {
    type: 'https://portarium.dev/problems/service-unavailable',
    title: 'Service Unavailable',
    status: 503,
    detail,
    instance,
  };
}

function missingGovernanceDependencyProblem(
  dependencyName: string,
  instance: string,
): ProblemDetails {
  return serviceUnavailableProblem(
    `Agent action governance is unavailable: ${dependencyName} is not configured.`,
    instance,
  );
}

function proposeErrorToProblem(error: ProposeAgentActionError, instance: string): ProblemDetails {
  switch (error.kind) {
    case 'Forbidden':
    case 'ValidationFailed':
    case 'NotFound':
      return problemFromError(error, instance);
    case 'Conflict':
      return problemFromError({ kind: 'ValidationFailed', message: error.message }, instance);
    case 'DependencyFailure':
      return serviceUnavailableProblem(GENERIC_DEPENDENCY_FAILURE_DETAIL, instance);
  }
}

function stringFromRecord(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function extractBeadId(parameters: Record<string, unknown> | undefined): string | undefined {
  if (!parameters) return undefined;
  const direct = stringFromRecord(parameters, 'beadId');
  if (direct) return direct;
  const metadata = parameters['metadata'];
  if (metadata && typeof metadata === 'object') {
    return stringFromRecord(metadata as Record<string, unknown>, 'beadId');
  }
  return undefined;
}

export async function handleProposeAgentAction(args: AgentActionArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    respondProblem(
      res,
      {
        type:
          bodyResult.error === 'unsupported-content-type'
            ? 'https://portarium.dev/problems/unsupported-media-type'
            : 'https://portarium.dev/problems/bad-request',
        title:
          bodyResult.error === 'unsupported-content-type'
            ? 'Unsupported Media Type'
            : 'Bad Request',
        status: bodyResult.error === 'unsupported-content-type' ? 415 : 400,
        detail:
          bodyResult.error === 'invalid-json'
            ? 'Request body contains invalid JSON.'
            : bodyResult.error === 'empty-body'
              ? 'Request body must not be empty.'
              : 'Content-Type must be application/json.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  if (!bodyResult.value || typeof bodyResult.value !== 'object') {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const record = bodyResult.value as Record<string, unknown>;

  const allowed = await deps.authorization.isAllowed(auth.ctx, APP_ACTIONS.agentActionPropose);
  if (!allowed) {
    respondProblem(
      res,
      problemFromError(
        {
          kind: 'Forbidden',
          action: APP_ACTIONS.agentActionPropose,
          message: 'Caller is not permitted to propose agent actions.',
        },
        pathname,
      ),
      correlationId,
      traceContext,
    );
    return;
  }

  if (!deps.policyStore) {
    respondProblem(
      res,
      missingGovernanceDependencyProblem('policyStore', pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  if (!deps.approvalStore) {
    respondProblem(
      res,
      missingGovernanceDependencyProblem('approvalStore', pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  if (!deps.eventPublisher) {
    respondProblem(
      res,
      missingGovernanceDependencyProblem('eventPublisher', pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  if (!deps.evidenceLog) {
    respondProblem(
      res,
      missingGovernanceDependencyProblem('evidenceLog', pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  const commandDeps: ProposeAgentActionDeps = {
    authorization: deps.authorization,
    clock: { nowIso: () => new Date().toISOString() },
    idGenerator: { generateId: () => crypto.randomUUID() },
    unitOfWork: deps.unitOfWork ?? { execute: async (fn) => fn() },
    policyStore: deps.policyStore,
    approvalStore: deps.approvalStore,
    eventPublisher: deps.eventPublisher,
    evidenceLog: deps.evidenceLog,
  };

  const input: ProposeAgentActionInput = {
    workspaceId,
    agentId: String(record['agentId'] ?? ''),
    actionKind: String(record['actionKind'] ?? ''),
    toolName: String(record['toolName'] ?? ''),
    executionTier: String(
      record['executionTier'] ?? '',
    ) as ProposeAgentActionInput['executionTier'],
    policyIds: (record['policyIds'] as string[]) ?? [],
    rationale: String(record['rationale'] ?? ''),
    correlationId,
    ...(record['machineId'] ? { machineId: String(record['machineId']) } : {}),
    ...(record['parameters']
      ? { parameters: record['parameters'] as Record<string, unknown> }
      : {}),
    ...(record['idempotencyKey'] ? { idempotencyKey: String(record['idempotencyKey']) } : {}),
  };

  const proposalStartMs = Date.now();
  const result = await proposeAgentAction(commandDeps, auth.ctx, input);
  const proposalDurationSeconds = (Date.now() - proposalStartMs) / 1000;
  policyEvaluationDuration.observe(proposalDurationSeconds, { workspaceId });

  if (!result.ok) {
    proposalsTotal.inc({ decision: 'error', workspaceId });
    if (result.error.kind === 'DependencyFailure') {
      args.log?.error('Agent action proposal dependency failure', {
        workspaceId,
        error: result.error.message,
      });
    }
    respondProblem(res, proposeErrorToProblem(result.error, pathname), correlationId, traceContext);
    return;
  }

  if (result.value.decision === 'NeedsApproval' && deps.eventStream) {
    const parameters = input.parameters;
    const beadId = extractBeadId(parameters);
    deps.eventStream.publish({
      type: 'com.portarium.approval.ApprovalRequested',
      id: crypto.randomUUID(),
      workspaceId,
      time: new Date().toISOString(),
      data: {
        ...result.value,
        agentId: input.agentId,
        actionKind: input.actionKind,
        toolName: input.toolName,
        executionTier: input.executionTier,
        policyIds: input.policyIds,
        rationale: input.rationale,
        ...(input.machineId ? { machineId: input.machineId } : {}),
        ...(parameters ? { parameters } : {}),
        ...(beadId ? { beadId } : {}),
      },
    });
  }

  proposalsTotal.inc({ decision: result.value.decision, workspaceId });
  respondJson(res, {
    statusCode: result.value.decision === 'Allow' ? 200 : 202,
    correlationId,
    traceContext,
    body: result.value,
  });
}

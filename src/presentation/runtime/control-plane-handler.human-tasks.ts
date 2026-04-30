import { randomUUID } from 'node:crypto';

import {
  EvidenceId,
  WorkforceMemberId,
  WorkforceQueueId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { HumanTaskV1 } from '../../domain/workforce/index.js';
import {
  authenticate,
  assertWorkspaceScope,
  assertReadAccess,
  hasRole,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';
import type {
  HandlerArgs,
  HandlerArgsWithHumanTask,
} from './control-plane-handler.workforce-types.js';
import {
  parseAssignHumanTaskBody,
  parseCompleteHumanTaskBody,
  parseEscalateHumanTaskBody,
  VALID_EVIDENCE_CATEGORIES,
  VALID_TASK_STATUSES,
} from './control-plane-handler.workforce-validation.js';

type AuthSuccess = Extract<Awaited<ReturnType<typeof authenticate>>, { ok: true }>;

async function authorize(
  args: HandlerArgs | HandlerArgsWithHumanTask,
): Promise<AuthSuccess | undefined> {
  const auth = await authenticate(args.deps, {
    req: args.req,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    expectedWorkspaceId: args.workspaceId,
  });
  if (!auth.ok) {
    respondProblem(
      args.res,
      problemFromError(auth.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  return auth;
}

function respondStoreUnavailable(
  args: HandlerArgs | HandlerArgsWithHumanTask,
  detail: string,
): void {
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail,
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
}

async function authorizeRead(
  args: HandlerArgs | HandlerArgsWithHumanTask,
): Promise<AuthSuccess | undefined> {
  const auth = await authorize(args);
  if (!auth) return undefined;

  const scope = assertWorkspaceScope(auth.ctx, args.workspaceId, args.deps.authEventLogger);
  if (!scope.ok) {
    respondProblem(
      args.res,
      problemFromError(scope.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }

  const readAccess = await assertReadAccess(args.deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(
      args.res,
      problemFromError(readAccess.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }

  return auth;
}

async function authorizeOperatorWrite(
  args: HandlerArgsWithHumanTask,
  detail: string,
): Promise<AuthSuccess | undefined> {
  const auth = await authorize(args);
  if (!auth) return undefined;
  const scope = assertWorkspaceScope(auth.ctx, args.workspaceId, args.deps.authEventLogger);
  if (!scope.ok) {
    respondProblem(
      args.res,
      problemFromError(scope.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  if (hasRole(auth.ctx, 'admin') || hasRole(auth.ctx, 'operator')) return auth;

  args.deps.authEventLogger?.logForbidden({
    correlationId: args.correlationId,
    workspaceId: args.workspaceId,
    action: 'operator.write',
    reason: detail,
  });
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      detail,
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
  return undefined;
}

async function findHumanTask(
  args: HandlerArgsWithHumanTask,
  auth: AuthSuccess,
): Promise<HumanTaskV1 | null> {
  const store = args.deps.humanTaskStore;
  if (!store) return null;
  return store.getHumanTaskById(auth.ctx.tenantId, args.humanTaskId as never, args.workspaceId);
}

function respondHumanTaskNotFound(args: HandlerArgsWithHumanTask): void {
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: `Human task ${args.humanTaskId} not found.`,
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
}

export async function handleListHumanTasks(args: HandlerArgs): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  const store = args.deps.humanTaskStore;
  if (!store?.listHumanTasks) {
    respondStoreUnavailable(args, 'Human task store is not configured.');
    return;
  }

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const assigneeId = url.searchParams.get('assigneeId');
  const status = url.searchParams.get('status');
  const runId = url.searchParams.get('runId');
  const page = await store.listHumanTasks(auth.ctx.tenantId, {
    workspaceId: args.workspaceId,
    ...(assigneeId ? { assigneeId } : {}),
    ...(status && VALID_TASK_STATUSES.has(status) ? { status: status as never } : {}),
    ...(runId ? { runId } : {}),
    ...listPageParams(url),
  });

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: page,
  });
}

export async function handleGetHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  if (!args.deps.humanTaskStore) {
    respondStoreUnavailable(args, 'Human task store is not configured.');
    return;
  }

  const task = await findHumanTask(args, auth);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: task,
  });
}

export async function handleAssignHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const auth = await authorizeOperatorWrite(args, 'Only admin/operator can assign human tasks.');
  if (!auth) return;
  const store = args.deps.humanTaskStore;
  if (!store) {
    respondStoreUnavailable(args, 'Human task store is not configured.');
    return;
  }

  const task = await findHumanTask(args, auth);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const bodyResult = await readJsonBody(args.req);
  if (!bodyResult.ok) {
    respondProblem(
      args.res,
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
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const body = parseAssignHumanTaskBody(bodyResult.value);
  if (!body.ok) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'workforceMemberId or workforceQueueId is required.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const assigneeId = body.workforceMemberId
    ? WorkforceMemberId(body.workforceMemberId)
    : task.assigneeId;
  const groupId = body.workforceQueueId ? WorkforceQueueId(body.workforceQueueId) : task.groupId;
  const updated: HumanTaskV1 = {
    ...task,
    status: body.workforceMemberId ? 'assigned' : task.status,
    ...(assigneeId ? { assigneeId } : {}),
    ...(groupId ? { groupId } : {}),
  };
  await store.saveHumanTask(auth.ctx.tenantId, updated, args.workspaceId);
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleCompleteHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const auth = await authorizeOperatorWrite(args, 'Only admin/operator can complete human tasks.');
  if (!auth) return;
  const store = args.deps.humanTaskStore;
  if (!store) {
    respondStoreUnavailable(args, 'Human task store is not configured.');
    return;
  }
  const evidenceLog = args.deps.evidenceLog;
  if (!evidenceLog) {
    respondStoreUnavailable(args, 'Evidence log is not configured.');
    return;
  }

  const task = await findHumanTask(args, auth);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const bodyResult = await readJsonBody(args.req);
  if (!bodyResult.ok) {
    respondProblem(
      args.res,
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
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const parsed = parseCompleteHumanTaskBody(bodyResult.value);
  if (!parsed.ok) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'completionNote must be a string when provided.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const evidenceId = EvidenceId(`evi-${randomUUID()}`);
  const nowIso = (args.deps.clock?.() ?? new Date()).toISOString();
  const appendedEvidence = await evidenceLog.appendEntry(auth.ctx.tenantId, {
    schemaVersion: 1,
    evidenceId,
    workspaceId: WorkspaceId(args.workspaceId),
    correlationId: auth.ctx.correlationId,
    occurredAtIso: nowIso,
    category: 'Action',
    summary: parsed.completionNote
      ? `Human task ${args.humanTaskId} completed: ${parsed.completionNote}`
      : `Human task ${args.humanTaskId} completed.`,
    actor: { kind: 'User', userId: auth.ctx.principalId },
    links: { runId: task.runId, workItemId: task.workItemId },
  });

  const updated: HumanTaskV1 = {
    ...task,
    status: 'completed',
    completedAt: nowIso,
    completedById: task.assigneeId ?? WorkforceMemberId('wm-1'),
    evidenceAnchorId: appendedEvidence.evidenceId,
  };
  await store.saveHumanTask(auth.ctx.tenantId, updated, args.workspaceId);
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleEscalateHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const auth = await authorizeOperatorWrite(args, 'Only admin/operator can escalate human tasks.');
  if (!auth) return;
  const store = args.deps.humanTaskStore;
  if (!store) {
    respondStoreUnavailable(args, 'Human task store is not configured.');
    return;
  }

  const task = await findHumanTask(args, auth);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const bodyResult = await readJsonBody(args.req);
  if (!bodyResult.ok) {
    respondProblem(
      args.res,
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
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const parsed = parseEscalateHumanTaskBody(bodyResult.value);
  if (!parsed.ok) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'workforceQueueId is required.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const { assigneeId: _dropAssigneeId, ...taskWithoutAssignee } = task;
  const updated: HumanTaskV1 = {
    ...taskWithoutAssignee,
    status: 'escalated',
    groupId: WorkforceQueueId(parsed.workforceQueueId),
  };
  await store.saveHumanTask(auth.ctx.tenantId, updated, args.workspaceId);
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleListEvidence(args: HandlerArgs): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  const store = args.deps.evidenceQueryStore;
  if (!store) {
    respondStoreUnavailable(args, 'Evidence query store is not configured.');
    return;
  }

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const runId = url.searchParams.get('runId');
  const planId = url.searchParams.get('planId');
  const workItemId = url.searchParams.get('workItemId');
  const category = url.searchParams.get('category');
  if (category && !VALID_EVIDENCE_CATEGORIES.has(category)) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'category is invalid.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const page = await store.listEvidenceEntries(auth.ctx.tenantId, WorkspaceId(args.workspaceId), {
    filter: {
      ...(runId ? { runId } : {}),
      ...(planId ? { planId } : {}),
      ...(workItemId ? { workItemId } : {}),
      ...(category ? { category: category as never } : {}),
    },
    pagination: listPageParams(url),
  });

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: page,
  });
}

function listPageParams(url: URL): { limit?: number; cursor?: string } {
  const limitRaw = url.searchParams.get('limit');
  const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const limit =
    parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  return { ...(limit ? { limit } : {}), ...(cursor ? { cursor } : {}) };
}

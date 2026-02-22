import { randomBytes, randomUUID } from 'node:crypto';

import type { EvidenceRecord, HumanTaskRecord } from './control-plane-handler.shared.js';
import {
  authenticate,
  assertReadAccess,
  hasRole,
  paginate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';
import {
  appendRuntimeEvidence,
  listRuntimeEvidence,
  listRuntimeHumanTasks,
  updateRuntimeHumanTask,
} from './control-plane-handler.workforce-state.js';
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

async function authorizeRead(
  args: HandlerArgs | HandlerArgsWithHumanTask,
): Promise<AuthSuccess | undefined> {
  const auth = await authorize(args);
  if (!auth) return undefined;

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

function findHumanTask(args: HandlerArgsWithHumanTask): HumanTaskRecord | undefined {
  return listRuntimeHumanTasks(args.workspaceId).find(
    (entry) => entry.humanTaskId === args.humanTaskId,
  );
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

function completionEvidence(
  input: Readonly<{
    auth: AuthSuccess;
    workspaceId: string;
    humanTaskId: string;
    task: HumanTaskRecord;
    completionNote?: string;
  }>,
): { evidence: EvidenceRecord; evidenceId: string; nowIso: string } {
  const evidenceId = `evi-${randomUUID()}`;
  const nowIso = new Date().toISOString();
  const evidence: EvidenceRecord = {
    schemaVersion: 1,
    evidenceId,
    workspaceId: input.workspaceId,
    occurredAtIso: nowIso,
    category: 'Action',
    summary: input.completionNote
      ? `Human task ${input.humanTaskId} completed: ${input.completionNote}`
      : `Human task ${input.humanTaskId} completed.`,
    actor: { kind: 'User', userId: input.auth.ctx.principalId },
    links: { runId: input.task.runId, workItemId: input.task.workItemId },
    hashSha256: randomBytes(32).toString('hex'),
  };
  return { evidence, evidenceId, nowIso };
}

export async function handleListHumanTasks(args: HandlerArgs): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const assigneeId = url.searchParams.get('assigneeId');
  const status = url.searchParams.get('status');
  const runId = url.searchParams.get('runId');
  let items = listRuntimeHumanTasks(args.workspaceId);
  if (assigneeId) items = items.filter((task) => task.assigneeId === assigneeId);
  if (status && VALID_TASK_STATUSES.has(status))
    items = items.filter((task) => task.status === status);
  if (runId) items = items.filter((task) => task.runId === runId);

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: paginate(items, args.req.url ?? '/'),
  });
}

export async function handleGetHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const task = findHumanTask(args);
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
  if (!(await authorizeOperatorWrite(args, 'Only admin/operator can assign human tasks.'))) return;

  const task = findHumanTask(args);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const body = parseAssignHumanTaskBody(await readJsonBody(args.req));
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

  const assigneeId = body.workforceMemberId ?? task.assigneeId;
  const groupId = body.workforceQueueId ?? task.groupId;
  const updated: HumanTaskRecord = {
    ...task,
    status: body.workforceMemberId ? 'assigned' : task.status,
    ...(assigneeId ? { assigneeId } : {}),
    ...(groupId ? { groupId } : {}),
  };
  updateRuntimeHumanTask(updated);
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

  const task = findHumanTask(args);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const parsed = parseCompleteHumanTaskBody(await readJsonBody(args.req));
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

  const { evidence, evidenceId, nowIso } = completionEvidence({
    auth,
    workspaceId: args.workspaceId,
    humanTaskId: args.humanTaskId,
    task,
    ...(parsed.completionNote ? { completionNote: parsed.completionNote } : {}),
  });
  appendRuntimeEvidence(evidence);

  const updated: HumanTaskRecord = {
    ...task,
    status: 'completed',
    completedAt: nowIso,
    completedById: task.assigneeId ?? 'wm-1',
    evidenceAnchorId: evidenceId,
  };
  updateRuntimeHumanTask(updated);
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleEscalateHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  if (!(await authorizeOperatorWrite(args, 'Only admin/operator can escalate human tasks.')))
    return;

  const task = findHumanTask(args);
  if (!task) {
    respondHumanTaskNotFound(args);
    return;
  }

  const parsed = parseEscalateHumanTaskBody(await readJsonBody(args.req));
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
  const updated: HumanTaskRecord = {
    ...taskWithoutAssignee,
    status: 'escalated',
    groupId: parsed.workforceQueueId,
  };
  updateRuntimeHumanTask(updated);
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleListEvidence(args: HandlerArgs): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const runId = url.searchParams.get('runId');
  const planId = url.searchParams.get('planId');
  const workItemId = url.searchParams.get('workItemId');
  const category = url.searchParams.get('category');
  let items = listRuntimeEvidence(args.workspaceId);
  if (runId) items = items.filter((entry) => entry.links?.runId === runId);
  if (planId) items = items.filter((entry) => entry.links?.planId === planId);
  if (workItemId) items = items.filter((entry) => entry.links?.workItemId === workItemId);
  if (category && VALID_EVIDENCE_CATEGORIES.has(category)) {
    items = items.filter((entry) => entry.category === category);
  }

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: paginate(items, args.req.url ?? '/'),
  });
}

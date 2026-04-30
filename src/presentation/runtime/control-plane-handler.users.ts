import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { parseWorkspaceUserV1, WorkspaceUserParseError } from '../../domain/users/index.js';
import { UserId, WorkspaceId } from '../../domain/primitives/index.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  authenticate,
  hasRole,
  parseListQueryParams,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type UserCollectionArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

type UserItemArgs = UserCollectionArgs & Readonly<{ userId: string }>;

function requireStore(args: UserCollectionArgs): boolean {
  if (args.deps.workspaceUserStore) return true;
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Workspace user store not configured.',
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
  return false;
}

function respondBodyProblem(args: UserCollectionArgs, bodyError: string): void {
  respondProblem(
    args.res,
    {
      type:
        bodyError === 'unsupported-content-type'
          ? 'https://portarium.dev/problems/unsupported-media-type'
          : 'https://portarium.dev/problems/bad-request',
      title: bodyError === 'unsupported-content-type' ? 'Unsupported Media Type' : 'Bad Request',
      status: bodyError === 'unsupported-content-type' ? 415 : 400,
      detail:
        bodyError === 'invalid-json'
          ? 'Request body contains invalid JSON.'
          : bodyError === 'empty-body'
            ? 'Request body must not be empty.'
            : 'Content-Type must be application/json.',
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
}

function assertAdmin(
  args: UserCollectionArgs,
  ctx: Awaited<ReturnType<typeof authenticate>>,
): boolean {
  if (ctx.ok && hasRole(ctx.ctx, 'admin')) return true;
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      detail: 'Only admins can manage workspace users.',
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
  return false;
}

export async function handleListWorkspaceUsers(args: UserCollectionArgs): Promise<void> {
  if (!requireStore(args)) return;

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
    return;
  }

  const query = parseListQueryParams(new URL(args.req.url ?? '/', 'http://localhost'), [
    'userId',
    'email',
    'createdAtIso',
  ]);
  if (!query.ok) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: query.error,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const page = await args.deps.workspaceUserStore!.listWorkspaceUsers(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
    {
      ...(query.value.limit !== undefined ? { limit: query.value.limit } : {}),
      ...(query.value.cursor !== undefined ? { cursor: query.value.cursor } : {}),
    },
  );
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: page,
  });
}

export async function handleGetWorkspaceUser(args: UserItemArgs): Promise<void> {
  if (!requireStore(args)) return;
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
    return;
  }

  const user = await args.deps.workspaceUserStore!.getWorkspaceUserById(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
    UserId(args.userId),
  );
  if (!user) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workspace user ${args.userId} not found.`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: user,
  });
}

export async function handleAddWorkspaceUser(args: UserCollectionArgs): Promise<void> {
  if (!requireStore(args)) return;
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
    return;
  }
  if (!assertAdmin(args, auth)) return;

  const bodyResult = await readJsonBody(args.req);
  if (!bodyResult.ok) {
    respondBodyProblem(args, bodyResult.error);
    return;
  }

  try {
    const record =
      typeof bodyResult.value === 'object' &&
      bodyResult.value !== null &&
      !Array.isArray(bodyResult.value)
        ? (bodyResult.value as Record<string, unknown>)
        : {};
    const user = parseWorkspaceUserV1({
      ...record,
      userId: `user-${randomUUID()}`,
      workspaceId: args.workspaceId,
      active: record['active'] ?? true,
      createdAtIso: new Date().toISOString(),
    });
    await args.deps.workspaceUserStore!.saveWorkspaceUser(auth.ctx.tenantId, user);
    respondJson(args.res, {
      statusCode: 201,
      correlationId: args.correlationId,
      traceContext: args.traceContext,
      body: user,
      location: `/v1/workspaces/${encodeURIComponent(args.workspaceId)}/users/${encodeURIComponent(String(user.userId))}`,
    });
  } catch (error) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail:
          error instanceof WorkspaceUserParseError
            ? error.message
            : 'Invalid workspace user payload.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
  }
}

export async function handleUpdateWorkspaceUser(args: UserItemArgs): Promise<void> {
  if (!requireStore(args)) return;
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
    return;
  }
  if (!assertAdmin(args, auth)) return;

  const existing = await args.deps.workspaceUserStore!.getWorkspaceUserById(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
    UserId(args.userId),
  );
  if (!existing) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workspace user ${args.userId} not found.`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const bodyResult = await readJsonBody(args.req);
  if (!bodyResult.ok) {
    respondBodyProblem(args, bodyResult.error);
    return;
  }

  try {
    const patch =
      typeof bodyResult.value === 'object' &&
      bodyResult.value !== null &&
      !Array.isArray(bodyResult.value)
        ? (bodyResult.value as Record<string, unknown>)
        : {};
    const user = parseWorkspaceUserV1({ ...existing, ...patch });
    await args.deps.workspaceUserStore!.saveWorkspaceUser(auth.ctx.tenantId, user);
    respondJson(args.res, {
      statusCode: 200,
      correlationId: args.correlationId,
      traceContext: args.traceContext,
      body: user,
    });
  } catch (error) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail:
          error instanceof WorkspaceUserParseError
            ? error.message
            : 'Invalid workspace user patch.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
  }
}

export async function handleRemoveWorkspaceUser(args: UserItemArgs): Promise<void> {
  if (!requireStore(args)) return;
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
    return;
  }
  if (!assertAdmin(args, auth)) return;

  await args.deps.workspaceUserStore!.removeWorkspaceUser(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
    UserId(args.userId),
  );
  args.res.statusCode = 204;
  args.res.setHeader('x-correlation-id', args.correlationId);
  args.res.end();
}

import type { WorkforceCapability } from './control-plane-handler.shared.js';
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
  HandlerArgsWithMember,
} from './control-plane-handler.workforce-types.js';
import { parseAvailabilityPatchBody } from './control-plane-handler.workforce-validation.js';

type AuthSuccess = Extract<Awaited<ReturnType<typeof authenticate>>, { ok: true }>;

async function authorize(
  args: HandlerArgs | HandlerArgsWithMember,
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

function respondStoreUnavailable(args: HandlerArgs | HandlerArgsWithMember, detail: string): void {
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
  args: HandlerArgs | HandlerArgsWithMember,
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

export async function handleListWorkforceMembers(args: HandlerArgs): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  const store = args.deps.workforceMemberStore;
  if (!store?.listWorkforceMembers) {
    respondStoreUnavailable(args, 'Workforce member store is not configured.');
    return;
  }

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  const queueId = url.searchParams.get('queueId');
  const availability = url.searchParams.get('availability');
  const page = await store.listWorkforceMembers(auth.ctx.tenantId, {
    workspaceId: args.workspaceId,
    ...(capability ? { capability: capability as WorkforceCapability } : {}),
    ...(queueId ? { queueId } : {}),
    ...(availability === 'available' || availability === 'busy' || availability === 'offline'
      ? { availability }
      : {}),
    ...listPageParams(url),
  });

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: page,
  });
}

export async function handleGetWorkforceMember(args: HandlerArgsWithMember): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  const store = args.deps.workforceMemberStore;
  if (!store) {
    respondStoreUnavailable(args, 'Workforce member store is not configured.');
    return;
  }

  const member = await store.getWorkforceMemberById(
    auth.ctx.tenantId,
    args.workforceMemberId as never,
    args.workspaceId,
  );
  if (!member) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workforce member ${args.workforceMemberId} not found.`,
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
    body: member,
  });
}

export async function handlePatchWorkforceAvailability(args: HandlerArgsWithMember): Promise<void> {
  const auth = await authorize(args);
  if (!auth) return;
  const scope = assertWorkspaceScope(auth.ctx, args.workspaceId, args.deps.authEventLogger);
  if (!scope.ok) {
    respondProblem(
      args.res,
      problemFromError(scope.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const store = args.deps.workforceMemberStore;
  if (!store?.saveWorkforceMember) {
    respondStoreUnavailable(args, 'Writable workforce member store is not configured.');
    return;
  }

  const member = await store.getWorkforceMemberById(
    auth.ctx.tenantId,
    args.workforceMemberId as never,
    args.workspaceId,
  );
  if (!member) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workforce member ${args.workforceMemberId} not found.`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  if (!hasRole(auth.ctx, 'admin') && String(auth.ctx.principalId) !== String(member.linkedUserId)) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admins or the linked user can update workforce availability.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
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

  const body = parseAvailabilityPatchBody(bodyResult.value);
  if (!body.ok) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'availabilityStatus must be one of: available, busy, offline.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const updated = {
    ...member,
    availabilityStatus: body.availabilityStatus,
    updatedAtIso: (args.deps.clock?.() ?? new Date()).toISOString(),
  };
  await store.saveWorkforceMember(auth.ctx.tenantId, updated, args.workspaceId);

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: updated,
  });
}

export async function handleListWorkforceQueues(args: HandlerArgs): Promise<void> {
  const auth = await authorizeRead(args);
  if (!auth) return;
  const store = args.deps.workforceQueueStore;
  if (!store?.listWorkforceQueues) {
    respondStoreUnavailable(args, 'Workforce queue store is not configured.');
    return;
  }

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  const page = await store.listWorkforceQueues(auth.ctx.tenantId, {
    workspaceId: args.workspaceId,
    ...(capability ? { capability: capability as WorkforceCapability } : {}),
    ...listPageParams(url),
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

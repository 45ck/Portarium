import type { WorkforceMemberRecord, WorkforceCapability } from './control-plane-handler.shared.js';
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
import type {
  HandlerArgs,
  HandlerArgsWithMember,
} from './control-plane-handler.workforce-types.js';
import { listFixtureMembers, listFixtureQueues } from './control-plane-handler.workforce-state.js';
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

async function authorizeRead(
  args: HandlerArgs | HandlerArgsWithMember,
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

export async function handleListWorkforceMembers(args: HandlerArgs): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  const queueId = url.searchParams.get('queueId');
  const availability = url.searchParams.get('availability');
  let items = listFixtureMembers(args.workspaceId);
  if (capability) {
    items = items.filter((member) =>
      member.capabilities.includes(capability as WorkforceCapability),
    );
  }
  if (queueId) {
    items = items.filter((member) => member.queueMemberships.includes(queueId));
  }
  if (availability === 'available' || availability === 'busy' || availability === 'offline') {
    items = items.filter((member) => member.availabilityStatus === availability);
  }

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: paginate(items, args.req.url ?? '/'),
  });
}

export async function handleGetWorkforceMember(args: HandlerArgsWithMember): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const member = listFixtureMembers(args.workspaceId).find(
    (entry) => entry.workforceMemberId === args.workforceMemberId,
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

function resolvePatchTarget(
  workspaceId: string,
  workforceMemberId: string,
): WorkforceMemberRecord | undefined {
  return listFixtureMembers(workspaceId).find(
    (member) => member.workforceMemberId === workforceMemberId,
  );
}

export async function handlePatchWorkforceAvailability(args: HandlerArgsWithMember): Promise<void> {
  const auth = await authorize(args);
  if (!auth) return;
  if (!hasRole(auth.ctx, 'admin')) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admins can update workforce availability in this runtime.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const member = resolvePatchTarget(args.workspaceId, args.workforceMemberId);
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

  const body = parseAvailabilityPatchBody(await readJsonBody(args.req));
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

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: {
      ...member,
      availabilityStatus: body.availabilityStatus,
      updatedAtIso: new Date().toISOString(),
    },
  });
}

export async function handleListWorkforceQueues(args: HandlerArgs): Promise<void> {
  if (!(await authorizeRead(args))) return;

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  let items = listFixtureQueues(args.workspaceId);
  if (capability) {
    items = items.filter((queue) =>
      queue.requiredCapabilities.includes(capability as WorkforceCapability),
    );
  }

  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: paginate(items, args.req.url ?? '/'),
  });
}

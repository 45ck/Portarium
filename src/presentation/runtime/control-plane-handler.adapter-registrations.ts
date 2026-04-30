import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AdapterMachineEntryV1, AdapterRegistrationV1 } from '../../domain/adapters/index.js';
import { WorkspaceId } from '../../domain/primitives/index.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  authenticate,
  hasRole,
  problemFromError,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type AdapterCollectionArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

type AdapterItemArgs = AdapterCollectionArgs & Readonly<{ adapterId: string }>;

function toAdapterApiView(registration: AdapterRegistrationV1): AdapterRegistrationV1 {
  if (!registration.machineRegistrations) return registration;
  return {
    ...registration,
    machineRegistrations: registration.machineRegistrations.map(redactMachineEntry),
  };
}

function redactMachineEntry(entry: AdapterMachineEntryV1): AdapterMachineEntryV1 {
  const { authHint: _authHint, ...safe } = entry;
  return safe;
}

function requireStore(args: AdapterCollectionArgs): boolean {
  if (args.deps.adapterRegistrationStore) return true;
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Adapter registration store not configured.',
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
  return false;
}

async function authorize(args: AdapterCollectionArgs) {
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

export async function handleListAdapterRegistrations(args: AdapterCollectionArgs): Promise<void> {
  if (!requireStore(args)) return;
  const auth = await authorize(args);
  if (!auth) return;

  const items = await args.deps.adapterRegistrationStore!.listByWorkspace(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
  );
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: { items: items.map(toAdapterApiView) },
  });
}

export async function handleGetAdapterRegistration(args: AdapterItemArgs): Promise<void> {
  if (!requireStore(args)) return;
  const auth = await authorize(args);
  if (!auth) return;

  const items = await args.deps.adapterRegistrationStore!.listByWorkspace(
    auth.ctx.tenantId,
    WorkspaceId(args.workspaceId),
  );
  const item = items.find((registration) => String(registration.adapterId) === args.adapterId);
  if (!item) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Adapter registration ${args.adapterId} not found.`,
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
    body: toAdapterApiView(item),
  });
}

export async function handleUnsupportedAdapterRegistrationMutation(
  args: AdapterCollectionArgs,
): Promise<void> {
  const auth = await authorize(args);
  if (!auth) return;
  if (!hasRole(auth.ctx, 'admin')) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admins can manage adapter registrations.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  respondProblem(
    args.res,
    {
      type: 'https://portarium.dev/problems/not-implemented',
      title: 'Not Implemented',
      status: 501,
      detail: 'Adapter registration mutations are not available in this runtime.',
      instance: args.pathname,
    },
    args.correlationId,
    args.traceContext,
  );
}

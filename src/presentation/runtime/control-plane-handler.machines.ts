/**
 * Machine and agent registry HTTP handlers for the control-plane runtime.
 * Exposes CRUD endpoints for machine registrations and agent configurations.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppContext } from '../../application/common/context.js';
import {
  getMachine,
  listMachines,
  getAgent,
  listAgents,
} from '../../application/queries/machine-agent-registry.js';
import {
  parseMachineRegistrationV1,
  parseAgentConfigV1,
  MachineRegistrationParseError,
  AgentConfigParseError,
} from '../../domain/machines/machine-registration-v1.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  authenticate,
  assertWorkspaceScope,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
  hasRole,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Handler arg types
// ---------------------------------------------------------------------------

type MachineRegistryArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

type MachineItemArgs = MachineRegistryArgs & Readonly<{ machineId: string }>;

type AgentRegistryArgs = MachineRegistryArgs;

type AgentItemArgs = MachineRegistryArgs & Readonly<{ agentId: string }>;

// ---------------------------------------------------------------------------
// Shared 503 helper when stores are not configured
// ---------------------------------------------------------------------------

function respondStoreUnavailable(
  res: ServerResponse,
  correlationId: string,
  pathname: string,
  traceContext: TraceContext,
): void {
  respondProblem(
    res,
    {
      type: 'https://portarium.dev/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Registry store not configured.',
      instance: pathname,
    },
    correlationId,
    traceContext,
  );
}

// ---------------------------------------------------------------------------
// Auth + scope helper (shared pattern across all registry handlers)
// ---------------------------------------------------------------------------

async function authAndScope(
  deps: ControlPlaneDeps,
  req: IncomingMessage,
  res: ServerResponse,
  correlationId: string,
  pathname: string,
  workspaceId: string,
  traceContext: TraceContext,
): Promise<{ ok: true; ctx: AppContext } | { ok: false }> {
  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return { ok: false };
  }
  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId, deps.authEventLogger);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return { ok: false };
  }
  return { ok: true, ctx: auth.ctx };
}

// ---------------------------------------------------------------------------
// Machine handlers
// ---------------------------------------------------------------------------

export async function handleListMachines(args: MachineRegistryArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  if (!deps.machineQueryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw !== null ? Number.parseInt(limitRaw, 10) : undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const activeRaw = url.searchParams.get('active');
  const active = activeRaw === 'true' ? true : activeRaw === 'false' ? false : undefined;

  const result = await listMachines(
    { authorization: deps.authorization, machineQueryStore: deps.machineQueryStore },
    authResult.ctx,
    {
      workspaceId,
      ...(active !== undefined ? { active } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

export async function handleGetMachine(args: MachineItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, machineId, traceContext } = args;

  if (!deps.machineQueryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  const result = await getMachine(
    { authorization: deps.authorization, machineQueryStore: deps.machineQueryStore },
    authResult.ctx,
    { workspaceId, machineId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

export async function handleRegisterMachine(args: MachineRegistryArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  if (!deps.machineRegistryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  if (!hasRole(authResult.ctx, 'admin') && !hasRole(authResult.ctx, 'operator')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin or operator roles may register machines.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = await readJsonBody(req);
  let registration;
  try {
    registration = parseMachineRegistrationV1(body);
  } catch (err) {
    if (err instanceof MachineRegistrationParseError) {
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/validation-failed',
          title: 'Validation Failed',
          status: 400,
          detail: err.message,
          instance: pathname,
        },
        correlationId,
        traceContext,
      );
      return;
    }
    throw err;
  }

  if (String(registration.workspaceId) !== workspaceId) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Machine workspaceId does not match the URL workspace scope.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  await deps.machineRegistryStore.saveMachineRegistration(authResult.ctx.tenantId, registration);
  respondJson(res, {
    statusCode: 201,
    correlationId,
    traceContext,
    body: { machineId: String(registration.machineId) },
  });
}

// ---------------------------------------------------------------------------
// Agent handlers
// ---------------------------------------------------------------------------

export async function handleListAgents(args: AgentRegistryArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  if (!deps.machineQueryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  const url = new URL(req.url ?? '/', 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw !== null ? Number.parseInt(limitRaw, 10) : undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const machineIdParam = url.searchParams.get('machineId') ?? undefined;

  const result = await listAgents(
    { authorization: deps.authorization, machineQueryStore: deps.machineQueryStore },
    authResult.ctx,
    {
      workspaceId,
      ...(machineIdParam !== undefined ? { machineId: machineIdParam } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

export async function handleGetAgent(args: AgentItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, agentId, traceContext } = args;

  if (!deps.machineQueryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  const result = await getAgent(
    { authorization: deps.authorization, machineQueryStore: deps.machineQueryStore },
    authResult.ctx,
    { workspaceId, agentId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

export async function handleCreateAgent(args: AgentRegistryArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  if (!deps.machineRegistryStore) {
    respondStoreUnavailable(res, correlationId, pathname, traceContext);
    return;
  }

  const authResult = await authAndScope(
    deps,
    req,
    res,
    correlationId,
    pathname,
    workspaceId,
    traceContext,
  );
  if (!authResult.ok) return;

  if (!hasRole(authResult.ctx, 'admin') && !hasRole(authResult.ctx, 'operator')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin or operator roles may create agents.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = await readJsonBody(req);
  let agent;
  try {
    agent = parseAgentConfigV1(body);
  } catch (err) {
    if (err instanceof AgentConfigParseError) {
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/validation-failed',
          title: 'Validation Failed',
          status: 400,
          detail: err.message,
          instance: pathname,
        },
        correlationId,
        traceContext,
      );
      return;
    }
    throw err;
  }

  if (String(agent.workspaceId) !== workspaceId) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Agent workspaceId does not match the URL workspace scope.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  await deps.machineRegistryStore.saveAgentConfig(authResult.ctx.tenantId, agent);
  respondJson(res, {
    statusCode: 201,
    correlationId,
    traceContext,
    body: { agentId: String(agent.agentId) },
  });
}

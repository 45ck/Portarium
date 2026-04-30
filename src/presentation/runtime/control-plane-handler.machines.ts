/**
 * Machine and agent registry HTTP handlers for the control-plane runtime.
 * Exposes CRUD endpoints for machine registrations and agent configurations.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

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
  type MachineRegistrationV1,
  type AgentConfigV1,
} from '../../domain/machines/machine-registration-v1.js';
import { AgentId, MachineId, WorkspaceId } from '../../domain/primitives/index.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import { machineRegistrationsTotal } from '../../infrastructure/observability/prometheus-registry.js';
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

type AgentCapability =
  | 'read:external'
  | 'write:external'
  | 'classify'
  | 'generate'
  | 'analyze'
  | 'execute-code'
  | 'notify'
  | 'machine:invoke';

type MachineApiView = Readonly<{
  schemaVersion: 1;
  machineId: string;
  workspaceId: string;
  hostname: string;
  registeredAtIso: string;
  status: 'Online' | 'Offline';
  allowedCapabilities: readonly AgentCapability[];
}>;

type AgentApiView = Readonly<{
  schemaVersion: 1;
  agentId: string;
  workspaceId: string;
  name: string;
  endpoint: string;
  allowedCapabilities: readonly AgentCapability[];
  machineId: string;
  policyTier: AgentConfigV1['policyTier'];
  usedByWorkflowIds: readonly string[];
}>;

const UI_TO_DOMAIN_CAPABILITY: Readonly<Record<AgentCapability, string>> = {
  'read:external': 'read:external',
  'write:external': 'write:external',
  classify: 'agent:classify',
  generate: 'agent:generate',
  analyze: 'agent:analyze',
  'execute-code': 'code:execute',
  notify: 'notification:send',
  'machine:invoke': 'machine:invoke',
};

const DOMAIN_TO_UI_CAPABILITY: Readonly<Record<string, AgentCapability>> = Object.fromEntries(
  Object.entries(UI_TO_DOMAIN_CAPABILITY).map(([ui, domain]) => [domain, ui]),
) as Record<string, AgentCapability>;

// authConfig (secretRef, bearer/apiKey hints) must never reach the browser.
function toMachineApiView(machine: MachineRegistrationV1): MachineApiView {
  return {
    schemaVersion: 1,
    machineId: String(machine.machineId),
    workspaceId: String(machine.workspaceId),
    hostname: machine.displayName || hostnameFromEndpoint(machine.endpointUrl),
    registeredAtIso: machine.registeredAtIso,
    status: machine.active ? 'Online' : 'Offline',
    allowedCapabilities: machine.capabilities.map((capability) =>
      toUiCapability(String(capability.capability)),
    ),
  };
}

function toAgentApiView(agent: AgentConfigV1): AgentApiView {
  return {
    schemaVersion: 1,
    agentId: String(agent.agentId),
    workspaceId: String(agent.workspaceId),
    name: agent.displayName,
    endpoint: `machine://${String(agent.machineId)}`,
    allowedCapabilities: agent.capabilities.map((capability) =>
      toUiCapability(String(capability.capability)),
    ),
    machineId: String(agent.machineId),
    policyTier: agent.policyTier,
    usedByWorkflowIds: [],
  };
}

function toUiCapability(capability: string): AgentCapability {
  return DOMAIN_TO_UI_CAPABILITY[capability] ?? 'analyze';
}

function toDomainCapability(capability: unknown): string {
  if (typeof capability !== 'string' || capability.trim() === '') return 'agent:analyze';
  const trimmed = capability.trim();
  if ((UI_TO_DOMAIN_CAPABILITY as Record<string, string>)[trimmed]) {
    return (UI_TO_DOMAIN_CAPABILITY as Record<string, string>)[trimmed]!;
  }
  return trimmed.includes(':') ? trimmed : `agent:${trimmed}`;
}

function hostnameFromEndpoint(endpointUrl: string): string {
  try {
    return new URL(endpointUrl).hostname || endpointUrl;
  } catch {
    return endpointUrl;
  }
}

function endpointFromHostname(hostname: string): string {
  const trimmed = hostname.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function recordFromBody(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeMachinePayload(value: unknown, workspaceId: string): unknown {
  const record = recordFromBody(value);
  if (record['schemaVersion'] !== undefined || record['endpointUrl'] !== undefined) return value;

  const hostname = typeof record['hostname'] === 'string' ? record['hostname'].trim() : '';
  if (hostname === '') {
    throw new MachineRegistrationParseError('hostname must be a non-empty string.');
  }
  const endpointUrl = endpointFromHostname(hostname);
  const rawCapabilities = Array.isArray(record['allowedCapabilities'])
    ? record['allowedCapabilities']
    : ['machine:invoke'];
  return {
    schemaVersion: 1,
    machineId: `machine-${randomUUID()}`,
    workspaceId,
    endpointUrl,
    active: false,
    displayName: hostname,
    capabilities: rawCapabilities.map((capability) => ({
      capability: toDomainCapability(capability),
    })),
    registeredAtIso: new Date().toISOString(),
    executionPolicy: {
      isolationMode: 'PerTenantWorker',
      egressAllowlist: [endpointUrl],
      workloadIdentity: 'Required',
    },
  };
}

function normalizeAgentPayload(value: unknown, workspaceId: string): unknown {
  const record = recordFromBody(value);
  if (record['schemaVersion'] !== undefined || record['displayName'] !== undefined) return value;

  const name = typeof record['name'] === 'string' ? record['name'].trim() : '';
  if (name === '') {
    throw new AgentConfigParseError('name must be a non-empty string.');
  }
  const machineId = typeof record['machineId'] === 'string' ? record['machineId'].trim() : '';
  if (machineId === '') {
    throw new AgentConfigParseError('machineId must be a non-empty string.');
  }
  const rawCapabilities = Array.isArray(record['allowedCapabilities'])
    ? record['allowedCapabilities']
    : ['analyze'];
  const policyTier =
    typeof record['policyTier'] === 'string' && record['policyTier'].trim() !== ''
      ? record['policyTier']
      : 'HumanApprove';
  return {
    schemaVersion: 1,
    agentId: `agent-${randomUUID()}`,
    workspaceId,
    machineId,
    displayName: name,
    capabilities: rawCapabilities.map((capability) => ({
      capability: toDomainCapability(capability),
    })),
    policyTier,
    allowedTools: rawCapabilities.filter(
      (capability): capability is string => typeof capability === 'string',
    ),
    registeredAtIso: new Date().toISOString(),
  };
}

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

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: { ...result.value, items: result.value.items.map(toMachineApiView) },
  });
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

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: toMachineApiView(result.value),
  });
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

  let registration;
  try {
    registration = parseMachineRegistrationV1(
      normalizeMachinePayload(bodyResult.value, workspaceId),
    );
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
  machineRegistrationsTotal.inc({ workspaceId });
  const machineId = String(registration.machineId);
  respondJson(res, {
    statusCode: 201,
    correlationId,
    traceContext,
    body: toMachineApiView(registration),
    location: `/v1/workspaces/${workspaceId}/machines/${machineId}`,
  });
}

export async function handleDeregisterMachine(args: MachineItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, machineId, traceContext } = args;

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
        detail: 'Only admin or operator roles may deregister machines.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const existing = await deps.machineRegistryStore.getMachineRegistrationById(
    authResult.ctx.tenantId,
    MachineId(machineId),
  );
  if (!existing || String(existing.workspaceId) !== workspaceId) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Machine ${machineId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const inactive = parseMachineRegistrationV1({ ...existing, active: false });
  await deps.machineRegistryStore.saveMachineRegistration(authResult.ctx.tenantId, inactive);
  res.statusCode = 204;
  res.setHeader('x-correlation-id', correlationId);
  res.end();
}

export async function handleTestMachineConnection(args: MachineItemArgs): Promise<void> {
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

  const machine = await deps.machineQueryStore.getMachineRegistrationById(
    authResult.ctx.tenantId,
    WorkspaceId(workspaceId),
    MachineId(machineId),
  );
  if (!machine) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Machine ${machineId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: { status: machine.active ? 'ok' : 'unreachable', latencyMs: 0 },
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

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: { ...result.value, items: result.value.items.map(toAgentApiView) },
  });
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

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: toAgentApiView(result.value),
  });
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

  let agent;
  try {
    agent = parseAgentConfigV1(normalizeAgentPayload(bodyResult.value, workspaceId));
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
  const agentId = String(agent.agentId);
  respondJson(res, {
    statusCode: 201,
    correlationId,
    traceContext,
    body: toAgentApiView(agent),
    location: `/v1/workspaces/${workspaceId}/agents/${agentId}`,
  });
}

export async function handleUpdateAgent(args: AgentItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, agentId, traceContext } = args;

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
        detail: 'Only admin or operator roles may update agents.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const existing = await deps.machineRegistryStore.getAgentConfigById(
    authResult.ctx.tenantId,
    AgentId(agentId),
  );
  if (!existing || String(existing.workspaceId) !== workspaceId) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Agent ${agentId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
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

  try {
    const patch = recordFromBody(bodyResult.value);
    const rawCapabilities = Array.isArray(patch['allowedCapabilities'])
      ? patch['allowedCapabilities']
      : undefined;
    const updated = parseAgentConfigV1({
      ...existing,
      ...(typeof patch['name'] === 'string' ? { displayName: patch['name'] } : {}),
      ...(rawCapabilities
        ? {
            capabilities: rawCapabilities.map((capability) => ({
              capability: toDomainCapability(capability),
            })),
            allowedTools: rawCapabilities.filter(
              (capability): capability is string => typeof capability === 'string',
            ),
          }
        : {}),
    });
    await deps.machineRegistryStore.saveAgentConfig(authResult.ctx.tenantId, updated);
    respondJson(res, {
      statusCode: 200,
      correlationId,
      traceContext,
      body: toAgentApiView(updated),
    });
  } catch (error) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: error instanceof Error ? error.message : 'Invalid agent update payload.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
  }
}

export async function handleTestAgentConnection(args: AgentItemArgs): Promise<void> {
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

  const agent = await deps.machineQueryStore.getAgentConfigById(
    authResult.ctx.tenantId,
    WorkspaceId(workspaceId),
    AgentId(agentId),
  );
  if (!agent) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Agent ${agentId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: { status: 'ok', latencyMs: 0 },
  });
}

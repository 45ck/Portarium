/**
 * Machine/agent heartbeat and agent work-item HTTP handlers for the control-plane runtime.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  authenticate,
  assertReadAccess,
  assertWorkspaceScope,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Body parser
// ---------------------------------------------------------------------------

type HeartbeatBody =
  | {
      ok: true;
      status: string;
      metrics?: Record<string, number>;
      location?: { lat: number; lon: number };
    }
  | { ok: false; message: string };

function checkMetrics(metrics: unknown): HeartbeatBody | null {
  if (metrics !== undefined && metrics !== null) {
    if (typeof metrics !== 'object' || Array.isArray(metrics))
      return { ok: false, message: 'metrics must be a record of numbers.' };
  }
  return null;
}

function checkLocation(location: unknown): HeartbeatBody | null {
  if (location !== undefined && location !== null) {
    if (typeof location !== 'object' || Array.isArray(location))
      return { ok: false, message: 'location must have lat and lon.' };
    const loc = location as Record<string, unknown>;
    if (typeof loc['lat'] !== 'number' || typeof loc['lon'] !== 'number')
      return { ok: false, message: 'location must have numeric lat and lon.' };
  }
  return null;
}

function parseHeartbeatBody(body: unknown): HeartbeatBody {
  if (typeof body !== 'object' || body === null)
    return { ok: false, message: 'Request body must be a JSON object.' };
  const record = body as Record<string, unknown>;
  const status = record['status'];
  if (status !== 'ok' && status !== 'degraded')
    return { ok: false, message: 'status must be "ok" or "degraded".' };
  const metricsCheck = checkMetrics(record['metrics']);
  if (metricsCheck) return metricsCheck;
  const locationCheck = checkLocation(record['location']);
  if (locationCheck) return locationCheck;
  const metrics = record['metrics'];
  const location = record['location'];
  return {
    ok: true,
    status: status as string,
    ...(metrics !== undefined && metrics !== null
      ? { metrics: metrics as Record<string, number> }
      : {}),
    ...(location !== undefined && location !== null
      ? { location: location as { lat: number; lon: number } }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Handler arg types
// ---------------------------------------------------------------------------

type MachineHeartbeatArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  machineId: string;
  traceContext: TraceContext;
}>;

type AgentArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  agentId: string;
  traceContext: TraceContext;
}>;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleMachineHeartbeat(args: MachineHeartbeatArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, machineId, traceContext } = args;
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
  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return;
  }
  const parsed = parseHeartbeatBody(await readJsonBody(req));
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: parsed.message,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const nowIso = new Date().toISOString();
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: {
      machineId,
      lastHeartbeatAtIso: nowIso,
      status: parsed.status,
      ...(parsed.metrics ? { metrics: parsed.metrics } : {}),
      ...(parsed.location ? { location: parsed.location } : {}),
    },
  });
}

export async function handleAgentHeartbeat(args: AgentArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, agentId, traceContext } = args;
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
  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return;
  }
  const parsed = parseHeartbeatBody(await readJsonBody(req));
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: parsed.message,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const nowIso = new Date().toISOString();
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: {
      agentId,
      lastHeartbeatAtIso: nowIso,
      status: parsed.status,
      ...(parsed.metrics ? { metrics: parsed.metrics } : {}),
      ...(parsed.location ? { location: parsed.location } : {}),
    },
  });
}

export async function handleGetAgentWorkItems(args: AgentArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, agentId, traceContext } = args;
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
  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: { items: [], agentId } });
}

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

type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; message: string }>;

function parseHeartbeatStatus(status: unknown): ParseResult<string> {
  if (status === 'ok' || status === 'degraded') return { ok: true, value: status };
  return { ok: false, message: 'status must be "ok" or "degraded".' };
}

function parseHeartbeatMetrics(
  metrics: unknown,
): ParseResult<Record<string, number> | undefined> {
  if (metrics === undefined || metrics === null) return { ok: true, value: undefined };
  if (typeof metrics !== 'object' || Array.isArray(metrics)) {
    return { ok: false, message: 'metrics must be a record of numbers.' };
  }
  return { ok: true, value: metrics as Record<string, number> };
}

function parseHeartbeatLocation(
  location: unknown,
): ParseResult<{ lat: number; lon: number } | undefined> {
  if (location === undefined || location === null) return { ok: true, value: undefined };
  if (typeof location !== 'object' || Array.isArray(location)) {
    return { ok: false, message: 'location must have lat and lon.' };
  }
  const loc = location as Record<string, unknown>;
  if (typeof loc['lat'] !== 'number' || typeof loc['lon'] !== 'number') {
    return { ok: false, message: 'location must have numeric lat and lon.' };
  }
  return { ok: true, value: { lat: loc['lat'], lon: loc['lon'] } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseHeartbeatBody(body: unknown): HeartbeatBody {
  const record = asRecord(body);
  if (!record) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  const status = parseHeartbeatStatus(record['status']);
  if (!status.ok) return status;

  const metrics = parseHeartbeatMetrics(record['metrics']);
  if (!metrics.ok) return metrics;

  const location = parseHeartbeatLocation(record['location']);
  if (!location.ok) return location;

  return {
    ok: true,
    status: status.value,
    ...(metrics.value ? { metrics: metrics.value } : {}),
    ...(location.value ? { location: location.value } : {}),
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

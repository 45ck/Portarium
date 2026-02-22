/**
 * Workspace-scoped SSE event stream handler (bead-sse1).
 *
 * GET /v1/workspaces/:workspaceId/events:stream
 *
 * Streams workspace events (run lifecycle, approval lifecycle) as
 * Server-Sent Events.  Sends a keep-alive heartbeat every 30 seconds
 * to prevent proxy timeouts.
 *
 * Event format (text/event-stream):
 *   event: <eventType>
 *   id: <eventId>
 *   data: <JSON payload>
 *   \n
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  authenticate,
  problemFromError,
  respondProblem,
  type ControlPlaneDeps,
} from './control-plane-handler.shared.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

type HandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

export async function handleEventsStream(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  if (!deps.eventStream) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Event stream not available in this deployment.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

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

  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-cache');
  res.setHeader('connection', 'keep-alive');
  res.setHeader('x-accel-buffering', 'no'); // cspell:disable-line
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) res.setHeader('tracestate', traceContext.tracestate);

  res.write(': connected\n\n');

  const unsubscribe = deps.eventStream.subscribe(workspaceId, (event) => {
    if (res.writableEnded) return;
    const eventLine = `event: ${event.type}\n`;
    const idLine = `id: ${event.id}\n`;
    const dataLine = `data: ${JSON.stringify(event.data ?? null)}\n\n`;
    res.write(eventLine + idLine + dataLine);
  });

  const heartbeatTimer = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeatTimer);
      return;
    }
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
    if (!res.writableEnded) res.end();
  };

  req.socket.once('close', cleanup);
  res.once('close', cleanup);
}

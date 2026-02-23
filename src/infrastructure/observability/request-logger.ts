/**
 * Request-scoped logger factory.
 *
 * Creates a child logger with per-request context fields automatically
 * injected into every log line:
 * - correlationId
 * - workspaceId (when available)
 * - userId (when available, after authentication)
 * - traceparent (when available)
 *
 * Usage in middleware:
 *   const reqLog = createRequestLogger(rootLogger, { correlationId, workspaceId });
 *   reqLog.info('Request received', { method: 'GET', path: '/v1/workspaces' });
 */

import type { LogFields, PortariumLogger } from './logger.js';

export type RequestLogContext = Readonly<{
  correlationId: string;
  workspaceId?: string;
  userId?: string;
  traceparent?: string;
  method?: string;
  path?: string;
}>;

export function createRequestLogger(
  parent: PortariumLogger,
  ctx: RequestLogContext,
): PortariumLogger {
  const bindings: LogFields = {
    correlationId: ctx.correlationId,
    ...(ctx.workspaceId !== undefined && { workspaceId: ctx.workspaceId }),
    ...(ctx.userId !== undefined && { userId: ctx.userId }),
    ...(ctx.traceparent !== undefined && { traceparent: ctx.traceparent }),
    ...(ctx.method !== undefined && { method: ctx.method }),
    ...(ctx.path !== undefined && { path: ctx.path }),
  };
  return parent.child(bindings);
}

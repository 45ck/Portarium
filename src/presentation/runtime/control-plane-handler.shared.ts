/**
 * Shared types and utilities for the control-plane HTTP handler.
 *
 * This module is imported by all control-plane-handler sub-modules. It must
 * not import from any of them (no circular dependencies).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { APP_ACTIONS } from '../../application/common/actions.js';
import type {
  AuthenticationPort,
  AuthorizationPort,
  EventStreamBroadcast,
  MachineQueryStore,
  MachineRegistryStore,
  QueryCache,
  RateLimitStore,
  RunQueryStore,
  RunStore,
  WorkspaceQueryStore,
  WorkspaceStore,
} from '../../application/ports/index.js';
import type { AppContext } from '../../application/common/context.js';
import {
  normalizeTraceparent,
  normalizeTracestate,
  type TraceContext,
} from '../../application/common/trace-context.js';
import type {
  Conflict,
  DependencyFailure,
  Forbidden,
  NotFound,
  PreconditionFailed,
  Unauthorized,
  ValidationFailed,
} from '../../application/common/errors.js';
import type { AuthEventLogger } from '../../infrastructure/observability/auth-event-logger.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Seconds until the rate-limit window resets. Sets the HTTP Retry-After header when present. */
  retryAfterSeconds?: number;
}>;

export type QueryError =
  | Unauthorized
  | Forbidden
  | NotFound
  | ValidationFailed
  | PreconditionFailed
  | Conflict
  | DependencyFailure;

export type ControlPlaneDeps = Readonly<{
  authentication: AuthenticationPort;
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceStore;
  runStore: RunStore;
  /** Optional query store for listing workspaces; enables the GET /v1/workspaces route. */
  workspaceQueryStore?: WorkspaceQueryStore;
  /** Optional query store for listing runs; enables the GET /v1/workspaces/:id/runs route. */
  runQueryStore?: RunQueryStore;
  /** Optional rate-limit store; when absent, rate limiting is disabled. */
  rateLimitStore?: RateLimitStore;
  /** Optional query cache for hot reads; when absent, caching is disabled. */
  queryCache?: QueryCache;
  /** Optional event-stream broadcast; when absent, the SSE endpoint returns 503. */
  eventStream?: EventStreamBroadcast;
  /** Optional structured logger for 401/403/429 security events. */
  authEventLogger?: AuthEventLogger;
  /** Optional query store for machine/agent registry reads; when absent, registry read routes return 503. */
  machineQueryStore?: MachineQueryStore;
  /** Optional write store for machine/agent registry; when absent, registry write routes return 503. */
  machineRegistryStore?: MachineRegistryStore;
}>;

export type WorkforceAvailabilityStatus = 'available' | 'busy' | 'offline';

export type WorkforceCapability =
  | 'operations.dispatch'
  | 'operations.approval'
  | 'operations.escalation'
  | 'robotics.supervision'
  | 'robotics.safety.override';

export type WorkforceMemberRecord = Readonly<{
  schemaVersion: 1;
  workforceMemberId: string;
  linkedUserId: string;
  displayName: string;
  capabilities: readonly WorkforceCapability[];
  availabilityStatus: WorkforceAvailabilityStatus;
  queueMemberships: readonly string[];
  tenantId: string;
  createdAtIso: string;
  updatedAtIso?: string;
}>;

export type WorkforceQueueRecord = Readonly<{
  schemaVersion: 1;
  workforceQueueId: string;
  name: string;
  requiredCapabilities: readonly WorkforceCapability[];
  memberIds: readonly string[];
  routingStrategy: 'round-robin' | 'least-busy' | 'manual';
  tenantId: string;
}>;

export type HumanTaskStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'escalated';

export type HumanTaskRecord = Readonly<{
  schemaVersion: 1;
  humanTaskId: string;
  workItemId: string;
  runId: string;
  stepId: string;
  assigneeId?: string;
  groupId?: string;
  description: string;
  requiredCapabilities: readonly WorkforceCapability[];
  status: HumanTaskStatus;
  dueAt?: string;
  completedAt?: string;
  completedById?: string;
  evidenceAnchorId?: string;
  tenantId: string;
}>;

export type EvidenceRecord = Readonly<{
  schemaVersion: number;
  evidenceId: string;
  workspaceId: string;
  occurredAtIso: string;
  category: 'Plan' | 'Action' | 'Approval' | 'Policy' | 'System';
  summary: string;
  actor:
    | Readonly<{ kind: 'User'; userId: string }>
    | Readonly<{ kind: 'System' }>
    | Readonly<{ kind: 'Machine'; machineId: string }>
    | Readonly<{ kind: 'Adapter'; adapterId: string }>;
  links?: Readonly<{
    runId?: string;
    planId?: string;
    workItemId?: string;
  }>;
  hashSha256: string;
}>;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

export function respondJson(
  res: ServerResponse,
  args: Readonly<{
    statusCode: number;
    correlationId: string;
    traceContext: TraceContext;
    body: unknown;
  }>,
): void {
  const { statusCode, correlationId, traceContext, body } = args;
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) res.setHeader('tracestate', traceContext.tracestate);
  res.end(JSON.stringify(body));
}

export function respondProblem(
  res: ServerResponse,
  problem: ProblemDetails,
  correlationId: string,
  traceContext: TraceContext,
): void {
  res.statusCode = problem.status;
  res.setHeader('content-type', 'application/problem+json');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) res.setHeader('tracestate', traceContext.tracestate);
  if (problem.retryAfterSeconds !== undefined)
    res.setHeader('Retry-After', String(problem.retryAfterSeconds));
  res.end(JSON.stringify(problem));
}

export function problemFromError(error: QueryError, instance: string): ProblemDetails {
  switch (error.kind) {
    case 'Unauthorized':
      return {
        type: 'https://portarium.dev/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: error.message,
        instance,
      };
    case 'Forbidden':
      return {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: error.message,
        instance,
      };
    case 'NotFound':
      return {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: error.message,
        instance,
      };
    case 'ValidationFailed':
      return {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: error.message,
        instance,
      };
    case 'PreconditionFailed':
      return {
        type: 'https://portarium.dev/problems/precondition-failed',
        title: 'Precondition Failed',
        status: 412,
        detail: error.message,
        instance,
      };
    case 'Conflict':
      return {
        type: 'https://portarium.dev/problems/conflict',
        title: 'Conflict',
        status: 409,
        detail: error.message,
        instance,
      };
    case 'DependencyFailure':
      return {
        type: 'https://portarium.dev/problems/dependency-failure',
        title: 'Dependency Failure',
        status: 503,
        detail: error.message,
        instance,
      };
  }
}

export function computeETag(content: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12)}"`;
}

export function checkIfMatch(
  req: IncomingMessage,
  currentETag: string,
): { ok: true } | { ok: false; error: PreconditionFailed } {
  const ifMatch = req.headers['if-match'];
  if (!ifMatch || ifMatch === '*' || ifMatch === currentETag) return { ok: true };
  return {
    ok: false,
    error: { kind: 'PreconditionFailed', message: 'ETag does not match.', ifMatch },
  };
}

export async function authenticate(
  deps: ControlPlaneDeps,
  args: Readonly<{
    req: IncomingMessage;
    correlationId: string;
    traceContext: TraceContext;
    expectedWorkspaceId?: string;
  }>,
): Promise<{ ok: true; ctx: AppContext } | { ok: false; error: Unauthorized }> {
  const { req, correlationId, traceContext, expectedWorkspaceId } = args;
  const auth = await deps.authentication.authenticateBearerToken({
    authorizationHeader: readAuthorizationHeader(req),
    correlationId,
    traceparent: traceContext.traceparent,
    ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
    ...(expectedWorkspaceId ? { expectedWorkspaceId } : {}),
  });
  if (auth.ok) return { ok: true, ctx: auth.value };
  deps.authEventLogger?.logUnauthorized({
    correlationId,
    ...(expectedWorkspaceId !== undefined && { workspaceId: expectedWorkspaceId }),
    reason: auth.error.message,
  });
  return { ok: false, error: auth.error };
}

export function assertWorkspaceScope(
  ctx: AppContext,
  workspaceId: string,
  authEventLogger?: AuthEventLogger,
): { ok: true } | { ok: false; error: Forbidden } {
  if (String(ctx.tenantId) !== workspaceId) {
    authEventLogger?.logForbidden({
      workspaceId,
      action: String(APP_ACTIONS.workspaceRead),
      reason: `Token workspace does not match requested workspace: ${workspaceId}`,
    });
    return {
      ok: false,
      error: {
        kind: 'Forbidden',
        action: APP_ACTIONS.workspaceRead,
        message: `Token workspace does not match requested workspace: ${workspaceId}`,
      },
    };
  }
  return { ok: true };
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasRole(
  ctx: AppContext,
  role: 'admin' | 'operator' | 'approver' | 'auditor',
): boolean {
  return ctx.roles.includes(role);
}

export async function assertReadAccess(
  deps: ControlPlaneDeps,
  ctx: AppContext,
): Promise<{ ok: true } | { ok: false; error: Forbidden }> {
  const readable =
    hasRole(ctx, 'admin') ||
    hasRole(ctx, 'operator') ||
    hasRole(ctx, 'approver') ||
    hasRole(ctx, 'auditor');
  if (!readable) {
    deps.authEventLogger?.logForbidden({
      workspaceId: String(ctx.tenantId),
      action: String(APP_ACTIONS.workspaceRead),
      reason: 'Read access denied.',
    });
    return {
      ok: false,
      error: {
        kind: 'Forbidden',
        action: APP_ACTIONS.workspaceRead,
        message: 'Read access denied.',
      },
    };
  }
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (allowed) return { ok: true };
  deps.authEventLogger?.logForbidden({
    workspaceId: String(ctx.tenantId),
    action: String(APP_ACTIONS.workspaceRead),
    reason: 'Read access denied.',
  });
  return {
    ok: false,
    error: { kind: 'Forbidden', action: APP_ACTIONS.workspaceRead, message: 'Read access denied.' },
  };
}

// ---------------------------------------------------------------------------
// List query param parsing (shared across all list endpoints)
// ---------------------------------------------------------------------------

export interface ParsedListQueryParams {
  limit: number | undefined;
  cursor: string | undefined;
  sort: Readonly<{ field: string; direction: 'asc' | 'desc' }> | undefined;
  search: string | undefined;
}

export function parseListQueryParams(
  url: URL,
  allowedSortFields: readonly string[],
): { ok: true; value: ParsedListQueryParams } | { ok: false; error: string } {
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  if (limit !== undefined && (Number.isNaN(limit) || limit <= 0)) {
    return { ok: false, error: 'limit must be a positive integer.' };
  }

  const cursor = url.searchParams.get('cursor') ?? undefined;

  const sortRaw = url.searchParams.get('sort');
  let sort: ParsedListQueryParams['sort'];
  if (sortRaw) {
    const parts = sortRaw.split(':');
    const field = parts[0]!;
    const dir = parts[1];
    if (!allowedSortFields.includes(field)) {
      return { ok: false, error: `sort field must be one of: ${allowedSortFields.join(', ')}.` };
    }
    sort = { field, direction: dir === 'desc' ? 'desc' : 'asc' };
  }

  const search = url.searchParams.get('q') ?? undefined;

  return { ok: true, value: { limit, cursor, sort, search } };
}

export function paginate<T extends Readonly<Record<string, unknown>>>(
  items: readonly T[],
  reqUrl: string,
): { items: readonly T[]; nextCursor?: string } {
  const url = new URL(reqUrl, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : undefined;
  if (!limit || Number.isNaN(limit) || items.length <= limit) return { items: [...items] };
  return { items: items.slice(0, limit), nextCursor: String(limit) };
}

// ---------------------------------------------------------------------------
// Header utilities
// ---------------------------------------------------------------------------

export function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function readAuthorizationHeader(req: IncomingMessage): string | undefined {
  return normalizeHeader(req.headers.authorization);
}

export function normalizeCorrelationId(req: IncomingMessage): string {
  return normalizeHeader(req.headers['x-correlation-id']) ?? randomUUID();
}

export function normalizeTraceContext(req: IncomingMessage): TraceContext {
  const inboundTraceparent = normalizeTraceparent(normalizeHeader(req.headers['traceparent']));
  const inboundTracestate = normalizeTracestate(normalizeHeader(req.headers['tracestate']));
  return {
    traceparent: inboundTraceparent ?? createTraceparent(),
    ...(inboundTracestate ? { tracestate: inboundTracestate } : {}),
  };
}

function createTraceparent(): string {
  const version = '00';
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const flags = '01';
  return `${version}-${traceId}-${spanId}-${flags}`;
}

function randomHex(byteLength: number): string {
  const bytes = randomBytes(byteLength);
  return bytes.toString('hex');
}

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
  ActionRunnerPort,
  AgentActionProposalStore,
  AdapterRegistrationStore,
  ApprovalQueryStore,
  ApprovalStore,
  AuthenticationPort,
  AuthorizationPort,
  BeadDiffStore,
  CockpitExtensionActivationSource,
  EventPublisher,
  EventStreamBroadcast,
  EvidenceLogPort,
  EvidenceQueryStore,
  IdempotencyStore,
  HumanTaskStore,
  PolicyStore,
  PlanQueryStore,
  QueryCache,
  RateLimitStore,
  RunQueryStore,
  RunStore,
  UnitOfWork,
  WorkforceMemberStore,
  WorkforceQueueStore,
  WorkflowOrchestrator,
  WorkflowStore,
  WorkItemStore,
  WorkspaceQueryStore,
  WorkspaceStore,
  WorkspaceUserStore,
} from '../../application/ports/index.js';
import type { AppContext } from '../../application/common/context.js';
import {
  normalizeTraceparent,
  normalizeTracestate,
  type TraceContext,
} from '../../application/common/trace-context.js';
import type {
  Forbidden,
  NotFound,
  PreconditionFailed,
  Unauthorized,
  ValidationFailed,
} from '../../application/common/errors.js';
import type { AuthEventLogger } from '../../infrastructure/observability/auth-event-logger.js';
import type {
  DerivedArtifactRegistryPort,
  EmbeddingPort,
  KnowledgeGraphPort,
  SemanticIndexPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { MachineQueryStore } from '../../application/ports/machine-query-store.js';
import type { MachineRegistryStore } from '../../application/ports/machine-registry-store.js';
import {
  authenticateCockpitWebSession,
  type CockpitWebSessionConfig,
  type CockpitWebSessionStore,
} from './cockpit-web-session.js';

// ---------------------------------------------------------------------------
// Problem type URIs (RFC 9457) — centralised for consistency
// ---------------------------------------------------------------------------

export const PROBLEM_TYPES = {
  notFound: 'https://portarium.dev/problems/not-found',
  validationFailed: 'https://portarium.dev/problems/validation-failed',
  serviceUnavailable: 'https://portarium.dev/problems/service-unavailable',
  unauthorized: 'https://portarium.dev/problems/unauthorized',
  forbidden: 'https://portarium.dev/problems/forbidden',
  badRequest: 'https://portarium.dev/problems/bad-request',
  conflict: 'https://portarium.dev/problems/conflict',
  rateLimited: 'https://portarium.dev/problems/rate-limited',
  unsupportedMediaType: 'https://portarium.dev/problems/unsupported-media-type',
} as const;

export const GENERIC_INTERNAL_ERROR_DETAIL =
  'An internal server error occurred. Use the correlation ID when contacting support.';

export const GENERIC_DEPENDENCY_FAILURE_DETAIL =
  'A required dependency is temporarily unavailable. Use the correlation ID when contacting support.';

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
  | PreconditionFailed;

export type ControlPlaneDeps = Readonly<{
  authentication: AuthenticationPort;
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceStore;
  runStore: RunStore;
  /** Optional work item store; enables workspace-scoped work-item routes. */
  workItemStore?: WorkItemStore;
  /** Optional workforce member store; enables workforce-member assignment resolution. */
  workforceMemberStore?: WorkforceMemberStore;
  /** Optional workforce queue store; enables persisted workforce queue reads and routing. */
  workforceQueueStore?: WorkforceQueueStore;
  /** Optional human task store; enables persisted human task reads and mutations. */
  humanTaskStore?: HumanTaskStore;
  /** Optional query store for listing workspaces; enables the GET /v1/workspaces route. */
  workspaceQueryStore?: WorkspaceQueryStore;
  /** Optional query store for listing runs; enables the GET /v1/workspaces/:id/runs route. */
  runQueryStore?: RunQueryStore;
  /** Optional workflow definition store; enables POST /v1/workspaces/:id/runs. */
  workflowStore?: WorkflowStore;
  /** Optional adapter registration store; required by startWorkflow aggregate invariants. */
  adapterRegistrationStore?: AdapterRegistrationStore;
  /** Optional idempotency store for command replay protection. */
  idempotency?: IdempotencyStore;
  /** Optional workflow orchestrator for execution dispatch after run creation. */
  orchestrator?: WorkflowOrchestrator;
  /** Optional rate-limit store; when absent, rate limiting is disabled. */
  rateLimitStore?: RateLimitStore;
  /** Optional query cache for hot reads; when absent, caching is disabled. */
  queryCache?: QueryCache;
  /** Optional event-stream broadcast; when absent, the SSE endpoint returns 503. */
  eventStream?: EventStreamBroadcast;
  /** Optional query store for bead-scoped approval diffs. */
  beadDiffStore?: BeadDiffStore;
  /** Optional structured logger for 401/403/429 security events. */
  authEventLogger?: AuthEventLogger;
  /** Optional query store for machine/agent registry reads; when absent, registry read routes return 503. */
  machineQueryStore?: MachineQueryStore;
  /** Optional write store for machine/agent registry; when absent, registry write routes return 503. */
  machineRegistryStore?: MachineRegistryStore;
  /** Optional semantic index port; when absent, retrieval/search returns 503. */
  semanticIndexPort?: SemanticIndexPort;
  /** Optional knowledge graph port; when absent, graph/retrieval returns 503. */
  knowledgeGraphPort?: KnowledgeGraphPort;
  /** Optional derived artifact registry port; when absent, derived-artifacts list returns 503. */
  derivedArtifactRegistryPort?: DerivedArtifactRegistryPort;
  /** Optional embedding port; when absent, semantic/hybrid search returns 503. */
  embeddingPort?: EmbeddingPort;
  /** Optional approval store for agent-governance proposal flow. */
  approvalStore?: ApprovalStore;
  /** Optional agent action proposal store; when present, approval responses are enriched with proposal metadata. */
  agentActionProposalStore?: AgentActionProposalStore;
  /** Optional approval query store for listing approvals; enables the GET /v1/workspaces/:id/approvals route. */
  approvalQueryStore?: ApprovalQueryStore;
  /** Optional policy store for agent-governance policy evaluation. */
  policyStore?: PolicyStore;
  /** Optional workspace user store; enables canonical users routes. */
  workspaceUserStore?: WorkspaceUserStore;
  /** Optional event publisher for domain events. */
  eventPublisher?: EventPublisher;
  /** Optional evidence log for audit trail. */
  evidenceLog?: EvidenceLogPort;
  /** Optional query store for reading evidence entries. */
  evidenceQueryStore?: EvidenceQueryStore;
  /** Optional query store for reading plans. */
  planQueryStore?: PlanQueryStore;
  /** Optional unit of work for transactional persistence. */
  unitOfWork?: UnitOfWork;
  /** Optional action runner for executing approved agent actions. */
  actionRunner?: ActionRunnerPort;
  /** Optional activation source for workspace-scoped Cockpit extension visibility. */
  cockpitExtensionActivationSource?: CockpitExtensionActivationSource;
  /** Optional HttpOnly cookie session store for same-origin Cockpit web clients. */
  cockpitWebSessionStore?: CockpitWebSessionStore;
  /** Optional same-origin Cockpit web session configuration. */
  cockpitWebSessionConfig?: CockpitWebSessionConfig;
  /** Optional clock override for testing; defaults to () => new Date(). */
  clock?: () => Date;
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
  category: 'Plan' | 'Action' | 'Approval' | 'Policy' | 'PolicyViolation' | 'System';
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
    approvalId?: string;
  }>;
  payloadRefs?: readonly Readonly<Record<string, unknown>>[];
  previousHash?: string;
  hashSha256: string;
  signatureBase64?: string;
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
    /** RFC 7231 Location header for 201 Created responses. */
    location?: string;
  }>,
): void {
  const { statusCode, correlationId, traceContext, body, location } = args;
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) res.setHeader('tracestate', traceContext.tracestate);
  if (location) res.setHeader('location', location);
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

/**
 * Check If-None-Match header for conditional GET requests (RFC 7232 §3.2).
 * Returns `true` when the client's cached copy is still fresh (i.e. the
 * server should respond with 304 Not Modified).
 */
export function checkIfNoneMatch(req: IncomingMessage, etag: string): boolean {
  const ifNoneMatch = req.headers['if-none-match'];
  if (!ifNoneMatch) return false;
  const header = Array.isArray(ifNoneMatch) ? ifNoneMatch.join(',') : ifNoneMatch;
  const current = etag.startsWith('"') ? etag : `"${etag}"`;
  const weakCurrent = current.startsWith('W/') ? current : `W/${current}`;
  return header
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || value === current || value === weakCurrent);
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
  const method = (req.method ?? 'GET').toUpperCase();
  const requireExpectedWorkspaceId = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  if (!readAuthorizationHeader(req)) {
    const webSessionAuth = await authenticateCockpitWebSession({
      req,
      store: deps.cockpitWebSessionStore,
      config: deps.cockpitWebSessionConfig,
      nowMs: (deps.clock?.() ?? new Date()).getTime(),
      correlationId,
      traceContext,
      ...(expectedWorkspaceId ? { expectedWorkspaceId } : {}),
      ...(requireExpectedWorkspaceId ? { requireExpectedWorkspaceId } : {}),
    });
    if (webSessionAuth?.ok) return { ok: true, ctx: webSessionAuth.value };
    if (webSessionAuth && !webSessionAuth.ok) {
      deps.authEventLogger?.logUnauthorized({
        correlationId,
        ...(expectedWorkspaceId !== undefined && { workspaceId: expectedWorkspaceId }),
        reason: webSessionAuth.error.message,
      });
      return { ok: false, error: webSessionAuth.error };
    }
  }
  const auth = await deps.authentication.authenticateBearerToken({
    authorizationHeader: readAuthorizationHeader(req),
    correlationId,
    traceparent: traceContext.traceparent,
    ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
    ...(expectedWorkspaceId ? { expectedWorkspaceId } : {}),
    ...(requireExpectedWorkspaceId ? { requireExpectedWorkspaceId } : {}),
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

/**
 * Maximum request body size in bytes.
 * 1 MiB is generous for JSON API payloads while defending against
 * accidental or malicious multi-gigabyte uploads.
 */
const DEFAULT_MAX_BODY_BYTES = 1_048_576; // 1 MiB

/**
 * Thrown when the request body exceeds the configured size limit.
 * Caught by the top-level error handler in `createControlPlaneHandler` to
 * produce a 413 Payload Too Large response.
 */
export class PayloadTooLargeError extends Error {
  readonly maxBytes: number;
  constructor(maxBytes: number) {
    super(`Request body exceeds the ${maxBytes}-byte limit.`);
    this.name = 'PayloadTooLargeError';
    this.maxBytes = maxBytes;
  }
}

/**
 * Result of reading and parsing JSON from a request body.
 * - `{ ok: true, value }` — valid JSON body
 * - `{ ok: false, error: 'empty-body' }` — no body present
 * - `{ ok: false, error: 'invalid-json' }` — malformed JSON
 * - `{ ok: false, error: 'unsupported-content-type' }` — Content-Type is not application/json
 */
export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; error: 'empty-body' | 'invalid-json' | 'unsupported-content-type' };

/**
 * Read and parse JSON from request body with proper error handling.
 *
 * Returns:
 * - `{ ok: true, value: <parsed> }` on valid JSON
 * - `{ ok: false, error: 'empty-body' }` when body is empty
 * - `{ ok: false, error: 'unsupported-content-type' }` when Content-Type is not application/json
 * - `{ ok: false, error: 'invalid-json' }` when JSON is malformed
 *
 * Throws `PayloadTooLargeError` if body exceeds maxBytes.
 */
export async function readJsonBody(
  req: IncomingMessage,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<JsonBodyResult> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      req.destroy();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(buf);
  }

  // No body bytes at all
  if (chunks.length === 0) {
    return { ok: false, error: 'empty-body' };
  }

  // If body is present, Content-Type must be application/json
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return { ok: false, error: 'unsupported-content-type' };
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') {
    return { ok: false, error: 'empty-body' };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'invalid-json' };
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

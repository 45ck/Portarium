import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

import { WorkspaceRbacAuthorization } from '../../application/iam/rbac/workspace-rbac-authorization.js';
import { APP_ACTIONS } from '../../application/common/actions.js';
import type {
  AuthenticationPort,
  AuthorizationPort,
  RunStore,
  WorkspaceStore,
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
  Unauthorized,
  ValidationFailed,
} from '../../application/common/errors.js';
import { err } from '../../application/common/result.js';
import { getRun } from '../../application/queries/get-run.js';
import { getWorkspace } from '../../application/queries/get-workspace.js';
import { JoseJwtAuthentication } from '../../infrastructure/auth/jose-jwt-authentication.js';
import type { RequestHandler } from './health-server.js';

type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}>;

type QueryError = Unauthorized | Forbidden | NotFound | ValidationFailed;

type ControlPlaneDeps = Readonly<{
  authentication: AuthenticationPort;
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceStore;
  runStore: RunStore;
}>;

type WorkforceAvailabilityStatus = 'available' | 'busy' | 'offline';

type WorkforceCapability =
  | 'operations.dispatch'
  | 'operations.approval'
  | 'operations.escalation'
  | 'robotics.supervision'
  | 'robotics.safety.override';

type WorkforceMemberRecord = Readonly<{
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

type WorkforceQueueRecord = Readonly<{
  schemaVersion: 1;
  workforceQueueId: string;
  name: string;
  requiredCapabilities: readonly WorkforceCapability[];
  memberIds: readonly string[];
  routingStrategy: 'round-robin' | 'least-busy' | 'manual';
  tenantId: string;
}>;

type HumanTaskStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'escalated';

type HumanTaskRecord = Readonly<{
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

type EvidenceRecord = Readonly<{
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

const WORKFORCE_FIXTURE: Readonly<{
  members: readonly WorkforceMemberRecord[];
  queues: readonly WorkforceQueueRecord[];
}> = {
  members: [
    {
      schemaVersion: 1,
      workforceMemberId: 'wm-1',
      linkedUserId: 'user-1',
      displayName: 'Alice Martinez',
      capabilities: ['operations.approval', 'operations.escalation'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-finance', 'queue-general'],
      tenantId: 'workspace-1',
      createdAtIso: '2026-02-19T00:00:00.000Z',
      updatedAtIso: '2026-02-19T00:00:00.000Z',
    },
    {
      schemaVersion: 1,
      workforceMemberId: 'wm-2',
      linkedUserId: 'user-2',
      displayName: 'Bob Chen',
      capabilities: ['operations.dispatch'],
      availabilityStatus: 'busy',
      queueMemberships: ['queue-general'],
      tenantId: 'workspace-1',
      createdAtIso: '2026-02-19T00:00:00.000Z',
      updatedAtIso: '2026-02-19T00:00:00.000Z',
    },
  ],
  queues: [
    {
      schemaVersion: 1,
      workforceQueueId: 'queue-finance',
      name: 'Finance Queue',
      requiredCapabilities: ['operations.approval'],
      memberIds: ['wm-1'],
      routingStrategy: 'least-busy',
      tenantId: 'workspace-1',
    },
    {
      schemaVersion: 1,
      workforceQueueId: 'queue-general',
      name: 'General Queue',
      requiredCapabilities: ['operations.dispatch'],
      memberIds: ['wm-1', 'wm-2'],
      routingStrategy: 'round-robin',
      tenantId: 'workspace-1',
    },
  ],
};

const HUMAN_TASK_FIXTURE: readonly HumanTaskRecord[] = [
  {
    schemaVersion: 1,
    humanTaskId: 'ht-1',
    workItemId: 'wi-101',
    runId: 'run-101',
    stepId: 'step-approve',
    assigneeId: 'wm-1',
    groupId: 'queue-finance',
    description: 'Approve invoice correction',
    requiredCapabilities: ['operations.approval'],
    status: 'assigned',
    dueAt: '2026-02-20T12:00:00.000Z',
    tenantId: 'workspace-1',
  },
  {
    schemaVersion: 1,
    humanTaskId: 'ht-2',
    workItemId: 'wi-102',
    runId: 'run-102',
    stepId: 'step-review',
    groupId: 'queue-general',
    description: 'Quality-check export batch',
    requiredCapabilities: ['operations.dispatch'],
    status: 'pending',
    dueAt: '2026-02-21T12:00:00.000Z',
    tenantId: 'workspace-1',
  },
];

let runtimeHumanTasks: HumanTaskRecord[] = [...HUMAN_TASK_FIXTURE];
let runtimeEvidence: EvidenceRecord[] = [];

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function readAuthorizationHeader(req: IncomingMessage): string | undefined {
  const value = normalizeHeader(req.headers.authorization);
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeCorrelationId(req: IncomingMessage): string {
  const value = normalizeHeader(req.headers['x-correlation-id']);
  if (value && value.trim() !== '') return value.trim();
  return randomUUID();
}

function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}

function createTraceparent(): string {
  // W3C Trace Context v00: version-traceid-spanid-flags
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

function normalizeTraceContext(req: IncomingMessage): TraceContext {
  const inboundTraceparent = normalizeTraceparent(normalizeHeader(req.headers['traceparent']));
  const inboundTracestate = normalizeTracestate(normalizeHeader(req.headers['tracestate']));

  return {
    traceparent: inboundTraceparent ?? createTraceparent(),
    ...(inboundTracestate ? { tracestate: inboundTracestate } : {}),
  };
}

function respondJson(
  res: ServerResponse,
  statusCode: number,
  correlationId: string,
  traceContext: TraceContext,
  body: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) {
    res.setHeader('tracestate', traceContext.tracestate);
  }
  res.end(JSON.stringify(body));
}

function respondProblem(
  res: ServerResponse,
  problem: ProblemDetails,
  correlationId: string,
  traceContext: TraceContext,
): void {
  res.statusCode = problem.status;
  res.setHeader('content-type', 'application/problem+json');
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('traceparent', traceContext.traceparent);
  if (traceContext.tracestate) {
    res.setHeader('tracestate', traceContext.tracestate);
  }
  res.end(JSON.stringify(problem));
}

function problemFromError(error: QueryError, instance: string): ProblemDetails {
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
        status: 400,
        detail: error.message,
        instance,
      };
  }
}

function buildAuthentication(): AuthenticationPort {
  const jwksUri = process.env['PORTARIUM_JWKS_URI']?.trim();
  const issuer = process.env['PORTARIUM_JWT_ISSUER']?.trim();
  const audience = process.env['PORTARIUM_JWT_AUDIENCE']?.trim();

  if (jwksUri) {
    return new JoseJwtAuthentication({
      jwksUri,
      ...(issuer && issuer !== '' ? { issuer } : {}),
      ...(audience && audience !== '' ? { audience } : {}),
    });
  }

  // Keep the container runnable without auth config; protected routes return 401.
  return {
    authenticateBearerToken: ({ correlationId }) =>
      Promise.resolve(
        err({ kind: 'Unauthorized', message: `Authentication not configured. (${correlationId})` }),
      ),
  };
}

function buildDeps(): ControlPlaneDeps {
  const authentication = buildAuthentication();
  const authorization: AuthorizationPort = new WorkspaceRbacAuthorization();

  // TODO(beads): replace with real persistence adapters (DB).
  const workspaceStore: WorkspaceStore = {
    getWorkspaceById: () => Promise.resolve(null),
    getWorkspaceByName: () => Promise.resolve(null),
    saveWorkspace: () => Promise.resolve(),
  };
  const runStore: RunStore = {
    getRunById: () => Promise.resolve(null),
    saveRun: () => Promise.resolve(),
  };

  return { authentication, authorization, workspaceStore, runStore };
}

async function authenticate(
  deps: ControlPlaneDeps,
  req: IncomingMessage,
  correlationId: string,
  traceContext: TraceContext,
  expectedWorkspaceId: string | undefined,
): Promise<{ ok: true; ctx: AppContext } | { ok: false; error: Unauthorized }> {
  const auth = await deps.authentication.authenticateBearerToken({
    authorizationHeader: readAuthorizationHeader(req),
    correlationId,
    traceparent: traceContext.traceparent,
    ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
    ...(expectedWorkspaceId ? { expectedWorkspaceId } : {}),
  });

  if (auth.ok) return { ok: true, ctx: auth.value };
  return { ok: false, error: auth.error };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
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

function hasRole(ctx: AppContext, role: 'admin' | 'operator' | 'approver' | 'auditor'): boolean {
  return ctx.roles.includes(role);
}

function isWorkforceReadable(ctx: AppContext): boolean {
  return (
    hasRole(ctx, 'admin') ||
    hasRole(ctx, 'operator') ||
    hasRole(ctx, 'approver') ||
    hasRole(ctx, 'auditor')
  );
}

async function assertReadAccess(
  deps: ControlPlaneDeps,
  ctx: AppContext,
): Promise<{ ok: true } | { ok: false; error: Forbidden }> {
  if (!isWorkforceReadable(ctx)) {
    return {
      ok: false,
      error: { kind: 'Forbidden', action: APP_ACTIONS.workspaceRead, message: 'Read access denied.' },
    };
  }

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (allowed) return { ok: true };
  return {
    ok: false,
    error: { kind: 'Forbidden', action: APP_ACTIONS.workspaceRead, message: 'Read access denied.' },
  };
}

function listFixtureMembers(workspaceId: string): WorkforceMemberRecord[] {
  return WORKFORCE_FIXTURE.members.filter((m) => m.tenantId === workspaceId);
}

function listFixtureQueues(workspaceId: string): WorkforceQueueRecord[] {
  return WORKFORCE_FIXTURE.queues.filter((q) => q.tenantId === workspaceId);
}

function paginate<T extends Readonly<Record<string, unknown>>>(
  items: readonly T[],
  reqUrl: string,
): { items: readonly T[]; nextCursor?: string } {
  const url = new URL(reqUrl, 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : undefined;
  if (!limit || Number.isNaN(limit) || items.length <= limit) {
    return { items: [...items] };
  }
  const sliced = items.slice(0, limit);
  return { items: sliced, nextCursor: String(limit) };
}

function parseAvailabilityPatchBody(
  value: unknown,
): { ok: true; availabilityStatus: WorkforceAvailabilityStatus } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { availabilityStatus?: unknown };
  if (
    record.availabilityStatus === 'available' ||
    record.availabilityStatus === 'busy' ||
    record.availabilityStatus === 'offline'
  ) {
    return { ok: true, availabilityStatus: record.availabilityStatus };
  }
  return { ok: false };
}

function parseAssignHumanTaskBody(
  value: unknown,
): { ok: true; workforceMemberId?: string; workforceQueueId?: string } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { workforceMemberId?: unknown; workforceQueueId?: unknown };
  const workforceMemberId =
    typeof record.workforceMemberId === 'string' && record.workforceMemberId.trim() !== ''
      ? record.workforceMemberId.trim()
      : undefined;
  const workforceQueueId =
    typeof record.workforceQueueId === 'string' && record.workforceQueueId.trim() !== ''
      ? record.workforceQueueId.trim()
      : undefined;
  if (!workforceMemberId && !workforceQueueId) return { ok: false };
  return {
    ok: true,
    ...(workforceMemberId ? { workforceMemberId } : {}),
    ...(workforceQueueId ? { workforceQueueId } : {}),
  };
}

function parseCompleteHumanTaskBody(value: unknown): { ok: true; completionNote?: string } | { ok: false } {
  if (value === null) return { ok: true };
  if (typeof value !== 'object') return { ok: false };
  const record = value as { completionNote?: unknown };
  const completionNote =
    typeof record.completionNote === 'string' && record.completionNote.trim() !== ''
      ? record.completionNote.trim()
      : undefined;
  return { ok: true, ...(completionNote ? { completionNote } : {}) };
}

function parseEscalateHumanTaskBody(
  value: unknown,
): { ok: true; workforceQueueId: string; reason?: string } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { workforceQueueId?: unknown; reason?: unknown };
  if (typeof record.workforceQueueId !== 'string' || record.workforceQueueId.trim() === '') {
    return { ok: false };
  }
  const reason =
    typeof record.reason === 'string' && record.reason.trim() !== '' ? record.reason.trim() : undefined;
  return {
    ok: true,
    workforceQueueId: record.workforceQueueId.trim(),
    ...(reason ? { reason } : {}),
  };
}

function listRuntimeHumanTasks(workspaceId: string): HumanTaskRecord[] {
  return runtimeHumanTasks.filter((task) => task.tenantId === workspaceId);
}

function updateRuntimeHumanTask(nextTask: HumanTaskRecord): void {
  runtimeHumanTasks = runtimeHumanTasks.map((task) =>
    task.humanTaskId === nextTask.humanTaskId && task.tenantId === nextTask.tenantId ? nextTask : task,
  );
}

function listRuntimeEvidence(workspaceId: string): EvidenceRecord[] {
  return runtimeEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

async function handleGetWorkspace(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const result = await getWorkspace(
    { authorization: deps.authorization, workspaceStore: deps.workspaceStore },
    auth.ctx,
    { workspaceId },
  );

  if (result.ok) {
    respondJson(res, 200, correlationId, traceContext, result.value);
    return;
  }

  respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
}

async function handleGetRun(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    runId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, runId, traceContext } = args;

  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const result = await getRun(
    { authorization: deps.authorization, runStore: deps.runStore },
    auth.ctx,
    { workspaceId, runId },
  );

  if (result.ok) {
    respondJson(res, 200, correlationId, traceContext, result.value);
    return;
  }

  respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
}

async function handleListWorkforceMembers(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  const queueId = url.searchParams.get('queueId');
  const availability = url.searchParams.get('availability');

  let items = listFixtureMembers(workspaceId);
  if (capability) {
    items = items.filter((m) => m.capabilities.includes(capability as WorkforceCapability));
  }
  if (queueId) {
    items = items.filter((m) => m.queueMemberships.includes(queueId));
  }
  if (availability === 'available' || availability === 'busy' || availability === 'offline') {
    items = items.filter((m) => m.availabilityStatus === availability);
  }

  const body = paginate(items, req.url ?? '/');
  respondJson(res, 200, correlationId, traceContext, body);
}

async function handleGetWorkforceMember(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    workforceMemberId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, workforceMemberId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const member = listFixtureMembers(workspaceId).find((m) => m.workforceMemberId === workforceMemberId);
  if (!member) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workforce member ${workforceMemberId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, 200, correlationId, traceContext, member);
}

async function handlePatchWorkforceAvailability(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    workforceMemberId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, workforceMemberId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  if (!hasRole(auth.ctx, 'admin')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admins can update workforce availability in this runtime.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const member = listFixtureMembers(workspaceId).find((m) => m.workforceMemberId === workforceMemberId);
  if (!member) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Workforce member ${workforceMemberId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = parseAvailabilityPatchBody(await readJsonBody(req));
  if (!body.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'availabilityStatus must be one of: available, busy, offline.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const updated: WorkforceMemberRecord = {
    ...member,
    availabilityStatus: body.availabilityStatus,
    updatedAtIso: new Date().toISOString(),
  };
  respondJson(res, 200, correlationId, traceContext, updated);
}

async function handleListWorkforceQueues(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  let items = listFixtureQueues(workspaceId);
  if (capability) {
    items = items.filter((queue) =>
      queue.requiredCapabilities.includes(capability as WorkforceCapability),
    );
  }
  const body = paginate(items, req.url ?? '/');
  respondJson(res, 200, correlationId, traceContext, body);
}

async function handleListHumanTasks(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const assigneeId = url.searchParams.get('assigneeId');
  const status = url.searchParams.get('status');
  const runId = url.searchParams.get('runId');

  let items = listRuntimeHumanTasks(workspaceId);
  if (assigneeId) {
    items = items.filter((task) => task.assigneeId === assigneeId);
  }
  if (
    status === 'pending' ||
    status === 'assigned' ||
    status === 'in-progress' ||
    status === 'completed' ||
    status === 'escalated'
  ) {
    items = items.filter((task) => task.status === status);
  }
  if (runId) {
    items = items.filter((task) => task.runId === runId);
  }

  const body = paginate(items, req.url ?? '/');
  respondJson(res, 200, correlationId, traceContext, body);
}

async function handleGetHumanTask(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    humanTaskId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }
  const task = listRuntimeHumanTasks(workspaceId).find((entry) => entry.humanTaskId === humanTaskId);
  if (!task) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Human task ${humanTaskId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  respondJson(res, 200, correlationId, traceContext, task);
}

async function handleAssignHumanTask(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    humanTaskId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  if (!hasRole(auth.ctx, 'admin') && !hasRole(auth.ctx, 'operator')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin/operator can assign human tasks.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const task = listRuntimeHumanTasks(workspaceId).find((entry) => entry.humanTaskId === humanTaskId);
  if (!task) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Human task ${humanTaskId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const body = parseAssignHumanTaskBody(await readJsonBody(req));
  if (!body.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'workforceMemberId or workforceQueueId is required.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const updated: HumanTaskRecord = {
    ...task,
    status: body.workforceMemberId ? 'assigned' : task.status,
    ...(body.workforceMemberId
      ? { assigneeId: body.workforceMemberId }
      : task.assigneeId
        ? { assigneeId: task.assigneeId }
        : {}),
    ...(body.workforceQueueId
      ? { groupId: body.workforceQueueId }
      : task.groupId
        ? { groupId: task.groupId }
        : {}),
  };
  updateRuntimeHumanTask(updated);
  respondJson(res, 200, correlationId, traceContext, updated);
}

async function handleCompleteHumanTask(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    humanTaskId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  if (!hasRole(auth.ctx, 'admin') && !hasRole(auth.ctx, 'operator')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin/operator can complete human tasks.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const task = listRuntimeHumanTasks(workspaceId).find((entry) => entry.humanTaskId === humanTaskId);
  if (!task) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Human task ${humanTaskId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const parsed = parseCompleteHumanTaskBody(await readJsonBody(req));
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'completionNote must be a string when provided.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const evidenceId = `evi-${randomUUID()}`;
  const nowIso = new Date().toISOString();
  const evidence: EvidenceRecord = {
    schemaVersion: 1,
    evidenceId,
    workspaceId,
    occurredAtIso: nowIso,
    category: 'Action',
    summary: parsed.completionNote
      ? `Human task ${humanTaskId} completed: ${parsed.completionNote}`
      : `Human task ${humanTaskId} completed.`,
    actor: { kind: 'User', userId: auth.ctx.principalId },
    links: { runId: task.runId, workItemId: task.workItemId },
    hashSha256: randomBytes(32).toString('hex'),
  };
  runtimeEvidence = [...runtimeEvidence, evidence];

  const updated: HumanTaskRecord = {
    ...task,
    status: 'completed',
    completedAt: nowIso,
    completedById: task.assigneeId ?? 'wm-1',
    evidenceAnchorId: evidenceId,
  };
  updateRuntimeHumanTask(updated);
  respondJson(res, 200, correlationId, traceContext, updated);
}

async function handleEscalateHumanTask(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    humanTaskId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  if (!hasRole(auth.ctx, 'admin') && !hasRole(auth.ctx, 'operator')) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin/operator can escalate human tasks.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const task = listRuntimeHumanTasks(workspaceId).find((entry) => entry.humanTaskId === humanTaskId);
  if (!task) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Human task ${humanTaskId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const parsed = parseEscalateHumanTaskBody(await readJsonBody(req));
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'workforceQueueId is required.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const { assigneeId: _dropAssigneeId, ...taskWithoutAssignee } = task;
  const updated: HumanTaskRecord = {
    ...taskWithoutAssignee,
    status: 'escalated',
    groupId: parsed.workforceQueueId,
  };
  updateRuntimeHumanTask(updated);
  respondJson(res, 200, correlationId, traceContext, updated);
}

async function handleListEvidence(
  args: Readonly<{
    deps: ControlPlaneDeps;
    req: IncomingMessage;
    res: ServerResponse;
    correlationId: string;
    pathname: string;
    workspaceId: string;
    traceContext: TraceContext;
  }>,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
  const auth = await authenticate(deps, req, correlationId, traceContext, workspaceId);
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const runId = url.searchParams.get('runId');
  const planId = url.searchParams.get('planId');
  const workItemId = url.searchParams.get('workItemId');
  const category = url.searchParams.get('category');

  let items = listRuntimeEvidence(workspaceId);
  if (runId) {
    items = items.filter((entry) => entry.links?.runId === runId);
  }
  if (planId) {
    items = items.filter((entry) => entry.links?.planId === planId);
  }
  if (workItemId) {
    items = items.filter((entry) => entry.links?.workItemId === workItemId);
  }
  if (
    category === 'Plan' ||
    category === 'Action' ||
    category === 'Approval' ||
    category === 'Policy' ||
    category === 'System'
  ) {
    items = items.filter((entry) => entry.category === category);
  }

  const body = paginate(items, req.url ?? '/');
  respondJson(res, 200, correlationId, traceContext, body);
}

async function handleRequest(
  deps: ControlPlaneDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const correlationId = normalizeCorrelationId(req);
  const traceContext = normalizeTraceContext(req);
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (req.method === 'GET') {
    const mWorkspace = /^\/v1\/workspaces\/([^/]+)$/.exec(pathname);
    if (mWorkspace) {
      await handleGetWorkspace({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mWorkspace[1] ?? ''),
      });
      return;
    }

    const mRun = /^\/v1\/workspaces\/([^/]+)\/runs\/([^/]+)$/.exec(pathname);
    if (mRun) {
      await handleGetRun({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mRun[1] ?? ''),
        runId: decodeURIComponent(mRun[2] ?? ''),
      });
      return;
    }

    const mWorkforceList = /^\/v1\/workspaces\/([^/]+)\/workforce$/.exec(pathname);
    if (mWorkforceList) {
      await handleListWorkforceMembers({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mWorkforceList[1] ?? ''),
      });
      return;
    }

    const mQueueList = /^\/v1\/workspaces\/([^/]+)\/workforce\/queues$/.exec(pathname);
    if (mQueueList) {
      await handleListWorkforceQueues({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mQueueList[1] ?? ''),
      });
      return;
    }

    const mHumanTaskList = /^\/v1\/workspaces\/([^/]+)\/human-tasks$/.exec(pathname);
    if (mHumanTaskList) {
      await handleListHumanTasks({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mHumanTaskList[1] ?? ''),
      });
      return;
    }

    const mEvidenceList = /^\/v1\/workspaces\/([^/]+)\/evidence$/.exec(pathname);
    if (mEvidenceList) {
      await handleListEvidence({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mEvidenceList[1] ?? ''),
      });
      return;
    }

    const mWorkforceMember = /^\/v1\/workspaces\/([^/]+)\/workforce\/([^/]+)$/.exec(pathname);
    if (mWorkforceMember) {
      await handleGetWorkforceMember({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mWorkforceMember[1] ?? ''),
        workforceMemberId: decodeURIComponent(mWorkforceMember[2] ?? ''),
      });
      return;
    }

    const mHumanTask = /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)$/.exec(pathname);
    if (mHumanTask) {
      await handleGetHumanTask({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mHumanTask[1] ?? ''),
        humanTaskId: decodeURIComponent(mHumanTask[2] ?? ''),
      });
      return;
    }
  }

  if (req.method === 'PATCH') {
    const mPatchAvailability = /^\/v1\/workspaces\/([^/]+)\/workforce\/([^/]+)\/availability$/.exec(
      pathname,
    );
    if (mPatchAvailability) {
      await handlePatchWorkforceAvailability({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mPatchAvailability[1] ?? ''),
        workforceMemberId: decodeURIComponent(mPatchAvailability[2] ?? ''),
      });
      return;
    }
  }

  if (req.method === 'POST') {
    const mAssignTask = /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/assign$/.exec(pathname);
    if (mAssignTask) {
      await handleAssignHumanTask({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mAssignTask[1] ?? ''),
        humanTaskId: decodeURIComponent(mAssignTask[2] ?? ''),
      });
      return;
    }

    const mCompleteTask = /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/complete$/.exec(pathname);
    if (mCompleteTask) {
      await handleCompleteHumanTask({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mCompleteTask[1] ?? ''),
        humanTaskId: decodeURIComponent(mCompleteTask[2] ?? ''),
      });
      return;
    }

    const mEscalateTask = /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/escalate$/.exec(pathname);
    if (mEscalateTask) {
      await handleEscalateHumanTask({
        deps,
        req,
        res,
        correlationId,
        traceContext,
        pathname,
        workspaceId: decodeURIComponent(mEscalateTask[1] ?? ''),
        humanTaskId: decodeURIComponent(mEscalateTask[2] ?? ''),
      });
      return;
    }
  }

  respondProblem(
    res,
    {
      type: 'https://portarium.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found.',
      instance: pathname,
    },
    correlationId,
    traceContext,
  );
}

export function createControlPlaneHandler(deps: ControlPlaneDeps = buildDeps()): RequestHandler {
  return (req, res) => {
    void handleRequest(deps, req, res).catch((error) => {
      const correlationId = randomUUID();
      const traceContext = normalizeTraceContext(req);
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Unhandled error.',
          instance: req.url ?? '/',
        },
        correlationId,
        traceContext,
      );
    });
  };
}

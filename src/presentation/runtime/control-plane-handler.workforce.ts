/**
 * Workforce and human-task HTTP handlers for the control-plane runtime.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  type HumanTaskRecord,
  type EvidenceRecord,
  type WorkforceAvailabilityStatus,
  type WorkforceCapability,
  type WorkforceMemberRecord,
  type WorkforceQueueRecord,
  authenticate,
  assertReadAccess,
  hasRole,
  paginate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutable runtime state (module-level singletons)
// ---------------------------------------------------------------------------

let runtimeHumanTasks: HumanTaskRecord[] = [...HUMAN_TASK_FIXTURE];
export let runtimeEvidence: EvidenceRecord[] = [];

export function listFixtureMembers(workspaceId: string): WorkforceMemberRecord[] {
  return WORKFORCE_FIXTURE.members.filter((m) => m.tenantId === workspaceId);
}

export function listFixtureQueues(workspaceId: string): WorkforceQueueRecord[] {
  return WORKFORCE_FIXTURE.queues.filter((q) => q.tenantId === workspaceId);
}

export function listRuntimeHumanTasks(workspaceId: string): HumanTaskRecord[] {
  return runtimeHumanTasks.filter((task) => task.tenantId === workspaceId);
}

export function updateRuntimeHumanTask(nextTask: HumanTaskRecord): void {
  runtimeHumanTasks = runtimeHumanTasks.map((task) =>
    task.humanTaskId === nextTask.humanTaskId && task.tenantId === nextTask.tenantId
      ? nextTask
      : task,
  );
}

export function listRuntimeEvidence(workspaceId: string): EvidenceRecord[] {
  return runtimeEvidence.filter((entry) => entry.workspaceId === workspaceId);
}

export function appendRuntimeEvidence(entry: EvidenceRecord): void {
  runtimeEvidence = [...runtimeEvidence, entry];
}

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------

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

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed !== '' ? trimmed : undefined;
}

function parseAssignHumanTaskBody(
  value: unknown,
): { ok: true; workforceMemberId?: string; workforceQueueId?: string } | { ok: false } {
  if (typeof value !== 'object' || value === null) return { ok: false };
  const record = value as { workforceMemberId?: unknown; workforceQueueId?: unknown };
  const workforceMemberId = readOptionalString(record.workforceMemberId);
  const workforceQueueId = readOptionalString(record.workforceQueueId);
  if (!workforceMemberId && !workforceQueueId) return { ok: false };
  return {
    ok: true,
    ...(workforceMemberId ? { workforceMemberId } : {}),
    ...(workforceQueueId ? { workforceQueueId } : {}),
  };
}

function parseCompleteHumanTaskBody(
  value: unknown,
): { ok: true; completionNote?: string } | { ok: false } {
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
  if (typeof record.workforceQueueId !== 'string' || record.workforceQueueId.trim() === '')
    return { ok: false };
  const reason =
    typeof record.reason === 'string' && record.reason.trim() !== ''
      ? record.reason.trim()
      : undefined;
  return {
    ok: true,
    workforceQueueId: record.workforceQueueId.trim(),
    ...(reason ? { reason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Handler args type alias
// ---------------------------------------------------------------------------

type HandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

type HandlerArgsWithMember = HandlerArgs & Readonly<{ workforceMemberId: string }>;
type HandlerArgsWithHumanTask = HandlerArgs & Readonly<{ humanTaskId: string }>;

// ---------------------------------------------------------------------------
// Workforce handlers
// ---------------------------------------------------------------------------

export async function handleListWorkforceMembers(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
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
  if (capability)
    items = items.filter((m) => m.capabilities.includes(capability as WorkforceCapability));
  if (queueId) items = items.filter((m) => m.queueMemberships.includes(queueId));
  if (availability === 'available' || availability === 'busy' || availability === 'offline') {
    items = items.filter((m) => m.availabilityStatus === availability);
  }
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: paginate(items, req.url ?? '/'),
  });
}

export async function handleGetWorkforceMember(args: HandlerArgsWithMember): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, workforceMemberId, traceContext } =
    args;
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
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }
  const member = listFixtureMembers(workspaceId).find(
    (m) => m.workforceMemberId === workforceMemberId,
  );
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
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: member });
}

export async function handlePatchWorkforceAvailability(args: HandlerArgsWithMember): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, workforceMemberId, traceContext } =
    args;
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
  const member = listFixtureMembers(workspaceId).find(
    (m) => m.workforceMemberId === workforceMemberId,
  );
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
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: updated });
}

export async function handleListWorkforceQueues(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
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
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const capability = url.searchParams.get('capability');
  let items = listFixtureQueues(workspaceId);
  if (capability)
    items = items.filter((queue) =>
      queue.requiredCapabilities.includes(capability as WorkforceCapability),
    );
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: paginate(items, req.url ?? '/'),
  });
}

// ---------------------------------------------------------------------------
// Human task handlers
// ---------------------------------------------------------------------------

const VALID_TASK_STATUSES = new Set([
  'pending',
  'assigned',
  'in-progress',
  'completed',
  'escalated',
]);

export async function handleListHumanTasks(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
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
  if (assigneeId) items = items.filter((task) => task.assigneeId === assigneeId);
  if (status && VALID_TASK_STATUSES.has(status))
    items = items.filter((task) => task.status === status);
  if (runId) items = items.filter((task) => task.runId === runId);
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: paginate(items, req.url ?? '/'),
  });
}

export async function handleGetHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
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
  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }
  const task = listRuntimeHumanTasks(workspaceId).find(
    (entry) => entry.humanTaskId === humanTaskId,
  );
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
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: task });
}

export async function handleAssignHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
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
  const task = listRuntimeHumanTasks(workspaceId).find(
    (entry) => entry.humanTaskId === humanTaskId,
  );
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
  const assigneeId = body.workforceMemberId ?? task.assigneeId;
  const groupId = body.workforceQueueId ?? task.groupId;
  const updated: HumanTaskRecord = {
    ...task,
    status: body.workforceMemberId ? 'assigned' : task.status,
    ...(assigneeId ? { assigneeId } : {}),
    ...(groupId ? { groupId } : {}),
  };
  updateRuntimeHumanTask(updated);
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: updated });
}

export async function handleCompleteHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
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
  const task = listRuntimeHumanTasks(workspaceId).find(
    (entry) => entry.humanTaskId === humanTaskId,
  );
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
  appendRuntimeEvidence(evidence);
  const updated: HumanTaskRecord = {
    ...task,
    status: 'completed',
    completedAt: nowIso,
    completedById: task.assigneeId ?? 'wm-1',
    evidenceAnchorId: evidenceId,
  };
  updateRuntimeHumanTask(updated);
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: updated });
}

export async function handleEscalateHumanTask(args: HandlerArgsWithHumanTask): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, humanTaskId, traceContext } = args;
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
  const task = listRuntimeHumanTasks(workspaceId).find(
    (entry) => entry.humanTaskId === humanTaskId,
  );
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
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: updated });
}

// ---------------------------------------------------------------------------
// Evidence handler
// ---------------------------------------------------------------------------

const VALID_EVIDENCE_CATEGORIES = new Set(['Plan', 'Action', 'Approval', 'Policy', 'System']);

export async function handleListEvidence(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;
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
  if (runId) items = items.filter((entry) => entry.links?.runId === runId);
  if (planId) items = items.filter((entry) => entry.links?.planId === planId);
  if (workItemId) items = items.filter((entry) => entry.links?.workItemId === workItemId);
  if (category && VALID_EVIDENCE_CATEGORIES.has(category))
    items = items.filter((entry) => entry.category === category);
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: paginate(items, req.url ?? '/'),
  });
}

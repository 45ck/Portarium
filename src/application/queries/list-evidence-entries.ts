import {
  PlanId,
  RunId,
  WorkItemId,
  WorkspaceId,
  type PlanId as PlanIdType,
  type RunId as RunIdType,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { EvidenceCategory, EvidenceEntryV1 } from '../../domain/evidence/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type Forbidden,
  type Result,
  type ValidationFailed,
  err,
  ok,
} from '../common/index.js';
import type { AuthorizationPort, EvidenceFieldFilter, EvidenceQueryStore } from '../ports/index.js';
import type { Page } from '../common/query.js';

const EVIDENCE_CATEGORIES = [
  'Plan',
  'Action',
  'Approval',
  'OperatorSurface',
  'Policy',
  'PolicyViolation',
  'System',
] as const;

export type ListEvidenceEntriesInput = Readonly<{
  workspaceId: string;
  runId?: string;
  planId?: string;
  workItemId?: string;
  category?: EvidenceCategory;
  limit?: number;
  cursor?: string;
}>;

export type ListEvidenceEntriesOutput = Readonly<Page<EvidenceEntryV1>>;

export type ListEvidenceEntriesError = Forbidden | ValidationFailed;

export interface ListEvidenceEntriesDeps {
  authorization: AuthorizationPort;
  evidenceQueryStore: EvidenceQueryStore;
}

type ParsedIds = Readonly<{
  workspaceId: WorkspaceIdType;
  runId?: RunIdType;
  planId?: PlanIdType;
  workItemId?: WorkItemIdType;
}>;

export async function listEvidenceEntries(
  deps: ListEvidenceEntriesDeps,
  ctx: AppContext,
  input: ListEvidenceEntriesInput,
): Promise<Result<ListEvidenceEntriesOutput, ListEvidenceEntriesError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.evidenceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.evidenceRead,
      message: 'Caller is not permitted to list evidence.',
    });
  }

  const validationError = validateInput(input);
  if (validationError) return err(validationError);

  const parsed = parseIds(input);
  if (!parsed.ok) return parsed;

  const page = await deps.evidenceQueryStore.listEvidenceEntries(
    ctx.tenantId,
    parsed.value.workspaceId,
    {
      filter: buildFilter(input, parsed.value),
      pagination: {
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      },
    },
  );
  return ok(page);
}

function validateInput(input: ListEvidenceEntriesInput): ValidationFailed | null {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return { kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' };
  }
  for (const [field, value] of [
    ['runId', input.runId],
    ['planId', input.planId],
    ['workItemId', input.workItemId],
    ['cursor', input.cursor],
  ] as const) {
    if (value?.trim() === '') {
      return { kind: 'ValidationFailed', message: `${field} must be a non-empty string.` };
    }
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return { kind: 'ValidationFailed', message: 'limit must be a positive integer.' };
  }
  if (input.category !== undefined && !EVIDENCE_CATEGORIES.includes(input.category)) {
    return { kind: 'ValidationFailed', message: 'category is invalid.' };
  }
  return null;
}

function parseIds(input: ListEvidenceEntriesInput): Result<ParsedIds, ValidationFailed> {
  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      ...(input.runId !== undefined ? { runId: RunId(input.runId) } : {}),
      ...(input.planId !== undefined ? { planId: PlanId(input.planId) } : {}),
      ...(input.workItemId !== undefined ? { workItemId: WorkItemId(input.workItemId) } : {}),
    });
  } catch {
    return err({
      kind: 'ValidationFailed',
      message: 'Invalid workspaceId/runId/planId/workItemId.',
    });
  }
}

function buildFilter(input: ListEvidenceEntriesInput, parsed: ParsedIds): EvidenceFieldFilter {
  return {
    ...(parsed.runId !== undefined ? { runId: String(parsed.runId) } : {}),
    ...(parsed.planId !== undefined ? { planId: String(parsed.planId) } : {}),
    ...(parsed.workItemId !== undefined ? { workItemId: String(parsed.workItemId) } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
  };
}

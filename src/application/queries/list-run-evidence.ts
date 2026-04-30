import {
  RunId,
  WorkspaceId,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { EvidenceQueryStore } from '../ports/index.js';
import type { AuthorizationPort } from '../ports/index.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/index.js';
import type { Page } from '../common/query.js';
import {
  APP_ACTIONS,
  type AppContext,
  type Forbidden,
  type Result,
  type ValidationFailed,
  err,
  ok,
} from '../common/index.js';

export type ListRunEvidenceInput = Readonly<{
  workspaceId: string;
  runId: string;
  limit?: number;
  cursor?: string;
}>;

export type ListRunEvidenceOutput = Readonly<Page<EvidenceEntryV1>>;

export type ListRunEvidenceError = Forbidden | ValidationFailed;

export interface ListRunEvidenceDeps {
  authorization: AuthorizationPort;
  evidenceQueryStore: EvidenceQueryStore;
}

export async function listRunEvidence(
  deps: ListRunEvidenceDeps,
  ctx: AppContext,
  input: ListRunEvidenceInput,
): Promise<Result<ListRunEvidenceOutput, ListRunEvidenceError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.evidenceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.evidenceRead,
      message: 'Caller is not permitted to list run evidence.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'runId must be a non-empty string.' });
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }
  if (input.cursor?.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'cursor must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let runId: RunIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    runId = RunId(input.runId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or runId.' });
  }

  const page = await deps.evidenceQueryStore.listEvidenceEntries(ctx.tenantId, workspaceId, {
    filter: { runId: String(runId) },
    pagination: {
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    },
  });
  return ok(page);
}

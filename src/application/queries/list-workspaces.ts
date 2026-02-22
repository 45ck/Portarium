import type { WorkspaceV1 } from '../../domain/workspaces/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  type Forbidden,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type {
  ListWorkspacesFilter,
  QueryCache,
  WorkspaceListPage,
  WorkspaceQueryStore,
  AuthorizationPort,
} from '../ports/index.js';
import { queryCacheKey } from '../ports/query-cache.js';

export type ListWorkspacesInput = Readonly<{
  nameQuery?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListWorkspacesOutput = Readonly<WorkspaceListPage>;

export type ListWorkspacesError = Forbidden | ValidationFailed;

export interface ListWorkspacesDeps {
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceQueryStore;
  /** Optional cache-aside cache. Pass null to disable caching. */
  queryCache?: QueryCache | null;
}

function validatePositiveLimit(limit: number | undefined): Result<void, ValidationFailed> {
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }
  return ok(undefined);
}

function validateOptionalNonEmptyString(
  value: string | undefined,
  field: 'cursor' | 'nameQuery',
): Result<void, ValidationFailed> {
  if (value?.trim() === '') {
    return err({ kind: 'ValidationFailed', message: `${field} must be a non-empty string.` });
  }
  return ok(undefined);
}

function validateInput(input: ListWorkspacesInput): Result<ListWorkspacesFilter, ValidationFailed> {
  const limitValid = validatePositiveLimit(input.limit);
  if (!limitValid.ok) return limitValid;
  const cursorValid = validateOptionalNonEmptyString(input.cursor, 'cursor');
  if (!cursorValid.ok) return cursorValid;
  const nameQueryValid = validateOptionalNonEmptyString(input.nameQuery, 'nameQuery');
  if (!nameQueryValid.ok) return nameQueryValid;

  return ok({
    ...(input.nameQuery ? { nameQuery: input.nameQuery } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  });
}

export async function listWorkspaces(
  deps: ListWorkspacesDeps,
  ctx: AppContext,
  input: ListWorkspacesInput,
): Promise<Result<ListWorkspacesOutput, ListWorkspacesError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: 'Caller is not permitted to list workspaces.',
    });
  }

  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }

  const cache = deps.queryCache ?? null;
  if (cache) {
    const cacheKey = queryCacheKey(
      ctx.tenantId,
      'listWorkspaces',
      input.nameQuery ?? '',
      input.cursor ?? '',
      String(input.limit ?? ''),
    );
    const cached = await cache.get<ListWorkspacesOutput>(cacheKey);
    if (cached !== null) return ok(cached);

    const page = await deps.workspaceStore.listWorkspaces(ctx.tenantId, validated.value);
    const result: ListWorkspacesOutput = {
      items: page.items.map((workspace): WorkspaceV1 => workspace),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    };
    await cache.set(cacheKey, result, 30);
    return ok(result);
  }

  const page = await deps.workspaceStore.listWorkspaces(ctx.tenantId, validated.value);
  return ok({
    items: page.items.map((workspace): WorkspaceV1 => workspace),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  });
}

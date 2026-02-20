import { AgentId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkItemV1 } from '../../domain/work-items/index.js';
import {
  type AppContext,
  type Forbidden,
  type NotFound,
  type ValidationFailed,
  APP_ACTIONS,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type {
  AuthorizationPort,
  MachineRegistryStore,
  WorkItemListPage,
  WorkItemStore,
} from '../ports/index.js';

export type GetAgentWorkItemsInput = Readonly<{
  workspaceId: string;
  agentId: string;
  status?: string;
  limit?: number;
  cursor?: string;
}>;

export type GetAgentWorkItemsOutput = Readonly<{
  agentId: string;
  items: readonly WorkItemV1[];
  nextCursor?: string;
}>;

export type GetAgentWorkItemsError = Forbidden | NotFound | ValidationFailed;

export interface GetAgentWorkItemsDeps {
  authorization: AuthorizationPort;
  workItemStore: WorkItemStore;
  machineRegistryStore: MachineRegistryStore;
}

const VALID_STATUSES = ['Open', 'InProgress', 'Blocked', 'Resolved', 'Closed'] as const;

export async function getAgentWorkItems(
  deps: GetAgentWorkItemsDeps,
  ctx: AppContext,
  input: GetAgentWorkItemsInput,
): Promise<Result<GetAgentWorkItemsOutput, GetAgentWorkItemsError>> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.agentId !== 'string' || input.agentId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'agentId must be a non-empty string.' });
  }
  if (input.status !== undefined && !(VALID_STATUSES as readonly string[]).includes(input.status)) {
    return err({ kind: 'ValidationFailed', message: 'status is invalid.' });
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workItemRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workItemRead,
      message: 'Caller is not permitted to read agent work items.',
    });
  }

  const workspaceId = WorkspaceId(input.workspaceId);
  const agentId = AgentId(input.agentId);

  const agent = await deps.machineRegistryStore.getAgentConfigById(ctx.tenantId, agentId);
  if (agent === null) {
    return err({
      kind: 'NotFound',
      resource: 'AgentConfig',
      message: `Agent ${input.agentId} not found.`,
    });
  }

  const page: WorkItemListPage = await deps.workItemStore.listWorkItems(
    ctx.tenantId,
    workspaceId,
    {
      ...(input.status ? { status: input.status as WorkItemV1['status'] } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
  );

  return ok({
    agentId: input.agentId,
    items: page.items,
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  });
}

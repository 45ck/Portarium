import {
  type WorkspaceV1,
  parseWorkspaceV1,
} from '../../domain/workspaces/workspace-v1.js';
import { createPortariumCloudEvent } from '../events/cloudevent.js';
import {
  type AppContext,
  type Conflict,
  type DependencyFailure,
  APP_ACTIONS,
  type ValidationFailed,
  err,
  ok,
  type Result,
  type Forbidden,
} from '../common/index.js';
import type { IdGenerator, WorkspaceStore, IdempotencyStore, AuthorizationPort, Clock, UnitOfWork, EventPublisher } from '../ports/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';

const REGISTER_WORKSPACE_COMMAND = 'RegisterWorkspace';
const WORKSPACE_CLOUD_EVENT_SOURCE = 'portarium.control-plane.application';

export type RegisterWorkspaceInput = Readonly<{
  idempotencyKey: string;
  workspace: unknown;
}>;

export type RegisterWorkspaceOutput = Readonly<{
  workspaceId: WorkspaceV1['workspaceId'];
}>;

export type RegisterWorkspaceError = Forbidden | ValidationFailed | Conflict | DependencyFailure;

export interface RegisterWorkspaceDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
  workspaceStore: WorkspaceStore;
  eventPublisher: EventPublisher;
}

export async function registerWorkspace(
  deps: RegisterWorkspaceDeps,
  ctx: AppContext,
  input: RegisterWorkspaceInput,
): Promise<Result<RegisterWorkspaceOutput, RegisterWorkspaceError>> {
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'idempotencyKey must be a non-empty string.' });
  }

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRegister);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Caller is not permitted to register workspaces.',
    });
  }

  let workspace: WorkspaceV1;
  try {
    workspace = parseWorkspaceV1(input.workspace);
  } catch (error) {
    if (error instanceof Error) {
      return err({ kind: 'ValidationFailed', message: error.message });
    }
    return err({ kind: 'ValidationFailed', message: 'Workspace payload must be valid.' });
  }

  if (workspace.tenantId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Tenant mismatch.',
    });
  }

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: REGISTER_WORKSPACE_COMMAND,
    requestKey: input.idempotencyKey,
  };

  const cached = await deps.idempotency.get<RegisterWorkspaceOutput>(commandKey);
  if (cached) return ok(cached);

  const existing = await deps.workspaceStore.getWorkspaceById(ctx.tenantId, workspace.workspaceId);
  if (existing !== null) {
    return err({
      kind: 'Conflict',
      message: `Workspace ${workspace.workspaceId} already exists.`,
    });
  }

  const occurredAtIso = deps.clock.nowIso().trim();
  if (occurredAtIso === '') {
    return err({
      kind: 'DependencyFailure',
      message: 'Clock returned an invalid timestamp.',
    });
  }
  const eventId = deps.idGenerator.generateId().trim();
  if (eventId === '') {
    return err({
      kind: 'DependencyFailure',
      message: 'Unable to generate event identifier.',
    });
  }

  const domainEvent: DomainEventV1 = {
    schemaVersion: 1,
    eventId,
    eventType: 'WorkspaceCreated',
    aggregateKind: 'Workspace',
    aggregateId: workspace.workspaceId,
    occurredAtIso,
    actorUserId: ctx.principalId,
    correlationId: ctx.correlationId,
    payload: {
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.name,
    },
  };

  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.workspaceStore.saveWorkspace(workspace);

      await deps.eventPublisher.publish(
        createPortariumCloudEvent({
          source: WORKSPACE_CLOUD_EVENT_SOURCE,
          eventType: `com.portarium.workspace.${domainEvent.eventType}`,
          eventId,
          tenantId: ctx.tenantId,
          correlationId: ctx.correlationId,
          subject: `workspaces/${workspace.workspaceId}`,
          occurredAtIso,
          data: domainEvent,
        }),
      );

      const output: RegisterWorkspaceOutput = {
        workspaceId: workspace.workspaceId,
      };

      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Workspace registration failed due to a dependency error.';
    return err({ kind: 'DependencyFailure', message });
  }
}

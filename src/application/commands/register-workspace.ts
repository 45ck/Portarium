import { type WorkspaceV1, parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import {
  type AppContext,
  type Conflict,
  type DependencyFailure,
  APP_ACTIONS,
  type ValidationFailed,
  err,
  ok,
  type Result,
  type Err,
  type Forbidden,
} from '../common/index.js';
import type {
  IdGenerator,
  WorkspaceStore,
  IdempotencyStore,
  AuthorizationPort,
  Clock,
  UnitOfWork,
  EventPublisher,
} from '../ports/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { IdempotencyKey } from '../ports/idempotency.js';

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

type InternalError = Err<RegisterWorkspaceError>;

function validateIdempotencyKey(key: string): InternalError | null {
  if (typeof key !== 'string' || key.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'idempotencyKey must be a non-empty string.' });
  }
  return null;
}

function parseAndValidateWorkspace(raw: unknown, ctx: AppContext): WorkspaceV1 | InternalError {
  let workspace: WorkspaceV1;
  try {
    workspace = parseWorkspaceV1(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workspace payload must be valid.';
    return err({ kind: 'ValidationFailed', message });
  }
  if (workspace.tenantId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Tenant mismatch.',
    });
  }
  return workspace;
}

function generateEventMetadata(
  deps: Pick<RegisterWorkspaceDeps, 'clock' | 'idGenerator'>,
): { occurredAtIso: string; eventId: string } | InternalError {
  const occurredAtIso = deps.clock.nowIso().trim();
  if (occurredAtIso === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }
  const eventId = deps.idGenerator.generateId().trim();
  if (eventId === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate event identifier.' });
  }
  return { occurredAtIso, eventId };
}

function buildDomainEvent(
  workspace: WorkspaceV1,
  ctx: AppContext,
  meta: { occurredAtIso: string; eventId: string },
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId: meta.eventId,
    eventType: 'WorkspaceCreated',
    aggregateKind: 'Workspace',
    aggregateId: workspace.workspaceId,
    occurredAtIso: meta.occurredAtIso,
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    actorUserId: ctx.principalId,
    payload: { workspaceId: workspace.workspaceId, workspaceName: workspace.name },
  };
}

function isErr<E>(value: unknown): value is Err<E> {
  return (
    typeof value === 'object' && value !== null && 'ok' in value && (value as Err<E>).ok === false
  );
}

type PersistInput = Readonly<{
  workspace: WorkspaceV1;
  domainEvent: DomainEventV1;
  commandKey: IdempotencyKey;
}>;

async function persistWorkspace(
  deps: RegisterWorkspaceDeps,
  ctx: AppContext,
  { workspace, domainEvent, commandKey }: PersistInput,
): Promise<Result<RegisterWorkspaceOutput, DependencyFailure>> {
  void ctx; // tenantId is now embedded in domainEvent.workspaceId
  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.workspaceStore.saveWorkspace(workspace);
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, WORKSPACE_CLOUD_EVENT_SOURCE),
      );
      const output: RegisterWorkspaceOutput = { workspaceId: workspace.workspaceId };
      await deps.idempotency.set(commandKey, output);
      return ok(output);
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Workspace registration failed due to a dependency error.';
    return err({ kind: 'DependencyFailure', message });
  }
}

export async function registerWorkspace(
  deps: RegisterWorkspaceDeps,
  ctx: AppContext,
  input: RegisterWorkspaceInput,
): Promise<Result<RegisterWorkspaceOutput, RegisterWorkspaceError>> {
  const keyError = validateIdempotencyKey(input.idempotencyKey);
  if (keyError) return keyError;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRegister);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRegister,
      message: 'Caller is not permitted to register workspaces.',
    });
  }

  const workspaceOrError = parseAndValidateWorkspace(input.workspace, ctx);
  if (isErr<RegisterWorkspaceError>(workspaceOrError)) return workspaceOrError;
  const workspace = workspaceOrError;

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: REGISTER_WORKSPACE_COMMAND,
    requestKey: input.idempotencyKey,
  };
  const cached = await deps.idempotency.get<RegisterWorkspaceOutput>(commandKey);
  if (cached) return ok(cached);

  const existing = await deps.workspaceStore.getWorkspaceById(ctx.tenantId, workspace.workspaceId);
  if (existing !== null) {
    return err({ kind: 'Conflict', message: `Workspace ${workspace.workspaceId} already exists.` });
  }

  const metaOrError = generateEventMetadata(deps);
  if (isErr<RegisterWorkspaceError>(metaOrError)) return metaOrError;

  const domainEvent = buildDomainEvent(workspace, ctx, metaOrError);
  return persistWorkspace(deps, ctx, { workspace, domainEvent, commandKey });
}

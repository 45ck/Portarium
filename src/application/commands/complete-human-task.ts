import { EvidenceId, HumanTaskId, WorkspaceId } from '../../domain/primitives/index.js';
import { completeHumanTaskV1, type HumanTaskV1 } from '../../domain/workforce/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  type AppContext,
  APP_ACTIONS,
  err,
  ok,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceEntryAppendInput,
  EvidenceLogPort,
  HumanTaskStore,
  IdGenerator,
  RunResumerPort,
  UnitOfWork,
  WorkforceMemberStore,
} from '../ports/index.js';

const COMPLETE_HUMAN_TASK_SOURCE = 'portarium.control-plane.workforce';

export type CompleteHumanTaskInput = Readonly<{
  workspaceId: string;
  humanTaskId: string;
  completionNote?: string;
}>;

export type CompleteHumanTaskOutput = Readonly<{
  humanTaskId: string;
  status: 'completed';
  completedByUserId: string;
  alreadyCompleted: boolean;
}>;

export type CompleteHumanTaskError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface CompleteHumanTaskDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  unitOfWork: UnitOfWork;
  humanTaskStore: HumanTaskStore;
  workforceMemberStore: WorkforceMemberStore;
  eventPublisher: EventPublisher;
  evidenceLog: EvidenceLogPort;
  runResumer: RunResumerPort;
}

type CompletionPlan = Readonly<{
  completedTask: HumanTaskV1;
  event: DomainEventV1;
  evidence: EvidenceEntryAppendInput;
}>;

function validateInput(input: CompleteHumanTaskInput): Result<true, ValidationFailed> {
  if (input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (input.humanTaskId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'humanTaskId must be a non-empty string.' });
  }
  if (input.completionNote?.trim() === '') {
    return err({
      kind: 'ValidationFailed',
      message: 'completionNote must be non-empty when provided.',
    });
  }
  return ok(true);
}

function nextId(
  idGenerator: IdGenerator,
  kind: 'event' | 'evidence',
): Result<string, DependencyFailure> {
  const value = idGenerator.generateId();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: `Unable to generate ${kind} identifier.` });
}

function nowIso(clock: Clock): Result<string, DependencyFailure> {
  const value = clock.nowIso();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
}

export class CompleteHumanTaskUseCase {
  public constructor(private readonly deps: CompleteHumanTaskDeps) {}

  public async execute(
    ctx: AppContext,
    input: CompleteHumanTaskInput,
  ): Promise<Result<CompleteHumanTaskOutput, CompleteHumanTaskError>> {
    const auth = await this.authorize(ctx);
    if (!auth.ok) return auth;

    const inputValidation = validateInput(input);
    if (!inputValidation.ok) return inputValidation;

    const taskResult = await this.loadTask(ctx, input);
    if (!taskResult.ok) return taskResult;

    if (taskResult.value.status === 'completed') {
      return ok({
        humanTaskId: taskResult.value.humanTaskId,
        status: 'completed',
        completedByUserId: taskResult.value.completedById ?? ctx.principalId,
        alreadyCompleted: true,
      });
    }

    const plan = await this.buildPlan(ctx, taskResult.value, input);
    if (!plan.ok) return plan;

    return this.persist(ctx, plan.value, input.completionNote);
  }

  private async authorize(ctx: AppContext): Promise<Result<true, Forbidden>> {
    const allowed = await this.deps.authorization.isAllowed(ctx, APP_ACTIONS.workforceComplete);
    if (allowed) return ok(true);
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workforceComplete,
      message: 'Caller is not permitted to complete human tasks.',
    });
  }

  private async loadTask(
    ctx: AppContext,
    input: CompleteHumanTaskInput,
  ): Promise<Result<HumanTaskV1, CompleteHumanTaskError>> {
    const workspaceId = WorkspaceId(input.workspaceId);
    if (workspaceId !== ctx.tenantId) {
      return err({
        kind: 'Forbidden',
        action: APP_ACTIONS.workforceComplete,
        message: 'Workspace mismatch in completion request.',
      });
    }

    const task = await this.deps.humanTaskStore.getHumanTaskById(
      ctx.tenantId,
      HumanTaskId(input.humanTaskId),
    );
    if (task !== null) return ok(task);

    return err({
      kind: 'NotFound',
      resource: 'HumanTask',
      message: `HumanTask ${input.humanTaskId} not found.`,
    });
  }

  private async buildPlan(
    ctx: AppContext,
    task: HumanTaskV1,
    input: CompleteHumanTaskInput,
  ): Promise<Result<CompletionPlan, CompleteHumanTaskError>> {
    if (!task.assigneeId) {
      return err({
        kind: 'Conflict',
        message: 'HumanTask has no assignee and cannot be completed.',
      });
    }

    const assignee = await this.deps.workforceMemberStore.getWorkforceMemberById(
      ctx.tenantId,
      task.assigneeId,
    );
    if (assignee === null) {
      return err({
        kind: 'NotFound',
        resource: 'WorkforceMember',
        message: `Assignee ${task.assigneeId} not found.`,
      });
    }
    if (assignee.linkedUserId !== ctx.principalId) {
      return err({
        kind: 'Forbidden',
        action: APP_ACTIONS.workforceComplete,
        message: 'Only the assigned workforce member may complete this human task.',
      });
    }

    const completedAtIso = nowIso(this.deps.clock);
    if (!completedAtIso.ok) return completedAtIso;
    const eventId = nextId(this.deps.idGenerator, 'event');
    if (!eventId.ok) return eventId;
    const evidenceId = nextId(this.deps.idGenerator, 'evidence');
    if (!evidenceId.ok) return evidenceId;

    const completedTask = completeHumanTaskV1({
      task,
      completedById: assignee.workforceMemberId,
      completedAt: completedAtIso.value,
      evidenceAnchorId: EvidenceId(evidenceId.value),
    });

    return ok({
      completedTask,
      event: this.buildEvent({
        ctx,
        task: completedTask,
        eventId: eventId.value,
        occurredAtIso: completedAtIso.value,
        completionNote: input.completionNote,
      }),
      evidence: this.buildEvidence(ctx, completedTask, evidenceId.value, completedAtIso.value),
    });
  }

  private buildEvent(args: {
    ctx: AppContext;
    task: HumanTaskV1;
    eventId: string;
    occurredAtIso: string;
    completionNote: string | undefined;
  }): DomainEventV1 {
    return {
      schemaVersion: 1,
      eventId: args.eventId,
      eventType: 'HumanTaskCompleted',
      aggregateKind: 'HumanTask',
      aggregateId: args.task.humanTaskId,
      occurredAtIso: args.occurredAtIso,
      workspaceId: args.ctx.tenantId,
      correlationId: args.ctx.correlationId,
      actorUserId: args.ctx.principalId,
      payload: {
        humanTaskId: args.task.humanTaskId,
        workItemId: args.task.workItemId,
        runId: args.task.runId,
        stepId: args.task.stepId,
        completedById: args.task.completedById,
        completionNote: args.completionNote,
      },
    };
  }

  private buildEvidence(
    ctx: AppContext,
    task: HumanTaskV1,
    evidenceId: string,
    occurredAtIso: string,
  ): EvidenceEntryAppendInput {
    return {
      schemaVersion: 1,
      evidenceId: EvidenceId(evidenceId),
      workspaceId: ctx.tenantId,
      correlationId: ctx.correlationId,
      occurredAtIso,
      category: 'Action',
      summary: `Completed human task ${task.humanTaskId}.`,
      actor: { kind: 'User', userId: ctx.principalId },
      links: { workItemId: task.workItemId, runId: task.runId },
    };
  }

  private async persist(
    ctx: AppContext,
    plan: CompletionPlan,
    completionNote: string | undefined,
  ): Promise<Result<CompleteHumanTaskOutput, DependencyFailure>> {
    try {
      return await this.deps.unitOfWork.execute(async () => {
        await this.deps.humanTaskStore.saveHumanTask(ctx.tenantId, plan.completedTask);
        await this.deps.eventPublisher.publish(
          domainEventToPortariumCloudEvent(plan.event, COMPLETE_HUMAN_TASK_SOURCE),
        );
        await this.deps.evidenceLog.appendEntry(ctx.tenantId, plan.evidence);
        await this.deps.runResumer.resumeRunFromHumanTask({
          tenantId: ctx.tenantId,
          runId: plan.completedTask.runId,
          humanTaskId: plan.completedTask.humanTaskId,
          completedByUserId: ctx.principalId,
          correlationId: ctx.correlationId,
          ...(completionNote ? { completionNote } : {}),
        });

        return ok({
          humanTaskId: plan.completedTask.humanTaskId,
          status: 'completed',
          completedByUserId: ctx.principalId,
          alreadyCompleted: false,
        });
      });
    } catch (error) {
      return err({
        kind: 'DependencyFailure',
        message: error instanceof Error ? error.message : 'Failed to complete human task.',
      });
    }
  }
}

export async function completeHumanTask(
  deps: CompleteHumanTaskDeps,
  ctx: AppContext,
  input: CompleteHumanTaskInput,
): Promise<Result<CompleteHumanTaskOutput, CompleteHumanTaskError>> {
  return new CompleteHumanTaskUseCase(deps).execute(ctx, input);
}

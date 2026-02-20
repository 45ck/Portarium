import {
  HumanTaskId,
  WorkItemId,
  WorkforceMemberId,
  WorkforceQueueId,
  type HumanTaskId as HumanTaskIdType,
  type UserId,
  type WorkItemId as WorkItemIdType,
  type WorkforceMemberId as WorkforceMemberIdType,
} from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  assignHumanTaskV1,
  routeHumanTaskToQueueV1,
  type HumanTaskV1,
  type WorkforceMemberV1,
} from '../../domain/workforce/index.js';
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
  UnitOfWork,
  WorkforceMemberStore,
  WorkforceQueueStore,
  WorkItemStore,
} from '../ports/index.js';
import {
  buildAssignmentArtifacts,
  ensureCapabilitiesCovered,
  ensureMemberAvailable,
  type ParsedAssignInput,
  validateAssignInput,
} from './assign-workforce-member.helpers.js';

const ASSIGN_WORKFORCE_SOURCE = 'portarium.control-plane.workforce';

export type AssignWorkforceMemberInput = Readonly<{
  workspaceId: string;
  target:
    | Readonly<{
        kind: 'WorkItem';
        workItemId: string;
        workforceMemberId: string;
      }>
    | Readonly<{
        kind: 'HumanTask';
        humanTaskId: string;
        workforceMemberId?: string;
        workforceQueueId?: string;
      }>;
}>;

export type AssignWorkforceMemberOutput = Readonly<{
  targetKind: 'WorkItem' | 'HumanTask';
  targetId: WorkItemIdType | HumanTaskIdType;
  workforceMemberId: WorkforceMemberIdType;
  ownerUserId: UserId;
}>;

export type AssignWorkforceMemberError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface AssignWorkforceMemberDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  unitOfWork: UnitOfWork;
  workItemStore: WorkItemStore;
  humanTaskStore: HumanTaskStore;
  workforceMemberStore: WorkforceMemberStore;
  workforceQueueStore: WorkforceQueueStore;
  eventPublisher: EventPublisher;
  evidenceLog: EvidenceLogPort;
}

type AssignPlan = Readonly<{
  targetKind: 'WorkItem' | 'HumanTask';
  targetId: WorkItemIdType | HumanTaskIdType;
  workforceMemberId: WorkforceMemberIdType;
  ownerUserId: UserId;
  save: () => Promise<void>;
  event: DomainEventV1;
  evidence: EvidenceEntryAppendInput;
}>;

export class AssignWorkforceMemberUseCase {
  public constructor(private readonly deps: AssignWorkforceMemberDeps) {}

  public async execute(
    ctx: AppContext,
    input: AssignWorkforceMemberInput,
  ): Promise<Result<AssignWorkforceMemberOutput, AssignWorkforceMemberError>> {
    const allowed = await this.deps.authorization.isAllowed(ctx, APP_ACTIONS.workforceAssign);
    if (!allowed) {
      return err({
        kind: 'Forbidden',
        action: APP_ACTIONS.workforceAssign,
        message: 'Caller is not permitted to assign workforce members.',
      });
    }

    const parsed = validateAssignInput(input);
    if (!parsed.ok) return parsed;

    const plan =
      parsed.value.target.kind === 'WorkItem'
        ? await this.buildWorkItemPlan(ctx, parsed.value)
        : await this.buildHumanTaskPlan(ctx, parsed.value);
    if (!plan.ok) return plan;

    try {
      return await this.deps.unitOfWork.execute(async () => {
        await plan.value.save();
        await this.deps.eventPublisher.publish(
          domainEventToPortariumCloudEvent(plan.value.event, ASSIGN_WORKFORCE_SOURCE),
        );
        await this.deps.evidenceLog.appendEntry(ctx.tenantId, plan.value.evidence);
        return ok({
          targetKind: plan.value.targetKind,
          targetId: plan.value.targetId,
          workforceMemberId: plan.value.workforceMemberId,
          ownerUserId: plan.value.ownerUserId,
        });
      });
    } catch (error) {
      return err({
        kind: 'DependencyFailure',
        message: error instanceof Error ? error.message : 'Failed to persist workforce assignment.',
      });
    }
  }

  private async buildWorkItemPlan(
    ctx: AppContext,
    parsed: ParsedAssignInput,
  ): Promise<Result<AssignPlan, AssignWorkforceMemberError>> {
    if (parsed.target.kind !== 'WorkItem') {
      return err({ kind: 'ValidationFailed', message: 'Invalid target kind for WorkItem plan.' });
    }

    const member = await this.deps.workforceMemberStore.getWorkforceMemberById(
      ctx.tenantId,
      WorkforceMemberId(parsed.target.workforceMemberId),
    );
    if (member === null) {
      return err({
        kind: 'NotFound',
        resource: 'WorkforceMember',
        message: `WorkforceMember ${parsed.target.workforceMemberId} not found.`,
      });
    }

    const memberAvailability = ensureMemberAvailable(member.availabilityStatus);
    if (!memberAvailability.ok) return memberAvailability;

    const workItem = await this.deps.workItemStore.getWorkItemById(
      ctx.tenantId,
      parsed.workspaceId,
      WorkItemId(parsed.target.workItemId),
    );
    if (workItem === null) {
      return err({
        kind: 'NotFound',
        resource: 'WorkItem',
        message: `WorkItem ${parsed.target.workItemId} not found.`,
      });
    }

    if (this.isOperatorWithoutAdmin(ctx) && workItem.ownerUserId !== ctx.principalId) {
      return err({
        kind: 'Forbidden',
        action: APP_ACTIONS.workforceAssign,
        message: 'Operators may only assign workforce members to WorkItems they own.',
      });
    }

    const artifacts = buildAssignmentArtifacts(ctx, {
      clock: this.deps.clock,
      idGenerator: this.deps.idGenerator,
      targetKind: 'WorkItem',
      targetId: workItem.workItemId,
      workforceMemberId: member.workforceMemberId,
      ownerUserId: member.linkedUserId,
      aggregateKind: 'WorkItem',
      aggregateId: workItem.workItemId,
      eventPayload: {
        workItemId: workItem.workItemId,
        workforceMemberId: member.workforceMemberId,
        ownerUserId: member.linkedUserId,
      },
      summary: `Assigned workforce member ${member.workforceMemberId} to work item ${workItem.workItemId}.`,
      links: { workItemId: workItem.workItemId },
    });
    if (!artifacts.ok) return artifacts;

    return ok({
      ...artifacts.value,
      save: async () =>
        this.deps.workItemStore.saveWorkItem(ctx.tenantId, {
          ...workItem,
          ownerUserId: member.linkedUserId,
        }),
    });
  }

  private async buildHumanTaskPlan(
    ctx: AppContext,
    parsed: ParsedAssignInput,
  ): Promise<Result<AssignPlan, AssignWorkforceMemberError>> {
    if (parsed.target.kind !== 'HumanTask') {
      return err({ kind: 'ValidationFailed', message: 'Invalid target kind for HumanTask plan.' });
    }

    const task = await this.deps.humanTaskStore.getHumanTaskById(
      ctx.tenantId,
      HumanTaskId(parsed.target.humanTaskId),
    );
    if (task === null) {
      return err({
        kind: 'NotFound',
        resource: 'HumanTask',
        message: `HumanTask ${parsed.target.humanTaskId} not found.`,
      });
    }
    if (task.status !== 'pending') {
      return err({
        kind: 'Conflict',
        message: `HumanTask ${parsed.target.humanTaskId} must be pending for assignment.`,
      });
    }

    const member = await this.resolveHumanTaskMember(ctx, task, parsed.target);
    if (!member.ok) return member;

    const availability = ensureMemberAvailable(member.value.availabilityStatus);
    if (!availability.ok) return availability;

    const capabilityCoverage = ensureCapabilitiesCovered(
      member.value.capabilities,
      task.requiredCapabilities,
    );
    if (!capabilityCoverage.ok) return capabilityCoverage;

    if (
      parsed.target.workforceQueueId &&
      !member.value.queueMemberships.includes(WorkforceQueueId(parsed.target.workforceQueueId))
    ) {
      return err({
        kind: 'Conflict',
        message: `Workforce member ${member.value.workforceMemberId} is not in queue ${parsed.target.workforceQueueId}.`,
      });
    }

    const nextTask = assignHumanTaskV1({ task, assigneeId: member.value.workforceMemberId });
    const artifacts = buildAssignmentArtifacts(ctx, {
      clock: this.deps.clock,
      idGenerator: this.deps.idGenerator,
      targetKind: 'HumanTask',
      targetId: task.humanTaskId,
      workforceMemberId: member.value.workforceMemberId,
      ownerUserId: member.value.linkedUserId,
      aggregateKind: 'HumanTask',
      aggregateId: task.humanTaskId,
      eventPayload: {
        humanTaskId: task.humanTaskId,
        workItemId: task.workItemId,
        runId: task.runId,
        stepId: task.stepId,
        workforceMemberId: member.value.workforceMemberId,
        queueRouting: parsed.target.workforceMemberId === undefined,
      },
      summary: `Assigned workforce member ${member.value.workforceMemberId} to human task ${task.humanTaskId}.`,
      links: { workItemId: task.workItemId, runId: task.runId },
    });
    if (!artifacts.ok) return artifacts;

    return ok({
      ...artifacts.value,
      save: async () => this.deps.humanTaskStore.saveHumanTask(ctx.tenantId, nextTask),
    });
  }

  private async resolveHumanTaskMember(
    ctx: AppContext,
    task: HumanTaskV1,
    target: Extract<AssignWorkforceMemberInput['target'], { kind: 'HumanTask' }>,
  ): Promise<Result<WorkforceMemberV1, AssignWorkforceMemberError>> {
    if (target.workforceMemberId) {
      const member = await this.deps.workforceMemberStore.getWorkforceMemberById(
        ctx.tenantId,
        WorkforceMemberId(target.workforceMemberId),
      );
      if (member !== null) return ok(member);
      return err({
        kind: 'NotFound',
        resource: 'WorkforceMember',
        message: `WorkforceMember ${target.workforceMemberId} not found.`,
      });
    }

    const queueId = WorkforceQueueId(target.workforceQueueId!);
    const queue = await this.deps.workforceQueueStore.getWorkforceQueueById(ctx.tenantId, queueId);
    if (queue === null) {
      return err({
        kind: 'NotFound',
        resource: 'WorkforceQueue',
        message: `WorkforceQueue ${target.workforceQueueId} not found.`,
      });
    }

    const members = await this.deps.workforceMemberStore.listWorkforceMembersByIds(
      ctx.tenantId,
      queue.memberIds,
    );
    const routed = routeHumanTaskToQueueV1({ queue, task, members });
    if (routed.stayedPending || !routed.selectedMemberId) {
      return err({
        kind: 'Conflict',
        message: `No available workforce member could be routed for queue ${queue.workforceQueueId}.`,
      });
    }

    const selected = members.find((entry) => entry.workforceMemberId === routed.selectedMemberId);
    if (selected) return ok(selected);
    return err({
      kind: 'DependencyFailure',
      message: 'Queue routing selected a member that was not loaded.',
    });
  }

  private isOperatorWithoutAdmin(ctx: AppContext): boolean {
    return ctx.roles.includes('operator') && !ctx.roles.includes('admin');
  }
}

export async function assignWorkforceMember(
  deps: AssignWorkforceMemberDeps,
  ctx: AppContext,
  input: AssignWorkforceMemberInput,
): Promise<Result<AssignWorkforceMemberOutput, AssignWorkforceMemberError>> {
  return new AssignWorkforceMemberUseCase(deps).execute(ctx, input);
}

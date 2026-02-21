import type {
  HumanTaskId as HumanTaskIdType,
  UserId,
  WorkItemId as WorkItemIdType,
  WorkforceMemberId as WorkforceMemberIdType,
} from '../../domain/primitives/index.js';
import type {
  Clock,
  EventPublisher,
  EvidenceLogPort,
  HumanTaskStore,
  IdGenerator,
  UnitOfWork,
  WorkforceMemberStore,
  WorkforceQueueStore,
  WorkItemStore,
  AuthorizationPort,
} from '../ports/index.js';
import type {
  Conflict,
  DependencyFailure,
  Forbidden,
  NotFound,
  ValidationFailed,
} from '../common/index.js';

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

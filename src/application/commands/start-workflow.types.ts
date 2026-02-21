import type {
  RunId as RunIdType,
  WorkspaceId as WorkspaceIdType,
  WorkflowId as WorkflowIdType,
} from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
import type { WorkflowTriggerV1 } from '../../domain/schedule/index.js';
import type { WorkflowV1 } from '../../domain/workflows/index.js';
import type {
  AdapterRegistrationStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
} from '../ports/index.js';
import type { TriggerExecutionRouterPort } from '../services/trigger-execution-router.js';
import type {
  Conflict,
  DependencyFailure,
  Forbidden,
  NotFound,
  ValidationFailed,
} from '../common/index.js';

export type StartWorkflowInput = Readonly<{
  idempotencyKey: string;
  workspaceId: string;
  workflowId: string;
  trigger?: unknown;
}>;

export type StartWorkflowOutput = Readonly<{
  runId: RunIdType;
}>;

export type StartWorkflowError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface StartWorkflowDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  idempotency: IdempotencyStore;
  unitOfWork: UnitOfWork;
  workflowStore: WorkflowStore;
  adapterRegistrationStore: AdapterRegistrationStore;
  runStore: RunStore;
  orchestrator: WorkflowOrchestrator;
  eventPublisher: EventPublisher;
  triggerRouter?: TriggerExecutionRouterPort;
}

export type ParsedIds = Readonly<{ workspaceId: WorkspaceIdType; workflowId: WorkflowIdType }>;
export type GeneratedValues = Readonly<{
  runIdValue: string;
  createdAtIso: string;
  eventIdValue: string;
}>;

export type NewStartWorkflowPlan = Readonly<{
  kind: 'new';
  ids: ParsedIds;
  workflow: WorkflowV1;
  generated: GeneratedValues;
  run: RunV1;
  commandKey: IdempotencyKey;
  trigger?: WorkflowTriggerV1;
}>;

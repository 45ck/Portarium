import {
  CorrelationId,
  UserId,
  type CorrelationId as CorrelationIdType,
  type UserId as UserIdType,
} from '../primitives/index.js';
import {
  readInteger,
  readIsoString,
  readOptionalRecordField,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type DomainEventType =
  // Workspace aggregate
  | 'WorkspaceCreated'
  | 'WorkspaceUpdated'
  | 'WorkspaceDeleted'
  | 'UserAdded'
  | 'UserRemoved'
  | 'UserRolesUpdated'
  | 'ProjectCreated'
  | 'CredentialGrantIssued'
  | 'CredentialGrantRotated'
  | 'CredentialGrantRevoked'
  // Workflow aggregate
  | 'WorkflowCreated'
  | 'WorkflowUpdated'
  | 'WorkflowActivated'
  | 'WorkflowDeactivated'
  | 'WorkflowVersionIncremented'
  | 'ActionAddedToWorkflow'
  | 'ActionRemovedFromWorkflow'
  | 'ActionReordered'
  // Run aggregate
  | 'RunStarted'
  | 'RunSucceeded'
  | 'RunFailed'
  | 'RunCancelled'
  | 'RunPaused'
  | 'RunResumed'
  | 'PlanGenerated'
  | 'DiffComputed'
  | 'EvidenceRecorded'
  | 'ArtifactProduced'
  | 'ActionDispatched'
  | 'ActionCompleted'
  | 'ActionFailed'
  // Approval
  | 'ApprovalRequested'
  | 'ApprovalGranted'
  | 'ApprovalDenied'
  // Policy aggregate
  | 'PolicyCreated'
  | 'PolicyUpdated'
  | 'PolicyActivated'
  | 'PolicyDeactivated'
  | 'PolicyVersionIncremented'
  | 'SodConstraintAdded'
  | 'SodConstraintRemoved'
  | 'PolicyEvaluated'
  | 'SodViolationDetected'
  // Adapter aggregate
  | 'AdapterRegistered'
  | 'AdapterEnabled'
  | 'AdapterDisabled'
  | 'AdapterCapabilitiesUpdated'
  | 'AdapterUpgraded'
  | 'MachineRegistered'
  | 'MachineDeregistered'
  | 'MachineEndpointUpdated'
  // Port
  | 'PortRegistered'
  | 'PortEnabled'
  | 'PortDisabled'
  // Pack lifecycle
  | 'PackEnabled'
  | 'PackDisabled'
  | 'PackUpgraded'
  | 'PackResolutionCompleted'
  // Tenant config
  | 'TenantConfigUpdated'
  | 'FeatureFlagToggled'
  | 'ComplianceProfileEnabled'
  // Triggers
  | 'TriggerCreated'
  | 'TriggerActivated'
  | 'TriggerDeactivated'
  | 'TriggerFired'
  // Work item extended
  | 'WorkItemTransitioned'
  // Catch-all
  | 'Unknown';

export type DomainEventV1 = Readonly<{
  schemaVersion: 1;
  eventId: string;
  eventType: DomainEventType;
  aggregateKind: string;
  aggregateId: string;
  occurredAtIso: string;
  actorUserId?: UserIdType;
  correlationId?: CorrelationIdType;
  payload?: unknown;
}>;

export class DomainEventParseError extends Error {
  public override readonly name = 'DomainEventParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EVENT_TYPES = new Set<DomainEventType>([
  // Workspace aggregate
  'WorkspaceCreated',
  'WorkspaceUpdated',
  'WorkspaceDeleted',
  'UserAdded',
  'UserRemoved',
  'UserRolesUpdated',
  'ProjectCreated',
  'CredentialGrantIssued',
  'CredentialGrantRotated',
  'CredentialGrantRevoked',
  // Workflow aggregate
  'WorkflowCreated',
  'WorkflowUpdated',
  'WorkflowActivated',
  'WorkflowDeactivated',
  'WorkflowVersionIncremented',
  'ActionAddedToWorkflow',
  'ActionRemovedFromWorkflow',
  'ActionReordered',
  // Run aggregate
  'RunStarted',
  'RunSucceeded',
  'RunFailed',
  'RunCancelled',
  'RunPaused',
  'RunResumed',
  'PlanGenerated',
  'DiffComputed',
  'EvidenceRecorded',
  'ArtifactProduced',
  'ActionDispatched',
  'ActionCompleted',
  'ActionFailed',
  // Approval
  'ApprovalRequested',
  'ApprovalGranted',
  'ApprovalDenied',
  // Policy aggregate
  'PolicyCreated',
  'PolicyUpdated',
  'PolicyActivated',
  'PolicyDeactivated',
  'PolicyVersionIncremented',
  'SodConstraintAdded',
  'SodConstraintRemoved',
  'PolicyEvaluated',
  'SodViolationDetected',
  // Adapter aggregate
  'AdapterRegistered',
  'AdapterEnabled',
  'AdapterDisabled',
  'AdapterCapabilitiesUpdated',
  'AdapterUpgraded',
  'MachineRegistered',
  'MachineDeregistered',
  'MachineEndpointUpdated',
  // Port
  'PortRegistered',
  'PortEnabled',
  'PortDisabled',
  // Pack lifecycle
  'PackEnabled',
  'PackDisabled',
  'PackUpgraded',
  'PackResolutionCompleted',
  // Tenant config
  'TenantConfigUpdated',
  'FeatureFlagToggled',
  'ComplianceProfileEnabled',
  // Triggers
  'TriggerCreated',
  'TriggerActivated',
  'TriggerDeactivated',
  'TriggerFired',
  // Work item extended
  'WorkItemTransitioned',
  // Catch-all
  'Unknown',
]);

export function parseDomainEventV1(value: unknown): DomainEventV1 {
  const record = readRecord(value, 'DomainEventV1', DomainEventParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', DomainEventParseError);
  if (schemaVersion !== 1) {
    throw new DomainEventParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const eventId = readString(record, 'eventId', DomainEventParseError);
  const eventType = readEventType(record, 'eventType');
  const aggregateKind = readString(record, 'aggregateKind', DomainEventParseError);
  const aggregateId = readString(record, 'aggregateId', DomainEventParseError);
  const occurredAtIso = readIsoString(record, 'occurredAtIso', DomainEventParseError);

  const actorUserIdRaw = readOptionalString(record, 'actorUserId', DomainEventParseError);
  const actorUserId = actorUserIdRaw === undefined ? undefined : UserId(actorUserIdRaw);

  const correlationIdRaw = readOptionalString(record, 'correlationId', DomainEventParseError);
  const correlationId =
    correlationIdRaw === undefined ? undefined : CorrelationId(correlationIdRaw);

  const payload = readOptionalRecordField(record, 'payload', DomainEventParseError);

  return {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind,
    aggregateId,
    occurredAtIso,
    ...(actorUserId ? { actorUserId } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(payload !== undefined ? { payload } : {}),
  };
}

function readEventType(record: Record<string, unknown>, key: string): DomainEventType {
  const raw = readString(record, key, DomainEventParseError);
  if (!EVENT_TYPES.has(raw as DomainEventType)) {
    throw new DomainEventParseError('eventType is not a recognised DomainEventType.');
  }
  return raw as DomainEventType;
}

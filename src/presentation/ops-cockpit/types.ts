export type CursorToken = string;

export type EffectOperation = 'Create' | 'Update' | 'Delete' | 'Upsert';

export interface ExternalObjectRef {
  sorName: string;
  portFamily: string;
  externalId: string;
  externalType: string;
  displayLabel?: string;
  deepLinkUrl?: string;
}

export interface PlanEffect {
  effectId: string;
  operation: EffectOperation;
  target: ExternalObjectRef;
  summary: string;
  idempotencyKey?: string;
}

export interface PredictedPlanEffect extends PlanEffect {
  confidence?: number;
}

export interface Plan {
  schemaVersion: number;
  planId: string;
  workspaceId: string;
  createdAtIso: string;
  createdByUserId: string;
  plannedEffects: PlanEffect[];
  predictedEffects?: PredictedPlanEffect[];
}

export interface PlanSection {
  title: string;
  guidance: string;
  effects: PlanEffect[];
}

export type RunStatus =
  | 'Pending'
  | 'Running'
  | 'WaitingForApproval'
  | 'Paused'
  | 'Succeeded'
  | 'Failed'
  | 'Cancelled';

export interface RunSummary {
  schemaVersion: number;
  runId: string;
  workspaceId: string;
  workflowId: string;
  correlationId: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  initiatedByUserId: string;
  status: RunStatus;
  createdAtIso: string;
  startedAtIso?: string;
  endedAtIso?: string;
  agentIds?: string[];
  robotIds?: string[];
  workforceMemberIds?: string[];
}

export type RunDetail = RunSummary;

export type WorkflowTriggerKind = 'Manual' | 'Cron' | 'Webhook' | 'DomainEvent';

export interface WorkflowActionSummary {
  actionId: string;
  order: number;
  portFamily: string;
  operation: string;
  executionTierOverride?: RunSummary['executionTier'];
}

export interface WorkflowRetryPolicy {
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}

export interface WorkflowSummary {
  schemaVersion: number;
  workflowId: string;
  workspaceId: string;
  name: string;
  description?: string;
  version: number;
  active: boolean;
  executionTier: RunSummary['executionTier'];
  actions: WorkflowActionSummary[];
  triggerKind?: WorkflowTriggerKind;
  timeoutMs?: number;
  retryPolicy?: WorkflowRetryPolicy;
  compensationMode?: 'best-effort' | 'strict' | 'none';
}

export type WorkflowDetail = WorkflowSummary;

export interface WorkItemSla {
  dueAtIso?: string;
}

export interface WorkItemLinks {
  externalRefs?: ExternalObjectRef[];
  runIds?: string[];
  workflowIds?: string[];
  approvalIds?: string[];
  evidenceIds?: string[];
}

export interface WorkItemSummary {
  schemaVersion: number;
  workItemId: string;
  workspaceId: string;
  createdAtIso: string;
  createdByUserId: string;
  title: string;
  status: 'Open' | 'Closed';
  ownerUserId?: string;
  sla?: WorkItemSla;
  links?: WorkItemLinks;
}

export type EvidenceCategory = 'Plan' | 'Action' | 'Approval' | 'Policy' | 'System';

export interface EvidenceLinks {
  runId?: string;
  planId?: string;
  workItemId?: string;
  externalRefs?: ExternalObjectRef[];
}

export interface EvidencePayloadRef {
  kind: 'Artifact' | 'Snapshot' | 'Diff' | 'Log';
  uri: string;
  contentType?: string;
  sha256?: string;
}

export interface EvidenceActorUser {
  kind: 'User';
  userId: string;
}

export interface EvidenceActorMachine {
  kind: 'Machine';
  machineId: string;
}

export interface EvidenceActorAdapter {
  kind: 'Adapter';
  adapterId: string;
}

export interface EvidenceActorSystem {
  kind: 'System';
}

export type EvidenceActor =
  | EvidenceActorUser
  | EvidenceActorMachine
  | EvidenceActorAdapter
  | EvidenceActorSystem;

export interface EvidenceEntry {
  schemaVersion: number;
  evidenceId: string;
  workspaceId: string;
  occurredAtIso: string;
  category: EvidenceCategory;
  summary: string;
  actor: EvidenceActor;
  links?: EvidenceLinks;
  payloadRefs?: EvidencePayloadRef[];
  previousHash?: string;
  hashSha256: string;
}

export type ApprovalStatus = 'Pending' | 'Approved' | 'Denied' | 'RequestChanges';

export type SodState = 'eligible' | 'blocked-self' | 'blocked-role' | 'n-of-m';

export interface SodEvaluation {
  state: SodState;
  requestorId: string;
  ruleId: string;
  rolesRequired: string[];
  nRequired?: number;
  nTotal?: number;
  nSoFar?: number;
}

export interface PolicyRule {
  ruleId: string;
  trigger: string;
  tier: string;
  blastRadius: string[];
  irreversibility: 'full' | 'partial' | 'none';
}

export interface DecisionHistoryEntry {
  timestamp: string;
  type: 'requested' | 'changes_requested' | 'resubmitted';
  actor: string;
  message: string;
}

export interface ApprovalSummary {
  schemaVersion: number;
  approvalId: string;
  workspaceId: string;
  runId: string;
  planId: string;
  workItemId?: string;
  prompt: string;
  status: ApprovalStatus;
  requestedAtIso: string;
  requestedByUserId: string;
  assigneeUserId?: string;
  dueAtIso?: string;
  decidedAtIso?: string;
  decidedByUserId?: string;
  rationale?: string;
  sodEvaluation?: SodEvaluation;
  policyRule?: PolicyRule;
  decisionHistory?: DecisionHistoryEntry[];
}

export interface CredentialGrantV1 {
  schemaVersion: 1;
  credentialGrantId: string;
  workspaceId: string;
  adapterId: string;
  credentialsRef: string;
  scope: string;
  issuedAtIso: string;
  expiresAtIso?: string;
  lastRotatedAtIso?: string;
  revokedAtIso?: string;
}

export interface CreateCredentialGrantRequest {
  adapterId: string;
  credentialsRef: string;
  scope: string;
  expiresAtIso?: string;
}

export type WorkforceAvailabilityStatus = 'available' | 'busy' | 'offline';

export type WorkforceCapability =
  | 'operations.dispatch'
  | 'operations.approval'
  | 'operations.escalation'
  | 'robotics.supervision'
  | 'robotics.safety.override';

export interface WorkforceMemberSummary {
  schemaVersion: 1;
  workforceMemberId: string;
  linkedUserId: string;
  displayName: string;
  capabilities: WorkforceCapability[];
  availabilityStatus: WorkforceAvailabilityStatus;
  queueMemberships: string[];
  tenantId: string;
  createdAtIso: string;
  updatedAtIso?: string;
}

export interface WorkforceQueueSummary {
  schemaVersion: 1;
  workforceQueueId: string;
  name: string;
  requiredCapabilities: WorkforceCapability[];
  memberIds: string[];
  routingStrategy: 'round-robin' | 'least-busy' | 'manual';
  tenantId: string;
}

export type HumanTaskStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'escalated';

export interface HumanTaskSummary {
  schemaVersion: 1;
  humanTaskId: string;
  workItemId: string;
  runId: string;
  stepId: string;
  assigneeId?: string;
  groupId?: string;
  description: string;
  requiredCapabilities: WorkforceCapability[];
  status: HumanTaskStatus;
  dueAt?: string;
  completedAt?: string;
  completedById?: string;
  evidenceAnchorId?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: CursorToken;
}

export interface CursorPaginationRequest {
  limit?: number;
  cursor?: CursorToken;
}

export interface ListRunsRequest extends CursorPaginationRequest {
  status?: RunStatus;
  workflowId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
  sort?: string;
  q?: string;
}

export interface ListWorkItemsRequest extends CursorPaginationRequest {
  status?: WorkItemSummary['status'];
  ownerUserId?: string;
  runId?: string;
  workflowId?: string;
  approvalId?: string;
  evidenceId?: string;
}

export type ListApprovalsRequest = CursorPaginationRequest;

export interface ListEvidenceRequest extends CursorPaginationRequest {
  runId?: string;
  planId?: string;
  workItemId?: string;
  category?: EvidenceCategory;
}

export interface ListWorkforceMembersRequest extends CursorPaginationRequest {
  capability?: WorkforceCapability;
  queueId?: string;
  availability?: WorkforceAvailabilityStatus;
}

export interface ListWorkforceQueuesRequest extends CursorPaginationRequest {
  capability?: WorkforceCapability;
}

export interface PatchWorkforceAvailabilityRequest {
  availabilityStatus: WorkforceAvailabilityStatus;
}

export interface ListHumanTasksRequest extends CursorPaginationRequest {
  assigneeId?: string;
  status?: HumanTaskStatus;
  runId?: string;
}

export * from './types.commands.js';
export * from './types.machines.js';

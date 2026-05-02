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

export type IntentTriggerSource = 'Human' | 'Ops' | 'Agent';

export interface ProjectIntent {
  schemaVersion: 1;
  intentId: string;
  workspaceId: string;
  createdAtIso: string;
  createdByUserId: string;
  source: IntentTriggerSource;
  prompt: string;
  normalizedGoal: string;
  constraints: string[];
}

export interface BeadProposal {
  schemaVersion: 1;
  proposalId: string;
  title: string;
  body: string;
  executionTier: RunSummary['executionTier'];
  specRef: string;
  dependsOnProposalIds: string[];
  plannedEffectIds: string[];
}

export interface PlanArtifact {
  schemaVersion: 1;
  artifactId: string;
  title: string;
  markdown: string;
}

export interface IntentPlanRequest {
  triggerText: string;
  source?: IntentTriggerSource;
  constraints?: string[];
}

export interface IntentPlanResponse {
  intent: ProjectIntent;
  plan: Plan;
  proposals: BeadProposal[];
  artifact: PlanArtifact;
}

export interface CockpitExtensionContextResponse {
  schemaVersion: 1;
  workspaceId: string;
  principalId: string;
  persona?: string;
  availablePersonas: string[];
  availableCapabilities: string[];
  availableApiScopes: string[];
  availablePrivacyClasses: string[];
  activePackIds: string[];
  quarantinedExtensionIds: string[];
  issuedAtIso: string;
  expiresAtIso: string;
}

export type RunStatus =
  | 'Pending'
  | 'Running'
  | 'WaitingForApproval'
  | 'Paused'
  | 'Succeeded'
  | 'Failed'
  | 'Cancelled';

export type RunControlState = 'waiting' | 'blocked' | 'degraded' | 'frozen' | 'operator-owned';

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
  controlState?: RunControlState;
  operatorOwnerId?: string;
  agentIds?: string[];
  robotIds?: string[];
  workforceMemberIds?: string[];
}

export type RunDetail = RunSummary;

export type RunInterventionKind =
  | 'pause'
  | 'resume'
  | 'reroute'
  | 'handoff'
  | 'escalate'
  | 'annotate'
  | 'request-evidence'
  | 'request-more-evidence'
  | 'freeze'
  | 'sandbox'
  | 'emergency-disable';

export type OperatorInputEffect =
  | 'current-run-effect'
  | 'approval-gate-effect'
  | 'future-policy-effect'
  | 'workspace-safety-effect'
  | 'context-only';

export type RunInterventionSurface =
  | 'monitoring'
  | 'steering'
  | 'approval'
  | 'policy-change'
  | 'emergency';

export type RunInterventionAuthoritySource =
  | 'workspace-rbac'
  | 'policy-rule'
  | 'run-charter'
  | 'queue-delegation'
  | 'incident-break-glass'
  | 'system-invariant'
  | 'policy-change-approval';

export interface RunInterventionRequest {
  interventionType: RunInterventionKind;
  rationale: string;
  target?: string;
  surface?: RunInterventionSurface;
  authoritySource?: RunInterventionAuthoritySource;
  effect?: OperatorInputEffect;
  consequence?: string;
  evidenceRequired?: boolean;
}

export interface StartRunRequest {
  workflowId: string;
  parameters?: Record<string, unknown>;
}

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

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  executionTier?: RunSummary['executionTier'];
  active?: boolean;
  actions?: WorkflowActionSummary[];
}

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
  status: 'Open' | 'InProgress' | 'Blocked' | 'Resolved' | 'Closed';
  ownerUserId?: string;
  sla?: WorkItemSla;
  links?: WorkItemLinks;
}

export type EvidenceCategory =
  | 'Plan'
  | 'Action'
  | 'Approval'
  | 'OperatorSurface'
  | 'Policy'
  | 'PolicyViolation'
  | 'System';

export interface EvidenceLinks {
  runId?: string;
  planId?: string;
  workItemId?: string;
  approvalId?: string;
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

export type OperatorSurfaceKind = 'Card' | 'Form' | 'Panel';
export type OperatorSurfaceLifecycleStatus = 'Proposed' | 'Approved' | 'Rendered' | 'Used';
export type OperatorSurfaceIntentKind = 'Intent' | 'Taste' | 'Insight';
export type OperatorSurfaceTextTone = 'neutral' | 'info' | 'warning' | 'success' | 'critical';
export type OperatorSurfaceFieldWidget = 'text' | 'textarea' | 'select' | 'checkbox' | 'number';

export type OperatorSurfaceContext =
  | { kind: 'Run'; runId: string }
  | { kind: 'Approval'; runId: string; approvalId: string };

export type OperatorSurfaceActor =
  | { kind: 'Machine'; machineId: string }
  | { kind: 'User'; userId: string }
  | { kind: 'System' };

export interface OperatorSurfaceAttribution {
  proposedBy: OperatorSurfaceActor;
  proposedAtIso: string;
  rationale: string;
}

export interface OperatorSurfaceLifecycle {
  status: OperatorSurfaceLifecycleStatus;
  proposedAtIso: string;
  approvedAtIso?: string;
  approvedByUserId?: string;
  renderedAtIso?: string;
  renderedByUserId?: string;
  usedAtIso?: string;
  usedByUserId?: string;
  evidenceIds?: string[];
}

export interface OperatorSurfaceTextBlock {
  blockType: 'text';
  text: string;
  tone?: OperatorSurfaceTextTone;
}

export interface OperatorSurfaceKeyValueItem {
  label: string;
  value: string;
}

export interface OperatorSurfaceKeyValueListBlock {
  blockType: 'keyValueList';
  items: OperatorSurfaceKeyValueItem[];
}

export interface OperatorSurfaceMetricBlock {
  blockType: 'metric';
  label: string;
  value: string;
  unit?: string;
  tone?: OperatorSurfaceTextTone;
}

export interface OperatorSurfaceSelectOption {
  value: string;
  label: string;
}

export interface OperatorSurfaceField {
  fieldId: string;
  label: string;
  widget: OperatorSurfaceFieldWidget;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: OperatorSurfaceSelectOption[];
}

export interface OperatorSurfaceFormBlock {
  blockType: 'form';
  fields: OperatorSurfaceField[];
}

export interface OperatorSurfaceAction {
  actionId: string;
  label: string;
  intentKind: OperatorSurfaceIntentKind;
  submitsForm?: boolean;
}

export interface OperatorSurfaceActionsBlock {
  blockType: 'actions';
  actions: OperatorSurfaceAction[];
}

export type OperatorSurfaceBlock =
  | OperatorSurfaceTextBlock
  | OperatorSurfaceKeyValueListBlock
  | OperatorSurfaceMetricBlock
  | OperatorSurfaceFormBlock
  | OperatorSurfaceActionsBlock;

export interface OperatorSurface {
  schemaVersion: 1;
  surfaceId: string;
  workspaceId: string;
  correlationId: string;
  surfaceKind: OperatorSurfaceKind;
  context: OperatorSurfaceContext;
  title: string;
  description?: string;
  attribution: OperatorSurfaceAttribution;
  lifecycle: OperatorSurfaceLifecycle;
  blocks: OperatorSurfaceBlock[];
}

export interface OperatorSurfaceInteraction {
  schemaVersion: 1;
  surfaceId: string;
  workspaceId: string;
  runId: string;
  approvalId?: string;
  actionId: string;
  intentKind: OperatorSurfaceIntentKind;
  submittedByUserId: string;
  submittedAtIso: string;
  values: Record<string, string | number | boolean>;
}

export type DiffLineKind = 'context' | 'add' | 'remove';

export interface DiffLine {
  op: DiffLineKind;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  hunkId: string;
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export type ApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Executing'
  | 'Denied'
  | 'Executed'
  | 'Expired'
  | 'RequestChanges';

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

/** Agent action proposal metadata (present when approval originated from proposeAgentAction) */
export interface AgentActionProposalMeta {
  proposalId: string;
  agentId: string;
  machineId?: string;
  toolName: string;
  toolCategory: 'ReadOnly' | 'Mutation' | 'Dangerous' | 'Unknown';
  blastRadiusTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  rationale: string;
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
  agentActionProposal?: AgentActionProposalMeta;
}

export interface CreateApprovalRequest {
  runId: string;
  planId: string;
  workItemId?: string;
  prompt: string;
  assigneeUserId?: string;
  dueAtIso?: string;
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

// ---------------------------------------------------------------------------
// Retrieval & Graph Query
// ---------------------------------------------------------------------------

export type RetrievalStrategy = 'semantic' | 'graph' | 'hybrid';

export interface SemanticQueryParams {
  query: string;
  topK?: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}

export interface GraphQueryParams {
  rootNodeId: string;
  direction: 'outbound' | 'inbound' | 'both';
  maxDepth?: number;
  relationFilter?: string[];
}

export interface RetrievalSearchRequest {
  strategy: RetrievalStrategy;
  semantic?: SemanticQueryParams;
  graph?: GraphQueryParams;
}

export interface RetrievalHitProvenance {
  workspaceId: string;
  runId: string;
  evidenceId?: string;
}

export interface RetrievalHitSummary {
  artifactId: string;
  score?: number;
  text?: string;
  metadata: Record<string, unknown>;
  provenance: RetrievalHitProvenance;
}

export interface GraphNodeSummary {
  nodeId: string;
  workspaceId: string;
  kind: 'run' | 'work-item' | 'approval' | 'evidence-entry' | 'agent-machine';
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdgeSummary {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
  workspaceId: string;
  properties?: Record<string, unknown>;
}

export interface GraphTraversalResult {
  nodes: GraphNodeSummary[];
  edges: GraphEdgeSummary[];
}

export interface RetrievalSearchResponse {
  strategy: RetrievalStrategy;
  hits: RetrievalHitSummary[];
  graph?: GraphTraversalResult;
}

export interface GraphQueryRequest {
  rootNodeId: string;
  direction: 'outbound' | 'inbound' | 'both';
  maxDepth?: number;
  relationFilter?: string[];
}

export type DerivedArtifactKind = 'embedding' | 'graph-node' | 'graph-edge' | 'chunk-index';
export type DerivedArtifactRetentionPolicy = 'indefinite' | 'run-lifetime' | 'ttl';

export interface DerivedArtifactProvenance {
  workspaceId: string;
  runId: string;
  evidenceId?: string;
  projectorVersion: string;
}

export interface DerivedArtifactMeta {
  schemaVersion: 1;
  artifactId: string;
  workspaceId: string;
  kind: DerivedArtifactKind;
  provenance: DerivedArtifactProvenance;
  retentionPolicy: DerivedArtifactRetentionPolicy;
  createdAtIso: string;
  expiresAtIso?: string;
}

export interface DerivedArtifactListResponse {
  items: DerivedArtifactMeta[];
  total: number;
}

export * from './types.commands.js';
export * from './types.machines.js';

/**
 * Branded-type helpers and Portarium domain primitives.
 *
 * A branded type is a TypeScript pattern that prevents accidental mixing of
 * structurally identical types (e.g., passing a TenantId where a WorkspaceId
 * is expected). The brand exists only at compile time — zero runtime cost.
 */

// ---------------------------------------------------------------------------
// Brand infrastructure
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;

/**
 * Branded<T, B> wraps a base type T with a compile-time-only brand B.
 * Two branded types with different brands are not assignable to each other.
 */
export type Branded<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Create a branded value. This is an identity function at runtime.
 */
export function brand<T, B extends string>(value: T): Branded<T, B> {
  return value as Branded<T, B>;
}

/**
 * Extract the underlying value from a branded type.
 */
export function unbrand<T>(branded: Branded<T, string>): T {
  return branded as T;
}

// ---------------------------------------------------------------------------
// Portarium domain primitives
// ---------------------------------------------------------------------------

/**
 * Unique identifier for a tenant / workspace.
 *
 * Policy (bead-0304): In v1 a "tenant" and a "workspace" are the same
 * identity. `WorkspaceId` is a pure type alias for `TenantId` — they share
 * one brand, one factory, and are structurally identical at compile time.
 *
 * Operational domain objects (Run, Approval, CredentialGrant …) use the
 * field name `workspaceId` and the `WorkspaceId()` factory.
 * Canonical data objects (AccountV1, InvoiceV1 …) use the field name
 * `tenantId` and the `TenantId()` factory, mirroring SoR semantics.
 */
export type TenantId = Branded<string, 'TenantId'>;

/** Unique identifier for a workspace (exact alias for TenantId in v1). */
export type WorkspaceId = TenantId;

// Compile-time guard: WorkspaceId must remain a bidirectional alias for TenantId.
// This type evaluates to `true`; a change to either type will cause this to
// resolve to `never`, which will then produce a TS error at any use site.
export type WorkspaceIdEqualsTenantId = [WorkspaceId] extends [TenantId]
  ? [TenantId] extends [WorkspaceId]
    ? true
    : never
  : never;

// Exported value-level guard — assignment to WorkspaceIdEqualsTenantId becomes a
// compile-time error (cannot assign `true` to `never`) if the alias breaks.
// Exporting prevents noUnusedLocals from flagging it.
export const WORKSPACE_ID_ALIAS_GUARD: WorkspaceIdEqualsTenantId = true;

/** Unique identifier for a workflow definition. */
export type WorkflowId = Branded<string, 'WorkflowId'>;

/** Unique identifier for a single workflow execution. */
export type RunId = Branded<string, 'RunId'>;

/** Unique identifier linking events/evidence across aggregates for traceability. */
export type CorrelationId = Branded<string, 'CorrelationId'>;

/** Unique identifier for an adapter implementation. */
export type AdapterId = Branded<string, 'AdapterId'>;

/** Unique identifier for a port (business capability interface). */
export type PortId = Branded<string, 'PortId'>;

/** Unique identifier for a single action within a workflow. */
export type ActionId = Branded<string, 'ActionId'>;

/** Unique identifier for a policy rule. */
export type PolicyId = Branded<string, 'PolicyId'>;

/** Unique identifier for an approval request. */
export type ApprovalId = Branded<string, 'ApprovalId'>;

/** Unique identifier for a plan object. */
export type PlanId = Branded<string, 'PlanId'>;

/** Unique identifier for an individual effect (planned/predicted/verified). */
export type EffectId = Branded<string, 'EffectId'>;

/** Unique identifier for an evidence log entry. */
export type EvidenceId = Branded<string, 'EvidenceId'>;

/** Unique identifier for a Work Item (cross-system binding object). */
export type WorkItemId = Branded<string, 'WorkItemId'>;

/** Unique identifier for an immutable artifact. */
export type ArtifactId = Branded<string, 'ArtifactId'>;

/** SHA-256 hex digest (lowercase). */
export type HashSha256 = Branded<string, 'HashSha256'>;

/** Unique identifier for a machine (value-producing generator). */
export type MachineId = Branded<string, 'MachineId'>;

/** Unique identifier for a versioned vertical pack. */
export type PackId = Branded<string, 'PackId'>;

/** Unique identifier for a user. */
export type UserId = Branded<string, 'UserId'>;

/** Unique identifier for a project/workspace container. */
export type ProjectId = Branded<string, 'ProjectId'>;

/** Unique identifier for a credential grant. */
export type CredentialGrantId = Branded<string, 'CredentialGrantId'>;

/** Unique identifier for a party (person, org, etc.). */
export type PartyId = Branded<string, 'PartyId'>;

/** Unique identifier for a support ticket. */
export type TicketId = Branded<string, 'TicketId'>;

/** Unique identifier for an invoice. */
export type InvoiceId = Branded<string, 'InvoiceId'>;

/** Unique identifier for a payment. */
export type PaymentId = Branded<string, 'PaymentId'>;

/** Unique identifier for a canonical task (avoids DOM Task collision). */
export type CanonicalTaskId = Branded<string, 'CanonicalTaskId'>;

/** Unique identifier for a marketing campaign. */
export type CampaignId = Branded<string, 'CampaignId'>;

/** Unique identifier for an asset. */
export type AssetId = Branded<string, 'AssetId'>;

/** Unique identifier for a document. */
export type DocumentId = Branded<string, 'DocumentId'>;

/** Unique identifier for a subscription. */
export type SubscriptionId = Branded<string, 'SubscriptionId'>;

/** Unique identifier for a sales opportunity. */
export type OpportunityId = Branded<string, 'OpportunityId'>;

/** Unique identifier for a product. */
export type ProductId = Branded<string, 'ProductId'>;

/** Unique identifier for an order. */
export type OrderId = Branded<string, 'OrderId'>;

/** Unique identifier for a financial account. */
export type FinancialAccountId = Branded<string, 'FinancialAccountId'>;

/** Unique identifier for a pack schema extension. */
export type SchemaExtensionId = Branded<string, 'SchemaExtensionId'>;

/** Unique identifier for a pack workflow definition. */
export type WorkflowDefinitionId = Branded<string, 'WorkflowDefinitionId'>;

/** Unique identifier for a pack connector mapping. */
export type ConnectorMappingId = Branded<string, 'ConnectorMappingId'>;

/** Unique identifier for a pack UI template. */
export type UiTemplateId = Branded<string, 'UiTemplateId'>;

/** Unique identifier for a pack compliance profile. */
export type ComplianceProfileId = Branded<string, 'ComplianceProfileId'>;

/** Unique identifier for a tenant configuration. */
export type TenantConfigId = Branded<string, 'TenantConfigId'>;

/** Unique identifier for a workflow trigger definition. */
export type TriggerDefinitionId = Branded<string, 'TriggerDefinitionId'>;

/** Unique identifier for a provider catalog entry. */
export type CatalogEntryId = Branded<string, 'CatalogEntryId'>;

/** Unique identifier for an AI agent configuration. */
export type AgentId = Branded<string, 'AgentId'>;

/** Unique identifier for a location telemetry event. */
export type LocationEventId = Branded<string, 'LocationEventId'>;

/** Unique identifier for a location telemetry source stream. */
export type SourceStreamId = Branded<string, 'SourceStreamId'>;

/** Unique identifier for a map layer registration. */
export type MapLayerId = Branded<string, 'MapLayerId'>;

/** Unique identifier for an operational site/campus. */
export type SiteId = Branded<string, 'SiteId'>;

/** Unique identifier for a floor/level. */
export type FloorId = Branded<string, 'FloorId'>;

/** Unique identifier for a robot. */
export type RobotId = Branded<string, 'RobotId'>;

/** Unique identifier for a robot fleet. */
export type FleetId = Branded<string, 'FleetId'>;

/** Unique identifier for a mission command. */
export type MissionId = Branded<string, 'MissionId'>;

/** Unique identifier for an edge gateway. */
export type GatewayId = Branded<string, 'GatewayId'>;

/** Unique identifier for a workforce member. */
export type WorkforceMemberId = Branded<string, 'WorkforceMemberId'>;

/** Unique identifier for a workforce queue. */
export type WorkforceQueueId = Branded<string, 'WorkforceQueueId'>;

/** Unique identifier for a human task. */
export type HumanTaskId = Branded<string, 'HumanTaskId'>;

/** Unique identifier for a consent record. */
export type ConsentId = Branded<string, 'ConsentId'>;

/** Unique identifier for a privacy policy. */
export type PrivacyPolicyId = Branded<string, 'PrivacyPolicyId'>;

/** A capability token in "entity:verb" format. */
export type CapabilityKey = Branded<string, 'CapabilityKey'>;

/** Unique identifier for an execution evidence entry. */
export type ExecutionEvidenceId = Branded<string, 'ExecutionEvidenceId'>;

/** Unique identifier for an intent command. */
export type IntentId = Branded<string, 'IntentId'>;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export const TenantId = (value: string): TenantId => brand<string, 'TenantId'>(value);
export const WorkspaceId = TenantId;
export const WorkflowId = (value: string): WorkflowId => brand<string, 'WorkflowId'>(value);
export const RunId = (value: string): RunId => brand<string, 'RunId'>(value);
export const CorrelationId = (value: string): CorrelationId =>
  brand<string, 'CorrelationId'>(value);
export const AdapterId = (value: string): AdapterId => brand<string, 'AdapterId'>(value);
export const PortId = (value: string): PortId => brand<string, 'PortId'>(value);
export const ActionId = (value: string): ActionId => brand<string, 'ActionId'>(value);
export const PolicyId = (value: string): PolicyId => brand<string, 'PolicyId'>(value);
export const ApprovalId = (value: string): ApprovalId => brand<string, 'ApprovalId'>(value);
export const PlanId = (value: string): PlanId => brand<string, 'PlanId'>(value);
export const EffectId = (value: string): EffectId => brand<string, 'EffectId'>(value);
export const EvidenceId = (value: string): EvidenceId => brand<string, 'EvidenceId'>(value);
export const WorkItemId = (value: string): WorkItemId => brand<string, 'WorkItemId'>(value);
export const ArtifactId = (value: string): ArtifactId => brand<string, 'ArtifactId'>(value);
export const HashSha256 = (value: string): HashSha256 => brand<string, 'HashSha256'>(value);
export const MachineId = (value: string): MachineId => brand<string, 'MachineId'>(value);
export const PackId = (value: string): PackId => brand<string, 'PackId'>(value);
export const UserId = (value: string): UserId => brand<string, 'UserId'>(value);
export const ProjectId = (value: string): ProjectId => brand<string, 'ProjectId'>(value);
export const CredentialGrantId = (value: string): CredentialGrantId =>
  brand<string, 'CredentialGrantId'>(value);
export const PartyId = (value: string): PartyId => brand<string, 'PartyId'>(value);
export const TicketId = (value: string): TicketId => brand<string, 'TicketId'>(value);
export const InvoiceId = (value: string): InvoiceId => brand<string, 'InvoiceId'>(value);
export const PaymentId = (value: string): PaymentId => brand<string, 'PaymentId'>(value);
export const CanonicalTaskId = (value: string): CanonicalTaskId =>
  brand<string, 'CanonicalTaskId'>(value);
export const CampaignId = (value: string): CampaignId => brand<string, 'CampaignId'>(value);
export const AssetId = (value: string): AssetId => brand<string, 'AssetId'>(value);
export const DocumentId = (value: string): DocumentId => brand<string, 'DocumentId'>(value);
export const SubscriptionId = (value: string): SubscriptionId =>
  brand<string, 'SubscriptionId'>(value);
export const OpportunityId = (value: string): OpportunityId =>
  brand<string, 'OpportunityId'>(value);
export const ProductId = (value: string): ProductId => brand<string, 'ProductId'>(value);
export const OrderId = (value: string): OrderId => brand<string, 'OrderId'>(value);
export const FinancialAccountId = (value: string): FinancialAccountId =>
  brand<string, 'FinancialAccountId'>(value);
export const SchemaExtensionId = (value: string): SchemaExtensionId =>
  brand<string, 'SchemaExtensionId'>(value);
export const WorkflowDefinitionId = (value: string): WorkflowDefinitionId =>
  brand<string, 'WorkflowDefinitionId'>(value);
export const ConnectorMappingId = (value: string): ConnectorMappingId =>
  brand<string, 'ConnectorMappingId'>(value);
export const UiTemplateId = (value: string): UiTemplateId => brand<string, 'UiTemplateId'>(value);
export const ComplianceProfileId = (value: string): ComplianceProfileId =>
  brand<string, 'ComplianceProfileId'>(value);
export const TenantConfigId = (value: string): TenantConfigId =>
  brand<string, 'TenantConfigId'>(value);
export const TriggerDefinitionId = (value: string): TriggerDefinitionId =>
  brand<string, 'TriggerDefinitionId'>(value);
export const CatalogEntryId = (value: string): CatalogEntryId =>
  brand<string, 'CatalogEntryId'>(value);
export const AgentId = (value: string): AgentId => brand<string, 'AgentId'>(value);
export const LocationEventId = (value: string): LocationEventId =>
  brand<string, 'LocationEventId'>(value);
export const SourceStreamId = (value: string): SourceStreamId =>
  brand<string, 'SourceStreamId'>(value);
export const MapLayerId = (value: string): MapLayerId => brand<string, 'MapLayerId'>(value);
export const SiteId = (value: string): SiteId => brand<string, 'SiteId'>(value);
export const FloorId = (value: string): FloorId => brand<string, 'FloorId'>(value);
export const RobotId = (value: string): RobotId => brand<string, 'RobotId'>(value);
export const FleetId = (value: string): FleetId => brand<string, 'FleetId'>(value);
export const MissionId = (value: string): MissionId => brand<string, 'MissionId'>(value);
export const GatewayId = (value: string): GatewayId => brand<string, 'GatewayId'>(value);
export const WorkforceMemberId = (value: string): WorkforceMemberId =>
  brand<string, 'WorkforceMemberId'>(value);
export const WorkforceQueueId = (value: string): WorkforceQueueId =>
  brand<string, 'WorkforceQueueId'>(value);
export const HumanTaskId = (value: string): HumanTaskId => brand<string, 'HumanTaskId'>(value);
export const ConsentId = (value: string): ConsentId => brand<string, 'ConsentId'>(value);
export const PrivacyPolicyId = (value: string): PrivacyPolicyId =>
  brand<string, 'PrivacyPolicyId'>(value);
export const CapabilityKey = (value: string): CapabilityKey =>
  brand<string, 'CapabilityKey'>(value);
export const ExecutionEvidenceId = (value: string): ExecutionEvidenceId =>
  brand<string, 'ExecutionEvidenceId'>(value);
export const IntentId = (value: string): IntentId => brand<string, 'IntentId'>(value);

// ---------------------------------------------------------------------------
// Port families
// ---------------------------------------------------------------------------

export const PORT_FAMILIES = [
  'FinanceAccounting',
  'PaymentsBilling',
  'ProcurementSpend',
  'HrisHcm',
  'Payroll',
  'CrmSales',
  'CustomerSupport',
  'ItsmItOps',
  'IamDirectory',
  'SecretsVaulting',
  'MarketingAutomation',
  'AdsPlatforms',
  'CommsCollaboration',
  'ProjectsWorkMgmt',
  'DocumentsEsign',
  'AnalyticsBi',
  'MonitoringIncident',
  'ComplianceGrc',
  'RoboticsActuation',
] as const;

export type PortFamily = (typeof PORT_FAMILIES)[number];

export function isPortFamily(value: string): value is PortFamily {
  return (PORT_FAMILIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Execution tiers
// ---------------------------------------------------------------------------

export type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

// ---------------------------------------------------------------------------
// Approval status
// ---------------------------------------------------------------------------

export type ApprovalDecision = 'Approved' | 'Denied' | 'RequestChanges';

// ---------------------------------------------------------------------------
// Workspace RBAC roles (control plane v1)
// ---------------------------------------------------------------------------

export const WORKSPACE_USER_ROLES = ['admin', 'operator', 'approver', 'auditor'] as const;

export type WorkspaceUserRole = (typeof WORKSPACE_USER_ROLES)[number];

export function isWorkspaceUserRole(value: string): value is WorkspaceUserRole {
  return (WORKSPACE_USER_ROLES as readonly string[]).includes(value);
}

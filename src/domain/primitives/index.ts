/**
 * Branded-type helpers and VAOP domain primitives.
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
// VAOP domain primitives
// ---------------------------------------------------------------------------

/** Unique identifier for a tenant / workspace. */
export type TenantId = Branded<string, 'TenantId'>;

/** Unique identifier for a workspace (alias for TenantId in v1). */
export type WorkspaceId = Branded<string, 'WorkspaceId'>;

/** Unique identifier for a workflow definition. */
export type WorkflowId = Branded<string, 'WorkflowId'>;

/** Unique identifier for a single workflow execution. */
export type RunId = Branded<string, 'RunId'>;

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

/** Unique identifier for an evidence log entry. */
export type EvidenceId = Branded<string, 'EvidenceId'>;

/** Unique identifier for an immutable artifact. */
export type ArtifactId = Branded<string, 'ArtifactId'>;

/** Unique identifier for a machine (value-producing generator). */
export type MachineId = Branded<string, 'MachineId'>;

/** Unique identifier for a versioned vertical pack. */
export type PackId = Branded<string, 'PackId'>;

/** Unique identifier for a user. */
export type UserId = Branded<string, 'UserId'>;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export const TenantId = (value: string): TenantId => brand<string, 'TenantId'>(value);
export const WorkspaceId = (value: string): WorkspaceId => brand<string, 'WorkspaceId'>(value);
export const WorkflowId = (value: string): WorkflowId => brand<string, 'WorkflowId'>(value);
export const RunId = (value: string): RunId => brand<string, 'RunId'>(value);
export const AdapterId = (value: string): AdapterId => brand<string, 'AdapterId'>(value);
export const PortId = (value: string): PortId => brand<string, 'PortId'>(value);
export const ActionId = (value: string): ActionId => brand<string, 'ActionId'>(value);
export const PolicyId = (value: string): PolicyId => brand<string, 'PolicyId'>(value);
export const ApprovalId = (value: string): ApprovalId => brand<string, 'ApprovalId'>(value);
export const EvidenceId = (value: string): EvidenceId => brand<string, 'EvidenceId'>(value);
export const ArtifactId = (value: string): ArtifactId => brand<string, 'ArtifactId'>(value);
export const MachineId = (value: string): MachineId => brand<string, 'MachineId'>(value);
export const PackId = (value: string): PackId => brand<string, 'PackId'>(value);
export const UserId = (value: string): UserId => brand<string, 'UserId'>(value);

// ---------------------------------------------------------------------------
// Execution tiers
// ---------------------------------------------------------------------------

export type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

// ---------------------------------------------------------------------------
// Approval status
// ---------------------------------------------------------------------------

export type ApprovalDecision = 'Approved' | 'Denied' | 'RequestChanges';

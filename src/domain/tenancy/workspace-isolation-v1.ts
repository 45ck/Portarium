/**
 * Workspace isolation tier domain model.
 *
 * Defines the isolation guarantees for multi-tenant infrastructure:
 * namespace separation, network policy enforcement, workload identity
 * boundaries, and resource quotas.
 *
 * Bead: bead-efra
 * ADR: ADR-0106 (Multi-Tenant Infrastructure Isolation)
 */

import type { WorkspaceId } from '../primitives/index.js';

// ── Isolation tiers ─────────────────────────────────────────────────────────

/**
 * Isolation tiers from shared (cheapest) to dedicated (strongest).
 *
 * - **A**: Dedicated cluster per workspace (strongest isolation, highest cost).
 * - **B**: Shared cluster, dedicated namespace per workspace.
 * - **C**: Shared namespace, logical isolation only (labels + RBAC + network policy).
 */
const ISOLATION_TIERS = ['A', 'B', 'C'] as const;

export type IsolationTier = (typeof ISOLATION_TIERS)[number];

export function isIsolationTier(value: string): value is IsolationTier {
  return (ISOLATION_TIERS as readonly string[]).includes(value);
}

// ── Namespace isolation profile ─────────────────────────────────────────────

export type NamespaceIsolationProfile = Readonly<{
  /** Workspace that owns this namespace. */
  workspaceId: WorkspaceId;
  /** Kubernetes namespace name. */
  namespaceName: string;
  /** Isolation tier for this workspace. */
  tier: IsolationTier;
  /** Whether a default-deny network policy exists for this namespace. */
  hasDefaultDenyIngress: boolean;
  /** Whether a default-deny egress policy exists for this namespace. */
  hasDefaultDenyEgress: boolean;
  /** PodSecurity standard enforced on this namespace. */
  podSecurityStandard: 'privileged' | 'baseline' | 'restricted';
  /** Whether the namespace has a dedicated service account (not default). */
  hasDedicatedServiceAccount: boolean;
  /** Whether resource quotas are set. */
  hasResourceQuota: boolean;
}>;

export type IsolationValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly string[] };

/**
 * Validate that a namespace isolation profile meets the minimum requirements
 * for its configured isolation tier.
 */
export function validateNamespaceIsolation(
  profile: NamespaceIsolationProfile,
): IsolationValidationResult {
  const violations: string[] = [];

  // All tiers require default-deny network policies
  if (!profile.hasDefaultDenyIngress) {
    violations.push(
      `Namespace '${profile.namespaceName}' is missing default-deny ingress NetworkPolicy.`,
    );
  }
  if (!profile.hasDefaultDenyEgress) {
    violations.push(
      `Namespace '${profile.namespaceName}' is missing default-deny egress NetworkPolicy.`,
    );
  }

  // All tiers require a dedicated service account
  if (!profile.hasDedicatedServiceAccount) {
    violations.push(
      `Namespace '${profile.namespaceName}' must use a dedicated ServiceAccount, not the default.`,
    );
  }

  // Tier A and B require 'restricted' PodSecurity standard
  if (
    (profile.tier === 'A' || profile.tier === 'B') &&
    profile.podSecurityStandard !== 'restricted'
  ) {
    violations.push(
      `Tier ${profile.tier} namespace '${profile.namespaceName}' requires PodSecurity=restricted, ` +
        `got '${profile.podSecurityStandard}'.`,
    );
  }

  // Tier C minimum: at least 'baseline' PodSecurity
  if (profile.tier === 'C' && profile.podSecurityStandard === 'privileged') {
    violations.push(
      `Tier C namespace '${profile.namespaceName}' requires at least PodSecurity=baseline, ` +
        `got 'privileged'.`,
    );
  }

  // Tiers A and B require resource quotas
  if ((profile.tier === 'A' || profile.tier === 'B') && !profile.hasResourceQuota) {
    violations.push(
      `Tier ${profile.tier} namespace '${profile.namespaceName}' requires ResourceQuota.`,
    );
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

/**
 * Validate all namespace isolation profiles.
 * Returns the first failure or valid.
 */
export function validateAllNamespaceIsolations(
  profiles: readonly NamespaceIsolationProfile[],
): IsolationValidationResult {
  for (const profile of profiles) {
    const result = validateNamespaceIsolation(profile);
    if (!result.valid) return result;
  }
  return { valid: true };
}

// ── Workload identity boundary ──────────────────────────────────────────────

export type WorkloadIdentityBinding = Readonly<{
  /** Kubernetes service account name. */
  serviceAccountName: string;
  /** Namespace of the service account. */
  namespace: string;
  /** Workspace this identity is scoped to (null = platform-wide). */
  workspaceId: WorkspaceId | null;
  /** SPIFFE ID if SPIRE is configured. */
  spiffeId: string | null;
  /** Vault role bound to this identity. */
  vaultRole: string | null;
  /** Cloud IAM role (for workload identity federation). */
  cloudIamRole: string | null;
}>;

/**
 * Validate that a workload identity binding is correctly scoped.
 */
export function validateWorkloadIdentityBinding(
  binding: WorkloadIdentityBinding,
): IsolationValidationResult {
  const violations: string[] = [];

  // Service account name must be non-empty
  if (!binding.serviceAccountName.trim()) {
    violations.push('serviceAccountName must be non-empty.');
  }

  // Must not use the Kubernetes default service account
  if (binding.serviceAccountName === 'default') {
    violations.push(
      `Namespace '${binding.namespace}' must not use the 'default' ServiceAccount for workloads.`,
    );
  }

  // If SPIFFE ID is set, it must be valid
  if (binding.spiffeId && !binding.spiffeId.startsWith('spiffe://')) {
    violations.push(`Invalid SPIFFE ID: '${binding.spiffeId}'. Must start with spiffe://.`);
  }

  // Workspace-scoped bindings must have the workspace in the SPIFFE ID
  if (binding.workspaceId && binding.spiffeId) {
    const wsStr = String(binding.workspaceId);
    if (!binding.spiffeId.includes(wsStr)) {
      violations.push(`SPIFFE ID '${binding.spiffeId}' does not contain workspace ID '${wsStr}'.`);
    }
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

// ── Network policy completeness check ───────────────────────────────────────

export type NetworkPolicyAudit = Readonly<{
  /** Component name (e.g., 'control-plane', 'execution-plane', 'agent'). */
  component: string;
  /** Whether a default-deny ingress policy exists. */
  hasDefaultDenyIngress: boolean;
  /** Whether a default-deny egress policy exists. */
  hasDefaultDenyEgress: boolean;
  /** Number of explicit ingress allow policies. */
  ingressAllowCount: number;
  /** Number of explicit egress allow policies. */
  egressAllowCount: number;
}>;

/**
 * Validate that a component's network policy set follows the deny-by-default
 * principle: default-deny exists, and at least one explicit allow for each
 * direction where the component needs connectivity.
 */
export function validateNetworkPolicyCompleteness(
  audit: NetworkPolicyAudit,
): IsolationValidationResult {
  const violations: string[] = [];

  if (!audit.hasDefaultDenyIngress) {
    violations.push(`Component '${audit.component}' is missing default-deny ingress policy.`);
  }

  if (!audit.hasDefaultDenyEgress) {
    violations.push(`Component '${audit.component}' is missing default-deny egress policy.`);
  }

  // If default-deny exists but no allows, warn (component is completely isolated)
  if (audit.hasDefaultDenyEgress && audit.egressAllowCount === 0) {
    violations.push(
      `Component '${audit.component}' has default-deny egress but no explicit allow policies — ` +
        `component has no outbound connectivity.`,
    );
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

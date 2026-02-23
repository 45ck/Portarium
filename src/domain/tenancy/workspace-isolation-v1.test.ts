/**
 * Tests for workspace isolation tier validation.
 *
 * Verifies namespace isolation profiles, workload identity boundary
 * enforcement, and network policy completeness for multi-tenant
 * infrastructure.
 *
 * Bead: bead-efra
 */

import { describe, expect, it } from 'vitest';
import { WorkspaceId } from '../primitives/index.js';
import {
  isIsolationTier,
  validateNamespaceIsolation,
  validateAllNamespaceIsolations,
  validateWorkloadIdentityBinding,
  validateNetworkPolicyCompleteness,
  type NamespaceIsolationProfile,
  type WorkloadIdentityBinding,
  type NetworkPolicyAudit,
} from './workspace-isolation-v1.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const WS_ID = WorkspaceId('ws-tenant-001');

function makeProfile(
  overrides: Partial<NamespaceIsolationProfile> = {},
): NamespaceIsolationProfile {
  return {
    workspaceId: WS_ID,
    namespaceName: 'portarium-ws-001',
    tier: 'B',
    hasDefaultDenyIngress: true,
    hasDefaultDenyEgress: true,
    podSecurityStandard: 'restricted',
    hasDedicatedServiceAccount: true,
    hasResourceQuota: true,
    ...overrides,
  };
}

function makeBinding(overrides: Partial<WorkloadIdentityBinding> = {}): WorkloadIdentityBinding {
  return {
    serviceAccountName: 'portarium-worker',
    namespace: 'portarium-ws-001',
    workspaceId: WS_ID,
    spiffeId: 'spiffe://portarium.io/ns/portarium/ws/ws-tenant-001/sa/worker',
    vaultRole: 'portarium-worker',
    cloudIamRole: null,
    ...overrides,
  };
}

// ── isIsolationTier ─────────────────────────────────────────────────────────

describe('isIsolationTier', () => {
  it.each(['A', 'B', 'C'])('accepts valid tier "%s"', (tier) => {
    expect(isIsolationTier(tier)).toBe(true);
  });

  it.each(['D', 'a', 'b', '', 'shared', 'dedicated'])('rejects invalid tier "%s"', (tier) => {
    expect(isIsolationTier(tier)).toBe(false);
  });
});

// ── validateNamespaceIsolation ──────────────────────────────────────────────

describe('validateNamespaceIsolation', () => {
  describe('Tier B (shared cluster, dedicated namespace)', () => {
    it('accepts a fully compliant Tier B profile', () => {
      expect(validateNamespaceIsolation(makeProfile())).toEqual({ valid: true });
    });

    it('rejects missing default-deny ingress', () => {
      const result = validateNamespaceIsolation(makeProfile({ hasDefaultDenyIngress: false }));
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('default-deny ingress');
    });

    it('rejects missing default-deny egress', () => {
      const result = validateNamespaceIsolation(makeProfile({ hasDefaultDenyEgress: false }));
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('default-deny egress');
    });

    it('rejects missing dedicated service account', () => {
      const result = validateNamespaceIsolation(makeProfile({ hasDedicatedServiceAccount: false }));
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('dedicated ServiceAccount');
    });

    it('rejects non-restricted PodSecurity for Tier B', () => {
      const result = validateNamespaceIsolation(makeProfile({ podSecurityStandard: 'baseline' }));
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('PodSecurity=restricted');
    });

    it('rejects missing ResourceQuota for Tier B', () => {
      const result = validateNamespaceIsolation(makeProfile({ hasResourceQuota: false }));
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('ResourceQuota');
    });
  });

  describe('Tier A (dedicated cluster)', () => {
    it('accepts a compliant Tier A profile', () => {
      const result = validateNamespaceIsolation(makeProfile({ tier: 'A' }));
      expect(result).toEqual({ valid: true });
    });

    it('rejects baseline PodSecurity for Tier A', () => {
      const result = validateNamespaceIsolation(
        makeProfile({ tier: 'A', podSecurityStandard: 'baseline' }),
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('Tier C (shared namespace, logical isolation)', () => {
    it('accepts Tier C with baseline PodSecurity and no ResourceQuota', () => {
      const result = validateNamespaceIsolation(
        makeProfile({ tier: 'C', podSecurityStandard: 'baseline', hasResourceQuota: false }),
      );
      expect(result).toEqual({ valid: true });
    });

    it('rejects Tier C with privileged PodSecurity', () => {
      const result = validateNamespaceIsolation(
        makeProfile({ tier: 'C', podSecurityStandard: 'privileged' }),
      );
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.violations[0]).toContain('baseline');
    });

    it('accepts Tier C with restricted PodSecurity', () => {
      const result = validateNamespaceIsolation(
        makeProfile({ tier: 'C', podSecurityStandard: 'restricted', hasResourceQuota: false }),
      );
      expect(result).toEqual({ valid: true });
    });
  });

  it('reports multiple violations at once', () => {
    const result = validateNamespaceIsolation(
      makeProfile({
        hasDefaultDenyIngress: false,
        hasDefaultDenyEgress: false,
        hasDedicatedServiceAccount: false,
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations.length).toBe(3);
  });
});

// ── validateAllNamespaceIsolations ──────────────────────────────────────────

describe('validateAllNamespaceIsolations', () => {
  it('passes when all profiles are valid', () => {
    const profiles = [makeProfile(), makeProfile({ namespaceName: 'portarium-ws-002' })];
    expect(validateAllNamespaceIsolations(profiles)).toEqual({ valid: true });
  });

  it('fails on first invalid profile', () => {
    const profiles = [
      makeProfile(),
      makeProfile({ namespaceName: 'portarium-ws-bad', hasDefaultDenyIngress: false }),
    ];
    const result = validateAllNamespaceIsolations(profiles);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('portarium-ws-bad');
  });

  it('passes for empty array', () => {
    expect(validateAllNamespaceIsolations([])).toEqual({ valid: true });
  });
});

// ── validateWorkloadIdentityBinding ─────────────────────────────────────────

describe('validateWorkloadIdentityBinding', () => {
  it('accepts a valid binding', () => {
    expect(validateWorkloadIdentityBinding(makeBinding())).toEqual({ valid: true });
  });

  it('rejects empty serviceAccountName', () => {
    const result = validateWorkloadIdentityBinding(makeBinding({ serviceAccountName: '' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('serviceAccountName');
  });

  it('rejects the default service account', () => {
    const result = validateWorkloadIdentityBinding(makeBinding({ serviceAccountName: 'default' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain("'default'");
  });

  it('rejects invalid SPIFFE ID format', () => {
    const result = validateWorkloadIdentityBinding(makeBinding({ spiffeId: 'not-a-spiffe-id' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('SPIFFE ID');
  });

  it('rejects SPIFFE ID missing workspace scope', () => {
    const result = validateWorkloadIdentityBinding(
      makeBinding({ spiffeId: 'spiffe://portarium.io/ns/portarium/sa/worker' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('workspace ID');
  });

  it('accepts binding with no SPIFFE ID', () => {
    const result = validateWorkloadIdentityBinding(makeBinding({ spiffeId: null }));
    expect(result).toEqual({ valid: true });
  });

  it('accepts platform-wide binding (null workspaceId)', () => {
    const result = validateWorkloadIdentityBinding(
      makeBinding({
        workspaceId: null,
        spiffeId: 'spiffe://portarium.io/ns/portarium/sa/platform-controller',
      }),
    );
    expect(result).toEqual({ valid: true });
  });
});

// ── validateNetworkPolicyCompleteness ───────────────────────────────────────

describe('validateNetworkPolicyCompleteness', () => {
  const completeAudit: NetworkPolicyAudit = {
    component: 'execution-plane',
    hasDefaultDenyIngress: true,
    hasDefaultDenyEgress: true,
    ingressAllowCount: 2,
    egressAllowCount: 5,
  };

  it('accepts a complete network policy set', () => {
    expect(validateNetworkPolicyCompleteness(completeAudit)).toEqual({ valid: true });
  });

  it('rejects missing default-deny ingress', () => {
    const result = validateNetworkPolicyCompleteness({
      ...completeAudit,
      hasDefaultDenyIngress: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('default-deny ingress');
  });

  it('rejects missing default-deny egress', () => {
    const result = validateNetworkPolicyCompleteness({
      ...completeAudit,
      hasDefaultDenyEgress: false,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('default-deny egress');
  });

  it('warns when egress deny exists but no allow policies', () => {
    const result = validateNetworkPolicyCompleteness({
      ...completeAudit,
      egressAllowCount: 0,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.violations[0]).toContain('no outbound connectivity');
  });

  it('accepts ingress deny with zero allow policies (isolated component)', () => {
    const result = validateNetworkPolicyCompleteness({
      ...completeAudit,
      ingressAllowCount: 0,
    });
    // A component with no ingress allows is valid (e.g., background worker)
    expect(result).toEqual({ valid: true });
  });
});

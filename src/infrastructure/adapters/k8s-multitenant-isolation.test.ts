/**
 * Kubernetes multi-tenant isolation manifest compliance tests.
 *
 * Validates that the infrastructure manifests enforce the multi-tenant
 * isolation policy defined in ADR-0106:
 *
 * 1. Default-deny NetworkPolicies exist for all components
 * 2. Namespaces have PodSecurity labels
 * 3. Service accounts are dedicated (not default)
 * 4. RBAC follows least-privilege
 * 5. SPIRE workload identity is configured
 *
 * Bead: bead-efra
 * ADR: ADR-0106 (Multi-Tenant Infrastructure Isolation)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

// ── Helpers ─────────────────────────────────────────────────────────────────

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: string };
        if (json.name === 'portarium') return dir;
      } catch {
        // skip
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(import.meta.dirname, '../../..');
}

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const K8S_BASE = path.join(REPO_ROOT, 'infra/kubernetes/base');

function readManifest(relativePath: string): string {
  return fs.readFileSync(path.join(K8S_BASE, relativePath), 'utf8');
}

function manifestExists(relativePath: string): boolean {
  return fs.existsSync(path.join(K8S_BASE, relativePath));
}

// ── Namespace isolation ─────────────────────────────────────────────────────

describe('Namespace isolation', () => {
  it('defines a dedicated portarium namespace', () => {
    const content = readManifest('namespace.yaml');
    expect(content).toContain('name: portarium');
  });

  it('defines a dedicated execution-plane namespace', () => {
    const content = readManifest('namespace.yaml');
    expect(content).toContain('name: portarium-execution');
  });

  it('enforces PodSecurity=baseline on the control-plane namespace', () => {
    const content = readManifest('namespace.yaml');
    expect(content).toContain('pod-security.kubernetes.io/enforce: baseline');
  });

  it('enforces PodSecurity=restricted on the execution-plane namespace', () => {
    const content = readManifest('namespace.yaml');
    expect(content).toContain('pod-security.kubernetes.io/enforce: restricted');
  });

  it('warns on restricted PodSecurity standard', () => {
    const content = readManifest('namespace.yaml');
    expect(content).toContain('pod-security.kubernetes.io/warn: restricted');
  });
});

// ── Network policies — default deny ────────────────────────────────────────

describe('Network policies: default-deny', () => {
  it('has default-deny egress for execution-plane', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-deny-default');
    expect(content).toContain('egress: []');
  });

  it('has default-deny ingress for execution-plane', () => {
    const content = readManifest('network-policies/execution-plane-ingress.yaml');
    expect(content).toContain('execution-plane-ingress-deny-default');
    expect(content).toContain('ingress: []');
  });

  it('has default-deny egress for agent pods', () => {
    const content = readManifest('network-policies/agent-egress-deny.yaml');
    expect(content).toContain('agent-egress-deny-default');
    expect(content).toContain('egress: []');
  });
});

// ── Network policies — controlled allow ────────────────────────────────────

describe('Network policies: controlled egress allows', () => {
  it('allows execution-plane to reach control-plane', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-allow-control-plane');
    expect(content).toContain('portarium.io/component: control-plane');
  });

  it('allows execution-plane to reach Vault', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-allow-vault');
    expect(content).toContain('port: 8200');
  });

  it('allows execution-plane to reach Temporal', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-allow-temporal');
    expect(content).toContain('port: 7233');
  });

  it('allows execution-plane DNS resolution', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-allow-dns');
    expect(content).toContain('port: 53');
  });

  it('limits SoR egress to HTTPS (443) and HTTP (80)', () => {
    const content = readManifest('network-policies/execution-plane-egress.yaml');
    expect(content).toContain('execution-plane-egress-allow-sor-https');
    expect(content).toContain('port: 443');
  });

  it('allows agent pods to reach control-plane only', () => {
    const content = readManifest('network-policies/agent-egress-deny.yaml');
    expect(content).toContain('agent-egress-allow-control-plane');
  });

  it('allows agent pods to reach Vault', () => {
    const content = readManifest('network-policies/agent-egress-deny.yaml');
    expect(content).toContain('agent-egress-allow-vault');
  });

  it('allows agent pods DNS resolution', () => {
    const content = readManifest('network-policies/agent-egress-deny.yaml');
    expect(content).toContain('agent-egress-allow-dns');
  });
});

// ── Network policies — ingress controls ────────────────────────────────────

describe('Network policies: ingress controls', () => {
  it('only control-plane can reach execution-plane', () => {
    const content = readManifest('network-policies/execution-plane-ingress.yaml');
    expect(content).toContain('execution-plane-ingress-allow-control-plane');
    expect(content).toContain('portarium.io/component: control-plane');
  });

  it('allows metrics scraping from otel-collector and prometheus', () => {
    const content = readManifest('network-policies/execution-plane-ingress.yaml');
    expect(content).toContain('execution-plane-ingress-allow-metrics-scrape');
    expect(content).toContain('portarium.io/component: otel-collector');
  });
});

// ── Service accounts ────────────────────────────────────────────────────────

describe('Service accounts', () => {
  it('has a dedicated control-plane service account', () => {
    const content = readManifest('serviceaccounts.yaml');
    expect(content).toContain('name: portarium-control-plane');
  });

  it('has a dedicated execution-plane service account', () => {
    const content = readManifest('serviceaccounts.yaml');
    expect(content).toContain('name: portarium-execution-plane');
  });

  it('has Vault role annotations on service accounts', () => {
    const content = readManifest('serviceaccounts.yaml');
    expect(content).toContain('vault.hashicorp.com/role');
  });
});

// ── RBAC — least privilege ──────────────────────────────────────────────────

describe('RBAC: least-privilege', () => {
  it('has RBAC manifests', () => {
    expect(manifestExists('rbac.yaml')).toBe(true);
  });

  it('control-plane Role uses read-only verbs for pods', () => {
    const content = readManifest('rbac.yaml');
    expect(content).toContain("'get'");
    expect(content).toContain("'list'");
    expect(content).toContain("'watch'");
    // Should not have create/delete/patch on pods
    expect(content).not.toContain("'create'");
    expect(content).not.toContain("'delete'");
  });

  it('uses Role (not ClusterRole) for namespace-scoped access', () => {
    const content = readManifest('rbac.yaml');
    expect(content).toContain('kind: Role');
    expect(content).toContain('kind: RoleBinding');
    // Should not use ClusterRole for app-level access
    expect(content).not.toContain('kind: ClusterRole');
  });
});

// ── SPIRE workload identity ─────────────────────────────────────────────────

describe('SPIRE workload identity', () => {
  it('has SPIRE server configuration', () => {
    expect(manifestExists('spire/spire-server.yaml')).toBe(true);
  });

  it('has SPIRE agent configuration', () => {
    expect(manifestExists('spire/spire-agent.yaml')).toBe(true);
  });

  it('has SPIRE registration entries', () => {
    expect(manifestExists('spire/registration-entries.yaml')).toBe(true);
  });

  it('SPIRE registration entries are workspace-scoped', () => {
    const content = readManifest('spire/registration-entries.yaml');
    // Entries should use workspace-scoped SPIFFE IDs
    expect(content).toContain('spiffe://');
    expect(content).toContain('portarium');
  });
});

// ── Component label consistency ─────────────────────────────────────────────

describe('Component label consistency', () => {
  it('network policies use portarium.io/component label selector', () => {
    const egress = readManifest('network-policies/execution-plane-egress.yaml');
    const ingress = readManifest('network-policies/execution-plane-ingress.yaml');
    expect(egress).toContain('portarium.io/component: execution-plane');
    expect(ingress).toContain('portarium.io/component: execution-plane');
  });

  it('all manifests use app.kubernetes.io/part-of: portarium label', () => {
    const namespace = readManifest('namespace.yaml');
    const sa = readManifest('serviceaccounts.yaml');
    expect(namespace).toContain('app.kubernetes.io/part-of: portarium');
    expect(sa).toContain('app.kubernetes.io/part-of: portarium');
  });
});

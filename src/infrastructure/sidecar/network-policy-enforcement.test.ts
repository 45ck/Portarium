/**
 * Tests for the no-bypass egress enforcement model (ADR-0115).
 *
 * Validates that:
 * - NetworkPolicy manifests correctly deny direct egress from agent pods.
 * - Sidecar-disabled pods cannot reach external destinations.
 * - Direct-IP bypass attempts are blocked by policy configuration.
 * - The egress gateway enforces fail-closed behavior.
 *
 * These tests parse the actual YAML manifests and verify structural
 * correctness — they do not require a running Kubernetes cluster.
 *
 * Bead: bead-0835
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as yaml from 'yaml';

import { checkEgressAllowed } from './egress-proxy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface K8sNetworkPolicy {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    podSelector: { matchLabels?: Record<string, string> };
    policyTypes: string[];
    egress?: {
      to?: {
        podSelector?: { matchLabels?: Record<string, string> };
        namespaceSelector?: { matchLabels?: Record<string, string> };
        ipBlock?: { cidr: string };
      }[];
      ports?: { protocol: string; port: number }[];
    }[];
    ingress?: {
      from?: {
        podSelector?: { matchLabels?: Record<string, string> };
        namespaceSelector?: { matchLabels?: Record<string, string> };
      }[];
      ports?: { protocol: string; port: number }[];
    }[];
  };
}

function loadManifests(filePath: string): K8sNetworkPolicy[] {
  const infraRoot = path.resolve(__dirname, '../../../infra/kubernetes/base');
  const fullPath = path.join(infraRoot, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  return yaml.parseAllDocuments(content).map((doc: any) => doc.toJSON() as K8sNetworkPolicy);
}

function findPolicy(policies: K8sNetworkPolicy[], name: string): K8sNetworkPolicy | undefined {
  return policies.find((p) => p.metadata?.name === name);
}

// ---------------------------------------------------------------------------
// Agent NetworkPolicy — ADR-0115 alignment
// ---------------------------------------------------------------------------

describe('Agent egress NetworkPolicy (ADR-0115)', () => {
  const policies = loadManifests('agent-network-policy.yaml');

  it('has a deny-all egress baseline policy', () => {
    const denyAll = findPolicy(policies, 'agent-deny-all-egress');
    expect(denyAll).toBeDefined();
    expect(denyAll!.spec.policyTypes).toContain('Egress');
    expect(denyAll!.spec.egress).toEqual([]);
  });

  it('deny-all policy uses empty podSelector (selects all pods in namespace)', () => {
    const denyAll = findPolicy(policies, 'agent-deny-all-egress');
    expect(denyAll!.spec.podSelector).toEqual({});
  });

  it('deny-all policy targets the agent namespace', () => {
    const denyAll = findPolicy(policies, 'agent-deny-all-egress');
    expect(denyAll!.metadata.namespace).toBe('portarium-agents');
  });

  it('allows egress to control-plane namespace only on port 443', () => {
    const allowCP = findPolicy(policies, 'agent-allow-control-plane-egress');
    expect(allowCP).toBeDefined();
    expect(allowCP!.spec.egress).toHaveLength(1);

    const rule = allowCP!.spec.egress![0]!;
    expect(rule.to).toBeDefined();
    expect(rule.to![0]!.namespaceSelector!.matchLabels).toEqual({
      'portarium.io/plane': 'control',
    });
    expect(rule.ports).toContainEqual({ protocol: 'TCP', port: 443 });
  });

  it('allows egress to localhost sidecar proxy on port 15001 only', () => {
    const allowSidecar = findPolicy(policies, 'agent-allow-sidecar-proxy-egress');
    expect(allowSidecar).toBeDefined();

    const rule = allowSidecar!.spec.egress![0]!;
    expect(rule.to![0]!.ipBlock!.cidr).toBe('127.0.0.1/32');
    expect(rule.ports).toContainEqual({ protocol: 'TCP', port: 15001 });
  });

  it('allows egress to SPIRE agent for identity attestation', () => {
    const allowSpire = findPolicy(policies, 'agent-allow-spire-egress');
    expect(allowSpire).toBeDefined();

    const rule = allowSpire!.spec.egress![0]!;
    expect(rule.to![0]!.namespaceSelector!.matchLabels).toHaveProperty(
      'kubernetes.io/metadata.name',
      'spire',
    );
  });

  it('allows DNS resolution to kube-system only', () => {
    const allowDNS = findPolicy(policies, 'agent-allow-dns-egress');
    expect(allowDNS).toBeDefined();

    const rule = allowDNS!.spec.egress![0]!;
    expect(rule.to![0]!.namespaceSelector!.matchLabels).toHaveProperty(
      'kubernetes.io/metadata.name',
      'kube-system',
    );
    expect(rule.ports).toContainEqual({ protocol: 'UDP', port: 53 });
    expect(rule.ports).toContainEqual({ protocol: 'TCP', port: 53 });
  });

  it('does NOT allow direct egress to any external IP range', () => {
    for (const policy of policies) {
      if (!policy.spec.egress) continue;
      for (const rule of policy.spec.egress) {
        if (!rule.to) continue;
        for (const to of rule.to) {
          if (to.ipBlock) {
            // Only 127.0.0.1/32 (sidecar) is allowed
            expect(to.ipBlock.cidr).toBe('127.0.0.1/32');
          }
        }
      }
    }
  });

  it('does NOT allow direct egress on port 443 without namespace restriction', () => {
    // Verify no "open" port 443 rule exists (would allow direct external HTTPS)
    for (const policy of policies) {
      if (!policy.spec.egress) continue;
      for (const rule of policy.spec.egress) {
        const has443 = rule.ports?.some((p) => p.port === 443);
        if (has443) {
          // Must have a `to` selector restricting the destination
          expect(rule.to).toBeDefined();
          expect(rule.to!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all policies carry the ADR-0115 label', () => {
    for (const policy of policies) {
      expect(policy.metadata.labels?.['portarium.io/adr']).toBe('0115');
    }
  });
});

// ---------------------------------------------------------------------------
// Sidecar bypass prevention
// ---------------------------------------------------------------------------

describe('Sidecar bypass prevention', () => {
  const policies = loadManifests('agent-network-policy.yaml');

  it('no policy allows egress to arbitrary ports on external IPs', () => {
    for (const policy of policies) {
      if (!policy.spec.egress) continue;
      for (const rule of policy.spec.egress) {
        // Rules without `to` selectors would match any destination
        if (!rule.to || rule.to.length === 0) {
          // This would be a bypass: open egress to anywhere
          throw new Error(
            `Policy ${policy.metadata.name} has an egress rule without destination ` +
              `selector — this allows bypass of sidecar/gateway enforcement.`,
          );
        }
      }
    }
  });

  it('only localhost:15001 is allowed as a direct IP destination', () => {
    const ipBlockRules: { cidr: string; port: number }[] = [];

    for (const policy of policies) {
      if (!policy.spec.egress) continue;
      for (const rule of policy.spec.egress) {
        if (!rule.to) continue;
        for (const to of rule.to) {
          if (to.ipBlock) {
            for (const port of rule.ports ?? []) {
              ipBlockRules.push({ cidr: to.ipBlock.cidr, port: port.port });
            }
          }
        }
      }
    }

    // The only IP-based rule should be localhost:15001
    expect(ipBlockRules).toHaveLength(1);
    expect(ipBlockRules[0]).toEqual({ cidr: '127.0.0.1/32', port: 15001 });
  });

  it('no policy allows egress to 0.0.0.0/0 (catch-all IP range)', () => {
    for (const policy of policies) {
      if (!policy.spec.egress) continue;
      for (const rule of policy.spec.egress) {
        if (!rule.to) continue;
        for (const to of rule.to) {
          if (to.ipBlock) {
            expect(to.ipBlock.cidr).not.toBe('0.0.0.0/0');
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Egress gateway — fail-closed behavior
// ---------------------------------------------------------------------------

describe('Egress gateway configuration (ADR-0115)', () => {
  const gatewayManifests = loadManifests('mesh-egress-gateway.yaml');

  it('egress gateway has deny-all ingress baseline', () => {
    const denyIngress = findPolicy(gatewayManifests, 'egress-gateway-ingress-deny-default');
    expect(denyIngress).toBeDefined();
    expect(denyIngress!.spec.policyTypes).toContain('Ingress');
    expect(denyIngress!.spec.ingress).toEqual([]);
  });

  it('egress gateway only accepts ingress from agent namespace', () => {
    const allowAgents = findPolicy(gatewayManifests, 'egress-gateway-ingress-allow-agents');
    expect(allowAgents).toBeDefined();

    const rule = allowAgents!.spec.ingress![0]!;
    expect(rule.from![0]!.namespaceSelector!.matchLabels).toHaveProperty(
      'kubernetes.io/metadata.name',
      'portarium-agents',
    );
    expect(rule.ports).toContainEqual({ protocol: 'TCP', port: 15443 });
  });

  it('egress gateway outbound is restricted to port 443 and DNS', () => {
    const allowExternal = findPolicy(gatewayManifests, 'egress-gateway-egress-allow-external');
    expect(allowExternal).toBeDefined();

    const rules = allowExternal!.spec.egress!;
    expect(rules).toHaveLength(2);

    // Rule 1: HTTPS
    expect(rules[0]!.ports).toContainEqual({ protocol: 'TCP', port: 443 });

    // Rule 2: DNS
    expect(rules[1]!.to![0]!.namespaceSelector!.matchLabels).toHaveProperty(
      'kubernetes.io/metadata.name',
      'kube-system',
    );
  });

  it('egress allowlist defaults to empty (fail-closed)', () => {
    const configMaps = gatewayManifests.filter((m) => m.kind === 'ConfigMap');
    expect(configMaps).toHaveLength(1);

    const configData = (configMaps[0] as unknown as { data: Record<string, string> }).data;
    const allowlistYaml = yaml.parse(configData['egress-allowlist.yaml']!) as {
      failMode: string;
      destinations: unknown[];
    };
    expect(allowlistYaml.failMode).toBe('closed');
    expect(allowlistYaml.destinations).toEqual([]);
  });

  it('envoy config returns 403 for unmatched destinations', () => {
    const configMaps = gatewayManifests.filter((m) => m.kind === 'ConfigMap');
    const configData = (configMaps[0] as unknown as { data: Record<string, string> }).data;
    const envoyConfig = yaml.parse(configData['envoy-config.yaml']!) as {
      static_resources: {
        listeners: {
          filter_chains: {
            filters: {
              typed_config: {
                route_config: {
                  virtual_hosts: {
                    routes: {
                      direct_response: { status: number };
                    }[];
                  }[];
                };
              };
            }[];
          }[];
        }[];
      };
    };

    const listener = envoyConfig.static_resources.listeners[0]!;
    const httpFilter = listener.filter_chains[0]!.filters[0]!;
    const routes = httpFilter.typed_config.route_config.virtual_hosts[0]!.routes;
    expect(routes[0]!.direct_response.status).toBe(403);
  });

  it('egress gateway deployment runs as non-root with read-only filesystem', () => {
    const deployments = gatewayManifests.filter((m) => m.kind === 'Deployment');
    expect(deployments).toHaveLength(1);

    const podSpec = (
      deployments[0] as unknown as {
        spec: { template: { spec: { securityContext: Record<string, unknown> } } };
      }
    ).spec.template.spec;
    expect(podSpec.securityContext).toMatchObject({
      runAsNonRoot: true,
    });

    const container = (
      deployments[0] as unknown as {
        spec: {
          template: {
            spec: { containers: { securityContext: Record<string, unknown> }[] };
          };
        };
      }
    ).spec.template.spec.containers[0]!;
    expect(container.securityContext).toMatchObject({
      readOnlyRootFilesystem: true,
      allowPrivilegeEscalation: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Egress proxy allowlist enforcement (application layer)
// ---------------------------------------------------------------------------

describe('Egress proxy allowlist — direct-IP bypass attempts', () => {
  const restrictedConfig = {
    allowlist: [{ hostPattern: 'api.github.com' }],
    injectTraceContext: true,
  };

  it('blocks direct IP address bypass (no DNS)', () => {
    const result = checkEgressAllowed(restrictedConfig, { host: '140.82.121.6' });
    expect(result.allowed).toBe(false);
  });

  it('blocks localhost bypass attempts on non-sidecar ports', () => {
    const result = checkEgressAllowed(restrictedConfig, { host: '127.0.0.1', port: 8080 });
    expect(result.allowed).toBe(false);
  });

  it('blocks metadata service endpoint (cloud provider IMDS)', () => {
    const result = checkEgressAllowed(restrictedConfig, { host: '169.254.169.254' });
    expect(result.allowed).toBe(false);
  });

  it('blocks internal Kubernetes service IPs', () => {
    const result = checkEgressAllowed(restrictedConfig, { host: '10.0.0.1', port: 443 });
    expect(result.allowed).toBe(false);
  });

  it('blocks DNS exfiltration via non-standard ports', () => {
    const result = checkEgressAllowed(restrictedConfig, { host: 'evil.example.com', port: 5353 });
    expect(result.allowed).toBe(false);
  });

  it('blocks when sidecar config has empty allowlist (fail-closed)', () => {
    const emptyConfig = { allowlist: [], injectTraceContext: true };
    const result = checkEgressAllowed(emptyConfig, { host: 'any.host.com' });
    expect(result.allowed).toBe(false);
  });
});

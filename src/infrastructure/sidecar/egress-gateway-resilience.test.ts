/**
 * Tests for egress gateway resilience configuration (bead-0837).
 *
 * Validates that the Kubernetes manifests include:
 * - PodDisruptionBudget for continuous gateway availability.
 * - Rolling update strategy with maxUnavailable=0.
 * - Startup, readiness, and liveness probes for health recovery.
 * - Sufficient replica count for fault tolerance.
 *
 * These tests parse the actual YAML manifests — no running cluster required.
 *
 * Bead: bead-0837
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as yaml from 'yaml';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

function loadManifests(filePath: string): K8sResource[] {
  const infraRoot = path.resolve(__dirname, '../../../infra/kubernetes/base');
  const fullPath = path.join(infraRoot, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  return yaml.parseAllDocuments(content).map((doc: any) => doc.toJSON() as K8sResource);
}

function findResource(
  resources: K8sResource[],
  kind: string,
  name?: string,
): K8sResource | undefined {
  return resources.find((r) => r.kind === kind && (!name || r.metadata?.name === name));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Egress gateway resilience (bead-0837)', () => {
  const manifests = loadManifests('mesh-egress-gateway.yaml');

  it('has a PodDisruptionBudget with minAvailable=1', () => {
    const pdb = findResource(manifests, 'PodDisruptionBudget', 'egress-gateway-pdb');
    expect(pdb).toBeDefined();
    expect((pdb!.spec as any).minAvailable).toBe(1);
    expect(pdb!.metadata.namespace).toBe('portarium-egress');
  });

  it('PodDisruptionBudget selects egress-gateway pods', () => {
    const pdb = findResource(manifests, 'PodDisruptionBudget', 'egress-gateway-pdb');
    expect(pdb).toBeDefined();
    const selector = (pdb!.spec as any).selector?.matchLabels;
    expect(selector).toEqual({ 'app.kubernetes.io/name': 'egress-gateway' });
  });

  it('deployment has at least 2 replicas for fault tolerance', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    expect(deployment).toBeDefined();
    expect((deployment!.spec as any).replicas).toBeGreaterThanOrEqual(2);
  });

  it('deployment uses RollingUpdate strategy with maxUnavailable=0', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    expect(deployment).toBeDefined();

    const strategy = (deployment!.spec as any).strategy;
    expect(strategy.type).toBe('RollingUpdate');
    expect(strategy.rollingUpdate.maxUnavailable).toBe(0);
    expect(strategy.rollingUpdate.maxSurge).toBeGreaterThanOrEqual(1);
  });

  it('envoy container has startup probe for initial health check', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    const container = (deployment!.spec as any).template.spec.containers[0];

    expect(container.startupProbe).toBeDefined();
    expect(container.startupProbe.httpGet.path).toBe('/ready');
    expect(container.startupProbe.httpGet.port).toBe(9901);
    expect(container.startupProbe.failureThreshold).toBeGreaterThanOrEqual(5);
  });

  it('envoy container has readiness probe for traffic routing', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    const container = (deployment!.spec as any).template.spec.containers[0];

    expect(container.readinessProbe).toBeDefined();
    expect(container.readinessProbe.httpGet.path).toBe('/ready');
    expect(container.readinessProbe.periodSeconds).toBeLessThanOrEqual(10);
  });

  it('envoy container has liveness probe for restart recovery', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    const container = (deployment!.spec as any).template.spec.containers[0];

    expect(container.livenessProbe).toBeDefined();
    expect(container.livenessProbe.httpGet.path).toBe('/ready');
    expect(container.livenessProbe.failureThreshold).toBeGreaterThanOrEqual(2);
  });

  it('pod spec includes terminationGracePeriodSeconds for graceful shutdown', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    const podSpec = (deployment!.spec as any).template.spec;

    expect(podSpec.terminationGracePeriodSeconds).toBeGreaterThanOrEqual(15);
  });

  it('PDB + replicas + maxUnavailable=0 guarantee continuous availability', () => {
    const deployment = findResource(manifests, 'Deployment', 'egress-gateway');
    const pdb = findResource(manifests, 'PodDisruptionBudget', 'egress-gateway-pdb');

    const replicas = (deployment!.spec as any).replicas;
    const minAvailable = (pdb!.spec as any).minAvailable;
    const maxUnavailable = (deployment!.spec as any).strategy.rollingUpdate.maxUnavailable;

    // Invariant: during both voluntary and rolling disruptions,
    // at least minAvailable pods remain.
    expect(replicas).toBeGreaterThan(minAvailable);
    expect(maxUnavailable).toBe(0);
  });
});

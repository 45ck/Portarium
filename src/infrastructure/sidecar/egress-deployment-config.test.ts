/**
 * Tests for the phased egress deployment configuration (bead-0841).
 *
 * Validates that Kustomize overlays correctly configure sidecar enforcement
 * mode per environment, supporting the staged rollout described in ADR-0115.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OVERLAYS_ROOT = path.resolve(__dirname, '../../../infra/kubernetes/overlays');

function readOverlayKustomization(env: string): string {
  return fs.readFileSync(path.join(OVERLAYS_ROOT, env, 'kustomization.yaml'), 'utf-8');
}

function readSidecarPatch(env: string): string {
  return fs.readFileSync(
    path.join(OVERLAYS_ROOT, env, 'patches', 'sidecar-enforcement-mode.yaml'),
    'utf-8',
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Egress deployment configuration (ADR-0115 phased rollout)', () => {
  const envs = ['dev', 'staging', 'prod'] as const;

  it.each(envs)('%s overlay exists and references base', (env) => {
    const content = readOverlayKustomization(env);
    expect(content).toContain('../../base');
  });

  it.each(envs)('%s overlay includes sidecar-enforcement-mode patch', (env) => {
    const content = readOverlayKustomization(env);
    expect(content).toContain('sidecar-enforcement-mode.yaml');
  });

  it('dev overlay sets sidecar to monitor mode', () => {
    const patch = readSidecarPatch('dev');
    expect(patch).toContain('enforcementMode: monitor');
    expect(patch).not.toContain('enforcementMode: enforce');
  });

  it('staging overlay sets sidecar to enforce mode', () => {
    const patch = readSidecarPatch('staging');
    expect(patch).toContain('enforcementMode: enforce');
  });

  it('prod overlay sets sidecar to enforce mode', () => {
    const patch = readSidecarPatch('prod');
    expect(patch).toContain('enforcementMode: enforce');
  });

  it('enforcement mode escalates across environments (monitor -> enforce -> enforce)', () => {
    const devPatch = readSidecarPatch('dev');
    const stagingPatch = readSidecarPatch('staging');
    const prodPatch = readSidecarPatch('prod');

    // Dev is monitor (least restrictive)
    expect(devPatch).toContain('enforcementMode: monitor');

    // Staging and prod are enforce (most restrictive)
    expect(stagingPatch).toContain('enforcementMode: enforce');
    expect(prodPatch).toContain('enforcementMode: enforce');
  });
});

describe('Deployment runbook and readiness checklist exist', () => {
  const docsRoot = path.resolve(__dirname, '../../../docs/internal/governance');

  it('deployment runbook exists', () => {
    expect(fs.existsSync(path.join(docsRoot, 'outbound-enforcement-deployment-runbook.md'))).toBe(
      true,
    );
  });

  it('production readiness checklist exists', () => {
    expect(fs.existsSync(path.join(docsRoot, 'outbound-enforcement-readiness-checklist.md'))).toBe(
      true,
    );
  });

  it('deployment runbook covers all four phases', () => {
    const content = fs.readFileSync(
      path.join(docsRoot, 'outbound-enforcement-deployment-runbook.md'),
      'utf-8',
    );
    expect(content).toContain('Phase 1');
    expect(content).toContain('Phase 2');
    expect(content).toContain('Phase 3');
    expect(content).toContain('Phase 4');
  });

  it('deployment runbook includes rollback strategy', () => {
    const content = fs.readFileSync(
      path.join(docsRoot, 'outbound-enforcement-deployment-runbook.md'),
      'utf-8',
    );
    expect(content).toContain('Rollback Strategy');
  });

  it('readiness checklist covers security, observability, CI/CD, and deployment', () => {
    const content = fs.readFileSync(
      path.join(docsRoot, 'outbound-enforcement-readiness-checklist.md'),
      'utf-8',
    );
    expect(content).toContain('## Security');
    expect(content).toContain('## Observability');
    expect(content).toContain('## CI/CD');
    expect(content).toContain('## Deployment');
  });
});

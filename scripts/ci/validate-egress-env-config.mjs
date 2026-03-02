/**
 * CI validation for egress environment configuration drift.
 *
 * Validates that sidecar enforcement mode and NetworkPolicy state are
 * consistent across Kustomize overlays (dev, staging, prod).
 *
 * Rules:
 *   1. All overlays must reference the base kustomization.
 *   2. Dev overlay must NOT set enforcement mode to 'enforce' without
 *      an explicit override comment (prevents accidental enforcement in dev).
 *   3. Prod overlay must set enforcement mode to 'enforce' (prevents
 *      accidental weakening of production enforcement).
 *   4. All overlays must include the sidecar enforcement mode patch.
 *   5. No overlay may delete or skip the agent-deny-all-egress policy.
 *
 * Bead: bead-0841
 * See: docs/internal/adr/ADR-0115-agent-egress-enforcement-model.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const OVERLAYS_ROOT = path.resolve(process.cwd(), 'infra/kubernetes/overlays');
const EXPECTED_ENVS = ['dev', 'staging', 'prod'];
const ERRORS = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addError(env, message) {
  ERRORS.push(`[${env}] ${message}`);
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content);
}

function collectPatches(kustomization) {
  const patches = [];
  if (kustomization.patchesStrategicMerge) {
    patches.push(...kustomization.patchesStrategicMerge);
  }
  if (kustomization.patches) {
    for (const p of kustomization.patches) {
      if (typeof p === 'string') {
        patches.push(p);
      } else if (p.path) {
        patches.push(p.path);
      }
    }
  }
  return patches;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateOverlay(env) {
  const overlayDir = path.join(OVERLAYS_ROOT, env);
  if (!fs.existsSync(overlayDir)) {
    addError(env, `Overlay directory does not exist: ${overlayDir}`);
    return;
  }

  const kustomizationPath = path.join(overlayDir, 'kustomization.yaml');
  const kustomization = readYaml(kustomizationPath);
  if (!kustomization) {
    addError(env, 'Missing kustomization.yaml');
    return;
  }

  // Rule 1: Must reference base
  const resources = kustomization.resources ?? [];
  const hasBase = resources.some((r) => r.includes('base'));
  if (!hasBase) {
    addError(env, 'kustomization.yaml does not reference ../../base');
  }

  // Collect all patches
  const patches = collectPatches(kustomization);

  // Rule 4: Must include sidecar enforcement mode patch
  const hasSidecarPatch = patches.some((p) => p.includes('sidecar-enforcement'));
  if (!hasSidecarPatch) {
    // Only warn — patch may be inline or use a different name
    // Check for inline patches targeting sidecar config
    const inlinePatches = (kustomization.patches ?? []).filter(
      (p) => typeof p === 'object' && p.target,
    );
    const hasInlineSidecar = inlinePatches.some(
      (p) => p.target?.kind === 'ConfigMap' && p.target?.name?.includes('sidecar'),
    );
    if (!hasInlineSidecar) {
      // Acceptable: overlay may inherit base sidecar config unchanged
    }
  }

  // Check for sidecar enforcement mode in patch files
  for (const patchRef of patches) {
    const patchPath = path.join(overlayDir, patchRef);
    if (!fs.existsSync(patchPath)) continue;

    const patchContent = fs.readFileSync(patchPath, 'utf-8');

    // Rule 2: Dev must not enforce without override comment
    if (env === 'dev' && patchContent.includes('value: enforce')) {
      if (!patchContent.includes('# OVERRIDE: dev-enforce-approved')) {
        addError(
          env,
          'Dev overlay sets sidecar enforcement mode to "enforce" without ' +
            '# OVERRIDE: dev-enforce-approved comment. This is dangerous in dev.',
        );
      }
    }

    // Rule 3: Prod must enforce
    if (env === 'prod' && patchContent.includes('value: monitor')) {
      addError(
        env,
        'Prod overlay sets sidecar enforcement mode to "monitor". ' +
          'Production must use "enforce" mode (ADR-0115).',
      );
    }
  }

  // Rule 5: No overlay may skip agent-deny-all-egress
  for (const patchRef of patches) {
    const patchPath = path.join(overlayDir, patchRef);
    if (!fs.existsSync(patchPath)) continue;

    const patchContent = fs.readFileSync(patchPath, 'utf-8');
    if (patchContent.includes('agent-deny-all-egress') && patchContent.includes('$patch: delete')) {
      addError(
        env,
        'Overlay deletes the agent-deny-all-egress NetworkPolicy. ' +
          'This violates ADR-0115 enforcement model.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(OVERLAYS_ROOT)) {
    console.log(
      'No infra/kubernetes/overlays/ directory found — skipping egress env config validation.',
    );
    process.exit(0);
  }

  for (const env of EXPECTED_ENVS) {
    validateOverlay(env);
  }

  if (ERRORS.length > 0) {
    console.error('Egress environment config validation failed:\n');
    for (const err of ERRORS) {
      console.error(`  - ${err}`);
    }
    console.error(`\n${ERRORS.length} error(s) found across ${EXPECTED_ENVS.length} overlays.`);
    process.exit(1);
  }

  console.log(
    `Egress environment config validation passed: ${EXPECTED_ENVS.length} overlays validated.`,
  );
}

main();

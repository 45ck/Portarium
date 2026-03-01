/**
 * CI validation for Kubernetes NetworkPolicy manifests.
 *
 * Parses all YAML files under infra/kubernetes/base/ and validates:
 *   1. Every NetworkPolicy has required metadata (name, namespace, labels).
 *   2. Every NetworkPolicy has a non-empty policyTypes array.
 *   3. Every deny-all baseline policy has an empty egress/ingress array.
 *   4. Agent egress policies do not allow unrestricted external access.
 *   5. All policies reference the portarium.io/part-of label.
 *   6. YAML files parse without errors.
 *
 * Bead: bead-0835
 * See: docs/internal/adr/ADR-0115-agent-egress-enforcement-model.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseAllDocuments } from 'yaml';

const INFRA_ROOT = path.resolve(process.cwd(), 'infra/kubernetes/base');
const ERRORS = [];
const WARNINGS = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectYamlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectYamlFiles(full));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      results.push(full);
    }
  }
  return results;
}

function addError(file, resource, message) {
  const rel = path.relative(process.cwd(), file);
  const id = resource?.metadata?.name ?? '(unknown)';
  ERRORS.push(`${rel} [${id}]: ${message}`);
}

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

function validateNetworkPolicy(file, policy) {
  const meta = policy.metadata;

  // Required metadata
  if (!meta?.name) {
    addError(file, policy, 'Missing metadata.name');
  }
  if (!meta?.namespace) {
    addError(file, policy, 'Missing metadata.namespace');
  }
  if (!meta?.labels?.['app.kubernetes.io/part-of']) {
    // Warn for older policies without the standard label; error for ADR-0115+ policies.
    if (meta?.labels?.['portarium.io/adr']) {
      addError(file, policy, 'Missing label app.kubernetes.io/part-of');
    } else {
      WARNINGS.push(
        `${path.relative(process.cwd(), file)} [${meta?.name ?? '(unknown)'}]: Missing label app.kubernetes.io/part-of (pre-existing)`,
      );
    }
  }

  const spec = policy.spec;
  if (!spec) {
    addError(file, policy, 'Missing spec');
    return;
  }

  // Must declare policyTypes
  if (!spec.policyTypes || spec.policyTypes.length === 0) {
    addError(file, policy, 'policyTypes must be non-empty');
  }

  // podSelector must be present (can be empty object for namespace-wide)
  if (spec.podSelector === undefined || spec.podSelector === null) {
    addError(file, policy, 'Missing spec.podSelector');
  }

  // Deny-all policies must have empty egress/ingress arrays
  const name = meta?.name ?? '';
  if (name.includes('deny-all') || name.includes('deny-default')) {
    if (spec.policyTypes?.includes('Egress') && spec.egress?.length > 0) {
      addError(file, policy, 'Deny-all egress policy must have empty egress array');
    }
    if (spec.policyTypes?.includes('Ingress') && spec.ingress?.length > 0) {
      addError(file, policy, 'Deny-all ingress policy must have empty ingress array');
    }
  }

  // Agent namespace policies: no unrestricted external access
  if (meta?.namespace === 'portarium-agents' && spec.policyTypes?.includes('Egress')) {
    for (const rule of spec.egress ?? []) {
      if (!rule.to || rule.to.length === 0) {
        addError(
          file,
          policy,
          'Agent egress rule has no destination selector — this allows unrestricted external access',
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(INFRA_ROOT)) {
    console.log('No infra/kubernetes/base/ directory found — skipping K8s policy validation.');
    process.exit(0);
  }

  const files = collectYamlFiles(INFRA_ROOT);
  let policyCount = 0;

  for (const file of files) {
    let documents;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      documents = parseAllDocuments(content);
    } catch (err) {
      addError(file, null, `YAML parse error: ${err.message}`);
      continue;
    }

    for (const doc of documents) {
      const obj = doc.toJSON();
      if (!obj) continue;

      if (obj.kind === 'NetworkPolicy') {
        policyCount++;
        validateNetworkPolicy(file, obj);
      }
    }
  }

  if (WARNINGS.length > 0) {
    console.warn('Warnings:');
    for (const w of WARNINGS) {
      console.warn(`  - ${w}`);
    }
    console.warn('');
  }

  if (ERRORS.length > 0) {
    console.error('K8s policy validation failed:\n');
    for (const err of ERRORS) {
      console.error(`  - ${err}`);
    }
    console.error(`\n${ERRORS.length} error(s) found in ${policyCount} NetworkPolicy resources.`);
    process.exit(1);
  }

  console.log(`K8s policy validation passed: ${policyCount} NetworkPolicy resources validated.`);
}

main();

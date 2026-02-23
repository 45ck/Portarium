#!/usr/bin/env node
/**
 * scripts/qa/seed-e2e-all.mjs
 *
 * Orchestrates all E2E seed scripts in dependency order:
 *   1. Keycloak — test users + roles
 *   2. OpenFGA  — workspace policies
 *   3. Odoo     — demo accounts/invoices
 *   4. API      — workspace, policy, runs, approvals
 *
 * Each seed script is idempotent. All scripts run sequentially to avoid
 * race conditions with service initialization.
 *
 * Usage:
 *   npm run test:seed          # seed all services
 *   npm run test:seed -- --api # seed API only (skip external services)
 *
 * Bead: bead-0829
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = __dirname;

const args = process.argv.slice(2);
const API_ONLY = args.includes('--api');

const ALL_SEEDS = [
  { name: 'keycloak', script: 'seed-e2e-keycloak.mjs', skipIfApiOnly: true },
  { name: 'openfga', script: 'seed-e2e-openfga.mjs', skipIfApiOnly: true },
  { name: 'odoo', script: 'seed-e2e-odoo.mjs', skipIfApiOnly: true },
  { name: 'api', script: 'seed-e2e-api.mjs', skipIfApiOnly: false },
];

function runScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

async function main() {
  const seeds = ALL_SEEDS.filter((s) => !(API_ONLY && s.skipIfApiOnly));

  process.stdout.write(
    `[seed-e2e-all] Running ${seeds.length} seed script(s)${API_ONLY ? ' (--api mode)' : ''}...\n`,
  );

  let failed = 0;
  for (const seed of seeds) {
    const scriptPath = path.join(SCRIPTS_DIR, seed.script);
    process.stdout.write(`\n[seed-e2e-all] ── ${seed.name} ──────────────────────────\n`);
    const status = runScript(scriptPath);
    if (status !== 0) {
      process.stderr.write(`[seed-e2e-all] ${seed.name} FAILED (exit ${status})\n`);
      failed++;
    }
  }

  if (failed > 0) {
    process.stderr.write(`\n[seed-e2e-all] ${failed} seed script(s) failed.\n`);
    process.exit(1);
  }

  process.stdout.write('\n[seed-e2e-all] All E2E seed scripts completed successfully.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-e2e-all] ERROR: ${err.message}\n`);
  process.exit(1);
});

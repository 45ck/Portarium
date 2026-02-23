#!/usr/bin/env node
/**
 * scripts/qa/reset-e2e-stack.mjs
 *
 * Resets Docker volumes for a clean E2E CI run.
 * Stops containers, removes named volumes, then re-starts the stack.
 *
 * Usage:
 *   node scripts/qa/reset-e2e-stack.mjs             # stop, clear volumes, restart
 *   node scripts/qa/reset-e2e-stack.mjs --stop-only  # stop + clear without restarting
 *
 * WARNING: This destroys all persistent state in the local stack.
 *
 * Bead: bead-0829
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const STOP_ONLY = process.argv.includes('--stop-only');

const COMPOSE_PROFILES = [
  '--profile',
  'baseline',
  '--profile',
  'runtime',
  '--profile',
  'auth',
  '--profile',
  'idp',
  '--profile',
  'authz',
  '--profile',
  'erp',
  '--profile',
  'cockpit',
];

const COMPOSE_FILES = ['-f', 'docker-compose.yml', '-f', 'docker-compose.local.yml'];

// Named volumes defined in docker-compose.yml for all profiles
const E2E_VOLUMES = [
  'portarium_postgres-data',
  'portarium_redis-data',
  'portarium_keycloak-db-data',
  'portarium_odoo-db-data',
  'portarium_odoo-data',
];

function run(cmd, args, opts = {}) {
  process.stdout.write(`[reset-e2e-stack] $ ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  return result.status ?? 0;
}

async function main() {
  // 1. Stop all containers
  process.stdout.write('[reset-e2e-stack] Stopping stack...\n');
  run('docker', ['compose', ...COMPOSE_PROFILES, ...COMPOSE_FILES, 'down', '--remove-orphans']);

  // 2. Remove named volumes
  process.stdout.write('[reset-e2e-stack] Removing volumes...\n');
  for (const vol of E2E_VOLUMES) {
    const result = run('docker', ['volume', 'rm', '-f', vol]);
    if (result !== 0) {
      // Volume may not exist on first run — not an error
      process.stdout.write(`[reset-e2e-stack] Volume ${vol} not found or already removed.\n`);
    }
  }

  if (STOP_ONLY) {
    process.stdout.write('[reset-e2e-stack] --stop-only: not restarting stack.\n');
    return;
  }

  // 3. Restart the stack
  process.stdout.write('[reset-e2e-stack] Starting stack (this may take a while)...\n');
  const startStatus = run('docker', [
    'compose',
    ...COMPOSE_PROFILES,
    ...COMPOSE_FILES,
    'up',
    '--wait',
  ]);

  if (startStatus !== 0) {
    process.stderr.write(`[reset-e2e-stack] Stack failed to start (exit ${startStatus}).\n`);
    process.exit(startStatus);
  }

  process.stdout.write('[reset-e2e-stack] Stack is up. Run npm run test:seed to seed data.\n');
}

main().catch((err) => {
  process.stderr.write(`[reset-e2e-stack] ERROR: ${err.message}\n`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * scripts/seed/seed-all.mjs
 *
 * Container-internal seed script — runs inside the portarium-api Docker
 * container via `npm run dev:seed`.
 *
 * Seeds the local Cockpit live workspace through the same PostgreSQL stores
 * used by the control-plane read APIs:
 *   - Live workspace (ws-local-dev by default)
 *   - Users, runs, approvals, work items, evidence, config, and workforce data
 *
 * Usage (from repo root):
 *   npm run dev:seed   # runs inside the running portarium-api container
 *
 * Bead: bead-1137
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const API_URL = process.env['LOCAL_STACK_URL'] ?? 'http://localhost:8080';
const SEED_TENANT = process.env['PORTARIUM_SEED_TENANT_ID'] ?? 'ws-local-dev';
const SEED_WORKSPACE = process.env['PORTARIUM_SEED_WORKSPACE_ID'] ?? SEED_TENANT;

process.stdout.write(`[seed-all] API_URL=${API_URL}\n`);
process.stdout.write(`[seed-all] Seeding Cockpit live bundle for ${SEED_WORKSPACE}...\n`);

// Health-check before seeding
async function healthCheck() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    process.stdout.write(`[seed-all] API healthy.\n`);
  } catch (err) {
    process.stderr.write(
      `[seed-all] API not reachable at ${API_URL}/health: ${err.message}\n` +
        '[seed-all] Ensure the API container is running: npm run dev:all\n',
    );
    process.exit(1);
  }
}

// Seed Cockpit live bundle via tsx (available in the container's node_modules)
async function seedCockpitLiveBundle() {
  const result = spawnSync('node', ['--import', 'tsx/esm', 'scripts/seed/seed-cockpit-live.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://portarium:portarium@evidence-db:5432/portarium',
      PORTARIUM_SEED_TENANT_ID: SEED_TENANT,
      PORTARIUM_SEED_WORKSPACE_ID: SEED_WORKSPACE,
    },
  });

  if (result.status !== 0) {
    process.stderr.write(
      `[seed-all] seed-cockpit-live failed (exit ${result.status ?? 'null'}).\n`,
    );
    process.exit(result.status ?? 1);
  }
}

await healthCheck();
await seedCockpitLiveBundle();

process.stdout.write('[seed-all] All seed steps complete.\n');

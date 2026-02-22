#!/usr/bin/env node
/**
 * scripts/seed/seed-all.mjs
 *
 * Container-internal seed script — runs inside the portarium-api Docker
 * container via `npm run dev:seed`.
 *
 * Calls the Portarium HTTP API to seed canonical demo data:
 *   - Demo workspace (ws-demo)
 *   - Default policy bundle
 *
 * The script uses the API rather than direct DB access so it works with any
 * persistence backend (Postgres, in-memory, etc.).
 *
 * Usage (from repo root):
 *   npm run dev:seed   # runs inside the running portarium-api container
 *
 * Bead: bead-sgt7
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const API_URL = process.env['LOCAL_STACK_URL'] ?? 'http://localhost:8080';
const SEED_TENANT = process.env['PORTARIUM_SEED_TENANT_ID'] ?? 'ws-demo';

process.stdout.write(`[seed-all] API_URL=${API_URL}\n`);
process.stdout.write(`[seed-all] Seeding canonical demo bundle...\n`);

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

// Seed canonical bundle via tsx (available in the container's node_modules)
async function seedCanonicalBundle() {
  const result = spawnSync('node', ['--import', 'tsx/esm', 'scripts/seed/seed-bundle.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://portarium:portarium@evidence-db:5432/portarium',
      PORTARIUM_SEED_TENANT_ID: SEED_TENANT,
    },
  });

  if (result.status !== 0) {
    process.stderr.write(`[seed-all] seed-bundle failed (exit ${result.status ?? 'null'}).\n`);
    process.exit(result.status ?? 1);
  }
}

await healthCheck();
await seedCanonicalBundle();

process.stdout.write('[seed-all] All seed steps complete.\n');

#!/usr/bin/env node
/**
 * scripts/db/reset-local.mjs
 *
 * Drop all Portarium tables and re-apply the full schema against the local
 * docker-compose Postgres instance.  Use this during dev iteration when you
 * want a clean slate without recreating the Postgres container volume.
 *
 * WARNING: destroys all data in the portarium database.
 *
 * Usage:
 *   npm run dev:db:reset                    # uses default local-stack URL
 *   DATABASE_URL=<url> npm run dev:db:reset # custom connection string
 *
 * Bead: bead-zhp7
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const LOCAL_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://portarium:portarium@localhost:5432/portarium';

process.stderr.write('[db:reset-local] WARNING: This will drop all Portarium tables and data.\n');
process.stdout.write(`[db:reset-local] DATABASE_URL=${LOCAL_DB_URL}\n`);

// Step 1: reset (drop tables)
const reset = spawnSync('tsx', ['src/infrastructure/migrations/cli.ts', 'reset', '--confirm'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: LOCAL_DB_URL },
  shell: false,
});

if (reset.status !== 0) {
  process.stderr.write(`[db:reset-local] Reset failed (exit ${reset.status ?? 'null'}).\n`);
  process.exit(reset.status ?? 1);
}

// Step 2: re-bootstrap
process.stdout.write('[db:reset-local] Re-applying schema...\n');

const bootstrap = spawnSync(
  'tsx',
  ['src/infrastructure/migrations/cli.ts', 'bootstrap', '--tenants', 'workspace-default'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: LOCAL_DB_URL },
    shell: false,
  },
);

if (bootstrap.status !== 0) {
  process.stderr.write(`[db:reset-local] Bootstrap failed (exit ${bootstrap.status ?? 'null'}).\n`);
  process.exit(bootstrap.status ?? 1);
}

process.stdout.write('[db:reset-local] Reset complete. Run `npm run seed:local` to re-seed.\n');

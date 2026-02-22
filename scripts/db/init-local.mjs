#!/usr/bin/env node
/**
 * scripts/db/init-local.mjs
 *
 * Bootstrap the local Postgres schema against the docker-compose evidence-db
 * service.  Applies all Expand-phase migrations idempotently (IF NOT EXISTS),
 * so it is safe to re-run on an already-initialised database.
 *
 * Usage:
 *   npm run dev:db:init                    # uses default local-stack URL
 *   DATABASE_URL=<url> npm run dev:db:init # custom connection string
 *
 * The default DATABASE_URL matches the portarium-postgres service defined in
 * docker-compose.yml (postgres:16-alpine, portarium / portarium / portarium).
 *
 * Run after `npm run dev:all` (or `docker compose ... up --wait`) to ensure
 * the database container is healthy before applying migrations.
 *
 * Bead: bead-zhp7
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const LOCAL_DB_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://portarium:portarium@localhost:5432/portarium';

const tenantsArg = process.argv.includes('--tenants')
  ? process.argv.slice(process.argv.indexOf('--tenants'))
  : ['--tenants', 'workspace-default'];

process.stdout.write(`[db:init-local] DATABASE_URL=${LOCAL_DB_URL}\n`);
process.stdout.write(`[db:init-local] Applying Expand-phase migrations...\n`);

const result = spawnSync(
  'tsx',
  ['src/infrastructure/migrations/cli.ts', 'bootstrap', ...tenantsArg],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: LOCAL_DB_URL },
    shell: false,
  },
);

if (result.status !== 0) {
  process.stderr.write(`[db:init-local] Migration failed (exit ${result.status ?? 'null'}).\n`);
  process.stdout.write(
    '[db:init-local] Ensure the Postgres container is healthy:\n' +
      '  docker compose -f docker-compose.local.yml ps\n' +
      '  npm run dev:all\n',
  );
  process.exit(result.status ?? 1);
}

process.stdout.write('[db:init-local] Schema bootstrap complete.\n');

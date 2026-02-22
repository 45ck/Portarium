#!/usr/bin/env tsx
/**
 * scripts/seed/seed-bundle.ts
 *
 * Developer seed that loads the canonical seed bundle and writes it into
 * real persistence stores (PostgreSQL via NodePostgresSqlClient).
 *
 * When DATABASE_URL is set, data is persisted to Postgres.
 * When DATABASE_URL is absent, falls back to in-memory stores and prints
 * the seeded entities for verification (dry-run mode).
 *
 * Usage:
 *   npm run seed:bundle                       # uses DATABASE_URL or dry-run
 *   DATABASE_URL=<pg-url> npm run seed:bundle # explicit Postgres target
 *   npm run seed:bundle -- --dry-run          # force in-memory dry-run
 *
 * Env vars (all optional):
 *   DATABASE_URL             PostgreSQL connection string (default: local compose)
 *   PORTARIUM_SEED_TENANT_ID Tenant to seed (default: tenant-seed-1)
 *
 * Bead: bead-sgt7
 */

import process from 'node:process';

import { NodePostgresSqlClient } from '../../src/infrastructure/postgresql/node-postgres-sql-client.js';
import { PostgresWorkspaceStore } from '../../src/infrastructure/postgresql/postgres-store-adapters.js';
import { TenantId, WorkspaceId } from '../../src/domain/primitives/index.js';
import {
  createCanonicalWorkspaceSeedV1,
  createCanonicalPolicySeedV1,
  createCanonicalRunSeedV1,
  createCanonicalEvidenceSeedInputV1,
  CANONICAL_SEED_IDS_V1,
} from '../../src/domain/testing/canonical-seeds-v1.js';
import type { WorkspaceStore } from '../../src/application/ports/workspace-store.js';
import type { WorkspaceV1 } from '../../src/domain/workspaces/workspace-v1.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LOCAL_DB_URL = 'postgresql://portarium:portarium@localhost:5432/portarium';

const DATABASE_URL = process.env['DATABASE_URL'] ?? LOCAL_DB_URL;
const TENANT_ID = TenantId(process.env['PORTARIUM_SEED_TENANT_ID'] ?? 'tenant-seed-1');
const DRY_RUN = process.argv.includes('--dry-run') || process.env['DATABASE_URL'] === undefined;

// ---------------------------------------------------------------------------
// In-memory fallback stores (dry-run mode)
// ---------------------------------------------------------------------------

class InMemoryWorkspaceStore implements WorkspaceStore {
  readonly #data = new Map<string, WorkspaceV1>();

  getWorkspaceById(_tenantId: string, id: string): Promise<WorkspaceV1 | null> {
    return Promise.resolve(this.#data.get(id) ?? null);
  }
  getWorkspaceByName(_tenantId: string, name: string): Promise<WorkspaceV1 | null> {
    for (const ws of this.#data.values()) {
      if (ws.name === name) return Promise.resolve(ws);
    }
    return Promise.resolve(null);
  }
  saveWorkspace(ws: WorkspaceV1): Promise<void> {
    this.#data.set(String(ws.workspaceId), ws);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Seed bundle
// ---------------------------------------------------------------------------

async function seedBundle(store: WorkspaceStore): Promise<void> {
  const workspace = createCanonicalWorkspaceSeedV1({
    tenantId: TENANT_ID,
    workspaceId: WorkspaceId(CANONICAL_SEED_IDS_V1.workspaceId),
  });

  const policy = createCanonicalPolicySeedV1();
  const run = createCanonicalRunSeedV1();
  const evidenceInput = createCanonicalEvidenceSeedInputV1();

  // Persist workspace (idempotent — overwrites if already present)
  await store.saveWorkspace(workspace);

  const bundle = { workspace, policy, run, evidenceInput };

  process.stdout.write(
    JSON.stringify(
      {
        seeded: true,
        tenantId: String(TENANT_ID),
        bundle: {
          workspaceId: String(bundle.workspace.workspaceId),
          workspaceName: bundle.workspace.name,
          policyId: String(bundle.policy.policyId),
          runId: String(bundle.run.runId),
          evidenceId: String(bundle.evidenceInput.evidenceId),
        },
      },
      null,
      2,
    ) + '\n',
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (DRY_RUN) {
    process.stdout.write('[seed-bundle] DATABASE_URL not set — running in dry-run mode.\n');
    process.stdout.write('[seed-bundle] Set DATABASE_URL to persist to Postgres.\n\n');
    const store = new InMemoryWorkspaceStore();
    await seedBundle(store);
    process.stdout.write('\n[seed-bundle] Dry-run complete. No data was persisted.\n');
    return;
  }

  process.stdout.write(`[seed-bundle] DATABASE_URL=${DATABASE_URL}\n`);
  process.stdout.write(`[seed-bundle] TENANT_ID=${String(TENANT_ID)}\n\n`);

  const client = new NodePostgresSqlClient({ connectionString: DATABASE_URL });
  try {
    const workspaceStore = new PostgresWorkspaceStore(client);
    await seedBundle(workspaceStore);
    process.stdout.write('\n[seed-bundle] Seed complete.\n');
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[seed-bundle] Error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * scripts/seed/seed-openfga.mjs
 *
 * Seeds OpenFGA workspace roles for demo users (alice/bob/carol).
 * Idempotent: skips tuples that already exist.
 *
 * Usage:
 *   npm run dev:seed:openfga
 *
 * Environment:
 *   OPENFGA_URL                  — default: http://localhost:8181
 *   PORTARIUM_SEED_WORKSPACE_ID  — default: ws-demo
 *
 * Bead: bead-0822
 */

const BASE_URL = process.env['OPENFGA_URL'] ?? 'http://localhost:8181';
const WORKSPACE_ID = process.env['PORTARIUM_SEED_WORKSPACE_ID'] ?? 'ws-demo';
const STORE_NAME = 'portarium';

/** Resolve the store ID for the named store */
async function getStoreId() {
  const res = await fetch(`${BASE_URL}/stores`);
  if (!res.ok) throw new Error(`GET /stores → ${res.status}`);
  const { stores } = await res.json();
  const store = stores?.find((s) => s.name === STORE_NAME);
  if (!store) {
    throw new Error(
      `Store "${STORE_NAME}" not found. Run \`npm run dev:all\` to start OpenFGA and initialize the store first.`,
    );
  }
  return store.id;
}

/** Write workspace role tuples for the demo users */
async function seedTuples(storeId) {
  const tuples = [
    { user: 'user:alice', relation: 'approver', object: `workspace:${WORKSPACE_ID}` },
    { user: 'user:bob', relation: 'operator', object: `workspace:${WORKSPACE_ID}` },
    { user: 'user:carol', relation: 'auditor', object: `workspace:${WORKSPACE_ID}` },
  ];

  const res = await fetch(`${BASE_URL}/stores/${storeId}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: { tuple_keys: tuples } }),
  });

  if (res.status === 400) {
    const body = await res.text();
    // OpenFGA returns 400 with code "write_failed_due_to_invalid_input" when tuples already exist
    if (body.includes('cannot write a tuple') || body.includes('already exists')) {
      process.stdout.write('[seed-openfga] Role tuples already seeded — skipping.\n');
      return;
    }
    throw new Error(`POST /stores/${storeId}/write → 400 ${body}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /stores/${storeId}/write → ${res.status} ${body}`);
  }

  process.stdout.write(
    `[seed-openfga] Seeded ${tuples.length} role tuples for workspace:${WORKSPACE_ID}\n`,
  );
  for (const t of tuples) {
    process.stdout.write(`  ${t.user} → ${t.relation} on ${t.object}\n`);
  }
}

async function main() {
  process.stdout.write(`[seed-openfga] Connecting to ${BASE_URL}...\n`);
  const storeId = await getStoreId();
  process.stdout.write(`[seed-openfga] Store "${STORE_NAME}" id=${storeId}\n`);
  await seedTuples(storeId);
  process.stdout.write('[seed-openfga] Done.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-openfga] ERROR: ${err.message}\n`);
  process.exit(1);
});

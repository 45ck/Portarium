#!/usr/bin/env node
/**
 * scripts/qa/seed-e2e-openfga.mjs
 *
 * Seeds OpenFGA with workspace policies for deterministic E2E tests.
 * Creates the portarium store (if missing), writes the authorization model,
 * and writes workspace role tuples for all E2E test users.
 * Idempotent: re-runnable.
 *
 * Usage:
 *   node scripts/qa/seed-e2e-openfga.mjs
 *
 * Environment:
 *   OPENFGA_URL                  — default: http://localhost:8181
 *   PORTARIUM_SEED_WORKSPACE_ID  — default: ws-e2e
 *
 * Bead: bead-0829
 */

const BASE_URL = process.env['OPENFGA_URL'] ?? 'http://localhost:8181';
const WORKSPACE_ID = process.env['PORTARIUM_SEED_WORKSPACE_ID'] ?? 'ws-e2e';
const STORE_NAME = 'portarium';

const AUTHORIZATION_MODEL = {
  schema_version: '1.1',
  type_definitions: [
    { type: 'user', relations: {} },
    {
      type: 'workspace',
      relations: {
        approver: { this: {} },
        operator: { this: {} },
        auditor: { this: {} },
        member: {
          union: {
            child: [
              { computedUserset: { object: '', relation: 'approver' } },
              { computedUserset: { object: '', relation: 'operator' } },
              { computedUserset: { object: '', relation: 'auditor' } },
            ],
          },
        },
      },
      metadata: {
        relations: {
          approver: { directly_related_user_types: [{ type: 'user' }] },
          operator: { directly_related_user_types: [{ type: 'user' }] },
          auditor: { directly_related_user_types: [{ type: 'user' }] },
          member: { directly_related_user_types: [] },
        },
      },
    },
  ],
};

/** Ensure the portarium store exists, return its id */
async function ensureStore() {
  const res = await fetch(`${BASE_URL}/stores`);
  if (!res.ok) throw new Error(`GET /stores → ${res.status}`);
  const { stores } = await res.json();
  const existing = stores?.find((s) => s.name === STORE_NAME);
  if (existing) {
    process.stdout.write(`[seed-e2e-openfga] Store "${STORE_NAME}" exists (id=${existing.id})\n`);
    return existing.id;
  }

  const createRes = await fetch(`${BASE_URL}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: STORE_NAME }),
  });
  if (!createRes.ok) throw new Error(`POST /stores → ${createRes.status}`);
  const created = await createRes.json();
  process.stdout.write(`[seed-e2e-openfga] Created store "${STORE_NAME}" (id=${created.id})\n`);
  return created.id;
}

/** Write the authorization model, return model id */
async function ensureAuthorizationModel(storeId) {
  // Write a new model (OpenFGA creates a new version each time, which is OK for seeding)
  const res = await fetch(`${BASE_URL}/stores/${storeId}/authorization-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AUTHORIZATION_MODEL),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /authorization-models → ${res.status} ${body}`);
  }
  const { authorization_model_id } = await res.json();
  process.stdout.write(
    `[seed-e2e-openfga] Authorization model written (id=${authorization_model_id})\n`,
  );
  return authorization_model_id;
}

/** Write workspace role tuples for E2E users */
async function seedWorkspaceTuples(storeId) {
  const tuples = [
    { user: 'user:e2e-approver', relation: 'approver', object: `workspace:${WORKSPACE_ID}` },
    { user: 'user:e2e-operator', relation: 'operator', object: `workspace:${WORKSPACE_ID}` },
    { user: 'user:e2e-auditor', relation: 'auditor', object: `workspace:${WORKSPACE_ID}` },
    // Also seed demo users for backward-compat with dev seeds
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
    if (body.includes('cannot write a tuple') || body.includes('already exists')) {
      process.stdout.write(
        `[seed-e2e-openfga] Role tuples already exist for workspace:${WORKSPACE_ID} — skipping.\n`,
      );
      return;
    }
    throw new Error(`POST /write → 400 ${body}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /write → ${res.status} ${body}`);
  }

  process.stdout.write(
    `[seed-e2e-openfga] Seeded ${tuples.length} role tuples for workspace:${WORKSPACE_ID}\n`,
  );
}

async function main() {
  process.stdout.write(`[seed-e2e-openfga] Connecting to ${BASE_URL}...\n`);
  const storeId = await ensureStore();
  await ensureAuthorizationModel(storeId);
  await seedWorkspaceTuples(storeId);
  process.stdout.write('[seed-e2e-openfga] Done.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-e2e-openfga] ERROR: ${err.message}\n`);
  process.exit(1);
});

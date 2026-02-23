#!/usr/bin/env node
/**
 * infra/openfga/init.mjs
 *
 * Idempotent OpenFGA store + authorization model initializer.
 * Runs as a docker-compose init container (openfga-init service, authz profile).
 *
 * Creates:
 *   - Store "portarium" (skips if already exists)
 *   - Authorization model with workspace roles (approver / operator / auditor)
 *
 * Environment:
 *   OPENFGA_BASE_URL — default: http://openfga:8080
 */

const BASE_URL = process.env['OPENFGA_BASE_URL'] ?? 'http://openfga:8080';
const STORE_NAME = 'portarium';

/** Workspace authorization model — supports approver / operator / auditor roles */
const AUTH_MODEL = {
  schema_version: '1.1',
  type_definitions: [
    { type: 'user' },
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

async function findOrCreateStore() {
  const res = await fetch(`${BASE_URL}/stores`);
  if (!res.ok) throw new Error(`GET /stores → ${res.status}`);
  const { stores } = await res.json();

  const existing = stores?.find((s) => s.name === STORE_NAME);
  if (existing) {
    process.stdout.write(`[openfga-init] Store "${STORE_NAME}" already exists id=${existing.id}\n`);
    return existing.id;
  }

  const createRes = await fetch(`${BASE_URL}/stores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: STORE_NAME }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`POST /stores → ${createRes.status} ${body}`);
  }
  const { id } = await createRes.json();
  process.stdout.write(`[openfga-init] Created store "${STORE_NAME}" id=${id}\n`);
  return id;
}

async function writeAuthorizationModel(storeId) {
  const res = await fetch(`${BASE_URL}/stores/${storeId}/authorization-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(AUTH_MODEL),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /stores/${storeId}/authorization-models → ${res.status} ${body}`);
  }
  const { authorization_model_id } = await res.json();
  process.stdout.write(`[openfga-init] Authorization model loaded id=${authorization_model_id}\n`);
}

async function main() {
  process.stdout.write(`[openfga-init] Connecting to ${BASE_URL}...\n`);
  const storeId = await findOrCreateStore();
  await writeAuthorizationModel(storeId);
  process.stdout.write('[openfga-init] Initialization complete.\n');
  process.stdout.write(`[openfga-init] OPENFGA_STORE_ID=${storeId}\n`);
}

main().catch((err) => {
  process.stderr.write(`[openfga-init] ERROR: ${err.message}\n`);
  process.exit(1);
});

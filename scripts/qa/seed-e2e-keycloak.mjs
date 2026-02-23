#!/usr/bin/env node
/**
 * scripts/qa/seed-e2e-keycloak.mjs
 *
 * Seeds Keycloak with deterministic E2E test users and roles.
 * Idempotent: existing users and role bindings are skipped.
 *
 * Usage:
 *   node scripts/qa/seed-e2e-keycloak.mjs
 *
 * Environment:
 *   KEYCLOAK_URL      — default: http://localhost:8180
 *   KEYCLOAK_REALM    — default: portarium
 *   KEYCLOAK_ADMIN    — default: admin
 *   KEYCLOAK_PASSWORD — default: admin
 *
 * Bead: bead-0829
 */

const BASE_URL = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8180';
const REALM = process.env['KEYCLOAK_REALM'] ?? 'portarium';
const ADMIN_USER = process.env['KEYCLOAK_ADMIN'] ?? 'admin';
const ADMIN_PASS = process.env['KEYCLOAK_PASSWORD'] ?? 'admin';

const E2E_USERS = [
  {
    username: 'e2e-approver',
    password: 'e2e-approver',
    role: 'approver',
    firstName: 'E2E',
    lastName: 'Approver',
  },
  {
    username: 'e2e-operator',
    password: 'e2e-operator',
    role: 'operator',
    firstName: 'E2E',
    lastName: 'Operator',
  },
  {
    username: 'e2e-auditor',
    password: 'e2e-auditor',
    role: 'auditor',
    firstName: 'E2E',
    lastName: 'Auditor',
  },
];

/** Obtain an admin access token */
async function getAdminToken() {
  const res = await fetch(`${BASE_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: ADMIN_USER,
      password: ADMIN_PASS,
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get admin token: HTTP ${res.status} ${body}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

/** List all roles in the realm */
async function listRoles(token) {
  const res = await fetch(`${BASE_URL}/admin/realms/${REALM}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /roles → ${res.status}`);
  return res.json();
}

/** List all users in the realm */
async function listUsers(token) {
  const res = await fetch(`${BASE_URL}/admin/realms/${REALM}/users?max=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /users → ${res.status}`);
  return res.json();
}

/** Create a user if not already present, return user id */
async function ensureUser(token, user, existingUsers) {
  const existing = existingUsers.find((u) => u.username === user.username);
  if (existing) {
    process.stdout.write(
      `[seed-e2e-keycloak] User ${user.username} already exists (id=${existing.id})\n`,
    );
    return existing.id;
  }

  const res = await fetch(`${BASE_URL}/admin/realms/${REALM}/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      emailVerified: true,
      email: `${user.username}@e2e.portarium.test`,
      credentials: [{ type: 'password', value: user.password, temporary: false }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /users (${user.username}) → ${res.status} ${body}`);
  }

  // Keycloak returns the new user URL in the Location header
  const location = res.headers.get('location') ?? '';
  const userId = location.split('/').at(-1);
  process.stdout.write(`[seed-e2e-keycloak] Created user ${user.username} (id=${userId})\n`);
  return userId;
}

/** Assign a realm role to a user if not already assigned */
async function assignRole(token, userId, username, role, allRoles) {
  const roleObj = allRoles.find((r) => r.name === role);
  if (!roleObj) throw new Error(`Role "${role}" not found in realm ${REALM}`);

  // Check existing role mappings
  const res = await fetch(`${BASE_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /role-mappings/realm → ${res.status}`);
  const existing = await res.json();
  if (existing.some((r) => r.name === role)) {
    process.stdout.write(`[seed-e2e-keycloak] User ${username} already has role ${role}\n`);
    return;
  }

  const assignRes = await fetch(
    `${BASE_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: roleObj.id, name: roleObj.name }]),
    },
  );
  if (!assignRes.ok) {
    const body = await assignRes.text();
    throw new Error(
      `POST /role-mappings/realm (${username}→${role}) → ${assignRes.status} ${body}`,
    );
  }
  process.stdout.write(`[seed-e2e-keycloak] Assigned role ${role} to ${username}\n`);
}

async function main() {
  process.stdout.write(`[seed-e2e-keycloak] Connecting to ${BASE_URL}, realm=${REALM}...\n`);

  const token = await getAdminToken();
  const [allRoles, allUsers] = await Promise.all([listRoles(token), listUsers(token)]);

  for (const user of E2E_USERS) {
    const userId = await ensureUser(token, user, allUsers);
    await assignRole(token, userId, user.username, user.role, allRoles);
  }

  process.stdout.write(`[seed-e2e-keycloak] Done — ${E2E_USERS.length} E2E users ready.\n`);
}

main().catch((err) => {
  process.stderr.write(`[seed-e2e-keycloak] ERROR: ${err.message}\n`);
  process.exit(1);
});

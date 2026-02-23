#!/usr/bin/env node
/**
 * scripts/seed/seed-odoo.mjs
 *
 * Installs Odoo modules (account, project) via XML-RPC.
 * Idempotent: skips modules that are already installed.
 *
 * Usage:
 *   npm run dev:seed:odoo
 *
 * Environment:
 *   ODOO_URL       — default: http://localhost:4000
 *   ODOO_DB        — default: portarium
 *   ODOO_USER      — default: admin
 *   ODOO_PASSWORD  — default: admin
 *
 * Bead: bead-0822
 */

const ODOO_URL = process.env['ODOO_URL'] ?? 'http://localhost:4000';
const ODOO_DB = process.env['ODOO_DB'] ?? 'portarium';
const ODOO_USER = process.env['ODOO_USER'] ?? 'admin';
const ODOO_PASSWORD = process.env['ODOO_PASSWORD'] ?? 'admin';

const MODULES_TO_INSTALL = ['account', 'project'];

// ---------------------------------------------------------------------------
// Minimal XML-RPC helpers
// ---------------------------------------------------------------------------

function serializeValue(val) {
  if (typeof val === 'string') return `<string>${escapeXml(val)}</string>`;
  if (typeof val === 'number' && Number.isInteger(val)) return `<int>${val}</int>`;
  if (typeof val === 'boolean') return `<boolean>${val ? 1 : 0}</boolean>`;
  if (Array.isArray(val)) {
    return `<array><data>${val.map((v) => `<value>${serializeValue(v)}</value>`).join('')}</data></array>`;
  }
  if (val === null || val === undefined) return `<nil/>`;
  if (typeof val === 'object') {
    return `<struct>${Object.entries(val)
      .map(
        ([k, v]) =>
          `<member><name>${escapeXml(k)}</name><value>${serializeValue(v)}</value></member>`,
      )
      .join('')}</struct>`;
  }
  return `<string>${String(val)}</string>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Extract the first primitive value from an XML-RPC response body */
function parseXmlrpcResponse(xml) {
  // Check for fault
  if (xml.includes('<fault>')) {
    const codeMatch = xml.match(/<name>faultCode<\/name>\s*<value>\s*<int>(\d+)<\/int>/);
    const msgMatch = xml.match(
      /<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/,
    );
    throw new Error(`Odoo XML-RPC fault ${codeMatch?.[1] ?? '?'}: ${msgMatch?.[1]?.trim() ?? xml}`);
  }
  // Parse int (uid, boolean as int)
  const intMatch = xml.match(/<value>\s*<int>(\d+)<\/int>\s*<\/value>/);
  if (intMatch) return parseInt(intMatch[1], 10);
  // Parse boolean
  const boolMatch = xml.match(/<value>\s*<boolean>(\d)<\/boolean>\s*<\/value>/);
  if (boolMatch) return boolMatch[1] === '1';
  // Parse string
  const strMatch = xml.match(/<value>\s*<string>([\s\S]*?)<\/string>\s*<\/value>/);
  if (strMatch) return strMatch[1];
  // Array of ints (search results)
  const intArrayMatches = [...xml.matchAll(/<int>(\d+)<\/int>/g)];
  if (intArrayMatches.length > 0) return intArrayMatches.map((m) => parseInt(m[1], 10));
  return null;
}

async function xmlrpc(endpoint, method, params) {
  const body = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
    ${params.map((p) => `<param><value>${serializeValue(p)}</value></param>`).join('\n    ')}
  </params>
</methodCall>`;

  const res = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body,
  });

  if (!res.ok) throw new Error(`XML-RPC ${endpoint} HTTP ${res.status}`);
  const text = await res.text();
  return parseXmlrpcResponse(text);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function waitForOdoo() {
  process.stdout.write(`[seed-odoo] Checking Odoo health at ${ODOO_URL}/web/health...\n`);
  const res = await fetch(`${ODOO_URL}/web/health`);
  if (!res.ok) throw new Error(`Odoo health check failed: HTTP ${res.status}`);
  process.stdout.write('[seed-odoo] Odoo is healthy.\n');
}

async function authenticate() {
  const uid = await xmlrpc('/xmlrpc/2/common', 'authenticate', [
    ODOO_DB,
    ODOO_USER,
    ODOO_PASSWORD,
    {},
  ]);
  if (!uid) throw new Error('Authentication failed — check ODOO_DB, ODOO_USER, ODOO_PASSWORD.');
  process.stdout.write(`[seed-odoo] Authenticated as uid=${uid}\n`);
  return uid;
}

async function installModules(uid) {
  // Find module records
  const moduleIds = await xmlrpc('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'ir.module.module',
    'search',
    [[['name', 'in', MODULES_TO_INSTALL]]],
  ]);

  if (!moduleIds || moduleIds.length === 0) {
    process.stderr.write(
      `[seed-odoo] Modules not found in registry: ${MODULES_TO_INSTALL.join(', ')}\n`,
    );
    process.exit(1);
  }

  // Read module states
  const rawFields = await xmlrpc('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'ir.module.module',
    'read',
    [moduleIds, ['name', 'state']],
  ]);

  // rawFields may come back as a raw XML string; filter modules not yet installed
  const alreadyInstalled = MODULES_TO_INSTALL.filter((m) => {
    if (typeof rawFields === 'string') {
      // The XML-RPC response includes the module name and state; do a simple substring check
      const nameIdx = rawFields.indexOf(`>${m}<`);
      if (nameIdx === -1) return false;
      const stateFragment = rawFields.slice(nameIdx, nameIdx + 200);
      return stateFragment.includes('installed');
    }
    return false;
  });

  const toInstall = MODULES_TO_INSTALL.filter((m) => !alreadyInstalled.includes(m));

  if (toInstall.length === 0) {
    process.stdout.write(
      `[seed-odoo] All modules already installed: ${MODULES_TO_INSTALL.join(', ')}\n`,
    );
    return;
  }

  process.stdout.write(`[seed-odoo] Installing: ${toInstall.join(', ')}...\n`);

  // Get ids of modules to install
  const installIds = await xmlrpc('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'ir.module.module',
    'search',
    [[['name', 'in', toInstall]]],
  ]);

  await xmlrpc('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'ir.module.module',
    'button_immediate_install',
    [installIds],
  ]);

  process.stdout.write(`[seed-odoo] Modules installed: ${toInstall.join(', ')}\n`);
}

async function main() {
  await waitForOdoo();
  const uid = await authenticate();
  await installModules(uid);
  process.stdout.write('[seed-odoo] Done.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-odoo] ERROR: ${err.message}\n`);
  process.exit(1);
});

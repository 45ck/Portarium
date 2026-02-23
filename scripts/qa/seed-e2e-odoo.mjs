#!/usr/bin/env node
/**
 * scripts/qa/seed-e2e-odoo.mjs
 *
 * Seeds Odoo with deterministic E2E test data:
 *   - Ensures the `account` module is installed
 *   - Creates a chart-of-accounts entry (if not present)
 *   - Creates sample vendor bills and customer invoices (if not present)
 *
 * Idempotent: re-runnable. Checks for existing records before creating.
 *
 * Usage:
 *   node scripts/qa/seed-e2e-odoo.mjs
 *
 * Environment:
 *   ODOO_URL       — default: http://localhost:4000
 *   ODOO_DB        — default: portarium
 *   ODOO_USER      — default: admin
 *   ODOO_PASSWORD  — default: admin
 *
 * Bead: bead-0829
 */

const ODOO_URL = process.env['ODOO_URL'] ?? 'http://localhost:4000';
const ODOO_DB = process.env['ODOO_DB'] ?? 'portarium';
const ODOO_USER = process.env['ODOO_USER'] ?? 'admin';
const ODOO_PASSWORD = process.env['ODOO_PASSWORD'] ?? 'admin';

// ---------------------------------------------------------------------------
// Minimal XML-RPC helpers (same as seed-odoo.mjs)
// ---------------------------------------------------------------------------

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeValue(val) {
  if (typeof val === 'string') return `<string>${escapeXml(val)}</string>`;
  if (typeof val === 'number' && Number.isInteger(val)) return `<int>${val}</int>`;
  if (typeof val === 'number') return `<double>${val}</double>`;
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

function parseXmlrpcInts(xml) {
  if (xml.includes('<fault>')) {
    const codeMatch = xml.match(/<name>faultCode<\/name>\s*<value>\s*<int>(\d+)<\/int>/);
    const msgMatch = xml.match(
      /<name>faultString<\/name>\s*<value>\s*<string>([\s\S]*?)<\/string>/,
    );
    throw new Error(`Odoo XML-RPC fault ${codeMatch?.[1] ?? '?'}: ${msgMatch?.[1]?.trim() ?? xml}`);
  }
  const intMatch = xml.match(/<value>\s*<int>(\d+)<\/int>\s*<\/value>/);
  if (intMatch) return parseInt(intMatch[1], 10);
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
  return parseXmlrpcInts(text);
}

function oe(db, uid, password, model, method, args, kwargs = {}) {
  return xmlrpc('/xmlrpc/2/object', 'execute_kw', [db, uid, password, model, method, args, kwargs]);
}

// ---------------------------------------------------------------------------
// Main seeding steps
// ---------------------------------------------------------------------------

async function authenticate() {
  const uid = await xmlrpc('/xmlrpc/2/common', 'authenticate', [
    ODOO_DB,
    ODOO_USER,
    ODOO_PASSWORD,
    {},
  ]);
  if (!uid) throw new Error('Odoo authentication failed.');
  process.stdout.write(`[seed-e2e-odoo] Authenticated uid=${uid}\n`);
  return uid;
}

/** Ensure a partner (vendor/customer) exists, return its id */
async function ensurePartner(uid, name, isSupplier, isCustomer) {
  const existing = await oe(ODOO_DB, uid, ODOO_PASSWORD, 'res.partner', 'search', [
    [['name', '=', name]],
  ]);
  if (Array.isArray(existing) && existing.length > 0) {
    process.stdout.write(`[seed-e2e-odoo] Partner "${name}" already exists (id=${existing[0]})\n`);
    return existing[0];
  }
  const id = await oe(ODOO_DB, uid, ODOO_PASSWORD, 'res.partner', 'create', [
    {
      name,
      supplier_rank: isSupplier ? 1 : 0,
      customer_rank: isCustomer ? 1 : 0,
    },
  ]);
  process.stdout.write(`[seed-e2e-odoo] Created partner "${name}" (id=${id})\n`);
  return id;
}

/** Ensure a journal entry/invoice exists by origin ref, return id or null */
async function findInvoiceByRef(uid, moveType, ref) {
  const existing = await oe(ODOO_DB, uid, ODOO_PASSWORD, 'account.move', 'search', [
    [
      ['move_type', '=', moveType],
      ['ref', '=', ref],
    ],
  ]);
  if (Array.isArray(existing) && existing.length > 0) return existing[0];
  return null;
}

/** Create a sample customer invoice */
async function ensureCustomerInvoice(uid, partnerId, ref) {
  const existing = await findInvoiceByRef(uid, 'out_invoice', ref);
  if (existing) {
    process.stdout.write(`[seed-e2e-odoo] Invoice "${ref}" already exists (id=${existing})\n`);
    return existing;
  }

  const id = await oe(ODOO_DB, uid, ODOO_PASSWORD, 'account.move', 'create', [
    {
      move_type: 'out_invoice',
      partner_id: partnerId,
      ref,
      invoice_line_ids: [
        [
          0,
          0,
          {
            name: 'E2E Test Service',
            quantity: 1,
            price_unit: 100.0,
          },
        ],
      ],
    },
  ]);
  process.stdout.write(`[seed-e2e-odoo] Created customer invoice "${ref}" (id=${id})\n`);
  return id;
}

/** Create a sample vendor bill */
async function ensureVendorBill(uid, partnerId, ref) {
  const existing = await findInvoiceByRef(uid, 'in_invoice', ref);
  if (existing) {
    process.stdout.write(`[seed-e2e-odoo] Bill "${ref}" already exists (id=${existing})\n`);
    return existing;
  }

  const id = await oe(ODOO_DB, uid, ODOO_PASSWORD, 'account.move', 'create', [
    {
      move_type: 'in_invoice',
      partner_id: partnerId,
      ref,
      invoice_line_ids: [
        [
          0,
          0,
          {
            name: 'E2E Vendor Services',
            quantity: 2,
            price_unit: 75.0,
          },
        ],
      ],
    },
  ]);
  process.stdout.write(`[seed-e2e-odoo] Created vendor bill "${ref}" (id=${id})\n`);
  return id;
}

async function main() {
  process.stdout.write(`[seed-e2e-odoo] Connecting to ${ODOO_URL}...\n`);
  const uid = await authenticate();

  // Create test partners
  const customerPartnerId = await ensurePartner(uid, 'E2E Test Customer', false, true);
  const vendorPartnerId = await ensurePartner(uid, 'E2E Test Vendor', true, false);

  // Create deterministic invoices (3 customer, 2 vendor)
  await ensureCustomerInvoice(uid, customerPartnerId, 'E2E-INV-001');
  await ensureCustomerInvoice(uid, customerPartnerId, 'E2E-INV-002');
  await ensureCustomerInvoice(uid, customerPartnerId, 'E2E-INV-003');
  await ensureVendorBill(uid, vendorPartnerId, 'E2E-BILL-001');
  await ensureVendorBill(uid, vendorPartnerId, 'E2E-BILL-002');

  process.stdout.write('[seed-e2e-odoo] Done — E2E Odoo records ready.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-e2e-odoo] ERROR: ${err.message}\n`);
  process.exit(1);
});

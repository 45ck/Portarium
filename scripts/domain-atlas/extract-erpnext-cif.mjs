import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'erpnext';

const atlasRoot = path.join(repoRoot, 'domain-atlas');
const manifestPath = path.join(atlasRoot, 'sources', providerId, 'source.json');
const upstreamRoot = path.join(atlasRoot, 'upstreams', providerId);
const outPath = path.join(atlasRoot, 'extracted', providerId, 'cif.json');

function nowIsoUtc() {
  return new Date().toISOString();
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pascalCase(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/g)
    .filter((p) => p.length > 0)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join('');
}

function normalizeFrappeFieldType(fieldType, options) {
  const ft = String(fieldType ?? '').trim();
  const opts = typeof options === 'string' ? options.trim() : '';

  if (ft === 'Link') return opts.length > 0 ? `link(${opts})` : 'link';
  if (ft === 'Dynamic Link') return 'dynamic_link';
  if (ft === 'Table') return opts.length > 0 ? `table(${opts})` : 'table';

  if (ft === 'Check') return 'boolean';
  if (ft === 'Int') return 'integer';
  if (ft === 'Float' || ft === 'Currency' || ft === 'Percent') return 'decimal';
  if (ft === 'Date') return 'date';
  if (ft === 'Datetime') return 'datetime';
  if (ft === 'Time') return 'time';
  if (ft === 'Select') return 'enum';
  if (ft === 'JSON') return 'json';

  // Default: keep a stable, explicit provider-native type string.
  return ft.length > 0 ? ft.toLowerCase().replaceAll(' ', '_') : 'unknown';
}

function parseSelectOptions(value) {
  if (!isNonEmptyString(value)) return null;
  const parts = value
    .split(/\r?\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  return parts;
}

function extractDocType({ relPath, fieldAllowlist }) {
  const filePath = path.join(upstreamRoot, relPath);
  const doc = readJson(filePath);

  const entityName = isNonEmptyString(doc?.name) ? String(doc.name).trim() : null;
  if (!entityName) {
    throw new Error(`Missing DocType name in ${path.relative(repoRoot, filePath)}`);
  }

  const fieldsRaw = Array.isArray(doc?.fields) ? doc.fields : [];
  const byName = new Map();
  for (const f of fieldsRaw) {
    const fieldname = isNonEmptyString(f?.fieldname) ? String(f.fieldname).trim() : null;
    if (!fieldname) continue;
    if (!byName.has(fieldname)) byName.set(fieldname, f);
  }

  const fields = [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Frappe document primary key (name).',
    },
  ];

  for (const fieldname of fieldAllowlist) {
    const f = byName.get(fieldname);
    if (!f) {
      throw new Error(
        `Missing field "${fieldname}" in DocType "${entityName}" (${path.relative(repoRoot, filePath)})`,
      );
    }

    const fieldType = normalizeFrappeFieldType(f.fieldtype, f.options);
    const required = Boolean(f.reqd);
    const label = isNonEmptyString(f.label) ? String(f.label).trim() : undefined;

    const out = {
      name: fieldname,
      type: fieldType,
      required,
      ...(label ? { description: label } : {}),
    };

    // Add select options as a validation hint (human-readable); keep it short.
    if (f.fieldtype === 'Select') {
      const opts = parseSelectOptions(f.options);
      if (opts && opts.length > 0) {
        out.validation = `options: ${opts.slice(0, 12).join(' | ')}${opts.length > 12 ? ' | …' : ''}`;
      }
    }

    fields.push(out);
  }

  const isSubmittable = Boolean(doc?.is_submittable);
  if (isSubmittable) {
    fields.push({
      name: 'docstatus',
      type: 'docstatus',
      required: true,
      description: 'Frappe docstatus (0=Draft, 1=Submitted, 2=Cancelled).',
    });
  }

  const entity = {
    name: entityName,
    description: isNonEmptyString(doc?.description) ? String(doc.description).trim() : undefined,
    primaryKeys: ['name'],
    fields,
  };

  const relationships = [];
  for (const f of fields) {
    const mLink = /^link\((.+)\)$/.exec(String(f.type));
    if (mLink) {
      relationships.push({
        fromEntity: entityName,
        toEntity: mLink[1],
        kind: 'many_to_one',
        fromField: f.name,
        toField: 'name',
      });
      continue;
    }

    const mTable = /^table\((.+)\)$/.exec(String(f.type));
    if (mTable) {
      relationships.push({
        fromEntity: entityName,
        toEntity: mTable[1],
        kind: 'one_to_many',
        fromField: f.name,
        toField: 'parent',
      });
    }
  }

  const lifecycle = isSubmittable
    ? {
        entity: entityName,
        statusField: 'docstatus',
        states: ['Draft', 'Submitted', 'Cancelled'],
        notes: 'Frappe docstatus: 0=Draft, 1=Submitted, 2=Cancelled.',
      }
    : null;

  return {
    entity: JSON.parse(JSON.stringify(entity)),
    relationships,
    lifecycle,
  };
}

function main() {
  const manifest = readJson(manifestPath);
  const upstream = manifest?.upstream ?? {};
  const commit = isNonEmptyString(upstream?.commit) ? String(upstream.commit).trim() : '';

  if (commit.length === 0) {
    throw new Error(
      `Missing upstream.commit in ${path.relative(repoRoot, manifestPath)} (run npm run domain-atlas:vendor -- --only erpnext)`,
    );
  }

  if (!fs.existsSync(upstreamRoot)) {
    throw new Error(
      `Missing upstream working copy at ${path.relative(repoRoot, upstreamRoot)} (run npm run domain-atlas:vendor -- --only erpnext)`,
    );
  }

  const docTypes = [
    {
      relPath: path.join('erpnext', 'selling', 'doctype', 'customer', 'customer.json'),
      fieldAllowlist: [
        'customer_name',
        'customer_type',
        'customer_group',
        'territory',
        'email_id',
        'mobile_no',
        'default_currency',
        'tax_id',
        'disabled',
      ],
    },
    {
      relPath: path.join('erpnext', 'buying', 'doctype', 'supplier', 'supplier.json'),
      fieldAllowlist: [
        'supplier_name',
        'supplier_type',
        'supplier_group',
        'country',
        'email_id',
        'mobile_no',
        'default_currency',
        'tax_id',
        'disabled',
      ],
    },
    {
      relPath: path.join('erpnext', 'accounts', 'doctype', 'sales_invoice', 'sales_invoice.json'),
      fieldAllowlist: [
        'company',
        'customer',
        'posting_date',
        'due_date',
        'currency',
        'conversion_rate',
        'grand_total',
        'outstanding_amount',
        'status',
        'is_return',
        'return_against',
        'items',
      ],
    },
    {
      relPath: path.join(
        'erpnext',
        'accounts',
        'doctype',
        'sales_invoice_item',
        'sales_invoice_item.json',
      ),
      fieldAllowlist: [
        'item_code',
        'item_name',
        'description',
        'qty',
        'rate',
        'amount',
        'net_amount',
        'uom',
        'stock_uom',
        'conversion_factor',
      ],
    },
    {
      relPath: path.join('erpnext', 'buying', 'doctype', 'purchase_order', 'purchase_order.json'),
      fieldAllowlist: [
        'company',
        'supplier',
        'transaction_date',
        'schedule_date',
        'currency',
        'conversion_rate',
        'grand_total',
        'status',
        'items',
      ],
    },
    {
      relPath: path.join(
        'erpnext',
        'buying',
        'doctype',
        'purchase_order_item',
        'purchase_order_item.json',
      ),
      fieldAllowlist: [
        'item_code',
        'item_name',
        'description',
        'qty',
        'rate',
        'amount',
        'uom',
        'stock_uom',
        'conversion_factor',
        'schedule_date',
      ],
    },
    {
      relPath: path.join('erpnext', 'accounts', 'doctype', 'payment_entry', 'payment_entry.json'),
      fieldAllowlist: [
        'company',
        'payment_type',
        'party_type',
        'party',
        'posting_date',
        'paid_amount',
        'received_amount',
        'paid_from',
        'paid_to',
        'reference_no',
        'reference_date',
        'remarks',
        'status',
      ],
    },
    {
      relPath: path.join('erpnext', 'stock', 'doctype', 'item', 'item.json'),
      fieldAllowlist: [
        'item_code',
        'item_name',
        'item_group',
        'stock_uom',
        'is_stock_item',
        'disabled',
      ],
    },
  ];

  const extracted = docTypes.map(extractDocType);
  const entities = extracted.map((e) => e.entity);
  const relationships = extracted.flatMap((e) => e.relationships);
  const lifecycles = extracted.map((e) => e.lifecycle).filter(Boolean);

  const actions = [];
  for (const e of entities) {
    actions.push({
      name: `create${pascalCase(e.name)}`,
      kind: 'create',
      entities: [e.name],
      idempotency: {
        supported: false,
        notes:
          'ERPNext uses naming series and server-side validation; adapter should verify by query and avoid duplicate creates.',
      },
    });

    const hasDocstatus = e.fields.some((f) => f.name === 'docstatus');
    if (hasDocstatus) {
      actions.push({
        name: `submit${pascalCase(e.name)}`,
        kind: 'workflow',
        entities: [e.name],
        idempotency: { supported: true, notes: 'Submit is deterministic per document name.' },
      });
      actions.push({
        name: `cancel${pascalCase(e.name)}`,
        kind: 'workflow',
        entities: [e.name],
        idempotency: { supported: true, notes: 'Cancel is deterministic per document name.' },
      });
    }
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId: manifest?.providerId ?? providerId,
      providerName: manifest?.providerName ?? providerId,
      upstream: {
        repoUrl: upstream?.repoUrl,
        commit,
        version: upstream?.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships,
    lifecycles,
    actions,
    extensionPoints: {
      customFields: {
        supported: true,
        notes:
          'Frappe supports custom fields (Custom Field / Property Setter). Treat as provider extensions in the adapter ACL.',
      },
      attachments: {
        supported: true,
        notes: 'Attachments are first-class via File doctype; not extracted in this MVP subset.',
      },
      tags: {
        supported: true,
        notes:
          'ERPNext supports tagging via Tag Link (and other metadata patterns); not extracted in this MVP subset.',
      },
      comments: { supported: true },
      activities: { supported: true },
    },
  };

  writeJson(outPath, cif);
  process.stdout.write(
    `${JSON.stringify({ outPath: path.relative(repoRoot, outPath) }, null, 2)}\n`,
  );
}

main();

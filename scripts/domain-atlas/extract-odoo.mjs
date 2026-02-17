import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const atlasRoot = path.join(repoRoot, 'domain-atlas');
const sourcesRoot = path.join(atlasRoot, 'sources');
const upstreamsRoot = path.join(atlasRoot, 'upstreams');
const extractedRoot = path.join(atlasRoot, 'extracted');

const providerId = 'odoo';
const manifestPath = path.join(sourcesRoot, providerId, 'source.json');
const upstreamRoot = path.join(upstreamsRoot, providerId);

const basePartnerPath = path.join(
  upstreamRoot,
  'odoo',
  'addons',
  'base',
  'models',
  'res_partner.py',
);
const accountPartnerPath = path.join(upstreamRoot, 'addons', 'account', 'models', 'partner.py');

const outDir = path.join(extractedRoot, providerId);
const outPath = path.join(outDir, 'cif.json');

function nowIsoUtc() {
  return new Date().toISOString();
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function countParens(value) {
  // Best-effort only; sufficient for the specific Odoo files we parse here.
  let delta = 0;
  for (const ch of value) {
    if (ch === '(') delta += 1;
    if (ch === ')') delta -= 1;
  }
  return delta;
}

function sliceClassBlock(lines, className) {
  const startRe = new RegExp(`^class\\s+${className}\\b`);
  const start = lines.findIndex((l) => startRe.test(l));
  if (start === -1) {
    throw new Error(`Failed to find class "${className}"`);
  }

  const rest = lines.slice(start + 1);
  const next = rest.findIndex((l) => /^class\s+/.test(l));
  const end = next === -1 ? lines.length : start + 1 + next;

  return lines.slice(start, end);
}

function normalizeFieldType(fieldType, expr) {
  const type = String(fieldType).trim();
  if (type === 'Many2one' || type === 'One2many' || type === 'Many2many') {
    const m = expr.match(/\(\s*['"]([^'"]+)['"]/);
    const model = m?.[1] ?? 'unknown';
    if (type === 'Many2one') return `many2one(${model})`;
    if (type === 'One2many') return `one2many(${model})`;
    return `many2many(${model})`;
  }

  return type.toLowerCase();
}

function extractOdooFieldsFromBlock(blockLines) {
  const fields = [];

  for (let i = 0; i < blockLines.length; i += 1) {
    const line = blockLines[i];
    const m = line.match(
      /^\s{4}([a-zA-Z_][a-zA-Z0-9_]*)(?::[^=]+)?\s*=\s*fields\.([A-Za-z0-9_]+)\(/,
    );
    if (!m) continue;

    const name = m[1];
    const fieldType = m[2];

    const startIdx = line.indexOf(`fields.${fieldType}(`);
    let expr = startIdx === -1 ? line : line.slice(startIdx);
    let depth = countParens(expr);
    while (depth > 0 && i + 1 < blockLines.length) {
      i += 1;
      expr += `\n${blockLines[i]}`;
      depth += countParens(blockLines[i]);
    }

    fields.push({
      name,
      type: normalizeFieldType(fieldType, expr),
      required: expr.includes('required=True'),
    });
  }

  return fields;
}

function uniqByName(fields) {
  const seen = new Set();
  const out = [];
  for (const field of fields) {
    if (seen.has(field.name)) continue;
    seen.add(field.name);
    out.push(field);
  }
  return out;
}

function pick(fields, allowList) {
  const allow = new Set(allowList);
  return fields.filter((f) => allow.has(f.name));
}

function deriveRelationships(fromEntity, fields) {
  const relationships = [];
  for (const field of fields) {
    const type = String(field.type);
    const m = type.match(/^(many2one|one2many|many2many)\((.+)\)$/);
    if (!m) continue;

    const kind =
      m[1] === 'many2one' ? 'many_to_one' : m[1] === 'one2many' ? 'one_to_many' : 'many_to_many';

    relationships.push({
      fromEntity,
      toEntity: m[2],
      kind,
      fromField: field.name,
      toField: 'id',
    });
  }
  return relationships;
}

function main() {
  const manifest = readJson(manifestPath);
  const upstream = manifest?.upstream ?? {};
  const commit = typeof upstream?.commit === 'string' ? upstream.commit.trim() : '';

  if (commit.length === 0) {
    throw new Error(
      `Missing upstream.commit in ${path.relative(repoRoot, manifestPath)} (run npm run domain-atlas:vendor -- --only odoo)`,
    );
  }

  if (!fs.existsSync(basePartnerPath)) {
    throw new Error(
      `Missing upstream file: ${path.relative(repoRoot, basePartnerPath)} (run npm run domain-atlas:vendor -- --only odoo)`,
    );
  }

  const baseLines = fs.readFileSync(basePartnerPath, 'utf8').split(/\r?\n/);
  const accountLines = fs.existsSync(accountPartnerPath)
    ? fs.readFileSync(accountPartnerPath, 'utf8').split(/\r?\n/)
    : [];

  const baseCategoryBlock = sliceClassBlock(baseLines, 'ResPartnerCategory');
  const basePartnerBlock = sliceClassBlock(baseLines, 'ResPartner');

  // Odoo extends res.partner across many addons. For MVP we only merge a small
  // set of fields from base + account (role ranks).
  const accountPartnerBlock =
    accountLines.length > 0 ? sliceClassBlock(accountLines, 'ResPartner') : [];

  const categoryFieldsAll = extractOdooFieldsFromBlock(baseCategoryBlock);
  const partnerFieldsBase = extractOdooFieldsFromBlock(basePartnerBlock);
  const partnerFieldsAccount = extractOdooFieldsFromBlock(accountPartnerBlock);

  const partnerFieldsAll = uniqByName([
    ...partnerFieldsBase,
    ...partnerFieldsAccount,
    // Odoo ORM always provides integer primary key `id`.
    { name: 'id', type: 'integer', required: true },
  ]);

  const categoryFields = uniqByName([
    ...categoryFieldsAll,
    { name: 'id', type: 'integer', required: true },
  ]);

  const partnerAllow = [
    'id',
    'name',
    'is_company',
    'company_type',
    'parent_id',
    'child_ids',
    'type',
    'active',
    'employee',
    'email',
    'phone',
    'street',
    'street2',
    'city',
    'zip',
    'state_id',
    'country_id',
    'vat',
    'company_registry',
    'category_id',
    'commercial_partner_id',
    'customer_rank',
    'supplier_rank',
  ];

  const categoryAllow = [
    'id',
    'name',
    'active',
    'color',
    'parent_id',
    'child_ids',
    'parent_path',
    'partner_ids',
  ];

  const partnerFields = pick(partnerFieldsAll, partnerAllow);
  const categoryFieldsPicked = pick(categoryFields, categoryAllow);

  const relationships = [
    ...deriveRelationships('res.partner', partnerFields),
    ...deriveRelationships('res.partner.category', categoryFieldsPicked),
  ];

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId: manifest.providerId,
      providerName: manifest.providerName,
      upstream: {
        repoUrl: upstream.repoUrl,
        commit,
        version: upstream.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities: [
      {
        name: 'res.partner.category',
        description: 'Partner tags (used for labeling / segmentation).',
        primaryKeys: ['id'],
        fields: categoryFieldsPicked,
      },
      {
        name: 'res.partner',
        description:
          'Unified Party entity: person/company/contact address. Field set is a minimal MVP subset; see upstream sources for full model.',
        primaryKeys: ['id'],
        fields: partnerFields,
      },
    ],
    relationships,
    extensionPoints: {
      tags: {
        supported: true,
        notes:
          'Partner tags are represented by res.partner.category and linked via res.partner.category.partner_ids / res.partner.category_id.',
      },
      customFields: {
        supported: true,
        notes:
          'Odoo supports extensible models via dynamic fields (ir.model.fields / customizations). Not extracted yet; treat as provider extensions in the adapter ACL.',
      },
      attachments: {
        supported: true,
        notes:
          'Attachments are first-class via ir.attachment and mail thread mixins; not extracted in this MVP subset.',
      },
    },
  };

  ensureDir(outDir);
  fs.writeFileSync(outPath, `${JSON.stringify(cif, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ outPath: path.relative(repoRoot, outPath) }, null, 2)}\n`,
  );
}

main();

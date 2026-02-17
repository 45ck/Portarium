import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'mautic';

const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

const ENTITY_SPECS = [
  {
    entityName: 'Lead',
    phpFile: 'app/bundles/LeadBundle/Entity/Lead.php',
    primaryKey: 'id',
  },
  {
    entityName: 'Company',
    phpFile: 'app/bundles/LeadBundle/Entity/Company.php',
    primaryKey: 'id',
  },
  {
    entityName: 'LeadList',
    phpFile: 'app/bundles/LeadBundle/Entity/LeadList.php',
    primaryKey: 'id',
  },
  {
    entityName: 'Campaign',
    phpFile: 'app/bundles/CampaignBundle/Entity/Campaign.php',
    primaryKey: 'id',
  },
  {
    entityName: 'Email',
    phpFile: 'app/bundles/EmailBundle/Entity/Email.php',
    primaryKey: 'id',
  },
  {
    entityName: 'Asset',
    phpFile: 'app/bundles/AssetBundle/Entity/Asset.php',
    primaryKey: 'id',
  },
  {
    entityName: 'Tag',
    phpFile: 'app/bundles/LeadBundle/Entity/Tag.php',
    primaryKey: 'id',
  },
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function nowIsoUtc() {
  return new Date().toISOString();
}

function relPosix(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function stripComments(text) {
  // Keep it simple: remove block comments + line comments. Good enough for parsing builder calls.
  const withoutBlock = text.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock.replaceAll(/\/\/.*$/gm, '');
}

function parseStringLiteral(expr) {
  const m = /^\s*(['"])(?<value>[\s\S]*?)\1\s*$/.exec(String(expr));
  if (!m?.groups) return null;
  return m.groups.value;
}

function splitArgs(argsRaw) {
  const args = [];
  let cur = '';
  let depthParen = 0;
  let depthBrack = 0;
  let depthBrace = 0;
  let quote = null;
  let escape = false;

  const s = String(argsRaw ?? '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];

    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }

    if (quote) {
      cur += ch;
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }

    if (ch === '(') depthParen += 1;
    if (ch === ')') depthParen -= 1;
    if (ch === '[') depthBrack += 1;
    if (ch === ']') depthBrack -= 1;
    if (ch === '{') depthBrace += 1;
    if (ch === '}') depthBrace -= 1;

    if (ch === ',' && depthParen === 0 && depthBrack === 0 && depthBrace === 0) {
      const part = cur.trim();
      if (part.length > 0) args.push(part);
      cur = '';
      continue;
    }

    cur += ch;
  }

  const last = cur.trim();
  if (last.length > 0) args.push(last);
  return args;
}

function normalizeDoctrineType(typeExprRaw) {
  const typeExpr = String(typeExprRaw).trim();
  const lit = parseStringLiteral(typeExpr);
  if (lit) return lit;

  const typesConst = /^Types::(?<name>[A-Z0-9_]+)$/.exec(typeExpr);
  if (typesConst?.groups?.name) {
    const t = typesConst.groups.name;
    if (t === 'STRING') return 'string';
    if (t === 'TEXT') return 'text';
    if (t === 'INTEGER' || t === 'BIGINT' || t === 'SMALLINT') return 'integer';
    if (t === 'BOOLEAN') return 'boolean';
    if (t === 'FLOAT') return 'float';
    if (t === 'DECIMAL') return 'decimal';
    if (t === 'DATETIME_MUTABLE' || t === 'DATETIME_IMMUTABLE') return 'datetime';
    if (t === 'DATE_MUTABLE' || t === 'DATE_IMMUTABLE') return 'date';
    if (t === 'ARRAY') return 'array';
    if (t === 'JSON') return 'json';
    if (t === 'GUID') return 'uuid';
    return `doctrine:${t.toLowerCase()}`;
  }

  // Preserve unknown types (class constants, etc.) so CIF stays informative.
  return typeExpr;
}

function normalizeTargetEntity(exprRaw, entityName) {
  const expr = String(exprRaw).trim();

  if (expr === 'self::class' || expr === 'static::class') return entityName;

  const m = /^(?<base>[A-Za-z0-9_\\\\]+)::class$/.exec(expr);
  if (m?.groups?.base) {
    const parts = m.groups.base.split('\\');
    return parts[parts.length - 1];
  }

  const lit = parseStringLiteral(expr);
  if (lit) return lit;

  // Fall back to a raw token (best effort).
  return expr.replaceAll(/[^A-Za-z0-9_]/g, '').trim() || expr;
}

function extractLoadMetadataBody(textRaw) {
  const text = stripComments(textRaw);
  const lines = text.split(/\r?\n/g);

  // Find the function declaration line first, then brace-count.
  const fnRe = /\bfunction\s+loadMetadata\s*\(/;
  let startLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (fnRe.test(lines[i])) {
      startLine = i;
      break;
    }
  }
  if (startLine < 0) return null;

  // Find the first "{" after the function signature.
  let startIdx = -1;
  let flatIdx = 0;
  const joined = lines.join('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineStart = flatIdx;
    const lineEnd = flatIdx + line.length;
    if (i >= startLine) {
      const braceIdx = line.indexOf('{');
      if (braceIdx >= 0) {
        startIdx = lineStart + braceIdx + 1;
        break;
      }
    }
    flatIdx = lineEnd + 1;
  }
  if (startIdx < 0) return null;

  let depth = 1;
  for (let i = startIdx; i < joined.length; i += 1) {
    const ch = joined[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return joined.slice(startIdx, i);
    }
  }

  return null;
}

function resolveTableName(textRaw, tableExprRaw) {
  const tableExpr = String(tableExprRaw).trim();
  const lit = parseStringLiteral(tableExpr);
  if (lit) return lit;

  if (tableExpr === 'self::TABLE_NAME' || tableExpr === 'static::TABLE_NAME') {
    const m = /\bTABLE_NAME\s*=\s*(['"])(?<name>[^'"]+)\1\s*;/.exec(textRaw);
    if (m?.groups?.name) return m.groups.name;
  }

  return tableExpr;
}

function upsertField(fieldsByName, field) {
  const existing = fieldsByName.get(field.name);
  if (!existing) {
    fieldsByName.set(field.name, field);
    return;
  }

  // Merge nullability/required in a conservative direction.
  const required = Boolean(existing.required && field.required);
  const nullable = Boolean(existing.nullable || field.nullable);
  const description = [existing.description, field.description].filter(Boolean).join(' ');

  fieldsByName.set(field.name, {
    ...existing,
    ...field,
    required,
    ...(nullable ? { nullable: true } : {}),
    ...(description.length > 0 ? { description } : {}),
  });
}

function extractFromLoadMetadata(entityName, loadMetadataBody) {
  const fieldsByName = new Map();
  const relationships = [];

  function addRelationship(rel) {
    relationships.push(rel);

    const isToMany = rel.kind === 'one_to_many' || rel.kind === 'many_to_many';
    upsertField(fieldsByName, {
      name: rel.fromField,
      type: isToMany ? `array<${rel.toEntity}>` : rel.toEntity,
      required: false,
      nullable: true,
      description: 'relationship',
    });
  }

  // setTable(...)
  const tableMatch = /->setTable\(\s*(?<expr>[^)]+?)\s*\)/.exec(loadMetadataBody);
  const tableExpr = tableMatch?.groups?.expr?.trim() ?? null;

  // Builder convenience methods.
  for (const m of loadMetadataBody.matchAll(/\$builder->addIdColumns\(\s*(?<args>[^)]*)\)\s*;/g)) {
    const args = splitArgs(m.groups?.args ?? '');
    const nameCol = args.length >= 1 ? args[0].trim() : null;
    const descCol = args.length >= 2 ? args[1].trim() : null;

    // id
    upsertField(fieldsByName, { name: 'id', type: 'integer', required: true });

    const nameColValue =
      nameCol == null || nameCol.length === 0
        ? 'name'
        : nameCol === 'false' || nameCol === 'null'
          ? null
          : (parseStringLiteral(nameCol) ?? 'name');

    const descColValue =
      descCol == null || descCol.length === 0
        ? 'description'
        : descCol === 'false' || descCol === 'null'
          ? null
          : (parseStringLiteral(descCol) ?? 'description');

    if (nameColValue) {
      upsertField(fieldsByName, { name: nameColValue, type: 'string', required: true });
    }
    if (descColValue) {
      upsertField(fieldsByName, {
        name: descColValue,
        type: 'text',
        required: false,
        nullable: true,
      });
    }
  }

  if (/\$builder->addPublishDates\(\s*\)\s*;/.test(loadMetadataBody)) {
    upsertField(fieldsByName, {
      name: 'publishUp',
      type: 'datetime',
      required: false,
      nullable: true,
    });
    upsertField(fieldsByName, {
      name: 'publishDown',
      type: 'datetime',
      required: false,
      nullable: true,
    });
  }

  for (const m of loadMetadataBody.matchAll(
    /\$builder->addNullableField\(\s*(?<q>['"])(?<name>[^'"]+)\k<q>(?:\s*,\s*(?<typeExpr>[^,)]+?))?(?:\s*,\s*(?<colExpr>[^,)]+?))?\s*\)\s*;/g,
  )) {
    const name = m.groups?.name?.trim();
    if (!name) continue;
    const type = normalizeDoctrineType(m.groups?.typeExpr ?? 'string');
    const col = m.groups?.colExpr ? parseStringLiteral(m.groups.colExpr) : null;

    upsertField(fieldsByName, {
      name,
      type,
      required: false,
      nullable: true,
      ...(col ? { description: `columnName: ${col}` } : {}),
    });
  }

  for (const m of loadMetadataBody.matchAll(
    /\$builder->addNamedField\(\s*(?<q>['"])(?<name>[^'"]+)\k<q>\s*,\s*(?<typeExpr>[^,)]+?)\s*,\s*(?<colExpr>[^,)]+?)\s*(?:,\s*(?<nullable>true|false))?\s*\)\s*;/g,
  )) {
    const name = m.groups?.name?.trim();
    if (!name) continue;
    const type = normalizeDoctrineType(m.groups?.typeExpr);
    const col = parseStringLiteral(m.groups?.colExpr ?? '');
    const nullable = m.groups?.nullable === 'true';

    upsertField(fieldsByName, {
      name,
      type,
      required: !nullable,
      ...(nullable ? { nullable: true } : {}),
      ...(col ? { description: `columnName: ${col}` } : {}),
    });
  }

  // addField('foo', Types::BOOLEAN, [...])
  for (const m of loadMetadataBody.matchAll(
    /\$builder->addField\(\s*(?<q>['"])(?<name>[^'"]+)\k<q>\s*,\s*(?<typeExpr>[^,)]+?)\s*(?:,\s*(?<mapping>\[[\s\S]*?\]))?\s*\)\s*;/g,
  )) {
    const name = m.groups?.name?.trim();
    if (!name) continue;
    const type = normalizeDoctrineType(m.groups?.typeExpr);
    const mapping = m.groups?.mapping ?? '';
    const nullable = /\bnullable\s*=>\s*true\b/.test(mapping);

    upsertField(fieldsByName, {
      name,
      type,
      required: !nullable,
      ...(nullable ? { nullable: true } : {}),
    });
  }

  // createField('foo', Types::STRING)->columnName('bar')->nullable()->build();
  for (const m of loadMetadataBody.matchAll(
    /\$builder->createField\(\s*(?<q>['"])(?<name>[^'"]+)\k<q>\s*,\s*(?<typeExpr>[^)]+?)\s*\)\s*(?<chain>[\s\S]*?)->build\(\);/g,
  )) {
    const name = m.groups?.name?.trim();
    if (!name) continue;

    const type = normalizeDoctrineType(m.groups?.typeExpr);
    const chain = String(m.groups?.chain ?? '');

    const nullable = /->nullable\(\s*\)/.test(chain);
    const colMatch = /->columnName\(\s*(?<q>['"])(?<col>[^'"]+)\k<q>\s*\)/.exec(chain);
    const col = colMatch?.groups?.col;

    upsertField(fieldsByName, {
      name,
      type,
      required: !nullable,
      ...(nullable ? { nullable: true } : {}),
      ...(col ? { description: `columnName: ${col}` } : {}),
    });
  }

  // addBigIntIdField(...)
  for (const m of loadMetadataBody.matchAll(
    /\$builder->addBigIntIdField\(\s*(?<args>[^)]*)\)\s*;/g,
  )) {
    const args = splitArgs(m.groups?.args ?? '');
    const fieldName = args.length >= 1 ? parseStringLiteral(args[0]) : null;
    upsertField(fieldsByName, {
      name: fieldName || 'id',
      type: 'integer',
      required: true,
    });
  }

  // addCategory()
  const categoryCalls = loadMetadataBody.match(/\$builder->addCategory\(\s*\)\s*;/g)?.length ?? 0;
  for (let i = 0; i < categoryCalls; i += 1) {
    addRelationship({
      toEntity: 'Category',
      kind: 'many_to_one',
      fromField: 'category',
      toField: 'id',
      notes: 'added via ClassMetadataBuilder::addCategory()',
    });
  }

  // Relationships: createManyToOne/OneToMany/ManyToMany/OneToOne
  const relSpecs = [
    { fn: 'createManyToOne', kind: 'many_to_one' },
    { fn: 'createOneToMany', kind: 'one_to_many' },
    { fn: 'createManyToMany', kind: 'many_to_many' },
    { fn: 'createOneToOne', kind: 'one_to_one' },
  ];

  for (const spec of relSpecs) {
    const re = new RegExp(
      `\\$builder->${spec.fn}\\(\\s*(['"])(?<field>[^'"]+)\\1\\s*,\\s*(?<target>[^)]+?)\\)\\s*(?<chain>[\\s\\S]*?)->build\\(\\);`,
      'g',
    );

    for (const m of loadMetadataBody.matchAll(re)) {
      const fromField = m.groups?.field?.trim();
      const targetExpr = m.groups?.target?.trim();
      if (!fromField || !targetExpr) continue;

      const toEntity = normalizeTargetEntity(targetExpr, entityName);
      addRelationship({
        toEntity,
        kind: spec.kind,
        fromField,
        toField: 'id',
      });
    }
  }

  // Heuristic: loadFixedFieldMetadata($builder, ['a','b'], ...)
  for (const m of loadMetadataBody.matchAll(/loadFixedFieldMetadata\s*\(\s*\$builder\s*,\s*\[/g)) {
    // Find the bracketed list starting at the match position.
    const start = m.index + m[0].length - 1; // points at "["
    let depth = 0;
    let end = -1;
    for (let i = start; i < loadMetadataBody.length; i += 1) {
      const ch = loadMetadataBody[i];
      if (ch === '[') depth += 1;
      if (ch === ']') depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) continue;

    const arr = loadMetadataBody.slice(start + 1, end);
    for (const litMatch of arr.matchAll(/['"](?<name>[A-Za-z0-9_]+)['"]/g)) {
      const name = litMatch.groups?.name?.trim();
      if (!name) continue;
      upsertField(fieldsByName, {
        name,
        type: 'string',
        required: false,
        nullable: true,
        description: 'fixed field via loadFixedFieldMetadata',
      });
    }
  }

  return {
    tableExpr,
    fields: [...fieldsByName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    relationships,
  };
}

function extractEntity(spec) {
  const filePath = path.join(upstreamRoot, spec.phpFile);
  const raw = readText(filePath);
  const loadMetadataBody = extractLoadMetadataBody(raw);
  if (!loadMetadataBody) {
    throw new Error(`Missing loadMetadata() in ${relPosix(filePath)}`);
  }

  const extracted = extractFromLoadMetadata(spec.entityName, loadMetadataBody);
  const tableName = extracted.tableExpr ? resolveTableName(raw, extracted.tableExpr) : undefined;

  return {
    entity: {
      name: spec.entityName,
      description: `Extracted from ${relPosix(filePath)} (loadMetadata${
        tableName ? `, table=${tableName}` : ''
      }).`,
      primaryKeys: [spec.primaryKey],
      fields: extracted.fields,
    },
    relationships: extracted.relationships.map((r) => ({
      fromEntity: spec.entityName,
      toEntity: r.toEntity,
      kind: r.kind,
      ...(r.fromField ? { fromField: r.fromField } : {}),
      ...(r.toField ? { toField: r.toField } : {}),
      ...(r.notes ? { notes: r.notes } : {}),
    })),
  };
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit =
    typeof sourceManifest?.upstream?.commit === 'string' &&
    sourceManifest.upstream.commit.trim().length > 0
      ? sourceManifest.upstream.commit.trim()
      : undefined;

  const extracted = ENTITY_SPECS.map((s) => extractEntity(s));
  const entities = extracted.map((x) => x.entity);
  const relationships = extracted.flatMap((x) => x.relationships);

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId: sourceManifest.providerId,
      providerName: sourceManifest.providerName,
      upstream: {
        repoUrl: sourceManifest.upstream.repoUrl,
        ...(commit ? { commit } : {}),
        version: sourceManifest.upstream.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    ...(relationships.length > 0 ? { relationships } : {}),
    actions: [
      {
        name: 'createContact',
        kind: 'create',
        entities: ['Lead'],
        idempotency: { supported: false },
        notes: 'API supports POST /contacts; no provider idempotency keys are exposed.',
      },
      {
        name: 'updateContact',
        kind: 'update',
        entities: ['Lead'],
        idempotency: { supported: false },
        notes:
          'API supports PUT/PATCH /contacts/{id}; adapters should prefer read-before-write diffs.',
      },
      {
        name: 'deleteContact',
        kind: 'delete',
        entities: ['Lead'],
        idempotency: { supported: false },
        notes: 'API supports DELETE /contacts/{id}; deletions are typically irreversible.',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: true,
        notes:
          'Contacts and companies support custom fields; adapter should surface these in an extension container to avoid canonical bloat.',
      },
      tags: {
        supported: true,
        notes: 'Contacts support tags; treat as a first-class extension point.',
      },
      attachments: {
        supported: true,
        notes:
          'Assets can be attached to emails; evidence/logging may store raw payload snapshots separately.',
      },
    },
  };

  writeJson(outPath, cif);
}

main();

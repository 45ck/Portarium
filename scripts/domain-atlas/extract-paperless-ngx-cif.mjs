import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'paperless-ngx';

const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

const MIGRATION_FILES = [
  'src/documents/migrations/0001_initial.py',
  'src/documents/migrations/0002_initial.py',
];

const TARGET_MODELS = new Set([
  'Document',
  'Tag',
  'Correspondent',
  'DocumentType',
  'StoragePath',
  'CustomField',
  'CustomFieldInstance',
  'Note',
]);

function nowIsoUtc() {
  return new Date().toISOString();
}

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

function deltaIgnoringStrings(text, openChar, closeChar) {
  const s = String(text ?? '');
  let delta = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];

    if (!inSingle && !inDouble && ch === '#') {
      break; // python comment
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble) && ch === '\\') {
      escaped = true;
      continue;
    }

    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (inSingle || inDouble) continue;

    if (ch === openChar) delta += 1;
    else if (ch === closeChar) delta -= 1;
  }

  return delta;
}

function captureParenBlock(lines, startIndex) {
  const block = [];
  let depth = 0;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    block.push(line);
    depth += deltaIgnoringStrings(line, '(', ')');

    if (i === startIndex && depth < 0) {
      throw new Error(`Unexpected close paren at line ${startIndex + 1} (depth=${depth}).`);
    }
    if (depth === 0) {
      return { block, endIndex: i };
    }
  }

  throw new Error(`Unterminated parentheses block starting at line ${startIndex + 1}.`);
}

function extractCreateModelBlocks(migrationText) {
  const lines = String(migrationText).split(/\r?\n/);
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!/\bmigrations\.CreateModel\s*\(/.test(line)) continue;

    const { block, endIndex } = captureParenBlock(lines, i);
    blocks.push(block);
    i = endIndex;
  }

  return blocks;
}

function extractAddConstraintBlocks(migrationText) {
  const lines = String(migrationText).split(/\r?\n/);
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!/\bmigrations\.AddConstraint\s*\(/.test(line)) continue;

    const { block, endIndex } = captureParenBlock(lines, i);
    blocks.push(block);
    i = endIndex;
  }

  return blocks;
}

function extractModelName(createModelBlockLines) {
  const text = createModelBlockLines.join('\n');
  const m = /\bname\s*=\s*["'](?<name>[^"']+)["']/.exec(text);
  return m?.groups?.name ?? null;
}

function extractAddConstraintModelName(addConstraintBlockLines) {
  const text = addConstraintBlockLines.join('\n');
  const m = /\bmodel_name\s*=\s*["'](?<name>[^"']+)["']/.exec(text);
  return m?.groups?.name ?? null;
}

function readStringLiteral(raw) {
  const v = String(raw ?? '').trim();
  const single = /^'(?<s>.*)'$/.exec(v);
  if (single?.groups) return single.groups.s;
  const dbl = /^"(?<s>.*)"$/.exec(v);
  if (dbl?.groups) return dbl.groups.s;
  return null;
}

function parseLiteral(raw) {
  const v = String(raw ?? '').trim();
  if (v === 'True') return true;
  if (v === 'False') return false;
  if (v === 'None') return null;
  if (/^-?\d+$/.test(v)) return Number(v);

  const s = readStringLiteral(v);
  if (s !== null) return s;

  return undefined;
}

function extractUniqueConstraints(createModelBlockLines) {
  const out = [];

  for (let i = 0; i < createModelBlockLines.length; i += 1) {
    const line = createModelBlockLines[i] ?? '';
    if (!line.includes('models.UniqueConstraint')) continue;

    const { block, endIndex } = captureParenBlock(createModelBlockLines, i);
    i = endIndex;

    const callText = block.join('\n');
    const tupleMatch = /\bfields\s*=\s*\((?<fields>[^)]*)\)/.exec(callText);
    const listMatch = /\bfields\s*=\s*\[(?<fields>[^\]]*)\]/.exec(callText);
    const fieldsRaw = tupleMatch?.groups?.fields ?? listMatch?.groups?.fields;
    if (!fieldsRaw) continue;

    const fields = Array.from(String(fieldsRaw).matchAll(/["'](?<f>[^"']+)["']/g))
      .map((mm) => mm.groups?.f)
      .filter((f) => typeof f === 'string' && f.length > 0);
    if (fields.length > 0) out.push(fields);
  }

  return out;
}

function dedupeConstraints(constraints) {
  const seen = new Set();
  const out = [];

  for (const c of constraints) {
    const key = JSON.stringify(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }

  return out;
}

function normalizeDjangoFieldType(fieldType, toEntity) {
  const t = String(fieldType).trim();
  if (t === 'ForeignKey') return `many2one(${toEntity ?? 'unknown'})`;
  if (t === 'OneToOneField') return `one2one(${toEntity ?? 'unknown'})`;
  if (t === 'ManyToManyField') return `many2many(${toEntity ?? 'unknown'})`;

  const asString = new Set([
    'CharField',
    'TextField',
    'SlugField',
    'EmailField',
    'URLField',
    'FilePathField',
  ]);
  if (asString.has(t)) return 'string';

  if (t === 'UUIDField') return 'uuid';
  if (t === 'BooleanField') return 'boolean';
  if (t === 'DateTimeField') return 'datetime';
  if (t === 'DateField') return 'date';

  const asInteger = new Set([
    'AutoField',
    'BigAutoField',
    'IntegerField',
    'BigIntegerField',
    'SmallIntegerField',
    'PositiveIntegerField',
    'PositiveSmallIntegerField',
  ]);
  if (asInteger.has(t)) return 'integer';

  if (t === 'FloatField') return 'float';
  if (t === 'DecimalField') return 'decimal';
  if (t === 'JSONField') return 'json';
  if (t === 'FileField' || t === 'ImageField') return 'file';
  if (t === 'GeneratedField') return 'generated';

  return t;
}

function extractFieldDescription(tupleText) {
  const helpText = /\bhelp_text\s*=\s*["'](?<t>[^"']+)["']/.exec(tupleText)?.groups?.t;
  if (helpText) return helpText;
  const verbose = /\bverbose_name\s*=\s*["'](?<t>[^"']+)["']/.exec(tupleText)?.groups?.t;
  if (verbose) return verbose;
  return undefined;
}

function extractFieldDefault(tupleText) {
  const m = /\bdefault\s*=\s*(?<v>[^,\n)]+)/.exec(tupleText);
  if (!m?.groups) return undefined;
  return parseLiteral(m.groups.v);
}

function parseFieldsAndRelationships(createModelBlockLines, modelNameMap) {
  const entitiesFields = [];
  const relationships = [];
  const uniqueFieldConstraints = [];

  const startIdx = createModelBlockLines.findIndex((l) => /\bfields\s*=\s*\[/.test(l));
  if (startIdx === -1) return { fields: entitiesFields, relationships, uniqueConstraints: [] };

  const lines = createModelBlockLines;
  const fieldLines = [];
  let depth = 0;

  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    depth += deltaIgnoringStrings(line, '[', ']');
    if (i === startIdx) continue; // skip "fields=["

    fieldLines.push(line);
    if (depth === 0) break;
  }

  // Parse tuples inside the fields list by capturing (...) blocks.
  for (let i = 0; i < fieldLines.length; i += 1) {
    const line = fieldLines[i] ?? '';
    const trimmed = String(line).trim();
    const isTupleStart = trimmed === '(' || /^\(\s*["']/.test(trimmed);
    if (!isTupleStart) continue;

    const { block: tupleLines, endIndex } = captureParenBlock(fieldLines, i);
    i = endIndex;

    const tupleText = tupleLines.join('\n');

    const nameMatch = /\(\s*["'](?<name>[^"']+)["']\s*,/.exec(tupleText);
    const fieldName = nameMatch?.groups?.name;
    if (!fieldName) continue;

    const typeMatch = /\b(models|multiselectfield\.db\.fields)\.(?<t>[A-Za-z0-9_]+)\s*\(/.exec(
      tupleText,
    );
    const fieldTypeRaw = typeMatch?.groups?.t ?? 'unknown';

    const nullTrue = /\bnull\s*=\s*True\b/.test(tupleText);
    const blankTrue = /\bblank\s*=\s*True\b/.test(tupleText);
    const uniqueTrue = /\bunique\s*=\s*True\b/.test(tupleText);
    const primaryKeyTrue = /\bprimary_key\s*=\s*True\b/.test(tupleText);

    const toArg = /\bto\s*=\s*(?<to>[^,\n)]+)/.exec(tupleText)?.groups?.to;
    const toLiteral = readStringLiteral(toArg);
    const toKey = toLiteral ? toLiteral.split('.').at(-1) : null;
    const toEntity =
      toKey && modelNameMap[toKey.toLowerCase()] ? modelNameMap[toKey.toLowerCase()] : toLiteral;

    const normalizedType = normalizeDjangoFieldType(fieldTypeRaw, toEntity ?? toArg?.trim());
    const required =
      primaryKeyTrue || fieldTypeRaw === 'AutoField' || fieldTypeRaw === 'BigAutoField'
        ? true
        : !(nullTrue || blankTrue);

    const defaultValue = extractFieldDefault(tupleText);
    const description = extractFieldDescription(tupleText);

    const field = {
      name: fieldName,
      type: normalizedType,
      required,
      ...(nullTrue ? { nullable: true } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      ...(description ? { description } : {}),
    };
    entitiesFields.push(field);

    if (uniqueTrue) uniqueFieldConstraints.push([fieldName]);

    if (
      fieldTypeRaw === 'ForeignKey' ||
      fieldTypeRaw === 'OneToOneField' ||
      fieldTypeRaw === 'ManyToManyField'
    ) {
      const kind =
        fieldTypeRaw === 'ForeignKey'
          ? 'many_to_one'
          : fieldTypeRaw === 'OneToOneField'
            ? 'one_to_one'
            : 'many_to_many';

      relationships.push({
        fromEntity: '__MODEL__', // replaced by caller
        toEntity: toEntity ?? toArg?.trim() ?? 'unknown',
        kind,
        fromField: fieldName,
        toField: 'id',
      });
    }
  }

  const uniqueConstraints = [...uniqueFieldConstraints];
  for (const c of extractUniqueConstraints(createModelBlockLines)) uniqueConstraints.push(c);

  return {
    fields: entitiesFields,
    relationships,
    uniqueConstraints: dedupeConstraints(uniqueConstraints),
  };
}

function buildModelNameMap(allModelNames) {
  const map = {};
  for (const name of allModelNames) {
    map[String(name).toLowerCase()] = name;
  }
  return map;
}

function main() {
  const manifest = readJson(sourceManifestPath);
  const upstream = manifest?.upstream ?? {};
  const commit = typeof upstream?.commit === 'string' ? upstream.commit.trim() : '';

  if (commit.length === 0) {
    throw new Error(
      `Missing upstream.commit in ${path.relative(repoRoot, sourceManifestPath)} (run npm run domain-atlas:vendor -- --only paperless-ngx)`,
    );
  }

  const migrationPaths = MIGRATION_FILES.map((p) => path.join(upstreamRoot, p));
  for (const p of migrationPaths) {
    if (!fs.existsSync(p)) {
      throw new Error(
        `Missing upstream file: ${path.relative(repoRoot, p)} (run domain-atlas:vendor)`,
      );
    }
  }

  const migrationTexts = migrationPaths.map((p) => readText(p));
  const createModelBlocks = migrationTexts.flatMap((t) => extractCreateModelBlocks(t));
  const modelNamesAll = createModelBlocks
    .map((b) => extractModelName(b))
    .filter((n) => typeof n === 'string' && n.length > 0);

  const modelNameMap = buildModelNameMap(modelNamesAll);

  const additionalUniqueConstraintsByModel = {};
  for (const text of migrationTexts) {
    for (const block of extractAddConstraintBlocks(text)) {
      const rawModelName = extractAddConstraintModelName(block);
      if (!rawModelName) continue;

      const modelName = modelNameMap[rawModelName.toLowerCase()];
      if (!modelName || !TARGET_MODELS.has(modelName)) continue;

      const extra = extractUniqueConstraints(block);
      if (extra.length === 0) continue;

      additionalUniqueConstraintsByModel[modelName] ??= [];
      additionalUniqueConstraintsByModel[modelName].push(...extra);
    }
  }

  const entities = [];
  const relationships = [];

  for (const block of createModelBlocks) {
    const modelName = extractModelName(block);
    if (!modelName || !TARGET_MODELS.has(modelName)) continue;

    const parsed = parseFieldsAndRelationships(block, modelNameMap);
    if (parsed.fields.length === 0) continue;

    const primaryKeys = parsed.fields.some((f) => f.name === 'id') ? ['id'] : [];

    const extraConstraints = additionalUniqueConstraintsByModel[modelName] ?? [];
    const uniqueConstraints = dedupeConstraints([...parsed.uniqueConstraints, ...extraConstraints]);

    entities.push({
      name: modelName,
      primaryKeys,
      ...(uniqueConstraints.length > 0 ? { uniqueConstraints } : {}),
      fields: parsed.fields,
    });

    for (const rel of parsed.relationships) {
      relationships.push({ ...rel, fromEntity: modelName });
    }
  }

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
    entities: entities.sort((a, b) => a.name.localeCompare(b.name)),
    ...(relationships.length > 0 ? { relationships } : {}),
    extensionPoints: {
      tags: {
        supported: true,
        notes: 'Tag model + Document.tags many-to-many relationship.',
      },
      attachments: {
        supported: true,
        notes:
          'Documents represent stored files with original/archive filename fields. Treat content as sensitive by default.',
      },
      customFields: {
        supported: true,
        notes: 'CustomField + CustomFieldInstance provide extensible metadata on Documents.',
      },
      comments: {
        supported: true,
        notes: 'Note model provides per-document notes/comments.',
      },
    },
  };

  writeJson(outPath, cif);
}

main();

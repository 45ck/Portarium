import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'zammad';

const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

// For initial extraction we focus on the foundational migrations that create core tables.
// Zammad does not ship a committed db/schema.rb in this repo.
const MIGRATION_FILES = [
  'db/migrate/20120101000001_create_base.rb',
  'db/migrate/20120101000010_create_ticket.rb',
];

const TARGET_TABLES = new Set([
  'users',
  'organizations',
  'groups',
  'tickets',
  'ticket_articles',
  'ticket_states',
  'ticket_priorities',
  'ticket_article_types',
  'ticket_article_senders',
  'stores',
  'store_files',
  'store_objects',
  'tags',
  'tag_items',
  'tag_objects',
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

function indentLen(line) {
  const m = /^(\s*)/.exec(line);
  return m ? m[1].length : 0;
}

function normalizeRailsType(typeRaw) {
  const t = String(typeRaw).trim().toLowerCase();
  if (t === 'string' || t === 'text') return 'string';
  if (t === 'integer' || t === 'bigint') return 'integer';
  if (t === 'boolean') return 'boolean';
  if (t === 'timestamp' || t === 'datetime') return 'datetime';
  if (t === 'date') return 'date';
  if (t === 'decimal') return 'decimal';
  if (t === 'binary') return 'binary';
  return t;
}

function parseLiteral(raw) {
  const v = String(raw).trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);

  // Ruby uses '' for empty string. Support both single and double quotes.
  const single = /^'(?<s>.*)'$/.exec(v);
  if (single?.groups) return single.groups.s;
  const dbl = /^"(?<s>.*)"$/.exec(v);
  if (dbl?.groups) return dbl.groups.s;

  return undefined;
}

function parseOptions(optionsRaw) {
  const text = String(optionsRaw ?? '')
    .trim()
    .replace(/^,/, '')
    .trim();

  const out = {};
  const re = /(?<k>[a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?<v>[^,]+)(?:,|$)/g;
  for (const m of text.matchAll(re)) {
    if (!m.groups) continue;
    out[m.groups.k] = String(m.groups.v).trim();
  }

  return out;
}

function tableToEntityName(tableNameRaw) {
  const tableName = String(tableNameRaw).trim();
  let s = tableName;
  if (s.endsWith('ies') && s.length > 3) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith('s') && s.length > 1) s = s.slice(0, -1);

  return s
    .split('_')
    .filter((p) => p.length > 0)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

function consumeCreateTableBlock(lines, startIndex) {
  const startLine = lines[startIndex] ?? '';
  const startIndent = indentLen(startLine);
  const body = [];

  let endIndex = -1;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trim() === 'end' && indentLen(line) === startIndent) {
      endIndex = i;
      break;
    }
    body.push(line);
  }

  if (endIndex < 0) {
    throw new Error(`Unterminated create_table block starting at line ${startIndex + 1}.`);
  }

  return { body, endIndex };
}

function addField(fields, field) {
  if (fields.some((f) => f.name === field.name)) return;
  fields.push(field);
}

function parseFieldLine(lineRaw) {
  const line = String(lineRaw).trim();
  if (line.length === 0) return null;
  if (line.startsWith('#')) return null;

  if (/^t\.timestamps\b/.test(line)) {
    const opts = parseOptions(line.replace(/^t\.timestamps\b/, ''));
    const nullRaw = opts.null;
    const required = nullRaw === 'false';
    const nullable = nullRaw === 'true';
    return [
      {
        name: 'created_at',
        type: 'datetime',
        required,
        ...(nullable ? { nullable: true } : {}),
      },
      {
        name: 'updated_at',
        type: 'datetime',
        required,
        ...(nullable ? { nullable: true } : {}),
      },
    ];
  }

  const refMatch = /^t\.(references|belongs_to)\s+:(?<name>[a-zA-Z0-9_]+)\b(?<opts>.*)$/.exec(line);
  if (refMatch?.groups) {
    const refName = refMatch.groups.name;
    const opts = parseOptions(refMatch.groups.opts);
    const nullRaw = opts.null;
    const required = nullRaw === 'false';
    const nullable = nullRaw === 'true';

    const desc = [`reference:${refName}`];
    if (opts.polymorphic === 'true') desc.push('polymorphic:true');

    return [
      {
        name: `${refName}_id`,
        type: 'integer',
        required,
        ...(nullable ? { nullable: true } : {}),
        description: desc.join(' '),
      },
    ];
  }

  const columnMatch =
    /^t\.column\s+:(?<name>[a-zA-Z0-9_]+)\s*,\s*:(?<type>[a-zA-Z0-9_]+)\b(?<opts>.*)$/.exec(line);
  if (columnMatch?.groups) {
    const name = columnMatch.groups.name;
    const type = normalizeRailsType(columnMatch.groups.type);
    const opts = parseOptions(columnMatch.groups.opts);
    const nullRaw = opts.null;
    const required = nullRaw === 'false';
    const nullable = nullRaw === 'true';
    const def = opts.default !== undefined ? parseLiteral(opts.default) : undefined;

    const descParts = [];
    if (opts.limit !== undefined) descParts.push(`limit:${opts.limit}`);
    if (opts.precision !== undefined) descParts.push(`precision:${opts.precision}`);
    if (opts.scale !== undefined) descParts.push(`scale:${opts.scale}`);

    return [
      {
        name,
        type,
        required,
        ...(nullable ? { nullable: true } : {}),
        ...(def !== undefined ? { default: def } : {}),
        ...(descParts.length > 0 ? { description: descParts.join(' ') } : {}),
      },
    ];
  }

  const typedMatch = /^t\.(?<type>[a-zA-Z0-9_]+)\s+:(?<name>[a-zA-Z0-9_]+)\b(?<opts>.*)$/.exec(
    line,
  );
  if (typedMatch?.groups) {
    const name = typedMatch.groups.name;
    const type = normalizeRailsType(typedMatch.groups.type);
    const opts = parseOptions(typedMatch.groups.opts);
    const nullRaw = opts.null;
    const required = nullRaw === 'false';
    const nullable = nullRaw === 'true';
    const def = opts.default !== undefined ? parseLiteral(opts.default) : undefined;

    const descParts = [];
    if (opts.limit !== undefined) descParts.push(`limit:${opts.limit}`);
    if (opts.precision !== undefined) descParts.push(`precision:${opts.precision}`);
    if (opts.scale !== undefined) descParts.push(`scale:${opts.scale}`);

    return [
      {
        name,
        type,
        required,
        ...(nullable ? { nullable: true } : {}),
        ...(def !== undefined ? { default: def } : {}),
        ...(descParts.length > 0 ? { description: descParts.join(' ') } : {}),
      },
    ];
  }

  return null;
}

function extractTablesFromMigration(fileRel) {
  const filePath = path.join(upstreamRoot, fileRel);
  const lines = readText(filePath).split(/\r?\n/g);

  const out = new Map();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const m = /^\s*create_table\s+:(?<table>[a-zA-Z0-9_]+)\b/.exec(line);
    if (!m?.groups) continue;

    const table = m.groups.table;
    const { body, endIndex } = consumeCreateTableBlock(lines, i);
    i = endIndex;

    if (!TARGET_TABLES.has(table)) continue;

    const fields = [];

    // Rails creates `id` by default for create_table unless id: false is passed.
    // We keep `id` in CIF as the primary key anchor.
    addField(fields, { name: 'id', type: 'integer', required: true });

    for (const bodyLine of body) {
      const parsed = parseFieldLine(bodyLine);
      if (!parsed) continue;
      for (const f of parsed) addField(fields, f);
    }

    out.set(table, fields);
  }

  return out;
}

function main() {
  const manifest = readJson(sourceManifestPath);

  const upstreamCommit = String(manifest?.upstream?.commit ?? '').trim();
  if (upstreamCommit.length === 0) {
    throw new Error(
      `Missing upstream.commit in ${path.relative(repoRoot, sourceManifestPath)} (run npm run domain-atlas:vendor -- --only zammad)`,
    );
  }

  const entitiesByName = new Map();

  for (const fileRel of MIGRATION_FILES) {
    const found = extractTablesFromMigration(fileRel);
    for (const [table, fields] of found.entries()) {
      const entityName = tableToEntityName(table);
      if (entitiesByName.has(entityName)) continue;

      entitiesByName.set(entityName, {
        name: entityName,
        description: `Extracted from ${path
          .join('domain-atlas', 'upstreams', providerId, fileRel)
          .split(path.sep)
          .join('/')} (create_table :${table}).`,
        primaryKeys: ['id'],
        fields,
      });
    }
  }

  const entities = Array.from(entitiesByName.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (entities.length === 0) {
    throw new Error('No entities extracted (targets missing?).');
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: manifest.providerName,
      upstream: {
        repoUrl: manifest.upstream.repoUrl,
        commit: upstreamCommit,
        version: manifest.upstream.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
  };

  writeJson(outPath, cif);
}

main();

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'openfga';

const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

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

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required upstream file: ${relPosix(filePath)}`);
  }
}

function stripProtoComments(text) {
  const s = String(text ?? '');
  let out = '';

  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    const next = s[i + 1] ?? '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  return out;
}

function extractBraceBlock(text, braceStartIndex) {
  if (text[braceStartIndex] !== '{') {
    throw new Error(`Expected '{' at index ${braceStartIndex}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = braceStartIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { body: text.slice(braceStartIndex + 1, i), endIndex: i + 1 };
      }
    }
  }

  throw new Error(`Unterminated '{' block starting at index ${braceStartIndex}`);
}

function normalizeProtoType(raw) {
  const t = String(raw ?? '').trim();

  const scalar = new Map([
    ['string', 'string'],
    ['bool', 'boolean'],
    ['bytes', 'bytes'],
    ['double', 'float'],
    ['float', 'float'],
    ['int32', 'integer'],
    ['int64', 'integer'],
    ['uint32', 'integer'],
    ['uint64', 'integer'],
    ['sint32', 'integer'],
    ['sint64', 'integer'],
    ['fixed32', 'integer'],
    ['fixed64', 'integer'],
    ['sfixed32', 'integer'],
    ['sfixed64', 'integer'],
  ]);
  if (scalar.has(t)) return scalar.get(t);

  if (t === 'google.protobuf.Timestamp') return 'timestamp';
  if (t === 'google.protobuf.Struct') return 'struct';

  const mapMatch = /^map\s*<\s*(?<k>[^,>]+)\s*,\s*(?<v>[^>]+)\s*>$/.exec(t);
  if (mapMatch?.groups) {
    const k = normalizeProtoType(mapMatch.groups.k) ?? mapMatch.groups.k.trim();
    const v = normalizeProtoType(mapMatch.groups.v) ?? mapMatch.groups.v.trim();
    return `map<${k},${v}>`;
  }

  return t;
}

function extractMessageBlocks(protoText) {
  const text = stripProtoComments(protoText);
  const out = [];

  const re = /\bmessage\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  for (const m of text.matchAll(re)) {
    const name = m.groups?.name;
    if (!name) continue;

    const braceStart = m.index + m[0].length - 1;
    const { body, endIndex } = extractBraceBlock(text, braceStart);
    out.push({ name, body, startIndex: m.index, endIndex });
  }

  return out;
}

function extractServiceBlock(protoText, serviceName) {
  const text = stripProtoComments(protoText);
  const re = new RegExp(`\\bservice\\s+${serviceName}\\s*\\{`);
  const m = re.exec(text);
  if (!m) return null;

  const braceStart = m.index + m[0].length - 1;
  const { body } = extractBraceBlock(text, braceStart);
  return body;
}

function extractFieldsFromMessageBody(body) {
  const fields = [];

  const fieldRe =
    /^\s*(?<label>repeated\s+)?(?<type>map\s*<[^>]+>|[A-Za-z_][A-Za-z0-9_\\.]*?)\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<num>\d+)/gm;

  for (const m of body.matchAll(fieldRe)) {
    const labelRaw = m.groups?.label ?? '';
    const typeRaw = m.groups?.type ?? 'unknown';
    const name = m.groups?.name ?? '';

    const start = m.index ?? 0;
    const endSemi = body.indexOf(';', start);
    const statement = endSemi === -1 ? body.slice(start) : body.slice(start, endSemi + 1);
    const required = /\bfield_behavior\)\s*=\s*REQUIRED\b/.test(statement);

    const normalizedType = normalizeProtoType(typeRaw) ?? 'unknown';
    const type = labelRaw.trim().startsWith('repeated')
      ? `array<${normalizedType}>`
      : normalizedType;

    fields.push({ name, type, required });
  }

  const byName = new Map();
  for (const f of fields) {
    if (!byName.has(f.name)) byName.set(f.name, f);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function lowerFirst(str) {
  const s = String(str);
  if (s.length === 0) return s;
  return s[0].toLowerCase() + s.slice(1);
}

function actionKindForRpc(rpcName) {
  if (rpcName === 'WriteAuthorizationModel') return 'create';
  if (rpcName.startsWith('Create')) return 'create';
  if (rpcName.startsWith('Delete')) return 'delete';
  if (rpcName.startsWith('Write')) return 'update';
  return 'other';
}

function actionIdempotencyForRpc(rpcName) {
  if (rpcName === 'Write') {
    return {
      supported: true,
      notes:
        'Not idempotent by default; callers can opt into idempotent behavior via on_duplicate: ignore and on_missing: ignore.',
    };
  }
  if (
    rpcName === 'BatchCheck' ||
    rpcName.startsWith('Read') ||
    rpcName.startsWith('List') ||
    rpcName.startsWith('Streamed') ||
    rpcName === 'GetStore' ||
    rpcName === 'Check' ||
    rpcName === 'Expand'
  ) {
    return { supported: true };
  }
  return { supported: false };
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commitRaw = sourceManifest?.upstream?.commit;
  const commit =
    typeof commitRaw === 'string' && commitRaw.trim().length > 0 ? commitRaw.trim() : '';

  if (commit.length === 0) {
    throw new Error(
      `Missing upstream.commit in ${relPosix(sourceManifestPath)} (run npm run domain-atlas:vendor -- --only openfga)`,
    );
  }

  const protoFiles = [
    path.join(upstreamRoot, 'openfga', 'v1', 'openfga.proto'),
    path.join(upstreamRoot, 'openfga', 'v1', 'authzmodel.proto'),
    path.join(upstreamRoot, 'openfga', 'v1', 'openfga_service.proto'),
    path.join(upstreamRoot, 'openfga', 'v1', 'openfga_service_consistency.proto'),
  ];
  for (const f of protoFiles) ensureFile(f);

  const targetMessages = new Set([
    'Store',
    'TupleKey',
    'TupleKeyWithoutCondition',
    'RelationshipCondition',
    'Tuple',
    'AuthorizationModel',
    'TypeDefinition',
    'Metadata',
    'RelationReference',
  ]);

  const primaryKeysByEntity = {
    Store: ['id'],
    TupleKey: ['object', 'relation', 'user'],
    TupleKeyWithoutCondition: ['object', 'relation', 'user'],
    AuthorizationModel: ['id'],
    TypeDefinition: ['type'],
  };

  const entitiesByName = new Map();

  for (const filePath of protoFiles) {
    const blocks = extractMessageBlocks(readText(filePath));
    for (const b of blocks) {
      if (!targetMessages.has(b.name)) continue;

      const fields = extractFieldsFromMessageBody(b.body);
      if (fields.length === 0) continue;

      const prev = entitiesByName.get(b.name);
      const sources = prev?.sources ? new Set(prev.sources) : new Set();
      sources.add(relPosix(filePath));

      entitiesByName.set(b.name, {
        name: b.name,
        sources: [...sources].sort((a, b2) => a.localeCompare(b2)),
        fields,
      });
    }
  }

  const entities = [...entitiesByName.values()]
    .map((e) => ({
      name: e.name,
      description: `Extracted from ${e.sources.join(', ')}.`,
      ...(primaryKeysByEntity[e.name] ? { primaryKeys: primaryKeysByEntity[e.name] } : {}),
      fields: e.fields,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (entities.length === 0) {
    throw new Error(`No entities extracted for ${providerId}.`);
  }

  const serviceBody = extractServiceBlock(readText(protoFiles[2]), 'OpenFGAService');
  const rpcRe =
    /\brpc\s+(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\(\s*(?<req>[A-Za-z0-9_\\.]+)\s*\)\s+returns\s*\(\s*(?:stream\s+)?(?<res>[A-Za-z0-9_\\.]+)\s*\)/g;

  const actions = [];
  if (serviceBody) {
    for (const m of serviceBody.matchAll(rpcRe)) {
      const rpcName = m.groups?.name;
      if (!rpcName) continue;

      actions.push({
        name: lowerFirst(rpcName),
        kind: actionKindForRpc(rpcName),
        idempotency: actionIdempotencyForRpc(rpcName),
      });
    }
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName:
        typeof sourceManifest?.providerName === 'string' &&
        sourceManifest.providerName.trim().length > 0
          ? sourceManifest.providerName.trim()
          : providerId,
      upstream: {
        repoUrl: sourceManifest?.upstream?.repoUrl,
        commit,
        version: sourceManifest?.upstream?.version,
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    ...(actions.length > 0 ? { actions } : {}),
    extensionPoints: {
      customFields: { supported: false },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
}

main();

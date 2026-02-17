import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'vault';

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
  { structName: 'MountInput', goFile: 'api/sys_mounts.go' },
  { structName: 'MountConfigInput', goFile: 'api/sys_mounts.go' },
  { structName: 'MountOutput', goFile: 'api/sys_mounts.go' },
  { structName: 'MountConfigOutput', goFile: 'api/sys_mounts.go' },
  { structName: 'EnableAuditOptions', goFile: 'api/sys_audit.go' },
  { structName: 'Audit', goFile: 'api/sys_audit.go' },
  { structName: 'TokenCreateRequest', goFile: 'api/auth_token.go' },
  { structName: 'Secret', goFile: 'api/secret.go' },
  { structName: 'SecretAuth', goFile: 'api/secret.go' },
  { structName: 'SecretWrapInfo', goFile: 'api/secret.go' },
  { structName: 'KVMetadata', goFile: 'api/kv_v2.go' },
  { structName: 'KVMetadataPutInput', goFile: 'api/kv_v2.go' },
  { structName: 'KVMetadataPatchInput', goFile: 'api/kv_v2.go' },
  { structName: 'KVVersionMetadata', goFile: 'api/kv_v2.go' },
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
  const withoutBlock = text.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock.replaceAll(/\/\/.*$/gm, '');
}

function countChar(str, ch) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    if (str[i] === ch) n += 1;
  }
  return n;
}

function parseStructBody(textRaw, structName) {
  const text = stripComments(textRaw);
  const lines = text.split(/\r?\n/g);

  const declRe = new RegExp(`\\btype\\s+${structName}\\s+struct\\s*\\{`);
  let startLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (declRe.test(lines[i])) {
      startLine = i;
      break;
    }
  }
  if (startLine < 0) return null;

  // Find opening brace "{" for the struct declaration.
  let braceDepth = 0;
  let started = false;
  const body = [];

  for (let i = startLine; i < lines.length; i += 1) {
    const line = lines[i];
    if (!started) {
      const openCount = countChar(line, '{');
      if (openCount > 0) {
        braceDepth += openCount;
        started = true;
      }
      continue;
    }

    braceDepth += countChar(line, '{');
    braceDepth -= countChar(line, '}');

    if (braceDepth <= 0) break;
    body.push(line);
  }

  return body;
}

function parseTags(tagsRaw) {
  const tags = String(tagsRaw ?? '');
  const out = {
    json: null,
    jsonOmitempty: false,
    mapstructure: null,
    mapstructureOmitempty: false,
  };

  const tagRe = /(json|mapstructure):"(?<value>[^"]*)"/g;
  for (const m of tags.matchAll(tagRe)) {
    const kind = m[1];
    const value = String(m.groups?.value ?? '');
    const [name, ...opts] = value.split(',');
    const omitempty = opts.includes('omitempty');
    if (kind === 'json') {
      out.json = name;
      out.jsonOmitempty = omitempty;
    }
    if (kind === 'mapstructure') {
      out.mapstructure = name;
      out.mapstructureOmitempty = omitempty;
    }
  }

  return out;
}

function isPointerType(goTypeRaw) {
  return String(goTypeRaw).trim().startsWith('*');
}

function isCollectionType(goTypeRaw) {
  const t = String(goTypeRaw).trim();
  return t.startsWith('[]') || t.startsWith('map[');
}

function normalizeGoType(goTypeRaw) {
  const t = String(goTypeRaw).replaceAll(/\s+/g, ' ').trim();
  // Preserve Go type surface (including pointers, slices, maps) so CIF stays informative.
  return t;
}

function extractFieldsFromStructBody(structBodyLines) {
  const fields = [];

  for (const rawLine of structBodyLines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    // Ignore embedded/anonymous fields (no explicit field name).
    // Example: `time.Time` or `*Foo`.
    if (/^[*]?[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(line)) continue;

    const m = /^(?<name>[A-Za-z_][A-Za-z0-9_]*)\s+(?<type>[^`]+?)(?:\s+`(?<tags>[^`]+)`)?\s*$/.exec(
      line,
    );
    if (!m?.groups) continue;

    const name = m.groups.name;
    const goType = normalizeGoType(m.groups.type);
    const tags = parseTags(m.groups.tags);

    // Only exported fields are integration-relevant (Vault API uses JSON/mapstructure on exported fields).
    if (!/^[A-Z]/.test(name)) continue;

    const wireNameRaw =
      (tags.json && tags.json !== '-' ? tags.json : null) ??
      (tags.mapstructure && tags.mapstructure !== '-' ? tags.mapstructure : null);

    const wireName = wireNameRaw && wireNameRaw.trim().length > 0 ? wireNameRaw.trim() : name;

    const nullable = isPointerType(goType);
    const required =
      !nullable &&
      !isCollectionType(goType) &&
      !tags.jsonOmitempty &&
      !tags.mapstructureOmitempty &&
      wireNameRaw !== null;

    const descParts = [];
    if (tags.json) descParts.push(`json:${tags.json}${tags.jsonOmitempty ? ',omitempty' : ''}`);
    if (tags.mapstructure)
      descParts.push(
        `mapstructure:${tags.mapstructure}${tags.mapstructureOmitempty ? ',omitempty' : ''}`,
      );
    const description = descParts.length > 0 ? descParts.join(' ') : 'no tags';

    fields.push({
      name: wireName,
      type: goType,
      required,
      ...(nullable ? { nullable: true } : {}),
      description,
    });
  }

  // Stable order for diffs.
  fields.sort((a, b) => a.name.localeCompare(b.name));
  return fields;
}

function extractEntity(upstreamGoFilePath, relGoFile, structName) {
  const raw = readText(upstreamGoFilePath);
  const structBody = parseStructBody(raw, structName);
  if (!structBody) {
    throw new Error(`Could not find struct ${structName} in ${relGoFile}`);
  }

  const fields = extractFieldsFromStructBody(structBody);
  if (fields.length === 0) {
    throw new Error(`Struct ${structName} in ${relGoFile} produced zero fields.`);
  }

  return {
    name: structName,
    description: `Extracted from ${relPosix(upstreamGoFilePath)} (type ${structName}).`,
    fields,
  };
}

function main() {
  const manifest = readJson(sourceManifestPath);

  const entities = [];
  for (const spec of ENTITY_SPECS) {
    const upstreamGoFilePath = path.join(upstreamRoot, spec.goFile);
    entities.push(extractEntity(upstreamGoFilePath, spec.goFile, spec.structName));
  }

  entities.sort((a, b) => a.name.localeCompare(b.name));

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: manifest.providerName,
      upstream: {
        repoUrl: manifest?.upstream?.repoUrl,
        ...(manifest?.upstream?.commit ? { commit: manifest.upstream.commit } : {}),
        ...(manifest?.upstream?.version ? { version: manifest.upstream.version } : {}),
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
  };

  writeJson(outPath, cif);
}

main();

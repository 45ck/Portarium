import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'keycloak';

const upstreamRoot = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

const idmRepRoot = path.join(
  upstreamRoot,
  'core',
  'src',
  'main',
  'java',
  'org',
  'keycloak',
  'representations',
  'idm',
);

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

function normalizeJavaType(javaTypeRaw) {
  const javaType = String(javaTypeRaw).replaceAll(/\s+/g, ' ').trim();

  const arrayMatch = /^(.+)\[\]$/.exec(javaType);
  if (arrayMatch) return `array<${normalizeJavaType(arrayMatch[1])}>`;

  const listMatch = /^List<(.+)>$/.exec(javaType);
  if (listMatch) return `array<${normalizeJavaType(listMatch[1])}>`;

  const setMatch = /^Set<(.+)>$/.exec(javaType);
  if (setMatch) return `array<${normalizeJavaType(setMatch[1])}>`;

  const mapMatch = /^Map<(.+),(.+)>$/.exec(javaType);
  if (mapMatch) {
    const k = normalizeJavaType(mapMatch[1]);
    const v = normalizeJavaType(mapMatch[2]);
    return `map<${k},${v}>`;
  }

  if (javaType === 'String') return 'string';
  if (javaType === 'Integer' || javaType === 'int' || javaType === 'Long' || javaType === 'long')
    return 'integer';
  if (javaType === 'Boolean' || javaType === 'boolean') return 'boolean';

  // Keep other types intact (DTOs, enums, etc.) for later mapping/refinement.
  return javaType;
}

function extractFieldsFromJavaFile(filePath, outerClassName) {
  const raw = readText(filePath);
  const text = stripComments(raw);
  const lines = text.split(/\r?\n/g);

  const classRe = new RegExp(`\\bclass\\s+${outerClassName}\\b`);
  let inClass = false;
  let depth = 0;

  const fields = [];

  for (const line of lines) {
    if (!inClass) {
      if (!classRe.test(line)) continue;
      inClass = true;
    }

    depth += countChar(line, '{');
    depth -= countChar(line, '}');

    if (depth !== 1) continue;

    const m =
      /^\s*(?:private|protected|public)\s+(?!static\b)(?:final\s+)?(?<type>[A-Za-z0-9_<>,?.\s[\]]+?)\s+(?<name>[A-Za-z0-9_]+)\s*;/.exec(
        line,
      );
    if (!m?.groups) continue;

    fields.push({
      name: m.groups.name.trim(),
      type: normalizeJavaType(m.groups.type.trim()),
      required: false,
    });
  }

  if (fields.length === 0) {
    throw new Error(`No fields extracted from ${relPosix(filePath)} for class ${outerClassName}`);
  }

  return fields;
}

function mergeFields(primary, secondary) {
  const byName = new Map();

  for (const f of [...primary, ...secondary]) {
    if (!byName.has(f.name)) byName.set(f.name, f);
  }

  return [...byName.values()];
}

function extractEntity(params) {
  const { entityName, javaFiles, primaryKey } = params;

  let mergedFields = [];
  const sources = [];

  for (const javaFile of javaFiles) {
    const filePath = path.join(idmRepRoot, javaFile);
    const outerClassName = path.basename(javaFile, '.java');

    const fields = extractFieldsFromJavaFile(filePath, outerClassName);
    mergedFields = mergeFields(mergedFields, fields);
    sources.push(relPosix(filePath));
  }

  return {
    name: entityName,
    description: `Extracted from ${sources.join(', ')}.`,
    primaryKeys: [primaryKey],
    fields: mergedFields,
  };
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit =
    typeof sourceManifest?.upstream?.commit === 'string' &&
    sourceManifest.upstream.commit.trim().length > 0
      ? sourceManifest.upstream.commit.trim()
      : undefined;

  const entities = [
    extractEntity({
      entityName: 'User',
      javaFiles: ['AbstractUserRepresentation.java', 'UserRepresentation.java'],
      primaryKey: 'id',
    }),
    extractEntity({
      entityName: 'Group',
      javaFiles: ['GroupRepresentation.java'],
      primaryKey: 'id',
    }),
    extractEntity({ entityName: 'Role', javaFiles: ['RoleRepresentation.java'], primaryKey: 'id' }),
    extractEntity({
      entityName: 'Client',
      javaFiles: ['ClientRepresentation.java'],
      primaryKey: 'id',
    }),
    extractEntity({
      entityName: 'Realm',
      javaFiles: ['RealmRepresentation.java'],
      primaryKey: 'id',
    }),
  ];

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
    relationships: [
      {
        fromEntity: 'User',
        toEntity: 'Group',
        kind: 'many_to_many',
        fromField: 'groups',
        toField: 'id',
        notes:
          'UserRepresentation.groups is a list of group paths; adapters may need a lookup to resolve IDs.',
      },
      {
        fromEntity: 'Group',
        toEntity: 'Group',
        kind: 'one_to_many',
        fromField: 'subGroups',
        toField: 'id',
        notes: 'Groups are hierarchical; parentId/path are used for navigation.',
      },
      {
        fromEntity: 'User',
        toEntity: 'Role',
        kind: 'many_to_many',
        fromField: 'realmRoles',
        toField: 'name',
        notes: 'realmRoles are role names (not IDs) in the representation.',
      },
      {
        fromEntity: 'Group',
        toEntity: 'Role',
        kind: 'many_to_many',
        fromField: 'realmRoles',
        toField: 'name',
      },
    ],
    lifecycles: [
      {
        entity: 'User',
        statusField: 'enabled',
        states: ['true', 'false'],
        notes: 'Keycloak uses a boolean enabled flag for user lifecycle gating.',
      },
      {
        entity: 'Realm',
        statusField: 'enabled',
        states: ['true', 'false'],
      },
      {
        entity: 'Client',
        statusField: 'enabled',
        states: ['true', 'false'],
      },
    ],
    actions: [
      {
        name: 'createUser',
        kind: 'create',
        entities: ['User'],
        idempotency: {
          supported: false,
          notes:
            'No provider idempotency key; adapters should dedupe by username where policy allows.',
        },
      },
      {
        name: 'updateUser',
        kind: 'update',
        entities: ['User'],
        idempotency: { supported: true, mechanism: 'User ID (path)' },
      },
      { name: 'deleteUser', kind: 'delete', entities: ['User'] },
      { name: 'createGroup', kind: 'create', entities: ['Group'] },
      { name: 'updateGroup', kind: 'update', entities: ['Group'] },
      { name: 'deleteGroup', kind: 'delete', entities: ['Group'] },
      {
        name: 'addUserToGroup',
        kind: 'workflow',
        entities: ['User', 'Group'],
        idempotency: { supported: true, notes: 'Safe if membership is checked before add.' },
      },
      {
        name: 'removeUserFromGroup',
        kind: 'workflow',
        entities: ['User', 'Group'],
        idempotency: { supported: true, notes: 'Safe if membership is checked before remove.' },
      },
      { name: 'createRole', kind: 'create', entities: ['Role'] },
      { name: 'deleteRole', kind: 'delete', entities: ['Role'] },
      { name: 'createClient', kind: 'create', entities: ['Client'] },
      { name: 'updateClient', kind: 'update', entities: ['Client'] },
      { name: 'deleteClient', kind: 'delete', entities: ['Client'] },
    ],
    events: [
      {
        name: 'admin.user.changed',
        delivery: 'stream',
        entities: ['User'],
        notes:
          'Keycloak supports admin events and event listener SPI; delivery depends on deployment configuration.',
      },
      {
        name: 'admin.group.changed',
        delivery: 'stream',
        entities: ['Group'],
      },
    ],
    extensionPoints: {
      customFields: {
        supported: true,
        notes: 'User and group attributes maps provide tenant-defined extension fields.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
}

main();

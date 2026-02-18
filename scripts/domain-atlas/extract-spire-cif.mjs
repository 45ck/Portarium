import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'spire';
const upstreamDir = path.join(repoRoot, 'domain-atlas', 'upstreams', providerId);
const sourceManifestPath = path.join(
  repoRoot,
  'domain-atlas',
  'sources',
  providerId,
  'source.json',
);
const outPath = path.join(repoRoot, 'domain-atlas', 'extracted', providerId, 'cif.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath))
    throw new Error(`Missing file: ${path.relative(repoRoot, filePath)}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function nowIsoUtc() {
  return new Date().toISOString();
}

/** Map proto3 scalar types to CIF types */
function protoToCifType(protoType) {
  const map = {
    string: 'string',
    bool: 'boolean',
    bytes: 'bytes',
    int32: 'int32',
    int64: 'int64',
    uint32: 'uint32',
    uint64: 'uint64',
    float: 'float32',
    double: 'float64',
  };
  return map[protoType] ?? protoType;
}

/** Parse a proto3 message block into CIF entity fields */
function parseProtoMessage(content, messageName) {
  const re = new RegExp(`message\\s+${messageName}\\s*\\{([^}]*)\\}`, 's');
  const m = re.exec(content);
  if (!m) return null;

  const block = m[1];
  const fields = [];
  for (const rawLine of block.split('\n')) {
    // Strip comments
    const line = rawLine
      .replace(/\/\/.*$/, '')
      .replace(/\/\*.*?\*\//gs, '')
      .trim();
    if (!line) continue;
    // Match: [repeated] type fieldName = number [comment]
    const fieldRe = /^(repeated\s+)?(\S+)\s+(\w+)\s*=\s*\d+\s*;/;
    const fm = fieldRe.exec(line);
    if (!fm) continue;
    const [, isRepeated, protoType, fieldName] = fm;
    let cifType = protoToCifType(protoType);
    if (isRepeated) cifType = `array<${cifType}>`;
    fields.push({
      name: fieldName,
      type: cifType,
      required: !isRepeated,
      description: `proto3 ${isRepeated ? 'repeated ' : ''}${protoType} ${messageName}.${fieldName}`,
    });
  }
  return fields.length > 0 ? fields : null;
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const commonProtoPath = path.join(upstreamDir, 'proto', 'spire', 'common', 'common.proto');
  if (!fs.existsSync(commonProtoPath)) {
    throw new Error(`common.proto not found at ${commonProtoPath}`);
  }
  const content = fs.readFileSync(commonProtoPath, 'utf8');

  const messageNames = [
    'AttestationData',
    'Selector',
    'AttestedNode',
    'RegistrationEntry',
    'Certificate',
    'PublicKey',
    'Bundle',
  ];

  const entities = [];
  for (const name of messageNames) {
    const fields = parseProtoMessage(content, name);
    if (!fields) {
      console.warn(`Warning: could not parse proto message ${name}`);
      continue;
    }
    entities.push({
      name,
      description: `SPIRE proto3 message spire.common.${name}`,
      primaryKeys:
        name === 'RegistrationEntry'
          ? ['entry_id']
          : name === 'AttestedNode'
            ? ['spiffe_id']
            : undefined,
      fields,
    });
  }

  if (entities.length === 0) {
    throw new Error('No entities extracted from SPIRE proto files.');
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'SPIFFE/SPIRE',
      upstream: {
        repoUrl: 'https://github.com/spiffe/spire',
        commit,
        version: 'main',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'RegistrationEntry',
        toEntity: 'Selector',
        kind: 'one_to_many',
        fromField: 'selectors',
        notes: 'A registration entry matches workloads via one or more selectors.',
      },
      {
        fromEntity: 'AttestedNode',
        toEntity: 'Selector',
        kind: 'one_to_many',
        fromField: 'selectors',
        notes: 'An attested SPIRE agent node is described by its selector set.',
      },
      {
        fromEntity: 'Bundle',
        toEntity: 'Certificate',
        kind: 'one_to_many',
        fromField: 'root_cas',
        notes: 'A trust bundle contains one or more root CA certificates.',
      },
      {
        fromEntity: 'Bundle',
        toEntity: 'PublicKey',
        kind: 'one_to_many',
        fromField: 'jwt_signing_keys',
        notes: 'A trust bundle contains the JWT signing keys for JWT-SVID validation.',
      },
    ],
    lifecycles: [
      {
        entity: 'AttestedNode',
        statusField: 'can_reattest',
        states: ['PENDING_ATTESTATION', 'ATTESTED', 'EXPIRED', 'BANNED'],
        notes:
          'SPIRE agent node attestation lifecycle; states derived from cert_not_after and ban mechanisms.',
      },
      {
        entity: 'RegistrationEntry',
        statusField: 'entryExpiry',
        states: ['ACTIVE', 'EXPIRED'],
        notes: 'Registration entries expire when entryExpiry (unix epoch) is reached.',
      },
    ],
    actions: [
      {
        name: 'createRegistrationEntry',
        kind: 'create',
        entities: ['RegistrationEntry'],
        idempotency: {
          supported: true,
          notes: 'SPIRE deduplicates entries by spiffe_id + selector set.',
        },
      },
      {
        name: 'updateRegistrationEntry',
        kind: 'update',
        entities: ['RegistrationEntry'],
        idempotency: {
          supported: true,
          notes: 'SPIRE uses revision_number for optimistic concurrency.',
        },
      },
      {
        name: 'deleteRegistrationEntry',
        kind: 'delete',
        entities: ['RegistrationEntry'],
        idempotency: { supported: true, notes: 'Deleting a non-existent entry is a no-op.' },
      },
      {
        name: 'attestWorkload',
        kind: 'workflow',
        entities: ['AttestedNode', 'RegistrationEntry'],
        idempotency: {
          supported: false,
          notes:
            'Attestation is a one-shot ceremony; re-attestation replaces the prior certificate.',
        },
      },
      {
        name: 'fetchBundle',
        kind: 'other',
        entities: ['Bundle'],
        idempotency: { supported: true, notes: 'Read-only; safe to call repeatedly.' },
      },
    ],
    events: [
      {
        name: 'svid.rotated',
        delivery: 'stream',
        entities: ['Certificate', 'PublicKey'],
        notes: 'SPIRE agents stream SVID rotation events to workloads via the Workload API.',
      },
      {
        name: 'bundle.updated',
        delivery: 'stream',
        entities: ['Bundle'],
        notes:
          'SPIRE federates bundle updates via the Bundle API (poll or push depending on federation config).',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'SPIRE proto3 schemas are fixed; extension via plugins (not fields).',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
  console.log(`Wrote ${entities.length} entities to ${path.relative(repoRoot, outPath)}`);
}

main();

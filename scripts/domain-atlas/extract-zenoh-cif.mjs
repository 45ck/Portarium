import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'zenoh';
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

/** Extract Rust enum variants from a source file */
function parseRustEnum(content, enumName) {
  const re = new RegExp(`pub\\s+enum\\s+${enumName}[^{]*\\{([^}]*)\\}`, 's');
  const m = re.exec(content);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) =>
      l
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//gs, '')
        .trim(),
    )
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('*'))
    .map((l) => l.replace(/[,{(].*$/, '').trim())
    .filter((l) => l && /^[A-Z]/.test(l));
}

/** Extract public struct fields from a Rust struct definition */
function parseRustPublicStruct(content, structName) {
  // Match `pub struct Name { ... }` or `pub(crate) struct Name { ... }`
  const re = new RegExp(`pub(?:\\([^)]*\\))?\\s+struct\\s+${structName}[^{]*\\{([^}]*)\\}`, 's');
  const m = re.exec(content);
  if (!m) return [];

  const block = m[1];
  const fields = [];
  for (const rawLine of block.split('\n')) {
    // Strip comments and cfg attributes
    const line = rawLine
      .replace(/\/\/.*$/, '')
      .replace(/\/\*.*?\*\//gs, '')
      .replace(/#\[.*?\]/gs, '')
      .trim();
    if (!line) continue;
    // Match: pub field_name: Type, OR pub(crate) field_name: Type,
    const fieldRe = /^pub(?:\([^)]*\))?\s+(\w+)\s*:\s*(.+?),?\s*$/;
    const fm = fieldRe.exec(line);
    if (!fm) continue;
    const [, fieldName, rustType] = fm;
    if (fieldName === 'fn' || fieldName === 'type') continue;
    fields.push({
      name: fieldName,
      type: rustTypeToCif(rustType.trim()),
      required: !rustType.includes('Option<'),
      description: `Zenoh Rust field ${structName}.${fieldName}: ${rustType.trim()}`,
    });
  }
  return fields;
}

function rustTypeToCif(rustType) {
  const inner = rustType.replace(/^Option<(.+)>$/, '$1').trim();
  if (inner === 'bool') return 'boolean';
  if (inner === 'u8' || inner === 'u16' || inner === 'u32') return `uint${inner.slice(1)}`;
  if (inner === 'i8' || inner === 'i16' || inner === 'i32') return `int${inner.slice(1)}`;
  if (inner === 'u64') return 'uint64';
  if (inner === 'i64') return 'int64';
  if (inner === 'f32') return 'float32';
  if (inner === 'f64') return 'float64';
  if (inner === 'String' || inner === '&str') return 'string';
  if (inner.startsWith('Vec<')) return `array<${rustTypeToCif(inner.slice(4, -1))}>`;
  // Compound types: use simplified name
  return inner.split('::').pop() ?? inner;
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const apiDir = path.join(upstreamDir, 'zenoh', 'src', 'api');

  const sampleContent = fs.readFileSync(path.join(apiDir, 'sample.rs'), 'utf8');

  const sampleKindVariants = parseRustEnum(sampleContent, 'SampleKind');
  const localityVariants = parseRustEnum(sampleContent, 'Locality');
  const sampleFields = parseRustPublicStruct(sampleContent, 'SampleFields');

  // Zenoh entities derived from the public API surface
  const entities = [
    {
      name: 'KeyExpr',
      description:
        'Zenoh KeyExpression — a hierarchical resource name with optional wildcards, used as the addressing primitive.',
      fields: [
        {
          name: 'expr',
          type: 'string',
          required: true,
          description: 'The key expression string (e.g., "robot/arm/joint/1").',
        },
        {
          name: 'autocanonize',
          type: 'boolean',
          required: false,
          description: 'Whether the expression is auto-canonicalized on construction.',
        },
      ],
    },
    {
      name: 'Sample',
      description:
        'Zenoh Sample — the data unit received by Subscribers or Queriers. Contains payload, key expression, and metadata.',
      fields:
        sampleFields.length > 0
          ? sampleFields
          : [
              {
                name: 'key_expr',
                type: 'string',
                required: true,
                description: 'The key expression on which this sample was published.',
              },
              {
                name: 'payload',
                type: 'bytes',
                required: true,
                description: 'The raw payload bytes.',
              },
              {
                name: 'kind',
                type: 'enum',
                required: true,
                description: `SampleKind: ${sampleKindVariants.join(', ') || 'Put, Delete'}.`,
              },
              {
                name: 'encoding',
                type: 'string',
                required: false,
                description: 'MIME-style encoding descriptor.',
              },
              {
                name: 'timestamp',
                type: 'datetime',
                required: false,
                description: 'Optional HLC timestamp.',
              },
              {
                name: 'priority',
                type: 'enum',
                required: false,
                description: 'QoS priority level (RealTime..Background).',
              },
              {
                name: 'congestion_control',
                type: 'enum',
                required: false,
                description: 'Drop or Block on congestion.',
              },
              {
                name: 'express',
                type: 'boolean',
                required: false,
                description: 'If true, the message bypasses batching for lower latency.',
              },
              {
                name: 'attachment',
                type: 'bytes',
                required: false,
                description: 'Optional opaque attachment bytes.',
              },
            ],
    },
    {
      name: 'SampleKind',
      description: `Zenoh SampleKind enum. Variants: ${sampleKindVariants.join(', ') || 'Put, Delete'}.`,
      fields: [
        {
          name: 'value',
          type: 'enum',
          required: true,
          description: `${sampleKindVariants.join(' | ') || 'Put | Delete'}: Put(0) is a data publication; Delete(1) is a removal notification.`,
        },
      ],
    },
    {
      name: 'Locality',
      description: `Zenoh Locality — controls whether pub/sub/query targets local-session, remote, or both. Variants: ${localityVariants.join(', ') || 'SessionLocal, Remote, Any'}.`,
      fields: [
        {
          name: 'value',
          type: 'enum',
          required: true,
          description: `${localityVariants.join(' | ') || 'SessionLocal | Remote | Any'}.`,
        },
      ],
    },
    {
      name: 'Publisher',
      description:
        'Zenoh Publisher — declares intent to publish data on a KeyExpr; enables QoS and matching subscriber queries.',
      fields: [
        {
          name: 'key_expr',
          type: 'string',
          required: true,
          description: 'The KeyExpr this publisher targets.',
        },
        {
          name: 'encoding',
          type: 'string',
          required: false,
          description: 'Default encoding for published payloads.',
        },
        {
          name: 'congestion_control',
          type: 'enum',
          required: false,
          description: 'Drop or Block on network congestion.',
        },
        { name: 'priority', type: 'enum', required: false, description: 'QoS priority level.' },
        {
          name: 'express',
          type: 'boolean',
          required: false,
          description: 'Skip batching for lower latency.',
        },
        {
          name: 'allowed_destination',
          type: 'enum',
          required: false,
          description: 'Locality filter for published samples.',
        },
      ],
    },
    {
      name: 'Subscriber',
      description:
        'Zenoh Subscriber — receives Sample stream for a KeyExpr. Supports wildcard expressions.',
      fields: [
        {
          name: 'key_expr',
          type: 'string',
          required: true,
          description: 'The KeyExpr (may include wildcards) to subscribe to.',
        },
        {
          name: 'allowed_origin',
          type: 'enum',
          required: false,
          description: 'Locality filter: SessionLocal, Remote, or Any.',
        },
        {
          name: 'callback',
          type: 'function',
          required: true,
          description: 'Handler invoked for each received Sample.',
        },
      ],
    },
    {
      name: 'Query',
      description:
        'Zenoh Query — a get() request targeting a KeyExpr for stored or computed data (queryable pattern).',
      fields: [
        {
          name: 'key_expr',
          type: 'string',
          required: true,
          description: 'Target KeyExpr for the query.',
        },
        {
          name: 'parameters',
          type: 'string',
          required: false,
          description: 'Optional query parameters string.',
        },
        {
          name: 'target',
          type: 'enum',
          required: false,
          description: 'QueryTarget: BestMatching, All, AllComplete.',
        },
        {
          name: 'consolidation',
          type: 'enum',
          required: false,
          description: 'ConsolidationMode: Auto, None, Monotonic, Latest.',
        },
        {
          name: 'timeout',
          type: 'uint64',
          required: false,
          description: 'Query timeout in milliseconds.',
        },
        {
          name: 'payload',
          type: 'bytes',
          required: false,
          description: 'Optional payload attached to the query.',
        },
        {
          name: 'encoding',
          type: 'string',
          required: false,
          description: 'Encoding of the query payload.',
        },
      ],
    },
    {
      name: 'Reply',
      description: 'Zenoh Reply — a response to a Query, delivered to the querier.',
      fields: [
        {
          name: 'result_ok',
          type: 'Sample',
          required: false,
          description: 'The Sample if the reply succeeded.',
        },
        {
          name: 'result_err',
          type: 'bytes',
          required: false,
          description: 'Error payload if the reply is an error.',
        },
        {
          name: 'replier_id',
          type: 'string',
          required: false,
          description: 'Unstable: ZenohId of the replying entity.',
        },
      ],
    },
    {
      name: 'Session',
      description:
        'Zenoh Session — the top-level API handle that owns all publishers, subscribers, queryables, and peer connections.',
      fields: [
        {
          name: 'zid',
          type: 'string',
          required: true,
          description: 'ZenohId assigned to this session.',
        },
        {
          name: 'config',
          type: 'object',
          required: true,
          description: 'Session configuration (peers, scouting, transport, etc.).',
        },
        {
          name: 'info',
          type: 'object',
          required: false,
          description: 'Runtime session info (peers, routers, timestamp).',
        },
      ],
    },
  ];

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'Eclipse Zenoh',
      upstream: {
        repoUrl: 'https://github.com/eclipse-zenoh/zenoh',
        commit,
        version: 'main',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'Sample',
        toEntity: 'KeyExpr',
        kind: 'many_to_one',
        fromField: 'key_expr',
        notes: 'Every Sample is addressed to a specific key expression.',
      },
      {
        fromEntity: 'Publisher',
        toEntity: 'KeyExpr',
        kind: 'many_to_one',
        fromField: 'key_expr',
        notes: 'A Publisher is bound to a KeyExpr for its lifetime.',
      },
      {
        fromEntity: 'Subscriber',
        toEntity: 'KeyExpr',
        kind: 'many_to_one',
        fromField: 'key_expr',
        notes: 'A Subscriber matches incoming Samples by KeyExpr (wildcards supported).',
      },
      {
        fromEntity: 'Query',
        toEntity: 'KeyExpr',
        kind: 'many_to_one',
        fromField: 'key_expr',
        notes: 'A Query targets queryables that match a KeyExpr.',
      },
      {
        fromEntity: 'Reply',
        toEntity: 'Query',
        kind: 'many_to_one',
        notes: 'Zero or more Replies are returned for each Query.',
      },
      {
        fromEntity: 'Publisher',
        toEntity: 'Session',
        kind: 'many_to_one',
        notes: 'Publishers are declared on a Session and live within its lifetime.',
      },
      {
        fromEntity: 'Subscriber',
        toEntity: 'Session',
        kind: 'many_to_one',
        notes: 'Subscribers are declared on a Session.',
      },
    ],
    lifecycles: [
      {
        entity: 'Session',
        statusField: 'state',
        states: ['OPENING', 'OPEN', 'CLOSING', 'CLOSED'],
        notes:
          'Zenoh session lifecycle; opened via zenoh::open() and closed explicitly or on drop.',
      },
      {
        entity: 'Sample',
        statusField: 'kind',
        states: sampleKindVariants.length > 0 ? sampleKindVariants : ['Put', 'Delete'],
        notes:
          'SampleKind differentiates data publications (Put) from resource deletions (Delete).',
      },
    ],
    actions: [
      {
        name: 'put',
        kind: 'create',
        entities: ['Sample', 'Publisher'],
        idempotency: {
          supported: false,
          notes: 'Put is fire-and-forget; no built-in idempotency key.',
        },
      },
      {
        name: 'delete',
        kind: 'delete',
        entities: ['Sample'],
        idempotency: {
          supported: false,
          notes: 'Delete marks a key as removed; re-deleting is harmless in practice.',
        },
      },
      {
        name: 'get',
        kind: 'other',
        entities: ['Query', 'Reply'],
        idempotency: {
          supported: true,
          notes: 'Get is read-only against stored data; repeatable.',
        },
      },
      {
        name: 'declarePublisher',
        kind: 'create',
        entities: ['Publisher'],
        idempotency: {
          supported: false,
          notes: 'Each declaration creates a distinct publisher object.',
        },
      },
      {
        name: 'declareSubscriber',
        kind: 'create',
        entities: ['Subscriber'],
        idempotency: {
          supported: false,
          notes: 'Each declaration creates a distinct subscriber object.',
        },
      },
    ],
    events: [
      {
        name: 'sample.received',
        delivery: 'stream',
        entities: ['Sample'],
        notes:
          'Zenoh Subscriber callback fires for every matching incoming Sample (pub/sub stream).',
      },
      {
        name: 'reply.received',
        delivery: 'stream',
        entities: ['Reply'],
        notes: 'Zenoh get() yields a stream of Replies from matching Queryables.',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'Zenoh payload is opaque bytes; schema is application-layer concern.',
      },
      tags: { supported: false },
      attachments: {
        supported: true,
        notes: 'Samples support an opaque binary attachment field for side-channel metadata.',
      },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
  console.log(`Wrote ${entities.length} entities to ${path.relative(repoRoot, outPath)}`);
}

main();

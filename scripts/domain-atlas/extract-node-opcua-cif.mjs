import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'node-opcua';
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

/** Extract enum values from a TypeScript enum block */
function parseTsEnum(content, enumName) {
  const re = new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{([^}]*)\\}`, 's');
  const m = re.exec(content);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l && !l.startsWith('*'))
    .map((l) =>
      l
        .replace(/,$/, '')
        .split(/\s*=\s*/)[0]
        .trim(),
    )
    .filter(Boolean);
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const dataModelSrcDir = path.join(upstreamDir, 'packages', 'node-opcua-data-model', 'source');

  // Read key data model source files
  const nodeClassContent = fs.readFileSync(path.join(dataModelSrcDir, 'nodeclass.ts'), 'utf8');
  const browseDirectionContent = fs.readFileSync(
    path.join(dataModelSrcDir, 'BrowseDirection.ts'),
    'utf8',
  );
  const attributeIdsContent = fs.readFileSync(
    path.join(dataModelSrcDir, 'attributeIds.ts'),
    'utf8',
  );

  const nodeClassValues = parseTsEnum(nodeClassContent, 'NodeClass');
  const browseDirectionValues = parseTsEnum(browseDirectionContent, 'BrowseDirection');

  // OPC UA is a rich standard; entities below represent the core address-space + session model.
  const entities = [
    {
      name: 'NodeId',
      description: 'OPC UA NodeId — the unique identifier of a node in an OPC UA address space.',
      fields: [
        {
          name: 'identifierType',
          type: 'enum',
          required: true,
          description: 'NodeIdType: Numeric, String, Guid, or ByteString.',
        },
        {
          name: 'namespace',
          type: 'uint16',
          required: true,
          description: 'Namespace index (0 = OPC UA standard namespace).',
        },
        {
          name: 'value',
          type: 'string',
          required: true,
          description: 'Identifier value (numeric, string, guid, or base64).',
        },
      ],
    },
    {
      name: 'NodeClass',
      description: `OPC UA NodeClass enumeration. Values: ${nodeClassValues.join(', ')}.`,
      fields: [
        {
          name: 'value',
          type: 'enum',
          required: true,
          description: `One of: ${nodeClassValues.join(', ')}.`,
        },
      ],
    },
    {
      name: 'DataValue',
      description:
        'OPC UA DataValue — the result of reading a variable node, including quality and timestamp.',
      fields: [
        {
          name: 'value',
          type: 'Variant',
          required: false,
          description: 'The actual data wrapped in a Variant.',
        },
        {
          name: 'statusCode',
          type: 'StatusCode',
          required: false,
          description: 'OPC UA StatusCode indicating quality of the value.',
        },
        {
          name: 'sourceTimestamp',
          type: 'datetime',
          required: false,
          description: 'Timestamp when the value was sampled at the source.',
        },
        {
          name: 'serverTimestamp',
          type: 'datetime',
          required: false,
          description: 'Timestamp when the server processed the value.',
        },
        {
          name: 'sourcePicoseconds',
          type: 'uint16',
          required: false,
          description: 'Sub-millisecond precision for sourceTimestamp.',
        },
        {
          name: 'serverPicoseconds',
          type: 'uint16',
          required: false,
          description: 'Sub-millisecond precision for serverTimestamp.',
        },
      ],
    },
    {
      name: 'Variant',
      description: 'OPC UA Variant — a polymorphic container for any OPC UA data type.',
      fields: [
        {
          name: 'dataType',
          type: 'DataType',
          required: false,
          description: 'OPC UA DataType NodeId of the contained value.',
        },
        {
          name: 'arrayType',
          type: 'VariantArrayType',
          required: false,
          description: 'Scalar, Array, or Matrix.',
        },
        {
          name: 'value',
          type: 'any',
          required: false,
          description: 'The actual typed value (scalar or array).',
        },
        {
          name: 'dimensions',
          type: 'array<int32>',
          required: false,
          description: 'Array dimensions for matrix values.',
        },
      ],
    },
    {
      name: 'BrowseDescription',
      description: 'OPC UA BrowseDescription — parameters for a Browse service call.',
      fields: [
        {
          name: 'nodeId',
          type: 'NodeId',
          required: true,
          description: 'Starting node for the browse operation.',
        },
        {
          name: 'browseDirection',
          type: 'enum',
          required: true,
          description: `Direction to browse: ${browseDirectionValues.join(', ')}.`,
        },
        {
          name: 'referenceTypeId',
          type: 'NodeId',
          required: false,
          description: 'Filter by reference type NodeId.',
        },
        {
          name: 'includeSubtypes',
          type: 'boolean',
          required: false,
          description: 'Whether to include subtypes of referenceTypeId.',
        },
        {
          name: 'nodeClassMask',
          type: 'uint32',
          required: false,
          description: 'Bitmask of NodeClass values to include in results.',
        },
        {
          name: 'resultMask',
          type: 'uint32',
          required: false,
          description: 'Bitmask of result fields to return.',
        },
      ],
    },
    {
      name: 'BrowseResult',
      description: 'OPC UA BrowseResult — the output of a Browse or BrowseNext call.',
      fields: [
        { name: 'statusCode', type: 'StatusCode', required: true, description: 'Result status.' },
        {
          name: 'continuationPoint',
          type: 'bytes',
          required: false,
          description: 'Token for paging with BrowseNext; absent if complete.',
        },
        {
          name: 'references',
          type: 'array<ReferenceDescription>',
          required: false,
          description: 'Discovered references.',
        },
      ],
    },
    {
      name: 'ReadValueId',
      description: 'OPC UA ReadValueId — identifies a node attribute to read.',
      fields: [
        { name: 'nodeId', type: 'NodeId', required: true, description: 'The node to read.' },
        {
          name: 'attributeId',
          type: 'uint32',
          required: true,
          description: 'OPC UA AttributeId (e.g., Value=13, BrowseName=3).',
        },
        {
          name: 'indexRange',
          type: 'string',
          required: false,
          description: 'NumericRange for reading array sub-ranges.',
        },
        {
          name: 'dataEncoding',
          type: 'QualifiedName',
          required: false,
          description: 'Optional data encoding override.',
        },
      ],
    },
    {
      name: 'WriteValue',
      description: 'OPC UA WriteValue — a single attribute write operation.',
      fields: [
        { name: 'nodeId', type: 'NodeId', required: true, description: 'The node to write.' },
        { name: 'attributeId', type: 'uint32', required: true, description: 'OPC UA AttributeId.' },
        {
          name: 'indexRange',
          type: 'string',
          required: false,
          description: 'NumericRange for partial array writes.',
        },
        {
          name: 'value',
          type: 'DataValue',
          required: true,
          description: 'The new value with status and timestamps.',
        },
      ],
    },
    {
      name: 'MonitoredItemCreateRequest',
      description:
        'OPC UA MonitoredItemCreateRequest — subscribes to a node attribute for change notifications.',
      fields: [
        {
          name: 'itemToMonitor',
          type: 'ReadValueId',
          required: true,
          description: 'Node attribute to monitor.',
        },
        {
          name: 'monitoringMode',
          type: 'enum',
          required: true,
          description: 'Disabled, Sampling, or Reporting.',
        },
        {
          name: 'requestedParameters',
          type: 'MonitoringParameters',
          required: true,
          description: 'Sampling interval, queue size, filter.',
        },
      ],
    },
    {
      name: 'Subscription',
      description:
        'OPC UA Subscription — a server-side object that batches and publishes monitored item notifications.',
      fields: [
        {
          name: 'subscriptionId',
          type: 'uint32',
          required: true,
          description: 'Server-assigned subscription identifier.',
        },
        {
          name: 'publishingInterval',
          type: 'float64',
          required: true,
          description: 'Interval (ms) at which the server sends Publish responses.',
        },
        {
          name: 'lifetimeCount',
          type: 'uint32',
          required: true,
          description:
            'Number of publish cycles before the subscription expires without a Publish.',
        },
        {
          name: 'maxKeepAliveCount',
          type: 'uint32',
          required: true,
          description: 'Maximum keep-alive cycles before sending a keep-alive response.',
        },
        {
          name: 'maxNotificationsPerPublish',
          type: 'uint32',
          required: false,
          description: 'Maximum notifications per Publish response.',
        },
        {
          name: 'publishingEnabled',
          type: 'boolean',
          required: true,
          description: 'Whether the subscription is actively publishing.',
        },
        {
          name: 'priority',
          type: 'uint8',
          required: false,
          description: 'Relative priority for concurrent subscriptions.',
        },
      ],
    },
  ];

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'node-opcua',
      upstream: {
        repoUrl: 'https://github.com/node-opcua/node-opcua',
        commit,
        version: 'master',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'DataValue',
        toEntity: 'Variant',
        kind: 'many_to_one',
        fromField: 'value',
        notes: 'DataValue wraps the actual typed value in a Variant.',
      },
      {
        fromEntity: 'BrowseDescription',
        toEntity: 'NodeId',
        kind: 'many_to_one',
        fromField: 'nodeId',
        notes: 'Browse starts from a specific node.',
      },
      {
        fromEntity: 'ReadValueId',
        toEntity: 'NodeId',
        kind: 'many_to_one',
        fromField: 'nodeId',
        notes: 'Read targets a specific node.',
      },
      {
        fromEntity: 'MonitoredItemCreateRequest',
        toEntity: 'ReadValueId',
        kind: 'many_to_one',
        fromField: 'itemToMonitor',
        notes: 'Monitored items reference a specific node attribute to watch.',
      },
      {
        fromEntity: 'MonitoredItemCreateRequest',
        toEntity: 'Subscription',
        kind: 'many_to_one',
        notes: 'Monitored items are created within a subscription.',
      },
    ],
    lifecycles: [
      {
        entity: 'Subscription',
        statusField: 'publishingEnabled',
        states: ['CREATING', 'NORMAL', 'LATE', 'KEEPALIVE', 'CLOSED'],
        notes: 'OPC UA subscription lifecycle per Part 4 §5.13.1 state machine.',
      },
    ],
    actions: [
      {
        name: 'browse',
        kind: 'other',
        entities: ['BrowseDescription', 'BrowseResult'],
        idempotency: {
          supported: true,
          notes: 'Read-only browse; repeatable without side effects.',
        },
      },
      {
        name: 'read',
        kind: 'other',
        entities: ['ReadValueId', 'DataValue'],
        idempotency: { supported: true, notes: 'Read-only; repeatable without side effects.' },
      },
      {
        name: 'write',
        kind: 'update',
        entities: ['WriteValue'],
        idempotency: {
          supported: false,
          notes: 'Writes may have physical side effects; not idempotent.',
        },
      },
      {
        name: 'createSubscription',
        kind: 'create',
        entities: ['Subscription'],
        idempotency: {
          supported: false,
          notes: 'Each call creates a new subscription with a new ID.',
        },
      },
      {
        name: 'createMonitoredItems',
        kind: 'create',
        entities: ['MonitoredItemCreateRequest'],
        idempotency: {
          supported: false,
          notes: 'Creates new monitored items; duplicates are not merged.',
        },
      },
      {
        name: 'callMethod',
        kind: 'workflow',
        entities: ['NodeId'],
        idempotency: {
          supported: false,
          notes: 'OPC UA Method calls may have physical side effects.',
        },
      },
    ],
    events: [
      {
        name: 'dataChange.notification',
        delivery: 'stream',
        entities: ['DataValue', 'MonitoredItemCreateRequest'],
        notes:
          'OPC UA Publish response streams DataChangeNotifications for subscribed variable nodes.',
      },
      {
        name: 'event.notification',
        delivery: 'stream',
        entities: ['Subscription'],
        notes: 'OPC UA event-type monitored items stream event notifications via Publish.',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes:
          'OPC UA information model is extensible via custom DataTypes but requires server-side schema definition.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  // Suppress unused
  void attributeIdsContent;

  writeJson(outPath, cif);
  console.log(`Wrote ${entities.length} entities to ${path.relative(repoRoot, outPath)}`);
}

main();

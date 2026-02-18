import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'rosbridge-suite';
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

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const protocolPath = path.join(upstreamDir, 'ROSBRIDGE_PROTOCOL.md');
  if (!fs.existsSync(protocolPath)) {
    throw new Error(`ROSBRIDGE_PROTOCOL.md not found at ${protocolPath}`);
  }

  // The rosbridge v2 protocol defines a set of JSON message types identified by the "op" field.
  // We extract each op type as a CIF entity. Fields are defined per the protocol specification.
  const entities = [
    {
      name: 'RosbridgeMessage',
      description:
        'Base rosbridge v2 message envelope. All rosbridge messages share this structure.',
      fields: [
        {
          name: 'op',
          type: 'string',
          required: true,
          description: 'Operation type identifier (subscribe, publish, call_service, etc.).',
        },
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'Optional client-assigned interaction ID for correlating related messages.',
        },
      ],
    },
    {
      name: 'SubscribeRequest',
      description: 'rosbridge op:subscribe — client requests to receive messages on a ROS 2 topic.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "subscribe".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        {
          name: 'topic',
          type: 'string',
          required: true,
          description: 'ROS 2 topic name to subscribe to.',
        },
        {
          name: 'type',
          type: 'string',
          required: false,
          description: 'Message type (e.g., "geometry_msgs/Twist"); inferred if omitted.',
        },
        {
          name: 'throttle_rate',
          type: 'int32',
          required: false,
          description: 'Minimum milliseconds between messages delivered to this subscriber.',
        },
        {
          name: 'queue_length',
          type: 'int32',
          required: false,
          description: 'Size of the message queue if throttling is active.',
        },
        {
          name: 'fragment_size',
          type: 'int32',
          required: false,
          description: 'Maximum byte size before fragmenting large messages.',
        },
        {
          name: 'compression',
          type: 'string',
          required: false,
          description: 'Optional compression: "png" or "cbor".',
        },
      ],
    },
    {
      name: 'UnsubscribeRequest',
      description: 'rosbridge op:unsubscribe — client cancels a topic subscription.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "unsubscribe".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        {
          name: 'topic',
          type: 'string',
          required: true,
          description: 'Topic name to unsubscribe from.',
        },
      ],
    },
    {
      name: 'PublishRequest',
      description: 'rosbridge op:publish — client publishes a message to a ROS 2 topic.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "publish".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        {
          name: 'topic',
          type: 'string',
          required: true,
          description: 'ROS 2 topic to publish on.',
        },
        {
          name: 'msg',
          type: 'object',
          required: true,
          description:
            'Message payload serialised as a JSON object matching the ROS 2 message type.',
        },
      ],
    },
    {
      name: 'TopicMessage',
      description:
        'rosbridge op:publish delivered server→client — a message received on a subscribed topic.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "publish".' },
        {
          name: 'topic',
          type: 'string',
          required: true,
          description: 'Topic on which the message was received.',
        },
        {
          name: 'msg',
          type: 'object',
          required: true,
          description: 'The received ROS 2 message as a JSON object.',
        },
      ],
    },
    {
      name: 'ServiceCallRequest',
      description: 'rosbridge op:call_service — client calls a ROS 2 service.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "call_service".' },
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'Optional interaction ID used to correlate the response.',
        },
        {
          name: 'service',
          type: 'string',
          required: true,
          description: 'ROS 2 service name (e.g., "/move_base").',
        },
        {
          name: 'type',
          type: 'string',
          required: false,
          description: 'Service type string (inferred by server if omitted).',
        },
        {
          name: 'args',
          type: 'object',
          required: false,
          description: 'Service request object; defaults to empty {} if omitted.',
        },
        {
          name: 'fragment_size',
          type: 'int32',
          required: false,
          description: 'Maximum byte size for response fragmentation.',
        },
        {
          name: 'compression',
          type: 'string',
          required: false,
          description: 'Response compression: "png" or "cbor".',
        },
      ],
    },
    {
      name: 'ServiceResponse',
      description: 'rosbridge op:service_response — server returns the result of a service call.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "service_response".' },
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'Echoed interaction ID from the call_service request.',
        },
        {
          name: 'service',
          type: 'string',
          required: true,
          description: 'The service name that was called.',
        },
        {
          name: 'values',
          type: 'object',
          required: false,
          description: 'Service response payload as a JSON object.',
        },
        {
          name: 'result',
          type: 'boolean',
          required: true,
          description: 'true if the service call succeeded, false on failure.',
        },
      ],
    },
    {
      name: 'AdvertiseTopicRequest',
      description: 'rosbridge op:advertise — client declares intent to publish on a topic.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "advertise".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        { name: 'topic', type: 'string', required: true, description: 'Topic to advertise.' },
        { name: 'type', type: 'string', required: true, description: 'ROS 2 message type string.' },
      ],
    },
    {
      name: 'UnadvertiseTopicRequest',
      description: 'rosbridge op:unadvertise — client removes a topic advertisement.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "unadvertise".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        { name: 'topic', type: 'string', required: true, description: 'Topic to unadvertise.' },
      ],
    },
    {
      name: 'SetLevelRequest',
      description:
        'rosbridge op:set_level — client sets the verbosity level for server status messages.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "set_level".' },
        { name: 'id', type: 'string', required: false, description: 'Optional interaction ID.' },
        {
          name: 'level',
          type: 'enum',
          required: true,
          description: 'Log level: info, warning, error, none.',
        },
      ],
    },
    {
      name: 'StatusMessage',
      description: 'rosbridge op:status — server reports a diagnostic or error message.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "status".' },
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'Echoed interaction ID if relevant.',
        },
        {
          name: 'level',
          type: 'enum',
          required: true,
          description: 'Severity: info, warning, error, none.',
        },
        {
          name: 'msg',
          type: 'string',
          required: true,
          description: 'Human-readable status message.',
        },
      ],
    },
    {
      name: 'FragmentMessage',
      description: 'rosbridge op:fragment — a chunk of a fragmented large message.',
      fields: [
        { name: 'op', type: 'string', required: true, description: 'Always "fragment".' },
        {
          name: 'id',
          type: 'string',
          required: true,
          description: 'Interaction ID shared by all fragments of the same message.',
        },
        {
          name: 'data',
          type: 'string',
          required: true,
          description: 'Base64-encoded fragment data.',
        },
        { name: 'num', type: 'int32', required: true, description: 'Zero-based fragment index.' },
        {
          name: 'total',
          type: 'int32',
          required: true,
          description: 'Total number of fragments for this message.',
        },
      ],
    },
  ];

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'rosbridge_suite',
      upstream: {
        repoUrl: 'https://github.com/RobotWebTools/rosbridge_suite',
        commit,
        version: 'ros2',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'SubscribeRequest',
        toEntity: 'TopicMessage',
        kind: 'one_to_many',
        notes: 'A subscribe request causes subsequent TopicMessage deliveries from the server.',
      },
      {
        fromEntity: 'ServiceCallRequest',
        toEntity: 'ServiceResponse',
        kind: 'one_to_one',
        fromField: 'id',
        toField: 'id',
        notes: 'Each service call is correlated to its response via the interaction ID.',
      },
      {
        fromEntity: 'AdvertiseTopicRequest',
        toEntity: 'PublishRequest',
        kind: 'one_to_many',
        notes: 'A topic must be advertised before the client can publish to it.',
      },
      {
        fromEntity: 'FragmentMessage',
        toEntity: 'RosbridgeMessage',
        kind: 'many_to_one',
        fromField: 'id',
        notes: 'Multiple fragments reassemble into one logical rosbridge message.',
      },
    ],
    lifecycles: [
      {
        entity: 'SubscribeRequest',
        statusField: 'op',
        states: ['SUBSCRIBED', 'UNSUBSCRIBED'],
        notes:
          'A subscription is active after subscribe and inactive after unsubscribe for the same topic.',
      },
      {
        entity: 'AdvertiseTopicRequest',
        statusField: 'op',
        states: ['ADVERTISED', 'UNADVERTISED'],
        notes: 'A publisher advertisement is active after advertise and removed after unadvertise.',
      },
    ],
    actions: [
      {
        name: 'subscribe',
        kind: 'create',
        entities: ['SubscribeRequest'],
        idempotency: {
          supported: true,
          notes: 'Re-subscribing to the same topic updates throttle/compression options.',
        },
      },
      {
        name: 'unsubscribe',
        kind: 'delete',
        entities: ['UnsubscribeRequest'],
        idempotency: { supported: true, notes: 'Unsubscribing a non-existent topic is a no-op.' },
      },
      {
        name: 'publish',
        kind: 'create',
        entities: ['PublishRequest'],
        idempotency: {
          supported: false,
          notes: 'Messages are fire-and-forget; no delivery guarantee.',
        },
      },
      {
        name: 'callService',
        kind: 'workflow',
        entities: ['ServiceCallRequest', 'ServiceResponse'],
        idempotency: {
          supported: false,
          notes: 'Service call idempotency depends on the ROS 2 service implementation.',
        },
      },
      {
        name: 'advertise',
        kind: 'create',
        entities: ['AdvertiseTopicRequest'],
        idempotency: { supported: true, notes: 'Re-advertising is idempotent if type matches.' },
      },
    ],
    events: [
      {
        name: 'topic.message_received',
        delivery: 'stream',
        entities: ['TopicMessage'],
        notes: 'Delivered over WebSocket as server-sent publish messages for active subscriptions.',
      },
      {
        name: 'server.status',
        delivery: 'stream',
        entities: ['StatusMessage'],
        notes: 'Server emits status messages at the configured log level (set_level).',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'rosbridge v2 protocol is fixed; custom ops are out-of-spec.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  // Read protocol doc to verify key ops are present (documentation traceability)
  const protocolContent = fs.readFileSync(protocolPath, 'utf8');
  const ops = [
    'subscribe',
    'unsubscribe',
    'publish',
    'call_service',
    'service_response',
    'advertise',
    'unadvertise',
    'fragment',
    'status',
    'set_level',
  ];
  for (const op of ops) {
    if (!protocolContent.includes(op)) {
      console.warn(`Warning: op "${op}" not found in ROSBRIDGE_PROTOCOL.md`);
    }
  }

  writeJson(outPath, cif);
  console.log(`Wrote ${entities.length} entities to ${path.relative(repoRoot, outPath)}`);
}

main();

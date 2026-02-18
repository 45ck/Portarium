import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'mosquitto';
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

/** Parse C enum values from a header file block */
function parseCEnum(content, enumName) {
  const re = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`, 's');
  const m = re.exec(content);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) =>
      l
        .replace(/\/\*.*?\*\//gs, '')
        .replace(/\/\/.*$/, '')
        .trim(),
    )
    .filter((l) => l && !l.startsWith('/*') && !l.startsWith('*'))
    .map((l) => l.replace(/,$/, '').trim())
    .filter((l) => /^MOSQ_/.test(l))
    .map((l) => l.split(/\s*=\s*/)[0].trim());
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const defsPath = path.join(upstreamDir, 'include', 'mosquitto', 'defs.h');
  const defsContent = fs.readFileSync(defsPath, 'utf8');
  const errorStates = parseCEnum(defsContent, 'mosq_err_t');

  // Mosquitto is a C library — entities are derived from the conceptual API surface
  // (connect options, message envelope, subscription, broker config) not raw C structs.
  const entities = [
    {
      name: 'MqttConnectOptions',
      description: 'Options supplied when establishing an MQTT client connection to Mosquitto.',
      fields: [
        {
          name: 'clientId',
          type: 'string',
          required: true,
          description: 'Unique client identifier (max 23 chars for MQTT 3.1).',
        },
        {
          name: 'host',
          type: 'string',
          required: true,
          description: 'Broker hostname or IP address.',
        },
        {
          name: 'port',
          type: 'int32',
          required: true,
          description: 'Broker TCP port (default 1883, TLS 8883).',
        },
        {
          name: 'keepalive',
          type: 'int32',
          required: false,
          description: 'Keep-alive interval in seconds.',
        },
        {
          name: 'username',
          type: 'string',
          required: false,
          description: 'MQTT username for authentication.',
        },
        {
          name: 'password',
          type: 'string',
          required: false,
          description: 'MQTT password for authentication.',
        },
        {
          name: 'cleanSession',
          type: 'boolean',
          required: false,
          description: 'Whether to start a clean session (discard queued messages).',
        },
        {
          name: 'protocol',
          type: 'enum',
          required: false,
          description: 'MQTT protocol version: 3 (3.1), 4 (3.1.1), 5 (5.0).',
        },
        {
          name: 'tlsEnabled',
          type: 'boolean',
          required: false,
          description: 'Whether TLS is enabled for this connection.',
        },
      ],
    },
    {
      name: 'MqttMessage',
      description: 'An MQTT message published to or received from Mosquitto.',
      fields: [
        {
          name: 'messageId',
          type: 'int32',
          required: false,
          description: 'Message identifier (0 for QoS 0 messages).',
        },
        {
          name: 'topic',
          type: 'string',
          required: true,
          description: 'Topic string the message is published to or received on.',
        },
        {
          name: 'payload',
          type: 'bytes',
          required: false,
          description: 'Raw message payload bytes.',
        },
        {
          name: 'payloadLen',
          type: 'int32',
          required: true,
          description: 'Length of the payload in bytes.',
        },
        {
          name: 'qos',
          type: 'int32',
          required: true,
          description:
            'Quality of Service level: 0 (at most once), 1 (at least once), 2 (exactly once).',
        },
        {
          name: 'retain',
          type: 'boolean',
          required: false,
          description: 'Whether the broker retains this message for new subscribers.',
        },
      ],
    },
    {
      name: 'MqttSubscription',
      description: 'A topic subscription registered with the Mosquitto broker.',
      fields: [
        {
          name: 'topicFilter',
          type: 'string',
          required: true,
          description: 'Topic filter, may include + (single-level) or # (multi-level) wildcards.',
        },
        {
          name: 'qos',
          type: 'int32',
          required: true,
          description: 'Maximum QoS level at which messages are delivered to this subscriber.',
        },
        {
          name: 'noLocal',
          type: 'boolean',
          required: false,
          description: 'MQTT 5 — if true, messages from this client are not echoed back.',
        },
        {
          name: 'retainAsPublished',
          type: 'boolean',
          required: false,
          description: 'MQTT 5 — retain flag in forwarded messages matches original.',
        },
        {
          name: 'retainHandling',
          type: 'int32',
          required: false,
          description: 'MQTT 5 — controls delivery of retained messages on subscribe.',
        },
      ],
    },
    {
      name: 'MqttBrokerConfig',
      description: 'Core Mosquitto broker configuration parameters (mosquitto.conf).',
      fields: [
        {
          name: 'listenPort',
          type: 'int32',
          required: false,
          description: 'TCP port to listen on (default 1883).',
        },
        {
          name: 'maxConnections',
          type: 'int32',
          required: false,
          description: 'Maximum number of simultaneous client connections.',
        },
        {
          name: 'persistenceEnabled',
          type: 'boolean',
          required: false,
          description: 'Whether subscription and message data is persisted to disk.',
        },
        {
          name: 'persistenceFile',
          type: 'string',
          required: false,
          description: 'Path to the persistence database file.',
        },
        {
          name: 'aclFile',
          type: 'string',
          required: false,
          description: 'Path to the access-control-list file.',
        },
        {
          name: 'passwordFile',
          type: 'string',
          required: false,
          description: 'Path to the password file for username/password auth.',
        },
        {
          name: 'tlsCaFile',
          type: 'string',
          required: false,
          description: 'CA certificate file for TLS.',
        },
        {
          name: 'tlsCertFile',
          type: 'string',
          required: false,
          description: 'Server certificate file for TLS.',
        },
        {
          name: 'tlsKeyFile',
          type: 'string',
          required: false,
          description: 'Server private key file for TLS.',
        },
        {
          name: 'logLevel',
          type: 'enum',
          required: false,
          description: 'Log verbosity: none, info, notice, warning, err, debug, all.',
        },
      ],
    },
    {
      name: 'MqttSession',
      description: 'Active broker-side session state for a connected MQTT client.',
      fields: [
        {
          name: 'clientId',
          type: 'string',
          required: true,
          description: 'Client identifier for this session.',
        },
        {
          name: 'connected',
          type: 'boolean',
          required: true,
          description: 'Whether the client is currently connected.',
        },
        {
          name: 'cleanSession',
          type: 'boolean',
          required: true,
          description: 'Whether the session is non-persistent.',
        },
        {
          name: 'keepalive',
          type: 'int32',
          required: false,
          description: 'Negotiated keep-alive in seconds.',
        },
        {
          name: 'subscriptions',
          type: 'array<MqttSubscription>',
          required: false,
          description: 'Current subscriptions held by this session.',
        },
      ],
    },
  ];

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'Eclipse Mosquitto',
      upstream: {
        repoUrl: 'https://github.com/eclipse-mosquitto/mosquitto',
        commit,
        version: 'master',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'MqttMessage',
        toEntity: 'MqttSubscription',
        kind: 'many_to_many',
        notes:
          'A published message is delivered to all subscriptions whose topic filter matches the message topic.',
      },
      {
        fromEntity: 'MqttSession',
        toEntity: 'MqttSubscription',
        kind: 'one_to_many',
        fromField: 'subscriptions',
        notes: 'Each session holds zero or more active subscriptions.',
      },
      {
        fromEntity: 'MqttSession',
        toEntity: 'MqttConnectOptions',
        kind: 'many_to_one',
        notes: 'A session is established via connect options.',
      },
    ],
    lifecycles: [
      {
        entity: 'MqttSession',
        statusField: 'connected',
        states: ['CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED'],
        notes:
          'Mosquitto client session lifecycle; transitions driven by CONNECT/DISCONNECT/keep-alive timeout.',
      },
    ],
    actions: [
      {
        name: 'connect',
        kind: 'create',
        entities: ['MqttSession'],
        idempotency: {
          supported: false,
          notes: 'Reconnection re-creates the TCP session; not idempotent.',
        },
      },
      {
        name: 'publish',
        kind: 'create',
        entities: ['MqttMessage'],
        idempotency: {
          supported: false,
          notes: 'QoS 2 ensures exactly-once delivery but is not idempotent at the API level.',
        },
      },
      {
        name: 'subscribe',
        kind: 'create',
        entities: ['MqttSubscription'],
        idempotency: {
          supported: true,
          notes: 'Re-subscribing with the same filter is safe; broker updates QoS if different.',
        },
      },
      {
        name: 'unsubscribe',
        kind: 'delete',
        entities: ['MqttSubscription'],
        idempotency: { supported: true, notes: 'Unsubscribing a non-existent filter is a no-op.' },
      },
      {
        name: 'disconnect',
        kind: 'delete',
        entities: ['MqttSession'],
        idempotency: {
          supported: true,
          notes: 'Disconnecting an already-disconnected client is harmless.',
        },
      },
    ],
    events: [
      {
        name: 'message.received',
        delivery: 'stream',
        entities: ['MqttMessage'],
        notes: 'Delivered to all matching subscribers as a DDS-style push stream.',
      },
      {
        name: 'client.connected',
        delivery: 'stream',
        entities: ['MqttSession'],
        notes: 'Broker-side event when a client successfully connects (available via $SYS topics).',
      },
      {
        name: 'client.disconnected',
        delivery: 'stream',
        entities: ['MqttSession'],
        notes: 'Broker-side event when a client disconnects (available via $SYS topics).',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'MQTT 5 user-properties extend messages but are not schema-defined.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  // Suppress unused variable warning for errorStates; used for documentation purposes only.
  void errorStates;

  writeJson(outPath, cif);
  console.log(`Wrote ${entities.length} entities to ${path.relative(repoRoot, outPath)}`);
}

main();

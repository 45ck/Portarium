import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'ros2-common-interfaces';
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

/** Map ROS 2 primitive types to CIF field types */
function rosToCifType(rosType) {
  const stripped = rosType.replace(/\[\d*\]$/, '');
  const isArray = rosType.includes('[');
  const typeMap = {
    bool: 'boolean',
    byte: 'uint8',
    char: 'uint8',
    float32: 'float32',
    float64: 'float64',
    int8: 'int8',
    int16: 'int16',
    int32: 'int32',
    int64: 'int64',
    uint8: 'uint8',
    uint16: 'uint16',
    uint32: 'uint32',
    uint64: 'uint64',
    string: 'string',
    wstring: 'string',
  };
  const base = typeMap[stripped] ?? stripped.replace('/', '.');
  return isArray ? `array<${base}>` : base;
}

/** Parse a single .msg file into a CIF entity */
function parseMsgFile(msgPath, entityName, packageName) {
  const lines = fs.readFileSync(msgPath, 'utf8').split('\n');
  const fields = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    // Skip constant definitions: "TYPE CONST_NAME = value"
    if (/^[a-zA-Z0-9_/[\]]+\s+[A-Z][A-Z0-9_]+\s*=/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [rosType, fieldName] = parts;
    if (!fieldName || !rosType) continue;
    fields.push({
      name: fieldName,
      type: rosToCifType(rosType),
      required: true,
      description: `ROS 2 ${packageName}/${entityName}.${fieldName} (${rosType})`,
    });
  }
  return fields;
}

/** Walk a package's msg/ directory and return entities */
function extractPackage(packageDir, packageName) {
  const msgDir = path.join(packageDir, 'msg');
  if (!fs.existsSync(msgDir)) return [];
  const entities = [];
  for (const file of fs.readdirSync(msgDir).sort()) {
    if (!file.endsWith('.msg')) continue;
    const entityName = file.replace('.msg', '');
    const fields = parseMsgFile(path.join(msgDir, file), entityName, packageName);
    if (fields.length === 0) continue;
    entities.push({
      name: `${packageName}.${entityName}`,
      description: `ROS 2 message type ${packageName}/${entityName}`,
      fields,
    });
  }
  return entities;
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  // Key packages in scope for Portarium's robotics CIF
  const packages = [
    'geometry_msgs',
    'sensor_msgs',
    'nav_msgs',
    'action_msgs',
    'std_msgs',
    'diagnostic_msgs',
  ];

  const entities = [];
  for (const pkg of packages) {
    const pkgDir = path.join(upstreamDir, pkg);
    const pkgEntities = extractPackage(pkgDir, pkg);
    entities.push(...pkgEntities);
  }

  if (entities.length === 0) {
    throw new Error('No entities extracted — check upstream directory structure.');
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'ROS 2 Common Interfaces',
      upstream: {
        repoUrl: 'https://github.com/ros2/common_interfaces',
        commit,
        version: 'rolling',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'sensor_msgs.BatteryState',
        toEntity: 'std_msgs.Header',
        kind: 'many_to_one',
        fromField: 'header',
        notes: 'Stamped messages embed std_msgs/Header for timestamp + frame_id.',
      },
      {
        fromEntity: 'nav_msgs.Odometry',
        toEntity: 'geometry_msgs.PoseWithCovariance',
        kind: 'many_to_one',
        fromField: 'pose',
        notes: 'Odometry embeds pose estimate with covariance.',
      },
      {
        fromEntity: 'nav_msgs.Odometry',
        toEntity: 'geometry_msgs.TwistWithCovariance',
        kind: 'many_to_one',
        fromField: 'twist',
        notes: 'Odometry embeds velocity estimate with covariance.',
      },
    ],
    lifecycles: [
      {
        entity: 'action_msgs.GoalStatus',
        statusField: 'status',
        states: [
          'STATUS_UNKNOWN',
          'STATUS_ACCEPTED',
          'STATUS_EXECUTING',
          'STATUS_CANCELING',
          'STATUS_SUCCEEDED',
          'STATUS_CANCELED',
          'STATUS_ABORTED',
        ],
        notes: 'ROS 2 action goal lifecycle states (action_msgs/GoalStatus.msg constants).',
      },
    ],
    actions: [
      {
        name: 'publishMessage',
        kind: 'create',
        entities: [
          'sensor_msgs.BatteryState',
          'sensor_msgs.JointState',
          'sensor_msgs.LaserScan',
          'nav_msgs.Odometry',
        ],
        idempotency: {
          supported: false,
          notes: 'ROS 2 pub/sub is fire-and-forget; no idempotency at the message layer.',
        },
      },
    ],
    events: [
      {
        name: 'topic.message_received',
        delivery: 'stream',
        entities: [
          'sensor_msgs.BatteryState',
          'sensor_msgs.JointState',
          'nav_msgs.Odometry',
          'nav_msgs.Path',
        ],
        notes: 'All ROS 2 topic subscriptions deliver messages as a stream via DDS.',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'ROS 2 .msg definitions are schema-fixed; no runtime field extension.',
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

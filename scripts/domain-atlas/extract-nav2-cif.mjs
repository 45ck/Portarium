import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const providerId = 'nav2';
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

function rosToCifType(rosType) {
  const stripped = rosType.replace(/\[\d*\]$/, '');
  const isArray = rosType.includes('[');
  const map = {
    bool: 'boolean',
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
  };
  const base = map[stripped] ?? stripped.replace('/', '.');
  return isArray ? `array<${base}>` : base;
}

/** Parse a section of a .action file (goal/result/feedback) into CIF fields */
function parseSectionFields(lines) {
  const fields = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    // Skip constant definitions
    if (/^[a-zA-Z0-9_/[\]]+\s+[A-Z][A-Z0-9_]+\s*=/.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [rosType, fieldName] = parts;
    if (!fieldName || !rosType) continue;
    fields.push({
      name: fieldName,
      type: rosToCifType(rosType),
      required: true,
    });
  }
  return fields;
}

/** Parse a single .action file into three CIF entities (Goal, Result, Feedback) */
function parseActionFile(actionPath, actionName) {
  const content = fs.readFileSync(actionPath, 'utf8');
  const [goalSection = '', resultSection = '', feedbackSection = ''] = content.split('---');

  const goalFields = parseSectionFields(goalSection.split('\n'));
  const resultFields = parseSectionFields(resultSection.split('\n'));
  const feedbackFields = parseSectionFields(feedbackSection.split('\n'));

  const entities = [];

  if (goalFields.length > 0) {
    entities.push({
      name: `${actionName}.Goal`,
      description: `Goal parameters for the ${actionName} Nav2 action.`,
      fields: goalFields,
    });
  }
  if (resultFields.length > 0) {
    entities.push({
      name: `${actionName}.Result`,
      description: `Result returned by the ${actionName} Nav2 action.`,
      fields: resultFields,
    });
  }
  if (feedbackFields.length > 0) {
    entities.push({
      name: `${actionName}.Feedback`,
      description: `Streaming feedback from the ${actionName} Nav2 action.`,
      fields: feedbackFields,
    });
  }

  return entities;
}

function main() {
  const sourceManifest = readJson(sourceManifestPath);
  const commit = sourceManifest?.upstream?.commit ?? undefined;

  const actionDir = path.join(upstreamDir, 'nav2_msgs', 'action');
  if (!fs.existsSync(actionDir)) {
    throw new Error(`nav2_msgs/action directory not found at ${actionDir}`);
  }

  const entities = [];
  const actionNames = [];

  for (const file of fs.readdirSync(actionDir).sort()) {
    if (!file.endsWith('.action')) continue;
    const actionName = file.replace('.action', '');
    const parsed = parseActionFile(path.join(actionDir, file), actionName);
    entities.push(...parsed);
    actionNames.push(actionName);
  }

  if (entities.length === 0) {
    throw new Error('No entities extracted from nav2 action files.');
  }

  const cif = {
    schemaVersion: '1.0.0',
    source: {
      providerId,
      providerName: 'Nav2 (Navigation2)',
      upstream: {
        repoUrl: 'https://github.com/ros-navigation/navigation2',
        commit,
        version: 'main',
      },
    },
    extractedAt: nowIsoUtc(),
    entities,
    relationships: [
      {
        fromEntity: 'NavigateToPose.Feedback',
        toEntity: 'NavigateToPose.Goal',
        kind: 'many_to_one',
        notes: 'Feedback messages stream while a NavigateToPose goal is active.',
      },
      {
        fromEntity: 'NavigateThroughPoses.Feedback',
        toEntity: 'NavigateThroughPoses.Goal',
        kind: 'many_to_one',
        notes: 'Feedback messages stream while a NavigateThroughPoses goal is active.',
      },
    ],
    lifecycles: [
      {
        entity: 'NavigateToPose.Goal',
        statusField: 'status',
        states: ['ACCEPTED', 'EXECUTING', 'CANCELING', 'SUCCEEDED', 'CANCELED', 'ABORTED'],
        notes: 'ROS 2 action goal lifecycle; state machine is managed by the action server.',
      },
    ],
    actions: actionNames.map((name) => ({
      name: `send${name}Goal`,
      kind: 'workflow',
      entities: [`${name}.Goal`, `${name}.Result`],
      idempotency: {
        supported: false,
        notes: 'ROS 2 action goals are identified by UUID; no built-in idempotency key.',
      },
    })),
    events: [
      {
        name: 'action.feedback_received',
        delivery: 'stream',
        entities: [
          'NavigateToPose.Feedback',
          'NavigateThroughPoses.Feedback',
          'FollowPath.Feedback',
        ],
        notes: 'Nav2 action servers stream feedback until goal is terminal.',
      },
      {
        name: 'action.goal_completed',
        delivery: 'stream',
        entities: ['NavigateToPose.Result', 'NavigateThroughPoses.Result'],
        notes: 'Emitted once when a goal reaches a terminal state (succeeded/canceled/aborted).',
      },
    ],
    extensionPoints: {
      customFields: {
        supported: false,
        notes: 'Nav2 action interfaces are schema-fixed .action files.',
      },
      tags: { supported: false },
      attachments: { supported: false },
      comments: { supported: false },
      activities: { supported: false },
    },
  };

  writeJson(outPath, cif);
  console.log(
    `Wrote ${entities.length} entities (${actionNames.length} actions) to ${path.relative(repoRoot, outPath)}`,
  );
}

main();

import fs from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
const SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';
const GOLDEN_RELATIVE_PATH = 'src/infrastructure/openapi/openapi-operation-ids.golden.json';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgs(argv) {
  const allowed = new Set(['--check', '--update']);
  const args = argv.slice(2);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0) {
    fail(`Unknown arguments: ${unknown.join(', ')}`);
  }

  return {
    check: args.includes('--check') || !args.includes('--update'),
    update: args.includes('--update'),
  };
}

function readOpenApiDocument(repoRoot) {
  const specPath = path.join(repoRoot, SPEC_RELATIVE_PATH);
  if (!fs.existsSync(specPath)) {
    fail(`OpenAPI spec not found at ${SPEC_RELATIVE_PATH}`);
  }

  const raw = fs.readFileSync(specPath, 'utf8');
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) fail('OpenAPI document must be an object.');

  const paths = parsed['paths'];
  if (!isRecord(paths)) fail('OpenAPI.paths must be an object.');

  return { parsed, paths };
}

function collectOperationIds(pathsObj) {
  const operationIds = [];
  const missingOperationId = [];

  for (const [route, pathItem] of Object.entries(pathsObj)) {
    if (!isRecord(pathItem)) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;

      if (!isRecord(operation)) {
        missingOperationId.push(`${method.toUpperCase()} ${route}`);
        continue;
      }

      const operationId = operation['operationId'];
      if (typeof operationId !== 'string' || operationId.trim() === '') {
        missingOperationId.push(`${method.toUpperCase()} ${route}`);
        continue;
      }

      operationIds.push(operationId.trim());
    }
  }

  const seen = new Set();
  const duplicates = new Set();
  for (const operationId of operationIds) {
    if (seen.has(operationId)) duplicates.add(operationId);
    seen.add(operationId);
  }

  return {
    operationIds: [...seen].sort((a, b) => a.localeCompare(b)),
    duplicates: [...duplicates].sort((a, b) => a.localeCompare(b)),
    missingOperationId,
  };
}

function readGolden(goldenPath) {
  if (!fs.existsSync(goldenPath)) {
    fail(
      [
        `Golden fixture not found at ${GOLDEN_RELATIVE_PATH}.`,
        'Run: npm run openapi:operation-ids:update',
      ].join('\n'),
    );
  }

  const raw = fs.readFileSync(goldenPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) fail('OpenAPI operationIds golden fixture must be an object.');

  const operationIds = parsed['operationIds'];
  if (!Array.isArray(operationIds) || operationIds.some((value) => typeof value !== 'string')) {
    fail('OpenAPI operationIds golden fixture must contain "operationIds" as string[].');
  }

  return operationIds;
}

function writeGolden(goldenPath, operationIds) {
  const payload = {
    openapiSpecPath: SPEC_RELATIVE_PATH,
    operationCount: operationIds.length,
    operationIds,
  };

  fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
  fs.writeFileSync(goldenPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function compare(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  const missing = actual.filter((op) => !expectedSet.has(op));
  const extra = expected.filter((op) => !actualSet.has(op));

  return {
    equal: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

function main() {
  const repoRoot = process.cwd();
  const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE_PATH);
  const args = parseArgs(process.argv);

  const { paths } = readOpenApiDocument(repoRoot);
  const { operationIds, duplicates, missingOperationId } = collectOperationIds(paths);

  if (duplicates.length > 0) {
    fail(`Duplicate operationId values found:\n- ${duplicates.join('\n- ')}`);
  }

  if (missingOperationId.length > 0) {
    fail(
      [
        'OpenAPI operations missing operationId:',
        ...missingOperationId.map((value) => `- ${value}`),
      ].join('\n'),
    );
  }

  if (args.update) {
    writeGolden(goldenPath, operationIds);
    console.log(
      `Updated ${GOLDEN_RELATIVE_PATH} with ${operationIds.length} OpenAPI operationId values.`,
    );
    return;
  }

  if (args.check) {
    const goldenOperationIds = readGolden(goldenPath);
    const result = compare(goldenOperationIds, operationIds);
    if (!result.equal) {
      fail(
        [
          `OpenAPI operationId golden fixture drift detected: ${GOLDEN_RELATIVE_PATH}`,
          result.missing.length > 0 ? `Missing in golden:\n- ${result.missing.join('\n- ')}` : '',
          result.extra.length > 0 ? `Stale in golden:\n- ${result.extra.join('\n- ')}` : '',
          'Run: npm run openapi:operation-ids:update',
        ]
          .filter(Boolean)
          .join('\n\n'),
      );
    }

    console.log(
      `OpenAPI operationId golden fixture is up to date (${operationIds.length} operationId values).`,
    );
  }
}

main();

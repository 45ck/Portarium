import { execSync } from 'node:child_process';
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

function parseOpenApiOperations(raw, label) {
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) fail(`${label} must be an object.`);

  const paths = parsed['paths'];
  if (!isRecord(paths)) fail(`${label}.paths must be an object.`);

  const operationIds = [];
  const stableOperationIds = [];
  const missingOperationId = [];
  const duplicates = new Set();
  const seen = new Set();

  for (const [route, pathItem] of Object.entries(paths)) {
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

      const normalized = operationId.trim();
      operationIds.push(normalized);
      const stability = operation['x-stability'];
      if (typeof stability === 'string' && stability.trim().toLowerCase() === 'stable') {
        stableOperationIds.push(normalized);
      }
      if (seen.has(normalized)) duplicates.add(normalized);
      seen.add(normalized);
    }
  }

  if (missingOperationId.length > 0) {
    fail(
      [
        `${label} has operations missing operationId:`,
        ...missingOperationId.map((value) => `- ${value}`),
      ].join('\n'),
    );
  }

  if (duplicates.size > 0) {
    fail(
      [
        `${label} contains duplicate operationIds:`,
        ...[...duplicates].sort((a, b) => a.localeCompare(b)).map((value) => `- ${value}`),
      ].join('\n'),
    );
  }

  return {
    operationIds: [...seen].sort((a, b) => a.localeCompare(b)),
    stableOperationIds: [...new Set(stableOperationIds)].sort((a, b) => a.localeCompare(b)),
  };
}

function readCurrentOpenApiOperations(repoRoot) {
  const specPath = path.join(repoRoot, SPEC_RELATIVE_PATH);
  if (!fs.existsSync(specPath)) {
    fail(`Current OpenAPI spec not found at ${SPEC_RELATIVE_PATH}`);
  }
  const raw = fs.readFileSync(specPath, 'utf8');
  return parseOpenApiOperations(raw, 'Current OpenAPI');
}

function readBaseOpenApiOperationsFromGit(baseRef) {
  const escapedPath = SPEC_RELATIVE_PATH.replace(/\\/g, '/');
  const raw = execSync(`git show ${baseRef}:${escapedPath}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return parseOpenApiOperations(raw, `Base OpenAPI (${baseRef})`);
}

function readOpenApiOperationsFromGolden(repoRoot) {
  const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE_PATH);
  if (!fs.existsSync(goldenPath)) {
    fail(
      [
        `Cannot read fallback golden fixture at ${GOLDEN_RELATIVE_PATH}.`,
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

  const stableOperationIdsRaw = parsed['stableOperationIds'];
  if (
    stableOperationIdsRaw !== undefined &&
    (!Array.isArray(stableOperationIdsRaw) ||
      stableOperationIdsRaw.some((value) => typeof value !== 'string'))
  ) {
    fail('OpenAPI operationIds golden fixture "stableOperationIds" must be omitted or string[].');
  }

  return {
    operationIds: [...new Set(operationIds)].sort((a, b) => a.localeCompare(b)),
    stableOperationIds: [
      ...new Set(stableOperationIdsRaw === undefined ? [] : stableOperationIdsRaw),
    ].sort((a, b) => a.localeCompare(b)),
  };
}

function main() {
  const repoRoot = process.cwd();
  const baseRef = process.env['OPENAPI_BASE_REF'] || 'origin/main';

  const currentOpenApi = readCurrentOpenApiOperations(repoRoot);
  const currentOperationIds = currentOpenApi.operationIds;
  const currentStableOperationIds = currentOpenApi.stableOperationIds;

  if (currentStableOperationIds.length === 0) {
    fail(
      [
        'OpenAPI routing-enforcement freeze check failed:',
        'No operations are marked with x-stability: stable.',
      ].join('\n'),
    );
  }

  let baseOpenApi;
  let baseSource;
  try {
    baseOpenApi = readBaseOpenApiOperationsFromGit(baseRef);
    baseSource = `git ref ${baseRef}`;
  } catch {
    baseOpenApi = readOpenApiOperationsFromGolden(repoRoot);
    baseSource = `golden fixture ${GOLDEN_RELATIVE_PATH}`;
  }

  const currentSet = new Set(currentOperationIds);
  const removedStable = baseOpenApi.stableOperationIds.filter(
    (operationId) => !currentSet.has(operationId),
  );

  if (removedStable.length > 0) {
    fail(
      [
        `OpenAPI stable-path regression detected against ${baseSource}:`,
        'The following stable operationIds were removed or renamed:',
        ...removedStable.map((operationId) => `- ${operationId}`),
      ].join('\n'),
    );
  }

  const removed = baseOpenApi.operationIds.filter((operationId) => !currentSet.has(operationId));

  if (removed.length > 0) {
    fail(
      [
        `OpenAPI breaking change detected against ${baseSource}:`,
        'The following operationIds were removed or renamed:',
        ...removed.map((operationId) => `- ${operationId}`),
      ].join('\n'),
    );
  }

  console.log(
    `OpenAPI breaking-change check passed against ${baseSource}. ` +
      `${baseOpenApi.operationIds.length} baseline operationIds, ` +
      `${currentOperationIds.length} current, ` +
      `${currentStableOperationIds.length} current stable operationIds.`,
  );
}

main();

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

const SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';
const VERSIONED_PATH_PATTERN = /^\/v1(?:\/|$)/;
const JSON_MEDIA_TYPES = new Set(['application/json', 'application/problem+json']);
const RESPONSE_MEDIA_TYPES = new Set([
  'application/json',
  'application/problem+json',
  'text/event-stream',
]);

function fail(lines) {
  const output = Array.isArray(lines) ? lines.join('\n') : String(lines);
  console.error(output);
  process.exit(1);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCurrentSpec(repoRoot) {
  const specPath = path.join(repoRoot, SPEC_RELATIVE_PATH);
  if (!fs.existsSync(specPath)) fail(`OpenAPI spec not found: ${SPEC_RELATIVE_PATH}`);
  const parsed = parseYaml(fs.readFileSync(specPath, 'utf8'));
  if (!isRecord(parsed)) fail('Current OpenAPI document must be an object.');
  return parsed;
}

function readBaseSpec(baseRef) {
  try {
    const specText = execSync(`git show ${baseRef}:${SPEC_RELATIVE_PATH.replace(/\\/g, '/')}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = parseYaml(specText);
    if (!isRecord(parsed)) throw new Error('base spec is not an object');
    return parsed;
  } catch {
    return null;
  }
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string');
}

function schemaCompatibilityIssues(baseSchemas, currentSchemas) {
  const issues = [];

  for (const [schemaName, baseSchemaRaw] of Object.entries(baseSchemas)) {
    const currentSchemaRaw = currentSchemas[schemaName];
    if (!isRecord(baseSchemaRaw) || !isRecord(currentSchemaRaw)) continue;

    const baseProperties = isRecord(baseSchemaRaw.properties) ? baseSchemaRaw.properties : {};
    const currentProperties = isRecord(currentSchemaRaw.properties)
      ? currentSchemaRaw.properties
      : {};

    const removedProperties = Object.keys(baseProperties).filter(
      (name) => !(name in currentProperties),
    );
    for (const removed of removedProperties) {
      issues.push(`components.schemas.${schemaName}: property removed (${removed})`);
    }

    const baseRequired = new Set(asStringArray(baseSchemaRaw.required));
    const currentRequired = new Set(asStringArray(currentSchemaRaw.required));
    for (const requiredField of currentRequired) {
      if (baseRequired.has(requiredField)) continue;
      issues.push(
        `components.schemas.${schemaName}: new required field (${requiredField}) violates additive-only rule`,
      );
    }
  }

  return issues;
}

function mediaTypeIssues(pathsObj) {
  const issues = [];

  for (const [route, pathItem] of Object.entries(pathsObj)) {
    if (!isRecord(pathItem)) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isRecord(operation)) continue;

      const opLabel = `${method.toUpperCase()} ${route}`;

      if (isRecord(operation.requestBody)) {
        const content = operation.requestBody.content;
        if (!isRecord(content)) {
          issues.push(`${opLabel}: requestBody must declare content media types`);
        } else if (!Object.keys(content).some((mediaType) => JSON_MEDIA_TYPES.has(mediaType))) {
          issues.push(`${opLabel}: requestBody must support application/json`);
        }
      }

      if (!isRecord(operation.responses)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!isRecord(response) || !isRecord(response.content)) continue;
        const mediaTypes = Object.keys(response.content);
        const hasSupported = mediaTypes.some((mediaType) => RESPONSE_MEDIA_TYPES.has(mediaType));
        if (!hasSupported) {
          issues.push(
            `${opLabel}: response ${status} must include JSON, problem+json, or text/event-stream`,
          );
        }
      }

      if (operation.deprecated === true) {
        const description = typeof operation.description === 'string' ? operation.description : '';
        if (!/deprecat/i.test(description)) {
          issues.push(
            `${opLabel}: deprecated operation must include deprecation guidance in description`,
          );
        }
      }
    }
  }

  return issues;
}

function versionPathIssues(pathsObj) {
  const issues = [];
  for (const route of Object.keys(pathsObj)) {
    if (VERSIONED_PATH_PATTERN.test(route)) continue;
    issues.push(`OpenAPI path not versioned under /v1: ${route}`);
  }
  return issues;
}

function main() {
  const repoRoot = process.cwd();
  const baseRef = process.env['OPENAPI_BASE_REF'] || 'origin/main';

  const currentSpec = readCurrentSpec(repoRoot);
  const pathsObj = isRecord(currentSpec.paths) ? currentSpec.paths : null;
  if (pathsObj === null) fail('Current OpenAPI document must contain object: paths');

  const allIssues = [];
  allIssues.push(...versionPathIssues(pathsObj));
  allIssues.push(...mediaTypeIssues(pathsObj));

  const baseSpec = readBaseSpec(baseRef);
  if (baseSpec !== null) {
    const baseSchemas =
      isRecord(baseSpec.components) && isRecord(baseSpec.components.schemas)
        ? baseSpec.components.schemas
        : {};
    const currentSchemas =
      isRecord(currentSpec.components) && isRecord(currentSpec.components.schemas)
        ? currentSpec.components.schemas
        : {};
    allIssues.push(...schemaCompatibilityIssues(baseSchemas, currentSchemas));
  }

  if (allIssues.length > 0) {
    fail([
      'OpenAPI compatibility policy check failed:',
      ...allIssues.map((issue) => `- ${issue}`),
      '',
      'Policy: versioned paths, additive-only schema evolution, deprecation guidance, JSON/problem+json content.',
    ]);
  }

  console.log('OpenAPI compatibility policy check passed.');
}

main();

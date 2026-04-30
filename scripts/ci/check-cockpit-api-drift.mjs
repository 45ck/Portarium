#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../..');
const cockpitSrc = resolve(repoRoot, 'apps/cockpit/src');
const cockpitMocksPath = resolve(cockpitSrc, 'mocks/handlers.ts');
const openApiSpecPath = resolve(repoRoot, 'docs/spec/openapi/portarium-control-plane.v1.yaml');
const cockpitTypesPath = resolve(repoRoot, 'src/presentation/ops-cockpit/types.ts');
const runtimeHandlerPath = resolve(repoRoot, 'src/presentation/runtime/control-plane-handler.ts');
const endpointRegistryPath = resolve(currentDir, 'cockpit-consumed-endpoints.json');

const httpMethods = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
const contractStates = new Set(['required', 'pending', 'not-required']);
const sourceExtensions = new Set(['.ts', '.tsx']);
const ignoredUsagePathParts = ['/mocks/', '.test.', '.stories.', '.d.ts'];
const legacyDecisionPathPattern = /\/approvals\/\$\{[^}]+\}\/decision/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }
    if (sourceExtensions.has(extname(fullPath))) out.push(fullPath);
  }
  return out;
}

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function relative(path) {
  return toPosix(path).replace(`${toPosix(repoRoot)}/`, '');
}

function fail(message, entries = []) {
  console.error(message);
  for (const entry of entries) {
    console.error(` - ${entry}`);
  }
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Cockpit API drift check failed: could not parse ${relative(path)}.`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}

function normalizeExpressionParameter(expression) {
  const compact = expression.replace(/\s+/g, '');
  const mappings = [
    ['workspaceId', ['workspaceId', 'wsId']],
    ['workItemId', ['workItemId', 'wiId']],
    ['humanTaskId', ['humanTaskId', 'taskId']],
    ['credentialGrantId', ['credentialGrantId']],
    ['approvalId', ['approvalId']],
    ['workflowId', ['workflowId']],
    ['machineId', ['machineId']],
    ['missionId', ['missionId']],
    ['evidenceId', ['evidenceId']],
    ['policyId', ['policyId']],
    ['agentId', ['agentId']],
    ['beadId', ['beadId']],
    ['robotId', ['robotId']],
    ['planId', ['planId']],
    ['runId', ['runId']],
    ['userId', ['userId']],
    ['action', ['action']],
  ];

  for (const [canonical, aliases] of mappings) {
    if (aliases.some((alias) => compact.includes(alias))) return canonical;
  }

  const identifiers = compact.match(/[A-Za-z][A-Za-z0-9_]*/g);
  return canonicalParameterName(identifiers?.at(-1) ?? 'param');
}

function canonicalParameterName(name, previousSegment) {
  const direct = {
    wsId: 'workspaceId',
    wiId: 'workItemId',
    taskId: 'humanTaskId',
  };
  if (direct[name]) return direct[name];
  if (name === 'id' && previousSegment === 'approvals') return 'approvalId';
  if (name === 'id' && previousSegment === 'policies') return 'policyId';
  return name;
}

function normalizePath(input) {
  let path = input.trim();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    path = new URL(path).pathname;
  }
  path = path.split('?')[0].split('#')[0];
  path = path.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    return `{${normalizeExpressionParameter(expression)}}`;
  });
  path = path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '{$1}');
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const segments = path.split('/');
  return segments
    .map((segment, index) => {
      const placeholder = segment.match(/^\{([^}]+)\}$/);
      if (!placeholder) return segment;
      const previousSegment = segments[index - 1];
      return `{${canonicalParameterName(placeholder[1], previousSegment)}}`;
    })
    .join('/');
}

function operationKey(method, path) {
  return `${method.toUpperCase()} ${normalizePath(path)}`;
}

function pathMatchesRegistry(path, registryPaths) {
  if (registryPaths.has(path)) return true;
  return [...registryPaths].some((registeredPath) => registeredPath.startsWith(`${path}/`));
}

function collectOpenApiOperations() {
  const parsed = parseYaml(readFileSync(openApiSpecPath, 'utf8'));
  const paths = parsed?.paths;
  if (!paths || typeof paths !== 'object') {
    fail('Cockpit API drift check failed: OpenAPI spec has no paths object.');
  }

  const operations = new Set();
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of Object.keys(pathItem)) {
      const upper = method.toUpperCase();
      if (httpMethods.has(upper)) operations.add(operationKey(upper, path));
    }
  }
  return operations;
}

function collectRuntimeOperations() {
  const content = readFileSync(runtimeHandlerPath, 'utf8');
  const operations = new Set();
  const routePattern = /app\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const match of content.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const path = match[2];
    if (path.startsWith('/v1/')) operations.add(operationKey(method, path));
  }
  return operations;
}

function collectMockOperations() {
  const content = readFileSync(cockpitMocksPath, 'utf8');
  const operations = new Set();
  const routePattern = /http\.(get|post|patch|put|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const match of content.matchAll(routePattern)) {
    operations.add(operationKey(match[1].toUpperCase(), match[2]));
  }
  return operations;
}

function loadRegistry() {
  const registry = readJson(endpointRegistryPath);
  if (!Array.isArray(registry?.endpoints)) {
    fail('Cockpit API drift check failed: endpoint registry must contain endpoints array.');
  }

  const entries = registry.endpoints;
  const errors = [];
  const keys = new Map();
  for (const entry of entries) {
    const label = typeof entry?.id === 'string' ? entry.id : '<missing id>';
    if (!entry || typeof entry !== 'object') {
      errors.push(`${label}: endpoint entry must be an object`);
      continue;
    }
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      errors.push(`${label}: id is required`);
    }
    if (!httpMethods.has(entry.method)) {
      errors.push(`${label}: method must be one of ${[...httpMethods].join(', ')}`);
    }
    if (typeof entry.path !== 'string' || !entry.path.startsWith('/v1/')) {
      errors.push(`${label}: path must be a /v1 path`);
    }
    for (const field of ['openapi', 'runtime', 'mock']) {
      if (!contractStates.has(entry[field])) {
        errors.push(`${label}: ${field} must be required, pending, or not-required`);
      }
    }
    if ([entry.openapi, entry.runtime, entry.mock].includes('pending')) {
      if (typeof entry.trackingBead !== 'string' || !/^bead-\d+$/.test(entry.trackingBead)) {
        errors.push(`${label}: pending endpoints must reference trackingBead`);
      }
      if (typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
        errors.push(`${label}: pending endpoints must include reason`);
      }
    }

    const key = operationKey(entry.method ?? '', entry.path ?? '');
    if (keys.has(key)) {
      errors.push(`${label}: duplicates ${keys.get(key)} as ${key}`);
    }
    keys.set(key, label);
  }

  if (errors.length > 0) {
    fail('Cockpit API drift check failed: invalid endpoint registry.', errors);
  }
  return entries;
}

function collectCockpitPathLiterals() {
  const offenders = [];
  const literals = [];
  const stringPattern = /[`'"]([^`'"]*\/v1\/[^`'"]*)[`'"]/g;

  for (const filePath of walk(cockpitSrc)) {
    const relativePath = relative(filePath);
    if (ignoredUsagePathParts.some((part) => relativePath.includes(part))) continue;

    const content = readFileSync(filePath, 'utf8');
    if (legacyDecisionPathPattern.test(content)) {
      offenders.push(`${relativePath}: legacy approvals /decision path`);
    }
    for (const match of content.matchAll(stringPattern)) {
      const normalized = normalizePath(match[1]);
      if (normalized === '/v1' || normalized === '/v1/') continue;
      literals.push({ filePath: relativePath, path: normalized });
    }
  }

  return { literals, offenders };
}

function collectControlPlaneClientMethods() {
  const content = readFileSync(resolve(cockpitSrc, 'lib/control-plane-client.ts'), 'utf8');
  const methods = new Map();
  const headers = [...content.matchAll(/^ {2}public\s+([A-Za-z0-9_]+)\(/gm)];

  for (const [index, header] of headers.entries()) {
    const name = header[1];
    const start = header.index ?? 0;
    const end = headers[index + 1]?.index ?? content.indexOf('\n  private ', start);
    const block = content.slice(start, end === -1 ? undefined : end);
    const pathMatch = block.match(/`([^`]*\/v1\/[^`]*)`/);
    if (!pathMatch) continue;
    const methodMatch = block.match(/method:\s*['"`]([A-Za-z]+)['"`]/);
    methods.set(name, {
      method: (methodMatch?.[1] ?? 'GET').toUpperCase(),
      path: normalizePath(pathMatch[1]),
    });
  }

  return methods;
}

const registryEntries = loadRegistry();
const openApiOperations = collectOpenApiOperations();
const runtimeOperations = collectRuntimeOperations();
const mockOperations = collectMockOperations();
const registryOperations = new Set(
  registryEntries.map((entry) => operationKey(entry.method, entry.path)),
);
const registryPaths = new Set(registryEntries.map((entry) => normalizePath(entry.path)));

const drift = [];
for (const entry of registryEntries) {
  const key = operationKey(entry.method, entry.path);
  if (entry.openapi === 'required' && !openApiOperations.has(key)) {
    drift.push(`${entry.id}: ${key} is marked OpenAPI-required but is absent from the spec`);
  }
  if (entry.runtime === 'required' && !runtimeOperations.has(key)) {
    drift.push(`${entry.id}: ${key} is marked runtime-required but is absent from live runtime`);
  }
  if (entry.mock === 'required' && !mockOperations.has(key)) {
    drift.push(`${entry.id}: ${key} is marked mock-required but has no MSW handler`);
  }
}

for (const mockOperation of mockOperations) {
  if (!registryOperations.has(mockOperation)) {
    drift.push(
      `${mockOperation} is handled by MSW but absent from cockpit-consumed-endpoints.json`,
    );
  }
}

const { literals, offenders } = collectCockpitPathLiterals();
drift.push(...offenders);
for (const literal of literals) {
  if (!pathMatchesRegistry(literal.path, registryPaths)) {
    drift.push(`${literal.filePath}: ${literal.path} is not registered`);
  }
}

const clientMethods = collectControlPlaneClientMethods();
const registryClientMethods = new Map(
  registryEntries
    .filter((entry) => typeof entry.clientMethod === 'string')
    .map((entry) => [entry.clientMethod, entry]),
);

for (const [name, usage] of clientMethods) {
  const entry = registryClientMethods.get(name);
  if (!entry) {
    drift.push(`ControlPlaneClient.${name}: method is missing from endpoint registry`);
    continue;
  }
  const registryKey = operationKey(entry.method, entry.path);
  const clientKey = operationKey(usage.method, usage.path);
  if (registryKey !== clientKey) {
    drift.push(
      `ControlPlaneClient.${name}: uses ${clientKey} but registry declares ${registryKey}`,
    );
  }
}

for (const methodName of registryClientMethods.keys()) {
  if (!clientMethods.has(methodName)) {
    drift.push(`Endpoint registry references missing ControlPlaneClient.${methodName}`);
  }
}

const openapiSpec = readFileSync(openApiSpecPath, 'utf8');
const statusEnumMatch = openapiSpec.match(/WorkItemStatus:[\s\S]*?enum:\s*\[([^\]]+)\]/m);
if (!statusEnumMatch) {
  fail('Cockpit API drift check failed: could not locate WorkItemStatus enum in OpenAPI spec.');
}
const openapiStatuses = statusEnumMatch[1]
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part.length > 0);

const cockpitTypes = readFileSync(cockpitTypesPath, 'utf8');
const workItemInterfaceMatch = cockpitTypes.match(
  /export interface WorkItemSummary\s*\{[\s\S]*?\n\}/m,
);
if (!workItemInterfaceMatch) {
  fail(
    'Cockpit API drift check failed: could not locate WorkItemSummary interface in cockpit types.',
  );
}
const workItemStatusMatch = workItemInterfaceMatch[0].match(/status:\s*([^;]+);/m);
if (!workItemStatusMatch) {
  fail(
    'Cockpit API drift check failed: could not locate WorkItemSummary.status union in cockpit types.',
  );
}
const cockpitStatuses = workItemStatusMatch[1].split("'").filter((_, index) => index % 2 === 1);

if (openapiStatuses.join('|') !== cockpitStatuses.join('|')) {
  drift.push(
    `WorkItemStatus enum drift detected. OpenAPI: ${openapiStatuses.join(', ')}; Cockpit: ${cockpitStatuses.join(', ')}`,
  );
}

const evidenceCategoryEnumMatch = openapiSpec.match(
  /EvidenceCategory:[\s\S]*?enum:\s*\[([^\]]+)\]/m,
);
if (!evidenceCategoryEnumMatch) {
  fail('Cockpit API drift check failed: could not locate EvidenceCategory enum in OpenAPI spec.');
}
const openapiEvidenceCategories = evidenceCategoryEnumMatch[1]
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part.length > 0);

const cockpitEvidenceCategoryMatch = cockpitTypes.match(
  /export type EvidenceCategory\s*=\s*([\s\S]*?);/m,
);
if (!cockpitEvidenceCategoryMatch) {
  fail('Cockpit API drift check failed: could not locate EvidenceCategory union in cockpit types.');
}
const cockpitEvidenceCategories = cockpitEvidenceCategoryMatch[1]
  .split("'")
  .filter((_, index) => index % 2 === 1);

if (openapiEvidenceCategories.join('|') !== cockpitEvidenceCategories.join('|')) {
  drift.push(
    `EvidenceCategory enum drift detected. OpenAPI: ${openapiEvidenceCategories.join(', ')}; Cockpit: ${cockpitEvidenceCategories.join(', ')}`,
  );
}

if (drift.length > 0) {
  fail('Cockpit API drift check failed.', drift);
}

console.log('Cockpit API drift check passed.');

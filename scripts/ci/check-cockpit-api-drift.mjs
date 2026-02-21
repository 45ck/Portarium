#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../..');
const cockpitSrc = resolve(repoRoot, 'apps/cockpit/src');
const openApiSpecPath = resolve(repoRoot, 'docs/spec/openapi/portarium-control-plane.v1.yaml');
const cockpitTypesPath = resolve(repoRoot, 'src/presentation/ops-cockpit/types.ts');

const trackedEntityPattern =
  /fetch\(\s*`\/v1\/workspaces\/\$\{wsId\}\/(?:approvals|runs|work-items|workflows)(?:\/|`)/;
const legacyDecisionPathPattern = /\/approvals\/\$\{[^}]+\}\/decision/;

const ignoredFiles = new Set([resolve(cockpitSrc, 'lib/control-plane-client.ts')]);
const extensions = new Set(['.ts', '.tsx']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }
    const ext = fullPath.slice(fullPath.lastIndexOf('.'));
    if (extensions.has(ext)) out.push(fullPath);
  }
  return out;
}

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function fail(message, entries = []) {
  console.error(message);
  for (const entry of entries) {
    console.error(` - ${entry}`);
  }
  process.exit(1);
}

const offenders = [];
for (const filePath of walk(cockpitSrc)) {
  if (ignoredFiles.has(filePath)) continue;
  const content = readFileSync(filePath, 'utf8');
  if (trackedEntityPattern.test(content)) {
    offenders.push(
      `${toPosix(filePath).replace(`${toPosix(repoRoot)}/`, '')}: direct fetch on core entity endpoint`,
    );
  }
  if (legacyDecisionPathPattern.test(content)) {
    offenders.push(
      `${toPosix(filePath).replace(`${toPosix(repoRoot)}/`, '')}: legacy approvals /decision path`,
    );
  }
}

if (offenders.length > 0) {
  fail('Cockpit API drift check failed. Use the shared typed control-plane client.', offenders);
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
  fail('Cockpit API drift check failed: WorkItemStatus enum drift detected.', [
    `OpenAPI: ${openapiStatuses.join(', ')}`,
    `Cockpit: ${cockpitStatuses.join(', ')}`,
  ]);
}

console.log('Cockpit API drift check passed.');

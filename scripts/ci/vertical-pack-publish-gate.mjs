#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PACK_ROOT = 'vertical-packs/software-change-management';
const DEFAULT_BASELINE_REF = 'origin/main';
const ASSET_KEYS = [
  'schemas',
  'workflows',
  'uiTemplates',
  'mappings',
  'testAssets',
  'complianceProfiles',
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const packRoot = path.resolve(repoRoot, args.packRoot);
  const errors = [];
  const warnings = [];

  if (!existsSync(packRoot)) {
    fail(`Pack root does not exist: ${toRepoRel(repoRoot, packRoot)}`);
  }

  const manifestPath = path.join(packRoot, 'pack.manifest.json');
  if (!existsSync(manifestPath)) {
    fail(`Missing pack manifest: ${toRepoRel(repoRoot, manifestPath)}`);
  }

  const manifest = readJsonFile(manifestPath, errors, 'pack.manifest.json');
  if (!isRecord(manifest)) {
    reportAndExit({
      packRoot,
      errors,
      warnings,
      summary: null,
    });
    return;
  }

  validateManifestShape(manifest, errors);

  const assetSet = validateAndLoadDeclaredAssets({
    repoRoot,
    packRoot,
    manifest,
    errors,
  });
  const fixtureSummary = validatePackFixtures({
    repoRoot,
    packRoot,
    loadedAssets: assetSet,
    errors,
    warnings,
  });
  const schemaSummary = validateSchemaCompatibility({
    repoRoot,
    packRoot,
    baselineRef: args.baselineRef,
    loadedAssets: assetSet,
    manifest,
    errors,
    warnings,
  });

  reportAndExit({
    packRoot,
    errors,
    warnings,
    summary: {
      schemasChecked: schemaSummary.schemasChecked,
      schemaBreakChecks: schemaSummary.breakChecks,
      testAssetsChecked: fixtureSummary.testAssetsChecked,
      workflowSimulationFixtures: fixtureSummary.workflowSimulationFixtures,
      connectorContractFixtures: fixtureSummary.connectorContractFixtures,
      conformanceFixtures: fixtureSummary.conformanceFixtures,
    },
  });
}

function parseArgs(argv) {
  const args = {
    packRoot: DEFAULT_PACK_ROOT,
    baselineRef: DEFAULT_BASELINE_REF,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--pack-root') {
      const value = argv[i + 1];
      if (!value) {
        fail('--pack-root requires a value.');
      }
      args.packRoot = value;
      i += 1;
      continue;
    }
    if (token === '--baseline-ref') {
      const value = argv[i + 1];
      if (!value) {
        fail('--baseline-ref requires a value.');
      }
      args.baselineRef = value;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
    fail(`Unknown argument: ${token}`);
  }

  return args;
}

function validateManifestShape(manifest, errors) {
  if (manifest['manifestVersion'] !== 1) {
    errors.push('Manifest must declare manifestVersion: 1.');
  }

  const id = manifest['id'];
  if (typeof id !== 'string' || id.length === 0) {
    errors.push('Manifest id must be a non-empty string.');
  }

  const version = manifest['version'];
  if (typeof version !== 'string' || parseSemVer(version) === null) {
    errors.push('Manifest version must be a valid SemVer string.');
  }

  const assets = manifest['assets'];
  if (!isRecord(assets)) {
    errors.push('Manifest assets must be an object.');
  }
}

function validateAndLoadDeclaredAssets({ repoRoot, packRoot, manifest, errors }) {
  const loadedAssets = {
    schemas: [],
    workflows: [],
    uiTemplates: [],
    mappings: [],
    testAssets: [],
    complianceProfiles: [],
  };

  const assetsRecord = isRecord(manifest['assets']) ? manifest['assets'] : {};
  for (const key of ASSET_KEYS) {
    const values = assetsRecord[key];
    if (values === undefined) continue;
    if (!Array.isArray(values)) {
      errors.push(`assets.${key} must be an array of relative file paths.`);
      continue;
    }

    values.forEach((assetPath, index) => {
      if (typeof assetPath !== 'string' || assetPath.trim().length === 0) {
        errors.push(`assets.${key}[${index}] must be a non-empty string.`);
        return;
      }
      const resolved = path.resolve(packRoot, assetPath);
      if (!resolved.startsWith(packRoot + path.sep) && resolved !== packRoot) {
        errors.push(`assets.${key}[${index}] escapes pack root: ${assetPath}`);
        return;
      }
      if (!existsSync(resolved)) {
        errors.push(`Missing declared asset: ${toRepoRel(repoRoot, resolved)}`);
        return;
      }
      const payload = readJsonFile(resolved, errors, toRepoRel(repoRoot, resolved));
      if (!isRecord(payload)) {
        errors.push(`Asset JSON must be an object: ${toRepoRel(repoRoot, resolved)}`);
        return;
      }
      loadedAssets[key].push({
        relPath: normalizePosixPath(assetPath),
        absPath: resolved,
        json: payload,
      });
    });
  }

  return loadedAssets;
}

function validatePackFixtures({ repoRoot, packRoot, loadedAssets, errors, warnings }) {
  let workflowSimulationFixtures = 0;
  let connectorContractFixtures = 0;
  let conformanceFixtures = 0;

  for (const asset of loadedAssets.testAssets) {
    const testAsset = asset.json;
    const assetId = readRequiredString(testAsset, 'assetId', errors, asset.relPath);
    const kind = readRequiredString(testAsset, 'kind', errors, asset.relPath);
    const dataPath = readRequiredString(testAsset, 'dataPath', errors, asset.relPath);
    if (!assetId || !kind || !dataPath) {
      continue;
    }

    const fixturePath = path.resolve(packRoot, dataPath);
    if (!fixturePath.startsWith(packRoot + path.sep) && fixturePath !== packRoot) {
      errors.push(`Test asset dataPath escapes pack root: ${asset.relPath} -> ${dataPath}`);
      continue;
    }
    if (!existsSync(fixturePath)) {
      errors.push(
        `Missing test fixture payload referenced by ${asset.relPath}: ${toRepoRel(repoRoot, fixturePath)}`,
      );
      continue;
    }

    const fixture = readJsonFile(fixturePath, errors, toRepoRel(repoRoot, fixturePath));
    if (!isRecord(fixture)) {
      errors.push(`Fixture JSON must be an object: ${toRepoRel(repoRoot, fixturePath)}`);
      continue;
    }

    if (kind.includes('workflow-simulation')) {
      workflowSimulationFixtures += 1;
      validateWorkflowSimulationFixture(fixture, dataPath, errors);
      continue;
    }

    if (kind.includes('connector-contract')) {
      connectorContractFixtures += 1;
      validateConnectorContractFixture(fixture, dataPath, errors);
      continue;
    }

    if (kind.includes('conformance')) {
      conformanceFixtures += 1;
      validateConformanceFixture(fixture, dataPath, errors);
      continue;
    }

    warnings.push(
      `Test asset kind "${kind}" has no dedicated gate checks (asset: ${asset.relPath}).`,
    );
  }

  if (workflowSimulationFixtures === 0) {
    errors.push('At least one workflow-simulation fixture is required for publish gating.');
  }
  if (connectorContractFixtures === 0) {
    errors.push('At least one connector-contract fixture is required for publish gating.');
  }
  if (conformanceFixtures === 0) {
    warnings.push(
      'No conformance fixture declared. This is acceptable for non-standardized packs, but standards-aligned packs should declare one.',
    );
  }

  return {
    testAssetsChecked: loadedAssets.testAssets.length,
    workflowSimulationFixtures,
    connectorContractFixtures,
    conformanceFixtures,
  };
}

function validateSchemaCompatibility({
  repoRoot,
  packRoot,
  baselineRef,
  loadedAssets,
  manifest,
  errors,
  warnings,
}) {
  const packRootRel = normalizePosixPath(path.relative(repoRoot, packRoot));
  const previousManifest = readJsonFromGit({
    cwd: repoRoot,
    gitRef: baselineRef,
    repoRelativePath: `${packRootRel}/pack.manifest.json`,
  });
  const previousVersion =
    isRecord(previousManifest) && typeof previousManifest['version'] === 'string'
      ? parseSemVer(previousManifest['version'])
      : null;
  const currentVersion =
    typeof manifest['version'] === 'string' ? parseSemVer(manifest['version']) : null;

  if (!previousManifest) {
    warnings.push(
      `Baseline manifest not found at ${baselineRef}:${packRootRel}/pack.manifest.json; schema diff check skipped.`,
    );
    return { schemasChecked: loadedAssets.schemas.length, breakChecks: 0 };
  }

  let breakChecks = 0;
  let breakingChanges = 0;
  for (const schemaAsset of loadedAssets.schemas) {
    const baselineSchema = readJsonFromGit({
      cwd: repoRoot,
      gitRef: baselineRef,
      repoRelativePath: `${packRootRel}/${schemaAsset.relPath}`,
    });
    if (!isRecord(baselineSchema)) {
      warnings.push(
        `No baseline schema found for ${schemaAsset.relPath} at ${baselineRef}; treated as additive schema.`,
      );
      continue;
    }

    breakChecks += 1;
    const breaks = computeSchemaBreakingChanges({
      currentSchema: schemaAsset.json,
      baselineSchema,
      schemaPath: schemaAsset.relPath,
    });
    breakingChanges += breaks.length;
    breaks.forEach((msg) => errors.push(msg));
  }

  if (breakingChanges > 0 && previousVersion && currentVersion) {
    if (currentVersion.major <= previousVersion.major) {
      errors.push(
        `Detected ${breakingChanges} schema compatibility break(s) but pack major version did not increase (${formatSemVer(previousVersion)} -> ${formatSemVer(currentVersion)}).`,
      );
    }
  }

  if (previousVersion && currentVersion && compareSemVer(currentVersion, previousVersion) <= 0) {
    errors.push(
      `Pack version must advance relative to baseline (${formatSemVer(previousVersion)} -> ${formatSemVer(currentVersion)}).`,
    );
  }

  return {
    schemasChecked: loadedAssets.schemas.length,
    breakChecks,
  };
}

function computeSchemaBreakingChanges({ currentSchema, baselineSchema, schemaPath }) {
  const out = [];

  const currentFields = toFieldMap(currentSchema);
  const baselineFields = toFieldMap(baselineSchema);

  if (!currentFields || !baselineFields) {
    out.push(
      `Schema compatibility comparison failed for ${schemaPath}: missing valid fields array.`,
    );
    return out;
  }

  if (baselineSchema['extendsCore'] !== currentSchema['extendsCore']) {
    out.push(
      `Schema ${schemaPath} changed extendsCore from "${String(baselineSchema['extendsCore'])}" to "${String(currentSchema['extendsCore'])}".`,
    );
  }

  for (const [fieldName, oldField] of baselineFields.entries()) {
    const nextField = currentFields.get(fieldName);
    if (!nextField) {
      out.push(`Schema ${schemaPath} removed field "${fieldName}" from previous version.`);
      continue;
    }
    if (oldField.fieldType !== nextField.fieldType) {
      out.push(
        `Schema ${schemaPath} changed field "${fieldName}" type from "${oldField.fieldType}" to "${nextField.fieldType}".`,
      );
    }
    if (oldField.required === false && nextField.required === true) {
      out.push(`Schema ${schemaPath} made field "${fieldName}" required.`);
    }
  }

  for (const [fieldName, nextField] of currentFields.entries()) {
    if (baselineFields.has(fieldName)) continue;
    if (nextField.required === true) {
      out.push(`Schema ${schemaPath} added new required field "${fieldName}".`);
    }
  }

  return out;
}

function toFieldMap(schemaJson) {
  if (!isRecord(schemaJson)) return null;
  if (!Array.isArray(schemaJson['fields'])) return null;
  const map = new Map();
  for (const field of schemaJson['fields']) {
    if (!isRecord(field)) continue;
    if (typeof field['fieldName'] !== 'string') continue;
    map.set(field['fieldName'], {
      fieldType: String(field['fieldType']),
      required: Boolean(field['required']),
    });
  }
  return map;
}

function validateWorkflowSimulationFixture(fixture, fixturePath, errors) {
  if (!nonEmptyString(fixture['scenarioId'])) {
    errors.push(`Workflow simulation fixture ${fixturePath} must include scenarioId.`);
  }
  if (!isRecord(fixture['triggerEvent'])) {
    errors.push(`Workflow simulation fixture ${fixturePath} must include triggerEvent object.`);
  }
  if (!Array.isArray(fixture['expectedTasks']) || fixture['expectedTasks'].length === 0) {
    errors.push(`Workflow simulation fixture ${fixturePath} must include expectedTasks array.`);
  }
  if (!Array.isArray(fixture['expectedEvidence']) || fixture['expectedEvidence'].length === 0) {
    errors.push(`Workflow simulation fixture ${fixturePath} must include expectedEvidence array.`);
  }
}

function validateConnectorContractFixture(fixture, fixturePath, errors) {
  if (!nonEmptyString(fixture['contractId'])) {
    errors.push(`Connector contract fixture ${fixturePath} must include contractId.`);
  }
  if (!nonEmptyString(fixture['provider'])) {
    errors.push(`Connector contract fixture ${fixturePath} must include provider.`);
  }
  if (!Array.isArray(fixture['operations']) || fixture['operations'].length === 0) {
    errors.push(`Connector contract fixture ${fixturePath} must include operations array.`);
    return;
  }

  fixture['operations'].forEach((entry, index) => {
    if (!isRecord(entry) || !nonEmptyString(entry['operation'])) {
      errors.push(`Connector contract fixture ${fixturePath} has invalid operations[${index}].`);
    }
    if (!isRecord(entry['expected'])) {
      errors.push(
        `Connector contract fixture ${fixturePath} operations[${index}] must include expected object.`,
      );
    }
  });
}

function validateConformanceFixture(fixture, fixturePath, errors) {
  if (!nonEmptyString(fixture['hookId'])) {
    errors.push(`Conformance fixture ${fixturePath} must include hookId.`);
  }
  if (!nonEmptyString(fixture['standard'])) {
    errors.push(`Conformance fixture ${fixturePath} must include standard.`);
  }

  const status = fixture['status'];
  if (status !== 'applicable' && status !== 'not_applicable') {
    errors.push(
      `Conformance fixture ${fixturePath} must include status of "applicable" or "not_applicable".`,
    );
    return;
  }

  if (status === 'applicable') {
    if (!Array.isArray(fixture['assertions']) || fixture['assertions'].length === 0) {
      errors.push(
        `Conformance fixture ${fixturePath} with status=applicable must include assertions.`,
      );
    }
    return;
  }

  if (!nonEmptyString(fixture['rationale'])) {
    errors.push(
      `Conformance fixture ${fixturePath} with status=not_applicable must include rationale.`,
    );
  }
}

function readJsonFromGit({ cwd, gitRef, repoRelativePath }) {
  try {
    const stdout = execFileSync('git', ['show', `${gitRef}:${repoRelativePath}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function readJsonFile(absPath, errors, label) {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (error) {
    errors.push(`Failed to parse JSON at ${label}: ${toErrorMessage(error)}`);
    return null;
  }
}

function readRequiredString(record, key, errors, label) {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must include non-empty string field "${key}".`);
    return null;
  }
  return value;
}

function resolveRepoRoot() {
  const current = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(current), '../..');
}

function toRepoRel(repoRoot, absPath) {
  return normalizePosixPath(path.relative(repoRoot, absPath));
}

function normalizePosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseSemVer(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemVer(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function formatSemVer(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function reportAndExit({ packRoot, errors, warnings, summary }) {
  const label = normalizePosixPath(packRoot);
  if (errors.length > 0) {
    console.error(`[pack-publish-gate] FAIL ${label}`);
    for (const message of errors) {
      console.error(`  - ${message}`);
    }
    for (const warning of warnings) {
      console.error(`  [warn] ${warning}`);
    }
    process.exit(1);
  }

  console.log(`[pack-publish-gate] PASS ${label}`);
  if (summary) {
    console.log(
      `[pack-publish-gate] Checked ${summary.schemasChecked} schema asset(s), ${summary.schemaBreakChecks} baseline diff(s), ${summary.testAssetsChecked} test asset(s).`,
    );
    console.log(
      `[pack-publish-gate] Fixtures: workflow-simulation=${summary.workflowSimulationFixtures}, connector-contract=${summary.connectorContractFixtures}, conformance=${summary.conformanceFixtures}.`,
    );
  }
  for (const warning of warnings) {
    console.log(`[pack-publish-gate][warn] ${warning}`);
  }
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function printHelp() {
  console.log(
    [
      'Vertical Pack Publish Gate',
      '',
      'Usage:',
      '  node scripts/ci/vertical-pack-publish-gate.mjs [--pack-root <path>] [--baseline-ref <git-ref>]',
      '',
      'Defaults:',
      `  --pack-root ${DEFAULT_PACK_ROOT}`,
      `  --baseline-ref ${DEFAULT_BASELINE_REF}`,
    ].join('\n'),
  );
}

function fail(message) {
  console.error(`[pack-publish-gate] ${message}`);
  process.exit(1);
}

main();

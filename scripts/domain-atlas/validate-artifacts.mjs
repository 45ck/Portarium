#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const atlasRoot = path.join(repoRoot, 'domain-atlas');
const schemaRoot = path.join(atlasRoot, 'schema');

const reportPath = path.join(repoRoot, 'reports', 'domain-atlas', 'validation-summary.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function listJsonFiles(rootDir, suffix = '.json') {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(suffix)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const sourceManifestSchema = readJson(path.join(schemaRoot, 'source-manifest.schema.json'));
const cifSchema = readJson(path.join(schemaRoot, 'cif.schema.json'));
const mappingSchema = readJson(path.join(schemaRoot, 'mapping.schema.json'));
const capabilitySchema = readJson(path.join(schemaRoot, 'capability-matrix.schema.json'));

const validateSourceManifest = ajv.compile(sourceManifestSchema);
const validateCif = ajv.compile(cifSchema);
const validateMapping = ajv.compile(mappingSchema);
const validateCapability = ajv.compile(capabilitySchema);

const errors = [];
const checks = [];

function recordValidation(filePath, ok, kind, issues = []) {
  checks.push({
    kind,
    file: rel(filePath),
    ok,
    issues,
  });
  if (!ok) {
    for (const issue of issues) {
      errors.push(`${rel(filePath)}: ${issue}`);
    }
  }
}

function formatAjvErrors(ajvErrors) {
  if (!Array.isArray(ajvErrors)) return [];
  return ajvErrors.map((e) => `${e.instancePath || '/'} ${e.message}`.trim());
}

const sourceFiles = listJsonFiles(path.join(atlasRoot, 'sources'));
const extractedFiles = listJsonFiles(path.join(atlasRoot, 'extracted'), '.json');
const mappingFiles = listJsonFiles(path.join(atlasRoot, 'mappings'));
const capabilityFiles = listJsonFiles(path.join(atlasRoot, 'capabilities'));

const sourceByProvider = new Map();
for (const file of sourceFiles) {
  if (!file.endsWith(`${path.sep}source.json`)) continue;
  const json = readJson(file);
  const ok = validateSourceManifest(json);
  recordValidation(
    file,
    Boolean(ok),
    'source-manifest',
    formatAjvErrors(validateSourceManifest.errors),
  );
  if (ok) {
    sourceByProvider.set(json.providerId, { file, json });
  }
}

for (const file of extractedFiles) {
  const json = readJson(file);
  const ok = validateCif(json);
  recordValidation(file, Boolean(ok), 'cif', formatAjvErrors(validateCif.errors));
  if (!ok) continue;

  const providerId = json?.source?.providerId;
  const source = sourceByProvider.get(providerId);
  if (!source) {
    errors.push(`${rel(file)}: source manifest not found for providerId "${providerId}".`);
    continue;
  }

  const manifestCommit = source.json?.upstream?.commit;
  const cifCommit = json?.source?.upstream?.commit;
  if (manifestCommit && cifCommit && manifestCommit !== cifCommit) {
    errors.push(
      `${rel(file)}: upstream commit mismatch; source manifest has ${manifestCommit}, CIF has ${cifCommit}.`,
    );
  }
}

for (const file of mappingFiles) {
  const json = readJson(file);
  const ok = validateMapping(json);
  recordValidation(file, Boolean(ok), 'mapping', formatAjvErrors(validateMapping.errors));
  if (!ok) continue;
  if (!sourceByProvider.has(json.providerId)) {
    errors.push(`${rel(file)}: source manifest not found for providerId "${json.providerId}".`);
  }
}

for (const file of capabilityFiles) {
  const json = readJson(file);
  const ok = validateCapability(json);
  recordValidation(
    file,
    Boolean(ok),
    'capability-matrix',
    formatAjvErrors(validateCapability.errors),
  );
  if (!ok) continue;
  if (!sourceByProvider.has(json.providerId)) {
    errors.push(`${rel(file)}: source manifest not found for providerId "${json.providerId}".`);
  }
}

for (const [providerId, { file, json }] of sourceByProvider.entries()) {
  if (json.status !== 'DONE') continue;
  const cifPath = path.join(atlasRoot, 'extracted', providerId, 'cif.json');
  if (!fs.existsSync(cifPath)) {
    errors.push(`${rel(file)}: status is DONE but missing extracted artifact ${rel(cifPath)}.`);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  counts: {
    sourceManifests: sourceFiles.filter((f) => f.endsWith(`${path.sep}source.json`)).length,
    extractedCif: extractedFiles.length,
    mappings: mappingFiles.length,
    capabilityMatrices: capabilityFiles.length,
  },
  errorCount: errors.length,
  errors,
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

if (errors.length > 0) {
  console.error('Domain Atlas artifact validation failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(`Validation report: ${rel(reportPath)}`);
  process.exit(1);
}

console.log('Domain Atlas artifact validation passed.');
console.log(`Validation report: ${rel(reportPath)}`);

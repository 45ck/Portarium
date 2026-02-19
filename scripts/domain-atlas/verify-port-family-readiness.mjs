#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const matrixPath = path.join(
  repoRoot,
  'domain-atlas',
  'decisions',
  'port-family-integration-candidate-matrix.json',
);
const sourcesRoot = path.join(repoRoot, 'domain-atlas', 'sources');
const mappingsRoot = path.join(repoRoot, 'domain-atlas', 'mappings');
const capabilitiesRoot = path.join(repoRoot, 'domain-atlas', 'capabilities');
const decisionsRoot = path.join(repoRoot, 'domain-atlas', 'decisions', 'providers');
const reportPath = path.join(repoRoot, 'reports', 'domain-atlas', 'port-family-readiness.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function loadSource(providerId) {
  const sourcePath = path.join(sourcesRoot, providerId, 'source.json');
  if (!fileExists(sourcePath)) return null;
  return readJson(sourcePath);
}

function loadMapping(providerId, family) {
  const mappingPath = path.join(mappingsRoot, providerId, `${family}.mapping.json`);
  if (!fileExists(mappingPath)) return null;
  return readJson(mappingPath);
}

function loadCapability(providerId, family) {
  const capabilityPath = path.join(capabilitiesRoot, providerId, `${family}.capability-matrix.json`);
  if (!fileExists(capabilityPath)) return null;
  return readJson(capabilityPath);
}

function hasEvidenceHints(providerId, family, mapping, capability) {
  const providerDecisionPath = path.join(decisionsRoot, `${providerId}.md`);
  const haystacks = [];

  if (fileExists(providerDecisionPath)) {
    haystacks.push(fs.readFileSync(providerDecisionPath, 'utf8'));
  }
  if (mapping) haystacks.push(JSON.stringify(mapping));
  if (capability) haystacks.push(JSON.stringify(capability));

  const fixturePaths = [
    path.join(repoRoot, 'test', 'fixtures', providerId),
    path.join(repoRoot, 'test', 'fixtures', `${providerId}.json`),
    path.join(repoRoot, 'test', 'fixtures', `${providerId}-${family}.json`),
  ];

  const fixtureFound = fixturePaths.some((p) => dirExists(p) || fileExists(p));
  const textEvidenceFound = haystacks.some((text) => /\bevidence\b/i.test(text));
  return fixtureFound || textEvidenceFound;
}

function verifyCandidate(providerId, family) {
  const issues = [];
  const source = loadSource(providerId);
  const mapping = loadMapping(providerId, family);
  const capability = loadCapability(providerId, family);

  const sourceIntent =
    source !== null &&
    Array.isArray(source.portFamilies) &&
    source.portFamilies.includes(family) &&
    Array.isArray(source.extraction?.modelSources) &&
    source.extraction.modelSources.length > 0;
  if (!sourceIntent) {
    issues.push('missing_source_intent');
  }

  const hasMappingRows = Array.isArray(mapping?.mappings) && mapping.mappings.length > 0;
  const hasCapabilityOps =
    Array.isArray(capability?.capabilities) &&
    capability.capabilities.some(
      (entry) => Array.isArray(entry?.operations) && entry.operations.length > 0,
    );
  const operationMapping = hasMappingRows && hasCapabilityOps;
  if (!operationMapping) {
    issues.push('missing_operation_mapping');
  }

  const evidenceChain = hasEvidenceHints(providerId, family, mapping, capability);
  if (!evidenceChain) {
    issues.push('missing_evidence_chain');
  }

  return {
    providerId,
    sourceIntent,
    operationMapping,
    evidenceChain,
    ready: sourceIntent && operationMapping && evidenceChain,
    issues,
  };
}

function main() {
  const matrix = readJson(matrixPath);
  const families = Array.isArray(matrix.families) ? matrix.families : [];
  const familyReadiness = [];

  for (const family of families) {
    const portFamily = family.portFamily;
    const owner = family.owner;
    const candidateProviders = Array.isArray(family.candidateProviders) ? family.candidateProviders : [];
    const baseBlockers = Array.isArray(family.blockers) ? family.blockers : [];

    const candidates = candidateProviders.map((providerId) => verifyCandidate(providerId, portFamily));
    const generatedBlockers = [];

    for (const candidate of candidates) {
      if (candidate.ready) continue;
      generatedBlockers.push(`${candidate.providerId}: ${candidate.issues.join(', ')}`);
    }

    if (candidates.length === 0) {
      generatedBlockers.push('no_candidates_defined');
    }

    familyReadiness.push({
      portFamily,
      owner,
      requiredArtifactDependencies: matrix.artifactDependencies ?? [],
      candidateCount: candidates.length,
      readyCandidateCount: candidates.filter((c) => c.ready).length,
      familyReady: candidates.length > 0 && candidates.every((c) => c.ready),
      blockers: [...baseBlockers, ...generatedBlockers],
      candidates,
    });
  }

  const summary = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceMatrix: path.relative(repoRoot, matrixPath).split(path.sep).join('/'),
    familyCount: familyReadiness.length,
    readyFamilies: familyReadiness.filter((f) => f.familyReady).length,
    familyReadiness,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`Port-family readiness report written: ${path.relative(repoRoot, reportPath)}`);
}

main();

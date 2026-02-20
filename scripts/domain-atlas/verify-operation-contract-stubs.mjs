#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const stubsRoot = path.join(repoRoot, 'domain-atlas', 'fixtures', 'operation-contract-stubs');
const candidateMatrixPath = path.join(
  repoRoot,
  'domain-atlas',
  'decisions',
  'port-family-integration-candidate-matrix.json',
);
const sourcesRoot = path.join(repoRoot, 'domain-atlas', 'sources');
const mappingsRoot = path.join(repoRoot, 'domain-atlas', 'mappings');
const catalogRoot = path.join(repoRoot, 'docs', 'integration-catalog');
const reportPath = path.join(
  repoRoot,
  'reports',
  'domain-atlas',
  'operation-contract-stub-verification.json',
);

const canonicalObjects = new Set([
  'Party',
  'Ticket',
  'Invoice',
  'Payment',
  'Task',
  'Campaign',
  'Asset',
  'Document',
  'Subscription',
  'Opportunity',
  'Product',
  'Order',
  'Account',
  'ExternalObjectRef',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function extractSourceRanks(markdown) {
  const rankRows = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const providerCell = cells[0]
      .replaceAll('**', '')
      .replace(/\(.*?\)/g, '')
      .trim();
    const sourceCell = cells[1];
    const match = sourceCell.match(/\bS([1-4])\b/i);
    if (!providerCell || !match) continue;
    rankRows.push({ provider: providerCell, rank: `S${match[1]}` });
  }
  return rankRows;
}

function sourceManifest(providerId) {
  const sourcePath = path.join(sourcesRoot, providerId, 'source.json');
  if (!fs.existsSync(sourcePath)) return null;
  return readJson(sourcePath);
}

function mappingFilesForFamily(providerId, family) {
  const mappingPath = path.join(mappingsRoot, providerId, `${family}.mapping.json`);
  if (!fs.existsSync(mappingPath)) return [];
  return [readJson(mappingPath)];
}

function verifyFamily(familyDef) {
  const family = familyDef.portFamily;
  const issues = [];

  const stubPath = path.join(stubsRoot, `${family}.operations.stub.json`);
  const hasStub = fs.existsSync(stubPath);
  let operations = [];
  if (!hasStub) {
    issues.push('missing_operation_stub');
  } else {
    const stub = readJson(stubPath);
    operations = Array.isArray(stub.operations) ? stub.operations : [];
    if (operations.length === 0) issues.push('empty_operation_stub');
    const badRows = operations.filter(
      (op) =>
        typeof op.operation !== 'string' ||
        op.operation.length === 0 ||
        typeof op.description !== 'string' ||
        op.description.length === 0 ||
        typeof op.idempotent !== 'boolean',
    );
    if (badRows.length > 0) issues.push('invalid_operation_rows');
  }

  const providers = Array.isArray(familyDef.candidateProviders) ? familyDef.candidateProviders : [];
  const mappings = [];
  for (const providerId of providers) {
    mappings.push(...mappingFilesForFamily(providerId, family));
  }

  const mappedCanonicalObjects = new Set();
  for (const mapping of mappings) {
    for (const row of Array.isArray(mapping.mappings) ? mapping.mappings : []) {
      if (typeof row?.canonicalObject === 'string') {
        mappedCanonicalObjects.add(row.canonicalObject);
      }
    }
  }

  if (mappedCanonicalObjects.size === 0) {
    issues.push('missing_canonical_mappings_for_candidates');
  } else {
    const invalidCanonical = Array.from(mappedCanonicalObjects).filter(
      (canonical) => !canonicalObjects.has(canonical),
    );
    if (invalidCanonical.length > 0) {
      issues.push(`invalid_canonical_objects:${invalidCanonical.join(',')}`);
    }
  }

  const catalogFilenames = {
    FinanceAccounting: 'finance-accounting.md',
    PaymentsBilling: 'payments-billing.md',
    ProcurementSpend: 'procurement-spend.md',
    HrisHcm: 'hris-hcm.md',
    Payroll: 'payroll.md',
    CrmSales: 'crm-sales.md',
    CustomerSupport: 'customer-support.md',
    ItsmItOps: 'itsm-it-ops.md',
    IamDirectory: 'iam-directory.md',
    SecretsVaulting: 'secrets-vaulting.md',
    MarketingAutomation: 'marketing-automation.md',
    AdsPlatforms: 'ads-platforms.md',
    CommsCollaboration: 'comms-collaboration.md',
    ProjectsWorkMgmt: 'projects-work-mgmt.md',
    DocumentsEsign: 'documents-esign.md',
    AnalyticsBi: 'analytics-bi.md',
    MonitoringIncident: 'monitoring-incident.md',
    ComplianceGrc: 'compliance-grc.md',
  };

  const catalogPath = path.join(catalogRoot, catalogFilenames[family] ?? '');
  let rankAssumptionSatisfied = false;
  let matchedRanks = [];

  if (!fs.existsSync(catalogPath)) {
    issues.push('missing_catalog_file');
  } else {
    const rankRows = extractSourceRanks(fs.readFileSync(catalogPath, 'utf8'));
    const providerNames = providers.map((providerId) => {
      const source = sourceManifest(providerId);
      return source?.providerName || providerId;
    });

    matchedRanks = rankRows
      .filter((row) =>
        providerNames.some((name) => {
          const left = normalizeName(name);
          const right = normalizeName(row.provider);
          return left.includes(right) || right.includes(left);
        }),
      )
      .map((row) => row.rank);

    rankAssumptionSatisfied = matchedRanks.some((rank) => rank === 'S1' || rank === 'S2');
    if (!rankAssumptionSatisfied) {
      issues.push('no_s1_s2_candidate_match_in_catalog');
    }
  }

  const completenessPassed =
    hasStub &&
    operations.length > 0 &&
    operations.every(
      (op) =>
        typeof op.operation === 'string' &&
        op.operation.length > 0 &&
        typeof op.description === 'string' &&
        op.description.length > 0 &&
        typeof op.idempotent === 'boolean',
    );
  const canonicalMappingPassed =
    mappedCanonicalObjects.size > 0 &&
    Array.from(mappedCanonicalObjects).every((canonical) => canonicalObjects.has(canonical));

  return {
    portFamily: family,
    completenessPassed,
    canonicalMappingPassed,
    sourceRankingAssumptionPassed: rankAssumptionSatisfied,
    matchedSourceRanks: matchedRanks,
    issues,
  };
}

function main() {
  const matrix = readJson(candidateMatrixPath);
  const families = Array.isArray(matrix.families) ? matrix.families : [];
  const results = families.map((familyDef) => verifyFamily(familyDef));

  const report = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    verification: {
      totalFamilies: results.length,
      fullyPassingFamilies: results.filter(
        (family) =>
          family.completenessPassed &&
          family.canonicalMappingPassed &&
          family.sourceRankingAssumptionPassed,
      ).length,
    },
    families: results,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `Operation contract stub verification report written: ${path.relative(repoRoot, reportPath)}`,
  );
}

main();

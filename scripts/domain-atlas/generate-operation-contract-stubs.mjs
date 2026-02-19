#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const catalogRoot = path.join(repoRoot, 'docs', 'integration-catalog');
const outputRoot = path.join(repoRoot, 'domain-atlas', 'fixtures', 'operation-contract-stubs');

const familyCatalogFiles = [
  ['FinanceAccounting', 'finance-accounting.md'],
  ['PaymentsBilling', 'payments-billing.md'],
  ['ProcurementSpend', 'procurement-spend.md'],
  ['HrisHcm', 'hris-hcm.md'],
  ['Payroll', 'payroll.md'],
  ['CrmSales', 'crm-sales.md'],
  ['CustomerSupport', 'customer-support.md'],
  ['ItsmItOps', 'itsm-it-ops.md'],
  ['IamDirectory', 'iam-directory.md'],
  ['SecretsVaulting', 'secrets-vaulting.md'],
  ['MarketingAutomation', 'marketing-automation.md'],
  ['AdsPlatforms', 'ads-platforms.md'],
  ['CommsCollaboration', 'comms-collaboration.md'],
  ['ProjectsWorkMgmt', 'projects-work-mgmt.md'],
  ['DocumentsEsign', 'documents-esign.md'],
  ['AnalyticsBi', 'analytics-bi.md'],
  ['MonitoringIncident', 'monitoring-incident.md'],
  ['ComplianceGrc', 'compliance-grc.md'],
];

function parseOperationsTable(markdown) {
  const marker = '## Port Operations';
  const start = markdown.indexOf(marker);
  if (start < 0) {
    throw new Error('missing section "## Port Operations"');
  }

  const afterMarker = markdown.slice(start + marker.length);
  const tableStart = afterMarker.indexOf('|');
  if (tableStart < 0) {
    throw new Error('missing operations table');
  }

  const lines = afterMarker
    .slice(tableStart)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tableLines = [];
  for (const line of lines) {
    if (!line.startsWith('|')) break;
    tableLines.push(line);
  }

  if (tableLines.length < 3) {
    throw new Error('operations table has no rows');
  }

  const rows = tableLines.slice(2);
  const operations = [];

  for (const row of rows) {
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 3) continue;
    const operation = cells[0].replaceAll('`', '').trim();
    const description = cells[1];
    const idempotent = /^yes$/i.test(cells[2]);

    if (operation.length === 0) continue;
    operations.push({ operation, description, idempotent });
  }

  return operations;
}

function main() {
  fs.mkdirSync(outputRoot, { recursive: true });

  const index = {
    schemaVersion: '1.0.0',
    source: 'docs/integration-catalog/*.md#Port Operations',
    families: [],
  };

  for (const [portFamily, filename] of familyCatalogFiles) {
    const catalogPath = path.join(catalogRoot, filename);
    if (!fs.existsSync(catalogPath)) {
      throw new Error(`missing catalog file: ${path.relative(repoRoot, catalogPath)}`);
    }

    const markdown = fs.readFileSync(catalogPath, 'utf8');
    const operations = parseOperationsTable(markdown);

    const stub = {
      schemaVersion: '1.0.0',
      portFamily,
      sourceCatalog: path.relative(repoRoot, catalogPath).split(path.sep).join('/'),
      operations,
    };

    const outPath = path.join(outputRoot, `${portFamily}.operations.stub.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(stub, null, 2)}\n`, 'utf8');

    index.families.push({
      portFamily,
      file: path.relative(repoRoot, outPath).split(path.sep).join('/'),
      operationCount: operations.length,
    });
  }

  const indexPath = path.join(outputRoot, 'index.json');
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(
    `Operation contract stubs written: ${path.relative(repoRoot, outputRoot).split(path.sep).join('/')}`,
  );
}

main();

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'docs', 'governance', 'bead-metadata-audit.md');

function parseArgs(argv) {
  return new Set(argv.slice(2));
}

function toNumber(id) {
  const value = Number.parseInt(String(id).replace(/^bead-/, ''), 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function latestIssueTimestamp(issues) {
  let latest = 0;
  for (const issue of issues) {
    if (typeof issue.updatedAt !== 'string') continue;
    const parsed = Date.parse(issue.updatedAt);
    if (Number.isFinite(parsed) && parsed > latest) latest = parsed;
  }
  return latest > 0 ? new Date(latest).toISOString() : 'n/a';
}

function readString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function ownerOf(issue) {
  return readString(issue.owner) ?? readString(issue.claimedBy);
}

function hasCloseCriteria(issue) {
  if (readString(issue.closeCriteria)) return true;
  const body = readString(issue.body);
  if (!body) return false;
  return /(?:^|\s)AC:/i.test(body) || /acceptance criteria/i.test(body);
}

function hasRollbackTrigger(issue) {
  if (readString(issue.rollbackTrigger)) return true;
  const body = readString(issue.body);
  if (!body) return false;
  return /\brollback\b/i.test(body);
}

async function loadIssues() {
  const raw = await fs.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function evaluateIssue(issue) {
  const owner = ownerOf(issue);
  const hasCriteria = hasCloseCriteria(issue);
  const hasRollback = hasRollbackTrigger(issue);
  const missing = [];

  if (!owner) missing.push('owner');
  if (!hasCriteria) missing.push('closeCriteria');
  if (!hasRollback) missing.push('rollbackTrigger');

  return {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    owner,
    hasCloseCriteria: hasCriteria,
    hasRollbackTrigger: hasRollback,
    missing,
    compliant: missing.length === 0,
  };
}

function buildAuditData(issues) {
  const evaluations = issues.map((issue) => evaluateIssue(issue)).sort((a, b) => toNumber(a.id) - toNumber(b.id));
  const nonCompliant = evaluations.filter((entry) => !entry.compliant);
  const missingOwner = evaluations.filter((entry) => entry.owner === null).length;
  const missingCloseCriteria = evaluations.filter((entry) => !entry.hasCloseCriteria).length;
  const missingRollbackTrigger = evaluations.filter((entry) => !entry.hasRollbackTrigger).length;

  return {
    generatedAtIso: latestIssueTimestamp(issues),
    summary: {
      totalBeads: evaluations.length,
      compliantBeads: evaluations.length - nonCompliant.length,
      nonCompliantBeads: nonCompliant.length,
      missingOwner,
      missingCloseCriteria,
      missingRollbackTrigger,
    },
    nonCompliant,
  };
}

function buildMarkdown(report) {
  const lines = [
    '# Bead Metadata Audit: Owner, Close Criteria, Rollback Trigger',
    '',
    `Generated: ${report.generatedAtIso}`,
    'Source: `.beads/issues.jsonl`',
    '',
    '## Snapshot',
    '',
    `- Total beads: ${report.summary.totalBeads}`,
    `- Fully compliant beads: ${report.summary.compliantBeads}`,
    `- Non-compliant beads: ${report.summary.nonCompliantBeads}`,
    `- Missing owner: ${report.summary.missingOwner}`,
    `- Missing close criteria: ${report.summary.missingCloseCriteria}`,
    `- Missing rollback trigger: ${report.summary.missingRollbackTrigger}`,
    '',
    '## Non-Compliant Beads',
    '',
  ];

  if (report.nonCompliant.length === 0) {
    lines.push('All beads satisfy owner, close criteria, and rollback trigger requirements.');
    lines.push('');
  } else {
    lines.push('| Bead | Status | Owner | Missing Fields | Title |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const entry of report.nonCompliant) {
      lines.push(
        `| ${entry.id} | ${entry.status ?? 'unknown'} | ${entry.owner ?? '(none)'} | ${entry.missing.join(
          ', ',
        )} | ${entry.title ?? '(untitled)'} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Rules');
  lines.push('');
  lines.push('- Owner: `owner` field, falling back to active `claimedBy`.');
  lines.push('- Close criteria: `closeCriteria` field or explicit `AC:` / acceptance criteria text in `body`.');
  lines.push('- Rollback trigger: `rollbackTrigger` field or explicit rollback text in `body`.');
  lines.push('');
  return lines.join('\n');
}

function enforceOrExit(report) {
  if (report.summary.nonCompliantBeads === 0) return;
  process.stderr.write(
    `Metadata audit failed: ${report.summary.nonCompliantBeads} bead(s) missing required metadata.\n`,
  );
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv);
  const checkMode = args.has('--check');
  const stdoutMode = args.has('--stdout');
  const jsonMode = args.has('--json');
  const enforceMode = args.has('--enforce');

  const issues = await loadIssues();
  const report = buildAuditData(issues);
  const markdown = buildMarkdown(report);

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (enforceMode) enforceOrExit(report);
    return;
  }

  if (stdoutMode) {
    process.stdout.write(markdown);
    if (enforceMode) enforceOrExit(report);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  if (checkMode) {
    try {
      const existing = await fs.readFile(OUTPUT_PATH, 'utf8');
      if (existing !== markdown) {
        process.stderr.write(
          `Bead metadata audit is stale. Regenerate with:\nnode scripts/beads/generate-bead-metadata-audit.mjs\n`,
        );
        process.exit(1);
      }
    } catch {
      process.stderr.write(
        `Bead metadata audit file is missing. Generate with:\nnode scripts/beads/generate-bead-metadata-audit.mjs\n`,
      );
      process.exit(1);
    }
    if (enforceMode) enforceOrExit(report);
    return;
  }

  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
  process.stdout.write(`Wrote ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}\n`);
  if (enforceMode) enforceOrExit(report);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

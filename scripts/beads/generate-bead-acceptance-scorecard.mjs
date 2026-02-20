#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const LINKAGE_PATH = path.join(WORKSPACE_ROOT, '.beads', 'bead-linkage-map.json');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'docs', 'governance', 'bead-acceptance-scorecard.md');

const SPEC_PATTERN = /\bspec\b|\badr\b/i;
const TEST_PATTERN = /\btest(?:ing)?\b|\bcoverage\b|\bmutation\b|\bfault(?:-| )?injection\b|\bsmoke\b/i;
const REVIEW_PATTERN = /\breview\b/i;
const DOC_PATTERN = /\bdocs?\b|\brunbook\b|\bonboarding\b|\bguide\b/i;
const SECURITY_PATTERN = /\bsecurity\b|\btenant\b|\brbac\b|\bsod\b|\bprivacy\b|\bsafety\b|\bauth(?:n|z)?\b/i;
const PERFORMANCE_PATTERN = /\bperformance\b|\blatency\b|\bthroughput\b|\bload\b|\bstress\b|\bslo\b/i;

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

function issueText(issue) {
  const title = typeof issue.title === 'string' ? issue.title : '';
  const body = typeof issue.body === 'string' ? issue.body : '';
  return `${title}\n${body}`;
}

function hasList(entry, field) {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry[field];
  return Array.isArray(value) && value.length > 0;
}

function criterion(required, pass) {
  return {
    required,
    pass: required ? pass : null,
  };
}

function statusLabel(value) {
  if (value.pass === null) return 'n/a';
  return value.pass ? 'pass' : 'fail';
}

async function loadIssues() {
  const raw = await fs.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

async function loadLinkageMap() {
  try {
    const raw = await fs.readFile(LINKAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function evaluateIssue(issue, linkageEntry) {
  const text = issueText(issue);
  const specPass = hasList(linkageEntry, 'specPaths') || hasList(linkageEntry, 'specBeads') || SPEC_PATTERN.test(text);
  const testPass = TEST_PATTERN.test(text);
  const reviewPass = hasList(linkageEntry, 'reviewBeads') || REVIEW_PATTERN.test(text);
  const docsPass = DOC_PATTERN.test(text) || SPEC_PATTERN.test(text);

  const securityRequired =
    issue.phase === 'security' || issue.phase === 'governance' || SECURITY_PATTERN.test(text);
  const securityPass = SECURITY_PATTERN.test(text);

  const performanceRequired = PERFORMANCE_PATTERN.test(text);
  const performancePass = PERFORMANCE_PATTERN.test(text);

  const criteria = {
    specAlignment: criterion(true, specPass),
    tests: criterion(true, testPass),
    review: criterion(true, reviewPass),
    docs: criterion(true, docsPass),
    security: criterion(securityRequired, securityPass),
    performance: criterion(performanceRequired, performancePass),
  };

  let achievedPoints = 0;
  let possiblePoints = 0;
  for (const value of Object.values(criteria)) {
    if (!value.required) continue;
    possiblePoints += 1;
    if (value.pass) achievedPoints += 1;
  }

  const scorePercent = possiblePoints === 0 ? 1 : achievedPoints / possiblePoints;
  const allMandatoryPass =
    criteria.specAlignment.pass === true &&
    criteria.tests.pass === true &&
    criteria.review.pass === true &&
    criteria.docs.pass === true;

  let band = 'red';
  if (allMandatoryPass && scorePercent >= 0.8) {
    band = 'green';
  } else if (scorePercent >= 0.6) {
    band = 'amber';
  }

  return {
    id: issue.id,
    title: issue.title,
    score: {
      achievedPoints,
      possiblePoints,
      percent: Number((scorePercent * 100).toFixed(1)),
    },
    band,
    criteria,
  };
}

function buildReport(issues, linkageMap) {
  const openIssues = issues.filter((issue) => issue.status === 'open').sort((a, b) => toNumber(a.id) - toNumber(b.id));
  const entries = openIssues.map((issue) => evaluateIssue(issue, linkageMap[issue.id]));
  const summary = {
    openBeads: entries.length,
    green: entries.filter((entry) => entry.band === 'green').length,
    amber: entries.filter((entry) => entry.band === 'amber').length,
    red: entries.filter((entry) => entry.band === 'red').length,
    missingSpecAlignment: entries.filter((entry) => entry.criteria.specAlignment.pass === false).length,
    missingTests: entries.filter((entry) => entry.criteria.tests.pass === false).length,
    missingReview: entries.filter((entry) => entry.criteria.review.pass === false).length,
    missingDocs: entries.filter((entry) => entry.criteria.docs.pass === false).length,
    missingRequiredSecurity: entries.filter((entry) => entry.criteria.security.pass === false).length,
    missingRequiredPerformance: entries.filter((entry) => entry.criteria.performance.pass === false).length,
  };

  return {
    generatedAtIso: latestIssueTimestamp(issues),
    summary,
    entries,
  };
}

function buildMarkdown(report) {
  const lines = [
    '# Bead Acceptance Scorecard',
    '',
    `Generated: ${report.generatedAtIso}`,
    'Source: `.beads/issues.jsonl` + optional `.beads/bead-linkage-map.json`',
    '',
    'This scorecard applies the same acceptance rubric to every open bead so owners can close gaps before closure attempts.',
    '',
    '## Snapshot',
    '',
    `- Open beads scored: ${report.summary.openBeads}`,
    `- Green: ${report.summary.green}`,
    `- Amber: ${report.summary.amber}`,
    `- Red: ${report.summary.red}`,
    `- Missing spec alignment: ${report.summary.missingSpecAlignment}`,
    `- Missing tests signal: ${report.summary.missingTests}`,
    `- Missing review signal: ${report.summary.missingReview}`,
    `- Missing docs signal: ${report.summary.missingDocs}`,
    `- Missing required security signal: ${report.summary.missingRequiredSecurity}`,
    `- Missing required performance signal: ${report.summary.missingRequiredPerformance}`,
    '',
    '## Open Bead Scorecard',
    '',
    '| Bead | Score | Band | Spec | Tests | Review | Docs | Security | Performance | Title |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of report.entries) {
    lines.push(
      `| ${entry.id} | ${entry.score.achievedPoints}/${entry.score.possiblePoints} (${entry.score.percent}%) | ${entry.band} | ${statusLabel(
        entry.criteria.specAlignment,
      )} | ${statusLabel(entry.criteria.tests)} | ${statusLabel(entry.criteria.review)} | ${statusLabel(
        entry.criteria.docs,
      )} | ${statusLabel(entry.criteria.security)} | ${statusLabel(entry.criteria.performance)} | ${
        entry.title ?? '(untitled)'
      } |`,
    );
  }

  lines.push('');
  lines.push('## Rules');
  lines.push('');
  lines.push('- Required for all beads: `specAlignment`, `tests`, `review`, `docs`.');
  lines.push('- `security` is required for security/governance beads or beads with security keywords.');
  lines.push('- `performance` is required for beads with explicit performance/load/SLO keywords.');
  lines.push('- Banding:');
  lines.push('  - `green`: all always-required criteria pass and score >= 80%.');
  lines.push('  - `amber`: score >= 60% but not green.');
  lines.push('  - `red`: score < 60%.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const checkMode = args.has('--check');
  const stdoutMode = args.has('--stdout');
  const jsonMode = args.has('--json');

  const issues = await loadIssues();
  const linkageMap = await loadLinkageMap();
  const report = buildReport(issues, linkageMap);
  const markdown = buildMarkdown(report);

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  if (stdoutMode) {
    process.stdout.write(markdown);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  if (checkMode) {
    try {
      const existing = await fs.readFile(OUTPUT_PATH, 'utf8');
      if (existing !== markdown) {
        process.stderr.write(
          `Bead acceptance scorecard is stale. Regenerate with:\nnode scripts/beads/generate-bead-acceptance-scorecard.mjs\n`,
        );
        process.exit(1);
      }
    } catch {
      process.stderr.write(
        `Bead acceptance scorecard is missing. Generate with:\nnode scripts/beads/generate-bead-acceptance-scorecard.mjs\n`,
      );
      process.exit(1);
    }
    return;
  }

  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
  process.stdout.write(`Wrote ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

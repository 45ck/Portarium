#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ISSUES_PATH = path.join(process.cwd(), '.beads', 'issues.jsonl');

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    json: false,
    next: false,
    beadId: null,
  };

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--next') {
      options.next = true;
      continue;
    }
    if (options.beadId === null) {
      options.beadId = arg;
      continue;
    }
  }

  return options;
}

function parsePriority(priority) {
  switch (priority) {
    case 'P0':
      return 0;
    case 'P1':
      return 1;
    case 'P2':
      return 2;
    case 'P3':
      return 3;
    default:
      return 4;
  }
}

function beadNumber(beadId) {
  const parsed = Number.parseInt(String(beadId).replace(/^bead-/, ''), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

async function loadIssues() {
  const raw = await fs.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function evaluateIssue(issue, byId) {
  const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
  const missing = [];

  for (const blockerId of blockers) {
    const blocker = byId.get(blockerId);
    if (!blocker) {
      missing.push({
        type: 'missing_bead',
        beadId: blockerId,
      });
      continue;
    }
    if (blocker.status !== 'closed') {
      missing.push({
        type: 'blocked_by_open',
        beadId: blocker.id,
        title: blocker.title,
        status: blocker.status,
      });
    }
  }

  return {
    beadId: issue.id,
    title: issue.title,
    status: issue.status,
    blockedBy: blockers,
    missingPrerequisites: missing,
    readyToStart: issue.status === 'open' && missing.length === 0,
  };
}

function formatHumanReport(report) {
  const lines = [];
  lines.push(`Bead: ${report.beadId}`);
  lines.push(`Title: ${report.title}`);
  lines.push(`Status: ${report.status}`);
  lines.push(`Ready to start: ${report.readyToStart ? 'yes' : 'no'}`);
  if (report.blockedBy.length === 0) {
    lines.push('BlockedBy: (none)');
  } else {
    lines.push(`BlockedBy: ${report.blockedBy.join(', ')}`);
  }

  if (report.missingPrerequisites.length > 0) {
    lines.push('Missing prerequisites:');
    for (const missing of report.missingPrerequisites) {
      if (missing.type === 'missing_bead') {
        lines.push(`- missing bead reference: ${missing.beadId}`);
      } else if (missing.type === 'blocked_by_open') {
        lines.push(`- ${missing.beadId} is still ${missing.status}: ${missing.title}`);
      }
    }
  }
  return lines.join('\n');
}

function sortIssuesForStart(issues) {
  return [...issues].sort((a, b) => {
    const priorityDelta = parsePriority(a.priority) - parsePriority(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    const beadDelta = beadNumber(a.id) - beadNumber(b.id);
    if (beadDelta !== 0) return beadDelta;
    return String(a.id).localeCompare(String(b.id));
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const issues = await loadIssues();
  const byId = new Map(issues.map((issue) => [issue.id, issue]));

  if (options.next) {
    const openIssues = issues.filter((issue) => issue.status === 'open');
    const reports = sortIssuesForStart(openIssues)
      .map((issue) => evaluateIssue(issue, byId))
      .filter((report) => report.readyToStart);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    } else if (reports.length === 0) {
      process.stdout.write('No open beads are ready to start.\n');
    } else {
      process.stdout.write('Ready beads:\n');
      for (const report of reports) {
        process.stdout.write(`- ${report.beadId}: ${report.title}\n`);
      }
    }
    return;
  }

  if (options.beadId === null) {
    process.stderr.write(
      'Usage:\n' +
        '  node scripts/beads/check-bead-prerequisites.mjs <bead-id> [--json]\n' +
        '  node scripts/beads/check-bead-prerequisites.mjs --next [--json]\n',
    );
    process.exit(2);
  }

  const issue = byId.get(options.beadId);
  if (!issue) {
    process.stderr.write(`Bead not found: ${options.beadId}\n`);
    process.exit(2);
  }

  const report = evaluateIssue(issue, byId);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatHumanReport(report)}\n`);
  }

  if (!report.readyToStart) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

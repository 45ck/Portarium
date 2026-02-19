#!/usr/bin/env node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const LINKAGE_MAP_PATH = path.join(WORKSPACE_ROOT, '.beads', 'bead-linkage-map.json');
const PHASE_GATE_MAP_PATH = path.join(WORKSPACE_ROOT, '.beads', 'phase-gate-map.json');

const SPEC_TITLE_PATTERNS = [/^spec:/i, /^adr:/i];
const REVIEW_TITLE_PATTERNS = [/^review:/i, /^code review:/i, /^closeout review:/i, /^doc review:/i];
const IMPLEMENTATION_TITLE_PATTERNS = [
  /^app:/i,
  /^infra:/i,
  /^domain:/i,
  /^cockpit:/i,
  /^prototype:/i,
  /^presentation\/api:/i,
  /^integration v\d+:/i,
  /^testing:/i,
  /^implement\b/i,
  /^build\b/i,
  /^wire\b/i,
  /^add\b/i,
  /^authz:/i,
  /^repository-level/i,
  /^hardening pass:/i,
  /^provision\b/i,
  /^draft\b/i,
  /^generate\b/i,
];

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    json: false,
    next: false,
    cycleGate: false,
    phaseGate: false,
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
    if (arg === '--cycle-gate') {
      options.cycleGate = true;
      continue;
    }
    if (arg === '--phase-gate') {
      options.phaseGate = true;
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

function titleMatches(title, patterns) {
  return patterns.some((pattern) => pattern.test(title));
}

function isImplementationIssue(issue) {
  const title = String(issue.title ?? '');
  return titleMatches(title, IMPLEMENTATION_TITLE_PATTERNS);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function parseSpecPathsFromBody(body) {
  if (typeof body !== 'string' || body.length === 0) return [];
  const matches = body.match(/\.specify\/specs\/[A-Za-z0-9._/-]+/g);
  return matches ? uniqueSorted(matches) : [];
}

function normalizeLinkageEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      specBeads: [],
      specPaths: [],
      reviewBeads: [],
    };
  }

  const specBeads = Array.isArray(raw.specBeads) ? raw.specBeads.filter((value) => typeof value === 'string') : [];
  const specPaths = Array.isArray(raw.specPaths) ? raw.specPaths.filter((value) => typeof value === 'string') : [];
  const reviewBeads = Array.isArray(raw.reviewBeads)
    ? raw.reviewBeads.filter((value) => typeof value === 'string')
    : [];

  return {
    specBeads: uniqueSorted(specBeads),
    specPaths: uniqueSorted(specPaths),
    reviewBeads: uniqueSorted(reviewBeads),
  };
}

async function loadIssues() {
  const raw = await fsPromises.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

async function loadLinkageMap() {
  try {
    const raw = await fsPromises.readFile(LINKAGE_MAP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function loadPhaseGateMap() {
  try {
    const raw = await fsPromises.readFile(PHASE_GATE_MAP_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePhaseGateRequirement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const beads = Array.isArray(raw.beads) ? raw.beads.filter((value) => typeof value === 'string') : [];
  if (label.length === 0 || beads.length === 0) return null;

  return {
    label,
    beads: uniqueSorted(beads),
  };
}

function normalizePhaseGateDefinition(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      name: null,
      requirements: [],
    };
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const requirements = Array.isArray(raw.requirements)
    ? raw.requirements.map((entry) => normalizePhaseGateRequirement(entry)).filter((entry) => entry !== null)
    : [];

  return {
    name: name.length > 0 ? name : null,
    requirements,
  };
}

function resolvePhaseGate(issue, context) {
  const { byId, phaseGateMap } = context;
  const rawDefinition = phaseGateMap[issue.id];
  if (!rawDefinition || typeof rawDefinition !== 'object') {
    return {
      defined: false,
      name: null,
      requirements: [],
      errors: [],
    };
  }

  const definition = normalizePhaseGateDefinition(rawDefinition);
  const requirements = [];
  const errors = [];

  if (definition.requirements.length === 0) {
    errors.push({
      type: 'invalid_phase_gate_definition',
      message: `phase gate definition has no requirements: ${issue.id}`,
    });
  }

  for (const requirement of definition.requirements) {
    const beads = [];

    for (const beadId of requirement.beads) {
      const requiredIssue = byId.get(beadId);
      if (!requiredIssue) {
        beads.push({
          beadId,
          title: null,
          status: 'missing',
          closed: false,
        });
        errors.push({
          type: 'invalid_phase_gate_reference',
          message: `phase gate reference does not exist: ${beadId}`,
        });
        continue;
      }

      beads.push({
        beadId,
        title: requiredIssue.title,
        status: requiredIssue.status,
        closed: requiredIssue.status === 'closed',
      });
    }

    requirements.push({
      label: requirement.label,
      beads,
      satisfied: beads.length > 0 && beads.every((entry) => entry.closed),
    });
  }

  return {
    defined: true,
    name: definition.name,
    requirements,
    errors,
  };
}

function resolveLinkage(issue, context) {
  const { byId, issues, linkageMap } = context;
  const entry = normalizeLinkageEntry(linkageMap[issue.id]);
  const specLinks = [];
  const reviewLinks = [];
  const linkageErrors = [];

  for (const specPath of parseSpecPathsFromBody(issue.body)) {
    specLinks.push(`body:${specPath}`);
  }

  const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
  for (const blockerId of blockers) {
    const blocker = byId.get(blockerId);
    if (blocker && titleMatches(String(blocker.title ?? ''), SPEC_TITLE_PATTERNS)) {
      specLinks.push(`bead:${blocker.id}`);
    }
  }

  for (const specBeadId of entry.specBeads) {
    if (byId.has(specBeadId)) {
      specLinks.push(`bead:${specBeadId}`);
    } else {
      linkageErrors.push({
        type: 'invalid_linkage_reference',
        message: `spec bead reference does not exist: ${specBeadId}`,
      });
    }
  }

  for (const reviewBeadId of entry.reviewBeads) {
    const reviewIssue = byId.get(reviewBeadId);
    if (!reviewIssue) {
      linkageErrors.push({
        type: 'invalid_linkage_reference',
        message: `review bead reference does not exist: ${reviewBeadId}`,
      });
      continue;
    }
    reviewLinks.push(`bead:${reviewBeadId}`);
  }

  for (const specPath of entry.specPaths) {
    const absolute = path.join(WORKSPACE_ROOT, specPath);
    if (fs.existsSync(absolute)) {
      specLinks.push(`path:${specPath}`);
    } else {
      linkageErrors.push({
        type: 'invalid_linkage_reference',
        message: `spec path does not exist: ${specPath}`,
      });
    }
  }

  const inferredReviews = issues.filter(
    (candidate) =>
      candidate.id !== issue.id &&
      typeof candidate.title === 'string' &&
      titleMatches(candidate.title, REVIEW_TITLE_PATTERNS) &&
      candidate.title.includes(issue.id),
  );
  for (const inferred of inferredReviews) {
    reviewLinks.push(`bead:${inferred.id}`);
  }

  return {
    specLinks: uniqueSorted(specLinks),
    reviewLinks: uniqueSorted(reviewLinks),
    linkageErrors,
  };
}

function evaluateIssue(issue, context) {
  const { byId, options, phaseGateMap } = context;
  const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
  const missing = [];
  let linkage = null;
  let phaseGate = null;

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

  if (options.cycleGate && issue.status === 'open' && isImplementationIssue(issue)) {
    linkage = resolveLinkage(issue, context);
    if (linkage.specLinks.length === 0) {
      missing.push({
        type: 'missing_spec_linkage',
        message: 'no design/spec linkage found (spec bead or .specify/specs path required)',
      });
    }
    if (linkage.reviewLinks.length === 0) {
      missing.push({
        type: 'missing_review_linkage',
        message: 'no review linkage found (review bead required)',
      });
    }
    for (const error of linkage.linkageErrors) {
      missing.push(error);
    }
  }

  const isPhaseGateIssue =
    Object.prototype.hasOwnProperty.call(phaseGateMap, issue.id) || /^phase gate:/i.test(String(issue.title ?? ''));
  if (options.phaseGate && issue.status === 'open' && isPhaseGateIssue) {
    phaseGate = resolvePhaseGate(issue, context);

    if (!phaseGate.defined) {
      missing.push({
        type: 'missing_phase_gate_definition',
        message: `no phase gate definition found for ${issue.id} in .beads/phase-gate-map.json`,
      });
    } else {
      for (const requirement of phaseGate.requirements) {
        for (const required of requirement.beads) {
          if (required.status === 'missing') {
            missing.push({
              type: 'invalid_phase_gate_reference',
              message: `phase gate requirement references unknown bead ${required.beadId} (${requirement.label})`,
            });
            continue;
          }

          if (required.status !== 'closed') {
            missing.push({
              type: 'phase_gate_requirement_open',
              beadId: required.beadId,
              title: required.title,
              status: required.status,
              requirement: requirement.label,
            });
          }
        }
      }
    }

    for (const error of phaseGate.errors) {
      missing.push(error);
    }
  }

  return {
    beadId: issue.id,
    title: issue.title,
    status: issue.status,
    blockedBy: blockers,
    missingPrerequisites: missing,
    readyToStart: issue.status === 'open' && missing.length === 0,
    ...(linkage !== null ? { linkage } : {}),
    ...(phaseGate !== null ? { phaseGate } : {}),
  };
}

function formatHumanReport(report) {
  const lines = [];
  lines.push(`Bead: ${report.beadId}`);
  lines.push(`Title: ${report.title}`);
  lines.push(`Status: ${report.status}`);
  lines.push(`Ready to start: ${report.readyToStart ? 'yes' : 'no'}`);
  lines.push(report.blockedBy.length === 0 ? 'BlockedBy: (none)' : `BlockedBy: ${report.blockedBy.join(', ')}`);

  if (report.linkage) {
    lines.push(
      report.linkage.specLinks.length === 0
        ? 'Spec linkage: (none)'
        : `Spec linkage: ${report.linkage.specLinks.join(', ')}`,
    );
    lines.push(
      report.linkage.reviewLinks.length === 0
        ? 'Review linkage: (none)'
        : `Review linkage: ${report.linkage.reviewLinks.join(', ')}`,
    );
  }

  if (report.phaseGate) {
    lines.push(`Phase gate definition: ${report.phaseGate.defined ? 'yes' : 'no'}`);
    if (report.phaseGate.defined) {
      if (report.phaseGate.name) {
        lines.push(`Phase gate name: ${report.phaseGate.name}`);
      }
      lines.push('Phase gate requirements:');
      for (const requirement of report.phaseGate.requirements) {
        const states = requirement.beads
          .map((required) => `${required.beadId}:${required.status}`)
          .join(', ');
        lines.push(`- ${requirement.label} (${requirement.satisfied ? 'closed' : 'incomplete'}): ${states}`);
      }
    }
  }

  if (report.missingPrerequisites.length > 0) {
    lines.push('Missing prerequisites:');
    for (const missing of report.missingPrerequisites) {
      if (missing.type === 'missing_bead') {
        lines.push(`- missing bead reference: ${missing.beadId}`);
      } else if (missing.type === 'blocked_by_open') {
        lines.push(`- ${missing.beadId} is still ${missing.status}: ${missing.title}`);
      } else if (missing.type === 'phase_gate_requirement_open') {
        lines.push(`- [${missing.requirement}] ${missing.beadId} is still ${missing.status}: ${missing.title}`);
      } else if (typeof missing.message === 'string') {
        lines.push(`- ${missing.message}`);
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
  const linkageMap = await loadLinkageMap();
  const phaseGateMap = await loadPhaseGateMap();
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const context = { options, issues, byId, linkageMap, phaseGateMap };

  if (options.next) {
    const openIssues = issues.filter((issue) => issue.status === 'open');
    const reports = sortIssuesForStart(openIssues)
      .map((issue) => evaluateIssue(issue, context))
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
        '  node scripts/beads/check-bead-prerequisites.mjs <bead-id> [--json] [--cycle-gate] [--phase-gate]\n' +
        '  node scripts/beads/check-bead-prerequisites.mjs --next [--json] [--cycle-gate] [--phase-gate]\n',
    );
    process.exit(2);
  }

  const issue = byId.get(options.beadId);
  if (!issue) {
    process.stderr.write(`Bead not found: ${options.beadId}\n`);
    process.exit(2);
  }

  const report = evaluateIssue(issue, context);
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

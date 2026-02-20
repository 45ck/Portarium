#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const OUTPUT_PATH = path.join(
  WORKSPACE_ROOT,
  'docs',
  'governance',
  'stop-loss-thresholds-status.md',
);

// cspell:ignore lowlinks neighbor badr
const DEFAULT_THRESHOLDS = {
  riskScore: 6,
  failedGates: 1,
  unresolvedOpenDecisions: 8,
  orphanedBeads: 20,
  openP0: 5,
  unownedOpenBeads: 25,
};

function parseArgs(argv) {
  return new Set(argv.slice(2));
}

function getArgValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || index + 1 >= argv.length) return '';
  return argv[index + 1] ?? '';
}

function parseCsvList(value) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

async function loadIssues() {
  const raw = await fs.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function buildOpenDependencyGraph(openIssues) {
  const openIds = new Set(openIssues.map((issue) => issue.id));
  const openDependencies = new Map();
  const dependents = new Map(openIssues.map((issue) => [issue.id, 0]));

  for (const issue of openIssues) {
    const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
    const openBlockers = blockers.filter((id) => openIds.has(id));
    openDependencies.set(issue.id, openBlockers);
    for (const blockerId of openBlockers) {
      dependents.set(blockerId, (dependents.get(blockerId) ?? 0) + 1);
    }
  }

  return { openDependencies, dependents };
}

function stronglyConnectedComponents(ids, openDependencies) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowlinks = new Map();
  const components = [];

  function visit(id) {
    indexes.set(id, index);
    lowlinks.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    const neighbors = openDependencies.get(id) ?? [];
    for (const neighbor of neighbors) {
      if (!indexes.has(neighbor)) {
        visit(neighbor);
        lowlinks.set(id, Math.min(lowlinks.get(id), lowlinks.get(neighbor)));
      } else if (onStack.has(neighbor)) {
        lowlinks.set(id, Math.min(lowlinks.get(id), indexes.get(neighbor)));
      }
    }

    if (lowlinks.get(id) === indexes.get(id)) {
      const component = [];
      while (stack.length > 0) {
        const node = stack.pop();
        onStack.delete(node);
        component.push(node);
        if (node === id) break;
      }
      components.push(component);
    }
  }

  for (const id of ids) {
    if (!indexes.has(id)) visit(id);
  }
  return components;
}

function findDeadlockCycles(openIssues, openDependencies) {
  const ids = openIssues.map((issue) => issue.id).sort((a, b) => toNumber(a) - toNumber(b));
  const components = stronglyConnectedComponents(ids, openDependencies);
  const cycles = [];

  for (const component of components) {
    if (component.length > 1) {
      cycles.push(component.sort((a, b) => toNumber(a) - toNumber(b)));
      continue;
    }
    const id = component[0];
    if ((openDependencies.get(id) ?? []).includes(id)) cycles.push([id]);
  }

  return cycles;
}

function countOrphans(openIssues, openDependencies, dependents) {
  return openIssues
    .filter((issue) => (openDependencies.get(issue.id) ?? []).length === 0)
    .filter((issue) => {
      return (dependents.get(issue.id) ?? 0) === 0;
    }).length;
}

function hasOwner(issue) {
  const owner = typeof issue.owner === 'string' ? issue.owner.trim() : '';
  const claimedBy = typeof issue.claimedBy === 'string' ? issue.claimedBy.trim() : '';
  return owner.length > 0 || claimedBy.length > 0;
}

function isOpenDecision(issue) {
  const title = typeof issue.title === 'string' ? issue.title : '';
  const body = typeof issue.body === 'string' ? issue.body : '';
  return /\badr\b|\bspec\b|\bdecision\b|\bsemantics?\b|\brule language\b/i.test(
    `${title}\n${body}`,
  );
}

function evaluateStopLoss(issues, failedGates, thresholds = DEFAULT_THRESHOLDS) {
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const { openDependencies, dependents } = buildOpenDependencyGraph(openIssues);
  const deadlockCycles = findDeadlockCycles(openIssues, openDependencies);
  const orphanCount = countOrphans(openIssues, openDependencies, dependents);
  const openP0Count = openIssues.filter((issue) => issue.priority === 'P0').length;
  const unownedOpenBeads = openIssues.filter((issue) => !hasOwner(issue)).length;
  const unresolvedOpenDecisions = openIssues.filter((issue) => isOpenDecision(issue)).length;

  const riskComponents = [];
  let riskScore = 0;

  if (deadlockCycles.length > 0) {
    riskScore += 4;
    riskComponents.push('dependency_deadlock');
  }
  if (orphanCount >= thresholds.orphanedBeads) {
    riskScore += 2;
    riskComponents.push('orphaned_beads_threshold');
  }
  if (openP0Count >= thresholds.openP0) {
    riskScore += 2;
    riskComponents.push('open_p0_threshold');
  }
  if (unownedOpenBeads >= thresholds.unownedOpenBeads) {
    riskScore += 2;
    riskComponents.push('unowned_open_beads_threshold');
  }
  if (unresolvedOpenDecisions >= thresholds.unresolvedOpenDecisions) {
    riskScore += 2;
    riskComponents.push('unresolved_decision_threshold');
  }

  const shouldHaltByRisk = riskScore >= thresholds.riskScore;
  const shouldHaltByFailedGates = failedGates.length >= thresholds.failedGates;
  const shouldHaltByDecisions = unresolvedOpenDecisions >= thresholds.unresolvedOpenDecisions;
  const shouldHalt = shouldHaltByRisk || shouldHaltByFailedGates || shouldHaltByDecisions;

  const reasons = [];
  if (shouldHaltByRisk) {
    reasons.push(`risk score ${riskScore} >= threshold ${thresholds.riskScore}`);
  }
  if (shouldHaltByFailedGates) {
    reasons.push(`failed gates ${failedGates.length} >= threshold ${thresholds.failedGates}`);
  }
  if (shouldHaltByDecisions) {
    reasons.push(
      `unresolved open decisions ${unresolvedOpenDecisions} >= threshold ${thresholds.unresolvedOpenDecisions}`,
    );
  }

  return {
    generatedAtIso: latestIssueTimestamp(issues),
    thresholds,
    inputs: {
      failedGates,
    },
    metrics: {
      openBeads: openIssues.length,
      deadlockCycles: deadlockCycles.length,
      orphanedBeads: orphanCount,
      openP0Beads: openP0Count,
      unownedOpenBeads,
      unresolvedOpenDecisions,
    },
    risk: {
      score: riskScore,
      components: riskComponents,
    },
    decision: {
      shouldHalt,
      reasons,
    },
  };
}

function buildMarkdown(report) {
  const lines = [
    '# Stop-Loss Threshold Evaluation',
    '',
    `Generated: ${report.generatedAtIso}`,
    'Source: `.beads/issues.jsonl`',
    '',
    '## Thresholds',
    '',
    `- Risk score halt threshold: ${report.thresholds.riskScore}`,
    `- Failed gates halt threshold: ${report.thresholds.failedGates}`,
    `- Unresolved open decisions halt threshold: ${report.thresholds.unresolvedOpenDecisions}`,
    '',
    '## Metrics',
    '',
    `- Open beads: ${report.metrics.openBeads}`,
    `- Deadlock cycles: ${report.metrics.deadlockCycles}`,
    `- Orphaned beads: ${report.metrics.orphanedBeads}`,
    `- Open P0 beads: ${report.metrics.openP0Beads}`,
    `- Unowned open beads: ${report.metrics.unownedOpenBeads}`,
    `- Unresolved open decisions: ${report.metrics.unresolvedOpenDecisions}`,
    `- Failed gates input: ${report.inputs.failedGates.length > 0 ? report.inputs.failedGates.join(', ') : '(none)'}`,
    '',
    '## Risk',
    '',
    `- Risk score: ${report.risk.score}`,
    `- Risk components: ${report.risk.components.length > 0 ? report.risk.components.join(', ') : '(none)'}`,
    '',
    '## Decision',
    '',
    `- Halt cycle: ${report.decision.shouldHalt ? 'yes' : 'no'}`,
    `- Reasons: ${report.decision.reasons.length > 0 ? report.decision.reasons.join(' | ') : '(none)'}`,
    '',
  ];
  return lines.join('\n');
}

function enforceOrExit(report) {
  if (!report.decision.shouldHalt) return;
  process.stderr.write(`Stop-loss halt triggered: ${report.decision.reasons.join('; ')}\n`);
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv);
  const checkMode = args.has('--check');
  const stdoutMode = args.has('--stdout');
  const jsonMode = args.has('--json');
  const enforceMode = args.has('--enforce');
  const failedGates = parseCsvList(getArgValue(process.argv, '--failed-gates'));

  const issues = await loadIssues();
  const report = evaluateStopLoss(issues, failedGates);
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
          `Stop-loss status is stale. Regenerate with:\nnode scripts/beads/evaluate-stop-loss-thresholds.mjs\n`,
        );
        process.exit(1);
      }
    } catch {
      process.stderr.write(
        `Stop-loss status file is missing. Generate with:\nnode scripts/beads/evaluate-stop-loss-thresholds.mjs\n`,
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
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'docs', 'governance', 'weekly-pe-audit.md');

function parseArgs(argv) {
  return new Set(argv.slice(2));
}

function toNumber(id) {
  const value = Number.parseInt(String(id).replace(/^bead-/, ''), 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function phaseLabel(phase) {
  return typeof phase === 'string' && phase.length > 0 ? phase : 'unspecified';
}

function priorityLabel(priority) {
  return typeof priority === 'string' && priority.length > 0 ? priority : '--';
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

function toWeekStart(isoTimestamp) {
  if (isoTimestamp === 'n/a') return 'n/a';
  const date = new Date(isoTimestamp);
  const utcDay = date.getUTCDay(); // 0 = Sunday.
  const deltaToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + deltaToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
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

function findOrphans(openIssues, openDependencies, dependents) {
  return openIssues
    .filter((issue) => (openDependencies.get(issue.id) ?? []).length === 0)
    .filter((issue) => (dependents.get(issue.id) ?? 0) === 0)
    .sort((a, b) => toNumber(a.id) - toNumber(b.id))
    .map((issue) => ({
      id: issue.id,
      title: issue.title,
      phase: phaseLabel(issue.phase),
      priority: priorityLabel(issue.priority),
    }));
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

  return cycles.sort((a, b) => toNumber(a[0]) - toNumber(b[0]));
}

function buildAuditData(issues) {
  const issuesById = new Map(issues.map((issue) => [issue.id, issue]));
  const openIssues = issues
    .filter((issue) => issue.status === 'open')
    .sort((a, b) => toNumber(a.id) - toNumber(b.id));
  const { openDependencies, dependents } = buildOpenDependencyGraph(openIssues);
  const orphans = findOrphans(openIssues, openDependencies, dependents);
  const deadlockCycles = findDeadlockCycles(openIssues, openDependencies);
  const deadlockIds = [...new Set(deadlockCycles.flat())].sort((a, b) => toNumber(a) - toNumber(b));
  const openDependencyEdges = openIssues.reduce(
    (sum, issue) => sum + (openDependencies.get(issue.id) ?? []).length,
    0,
  );
  const blockedByOpen = openIssues.filter((issue) => (openDependencies.get(issue.id) ?? []).length > 0).length;
  const generatedAtIso = latestIssueTimestamp(issues);

  return {
    generatedAtIso,
    weekStart: toWeekStart(generatedAtIso),
    snapshot: {
      openBeads: openIssues.length,
      openDependencyEdges,
      blockedByOpen,
      orphanCount: orphans.length,
      deadlockCycleCount: deadlockCycles.length,
      deadlockBeadCount: deadlockIds.length,
    },
    orphans,
    deadlocks: deadlockCycles.map((cycle, index) => ({
      index: index + 1,
      length: cycle.length,
      beads: cycle,
    })),
    issuesById,
  };
}

function formatCycle(cycle) {
  if (cycle.length === 1) return `${cycle[0]} -> ${cycle[0]}`;
  return `${cycle.join(' -> ')} -> ${cycle[0]}`;
}

function buildMarkdown(audit) {
  const lines = [
    '# Weekly PE Audit: Orphaned Beads And Dependency Deadlocks',
    '',
    `Generated: ${audit.generatedAtIso}`,
    `Week of: ${audit.weekStart}`,
    'Source: `.beads/issues.jsonl`',
    '',
    '## Snapshot',
    '',
    `- Open beads: ${audit.snapshot.openBeads}`,
    `- Open dependency edges: ${audit.snapshot.openDependencyEdges}`,
    `- Open beads blocked by open prerequisites: ${audit.snapshot.blockedByOpen}`,
    `- Orphaned beads: ${audit.snapshot.orphanCount}`,
    `- Deadlock cycles: ${audit.snapshot.deadlockCycleCount}`,
    `- Beads participating in deadlocks: ${audit.snapshot.deadlockBeadCount}`,
    '',
    '## Orphaned Beads',
    '',
  ];

  if (audit.orphans.length === 0) {
    lines.push('No orphaned beads detected.');
    lines.push('');
  } else {
    lines.push('| Bead | Priority | Phase | Title |');
    lines.push('| --- | --- | --- | --- |');
    for (const orphan of audit.orphans) {
      lines.push(`| ${orphan.id} | ${orphan.priority} | ${orphan.phase} | ${orphan.title} |`);
    }
    lines.push('');
  }

  lines.push('## Dependency Deadlocks');
  lines.push('');
  if (audit.deadlocks.length === 0) {
    lines.push('No dependency deadlocks detected.');
    lines.push('');
  } else {
    for (const deadlock of audit.deadlocks) {
      lines.push(`### Deadlock ${deadlock.index}`);
      lines.push('');
      lines.push(`- Cycle length: ${deadlock.length}`);
      lines.push(`- Cycle path: \`${formatCycle(deadlock.beads)}\``);
      lines.push('');
      lines.push('| Bead | Status | Title |');
      lines.push('| --- | --- | --- |');
      for (const beadId of deadlock.beads) {
        const issue = audit.issuesById.get(beadId);
        const title = issue?.title ?? '(missing issue)';
        const status = issue?.status ?? 'missing';
        lines.push(`| ${beadId} | ${status} | ${title} |`);
      }
      lines.push('');
    }
  }

  lines.push('## Rules');
  lines.push('');
  lines.push('- Orphaned bead: open bead with no open blockers and no open dependents.');
  lines.push(
    '- Dependency deadlock: strongly-connected component in the open-bead dependency graph (including self-loop).',
  );
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const checkMode = args.has('--check');
  const stdoutMode = args.has('--stdout');
  const jsonMode = args.has('--json');

  const issues = await loadIssues();
  const audit = buildAuditData(issues);
  const markdown = buildMarkdown(audit);

  if (jsonMode) {
    const output = { ...audit };
    delete output.issuesById;
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
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
          `Weekly PE audit is stale. Regenerate with:\nnode scripts/beads/generate-weekly-pe-audit.mjs\n`,
        );
        process.exit(1);
      }
      return;
    } catch {
      process.stderr.write(
        `Weekly PE audit file is missing. Generate with:\nnode scripts/beads/generate-weekly-pe-audit.mjs\n`,
      );
      process.exit(1);
    }
  }

  await fs.writeFile(OUTPUT_PATH, markdown, 'utf8');
  process.stdout.write(`Wrote ${path.relative(WORKSPACE_ROOT, OUTPUT_PATH)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});

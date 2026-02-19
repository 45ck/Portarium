#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const ISSUES_PATH = path.join(WORKSPACE_ROOT, '.beads', 'issues.jsonl');
const REVIEW_DIR = path.join(WORKSPACE_ROOT, 'docs', 'review');
const OUTPUT_PATH = path.join(WORKSPACE_ROOT, 'docs', 'governance', 'master-execution-dag.md');

function parseArgs(argv) {
  return new Set(argv.slice(2));
}

function toNumber(id) {
  const value = Number.parseInt(id.replace(/^bead-/, ''), 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function phaseLabel(phase) {
  return typeof phase === 'string' && phase.length > 0 ? phase : 'unspecified';
}

function shortTitle(title, max = 64) {
  if (title.length <= max) return title;
  return `${title.slice(0, max - 1)}…`;
}

function normalizeMermaidLabel(title) {
  return shortTitle(title).replaceAll('"', "'").replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function latestIssueTimestamp(issues) {
  let latest = 0;
  for (const issue of issues) {
    if (typeof issue.updatedAt !== 'string') continue;
    const value = Date.parse(issue.updatedAt);
    if (Number.isFinite(value) && value > latest) latest = value;
  }
  return latest > 0 ? new Date(latest).toISOString() : 'n/a';
}

function issueIdToNode(id) {
  return `B${id.replace(/^bead-/, '')}`;
}

async function loadIssues() {
  const raw = await fs.readFile(ISSUES_PATH, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

async function loadEvidenceIndex() {
  const index = new Map();
  let entries = [];
  try {
    entries = await fs.readdir(REVIEW_DIR, { withFileTypes: true });
  } catch {
    return index;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^bead-(\d{4})/);
    if (!match) continue;
    const beadId = `bead-${match[1]}`;
    const arr = index.get(beadId) ?? [];
    arr.push(path.posix.join('docs', 'review', entry.name));
    index.set(beadId, arr);
  }

  for (const [key, files] of index.entries()) {
    files.sort((a, b) => a.localeCompare(b));
    index.set(key, files);
  }
  return index;
}

function buildOpenGraph(openIssues) {
  const openIdSet = new Set(openIssues.map((issue) => issue.id));
  const openIssueMap = new Map(openIssues.map((issue) => [issue.id, issue]));
  const openDependencies = new Map();
  const reverseEdges = new Map();

  for (const issue of openIssues) {
    const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
    const openBlockers = blockers.filter((id) => openIdSet.has(id));
    openDependencies.set(issue.id, openBlockers);
    for (const blockerId of openBlockers) {
      const children = reverseEdges.get(blockerId) ?? [];
      children.push(issue.id);
      reverseEdges.set(blockerId, children);
    }
  }

  return { openIdSet, openIssueMap, openDependencies, reverseEdges };
}

function findCriticalPath(openIssues, openDependencies, reverseEdges) {
  const inDegree = new Map(openIssues.map((issue) => [issue.id, 0]));
  for (const issue of openIssues) {
    const deps = openDependencies.get(issue.id) ?? [];
    for (const dep of deps) {
      inDegree.set(issue.id, (inDegree.get(issue.id) ?? 0) + 1);
      if (!reverseEdges.has(dep)) reverseEdges.set(dep, []);
    }
  }

  const queue = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }
  queue.sort((a, b) => toNumber(a) - toNumber(b));

  const topo = [];
  while (queue.length > 0) {
    const current = queue.shift();
    topo.push(current);
    const children = reverseEdges.get(current) ?? [];
    for (const child of children) {
      const nextDegree = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, nextDegree);
      if (nextDegree === 0) {
        queue.push(child);
        queue.sort((a, b) => toNumber(a) - toNumber(b));
      }
    }
  }

  const isDag = topo.length === openIssues.length;
  const pathLength = new Map(openIssues.map((issue) => [issue.id, 1]));
  const predecessor = new Map();

  for (const id of topo) {
    const base = pathLength.get(id) ?? 1;
    const children = reverseEdges.get(id) ?? [];
    for (const child of children) {
      const candidate = base + 1;
      const current = pathLength.get(child) ?? 1;
      if (candidate > current) {
        pathLength.set(child, candidate);
        predecessor.set(child, id);
      }
    }
  }

  let endNode = null;
  let best = 0;
  for (const issue of openIssues) {
    const length = pathLength.get(issue.id) ?? 1;
    if (length > best) {
      best = length;
      endNode = issue.id;
    } else if (length === best && endNode !== null && toNumber(issue.id) < toNumber(endNode)) {
      endNode = issue.id;
    }
  }

  const path = [];
  if (endNode !== null) {
    let cursor = endNode;
    while (cursor !== undefined) {
      path.push(cursor);
      cursor = predecessor.get(cursor);
    }
    path.reverse();
  }

  return {
    isDag,
    topologicalCount: topo.length,
    path,
    pathLength: best,
  };
}

function summarizeByPhase(openIssues, openDependencies, evidenceIndex) {
  const summary = new Map();
  for (const issue of openIssues) {
    const phase = phaseLabel(issue.phase);
    if (!summary.has(phase)) {
      summary.set(phase, {
        phase,
        total: 0,
        blockedByOpen: 0,
        withEvidence: 0,
      });
    }
    const row = summary.get(phase);
    row.total += 1;
    if ((openDependencies.get(issue.id) ?? []).length > 0) row.blockedByOpen += 1;
    if ((evidenceIndex.get(issue.id) ?? []).length > 0) row.withEvidence += 1;
  }

  return [...summary.values()].sort((a, b) => a.phase.localeCompare(b.phase));
}

function buildMermaid(openIssues, openDependencies) {
  const lines = ['```mermaid', 'flowchart TD'];
  const byPhase = new Map();
  for (const issue of openIssues) {
    const phase = phaseLabel(issue.phase);
    const arr = byPhase.get(phase) ?? [];
    arr.push(issue);
    byPhase.set(phase, arr);
  }

  const phases = uniqueSorted([...byPhase.keys()]);
  for (const phase of phases) {
    lines.push(`  subgraph ${phase.replace(/[^A-Za-z0-9_]/g, '_')}[${phase}]`);
    const issues = byPhase.get(phase).sort((a, b) => toNumber(a.id) - toNumber(b.id));
    for (const issue of issues) {
      lines.push(
        `    ${issueIdToNode(issue.id)}["${issue.id}<br/>${normalizeMermaidLabel(issue.title)}"]`,
      );
    }
    lines.push('  end');
  }

  for (const issue of openIssues.sort((a, b) => toNumber(a.id) - toNumber(b.id))) {
    const deps = openDependencies.get(issue.id) ?? [];
    for (const dep of deps.sort((a, b) => toNumber(a) - toNumber(b))) {
      lines.push(`  ${issueIdToNode(dep)} --> ${issueIdToNode(issue.id)}`);
    }
  }

  lines.push('```');
  return lines.join('\n');
}

function buildMarkdown({
  generatedAtIso,
  openIssues,
  openDependencies,
  criticalPath,
  evidenceIndex,
  phaseSummary,
  issuesById,
}) {
  const totalOpenDependencies = openIssues.reduce(
    (sum, issue) => sum + (openDependencies.get(issue.id) ?? []).length,
    0,
  );
  const openBlockedCount = openIssues.filter((issue) => (openDependencies.get(issue.id) ?? []).length > 0).length;
  const withEvidence = openIssues.filter((issue) => (evidenceIndex.get(issue.id) ?? []).length > 0).length;

  const lines = [
    '# Master Execution DAG',
    '',
    `Generated: ${generatedAtIso}`,
    'Source: `.beads/issues.jsonl`',
    '',
    '## Snapshot',
    '',
    `- Open beads: ${openIssues.length}`,
    `- Open dependency edges: ${totalOpenDependencies}`,
    `- Open beads currently blocked by open prerequisites: ${openBlockedCount}`,
    `- Open beads with at least one review artifact in \`docs/review/\`: ${withEvidence}`,
    `- Graph acyclic: ${criticalPath.isDag ? 'yes' : 'no (dependency cycle detected)'}`,
    '',
    '## Phase Summary',
    '',
    '| Phase | Open Beads | Blocked By Open | With Evidence |',
    '| --- | ---: | ---: | ---: |',
    ...phaseSummary.map(
      (row) => `| ${row.phase} | ${row.total} | ${row.blockedByOpen} | ${row.withEvidence} |`,
    ),
    '',
    '## Critical Path',
    '',
    criticalPath.pathLength > 0
      ? `Longest open dependency chain length: **${criticalPath.pathLength}**`
      : 'Longest open dependency chain length: **0**',
    '',
  ];

  if (criticalPath.path.length > 0) {
    lines.push('| Order | Bead | Title |');
    lines.push('| ---: | --- | --- |');
    criticalPath.path.forEach((id, index) => {
      const issue = issuesById.get(id);
      const title = issue ? issue.title : '(missing issue)';
      lines.push(`| ${index + 1} | ${id} | ${title} |`);
    });
    lines.push('');
  }

  lines.push('## Open Dependency Graph');
  lines.push('');
  lines.push(buildMermaid(openIssues, openDependencies));
  lines.push('');
  lines.push('## Open Beads: Dependency And Evidence Detail');
  lines.push('');
  lines.push('| Bead | Phase | Open Blockers | Review Artifacts |');
  lines.push('| --- | --- | --- | --- |');

  for (const issue of [...openIssues].sort((a, b) => toNumber(a.id) - toNumber(b.id))) {
    const blockers = openDependencies.get(issue.id) ?? [];
    const artifacts = evidenceIndex.get(issue.id) ?? [];
    lines.push(
      `| ${issue.id} | ${phaseLabel(issue.phase)} | ${
        blockers.length > 0 ? blockers.join(', ') : 'none'
      } | ${artifacts.length > 0 ? artifacts.join('<br/>') : 'none'} |`,
    );
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- This artifact includes only open beads and only unresolved dependencies where both sides are still open.',
  );
  lines.push('- Review artifacts are detected by file prefix convention: `docs/review/bead-####*`.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const checkMode = args.has('--check');
  const stdoutMode = args.has('--stdout');

  const issues = await loadIssues();
  const issuesById = new Map(issues.map((issue) => [issue.id, issue]));
  const openIssues = issues
    .filter((issue) => issue.status === 'open')
    .sort((a, b) => toNumber(a.id) - toNumber(b.id));
  const evidenceIndex = await loadEvidenceIndex();
  const { openDependencies, reverseEdges } = buildOpenGraph(openIssues);
  const criticalPath = findCriticalPath(openIssues, openDependencies, reverseEdges);
  const phaseSummary = summarizeByPhase(openIssues, openDependencies, evidenceIndex);
  const snapshotAtIso = latestIssueTimestamp(issues);

  const markdown = buildMarkdown({
    generatedAtIso: snapshotAtIso,
    openIssues,
    openDependencies,
    criticalPath,
    evidenceIndex,
    phaseSummary,
    issuesById,
  });

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
          `Execution DAG is stale. Regenerate with:\nnode scripts/beads/generate-execution-dag.mjs\n`,
        );
        process.exit(1);
      }
      return;
    } catch {
      process.stderr.write(
        `Execution DAG file is missing. Generate with:\nnode scripts/beads/generate-execution-dag.mjs\n`,
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

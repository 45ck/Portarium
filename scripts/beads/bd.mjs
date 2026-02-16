import fs from 'node:fs';
import path from 'node:path';

function usage() {
  const lines = [
    'Beads (bd) - local issue tracker',
    '',
    'Usage:',
    '  bd issue list [--json]',
    '  bd issue create --title "..." [--json]',
    '  bd issue close <id> [--json]',
    '  bd issue reopen <id> [--json]',
    '  bd issue update <id> [--title "..." ] [--status open|closed] [--json]',
    '',
    'Notes:',
    '  - Issues are stored in .beads/issues.jsonl (JSON Lines).',
    '  - Commit .beads/issues.jsonl with code changes (project rule).',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function nowIsoUtc() {
  return new Date().toISOString();
}

function repoRoot() {
  return process.cwd();
}

function beadsDir(root) {
  return path.join(root, '.beads');
}

function issuesPath(root) {
  return path.join(beadsDir(root), 'issues.jsonl');
}

function ensureBeadsDir(root) {
  fs.mkdirSync(beadsDir(root), { recursive: true });
}

function readIssues(root) {
  const filePath = issuesPath(root);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  const issues = [];
  for (const [idx, line] of lines.entries()) {
    try {
      const parsed = JSON.parse(line);
      issues.push(parsed);
    } catch {
      throw new Error(`Invalid JSON in ${path.relative(root, filePath)} at line ${idx + 1}.`);
    }
  }
  return issues;
}

function writeIssues(root, issues) {
  ensureBeadsDir(root);
  const filePath = issuesPath(root);
  const lines = issues.map((i) => JSON.stringify(i));
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const args = argv.filter((a) => !a.startsWith('--'));
  return { args, flags };
}

function nextIssueId(issues) {
  let max = 0;
  for (const issue of issues) {
    const id = issue?.id;
    if (typeof id !== 'string') continue;
    const m = /^bead-(\d{4})$/.exec(id);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const next = max + 1;
  return `bead-${String(next).padStart(4, '0')}`;
}

function findIssueIndex(issues, id) {
  const idx = issues.findIndex((i) => i?.id === id);
  if (idx < 0) throw new Error(`Issue not found: ${id}`);
  return idx;
}

function setStatus(issues, id, status) {
  if (status !== 'open' && status !== 'closed') {
    throw new Error(`Invalid status "${status}". Expected "open" or "closed".`);
  }
  const idx = findIssueIndex(issues, id);
  const issue = issues[idx];
  issues[idx] = { ...issue, status, updatedAt: nowIsoUtc() };
  return issues[idx];
}

function setTitle(issues, id, title) {
  if (!isNonEmptyString(title)) throw new Error('title must be a non-empty string.');
  const idx = findIssueIndex(issues, id);
  const issue = issues[idx];
  issues[idx] = { ...issue, title: title.trim(), updatedAt: nowIsoUtc() };
  return issues[idx];
}

function print(value, jsonFlag) {
  if (jsonFlag) {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    return;
  }

  if (Array.isArray(value)) {
    for (const v of value) process.stdout.write(`${v.id} [${v.status}] ${v.title}\n`);
    return;
  }

  if (value && typeof value === 'object') {
    process.stdout.write(`${value.id} [${value.status}] ${value.title}\n`);
    return;
  }

  process.stdout.write(String(value) + '\n');
}

function readOption(argv, name) {
  const idx = argv.indexOf(name);
  if (idx < 0) return null;
  const value = argv[idx + 1];
  if (!isNonEmptyString(value)) throw new Error(`Missing value for ${name}.`);
  return value;
}

function main() {
  const root = repoRoot();
  const rawArgv = process.argv.slice(2);
  if (rawArgv.length === 0 || rawArgv.includes('--help') || rawArgv.includes('-h')) {
    usage();
    return;
  }

  const { args, flags } = parseArgs(rawArgv);
  const asJson = flags.has('--json');

  const [noun, verb, ...rest] = args;
  if (noun !== 'issue') {
    fail(`Unknown noun "${noun}". Expected "issue".\n\nRun: bd --help`);
  }

  const issues = readIssues(root);

  if (verb === 'list') {
    print(issues, asJson);
    return;
  }

  if (verb === 'create') {
    const title = readOption(process.argv.slice(2), '--title');
    if (!title) fail('Missing --title for issue create.');

    const id = nextIssueId(issues);
    const now = nowIsoUtc();
    const issue = {
      id,
      title: title.trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    writeIssues(root, issues);
    print(issue, asJson);
    return;
  }

  if (verb === 'close') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue close.');
    const updated = setStatus(issues, id, 'closed');
    writeIssues(root, issues);
    print(updated, asJson);
    return;
  }

  if (verb === 'reopen') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue reopen.');
    const updated = setStatus(issues, id, 'open');
    writeIssues(root, issues);
    print(updated, asJson);
    return;
  }

  if (verb === 'update') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue update.');

    const title = readOption(process.argv.slice(2), '--title');
    const status = readOption(process.argv.slice(2), '--status');

    let updated = issues[findIssueIndex(issues, id)];
    if (title) updated = setTitle(issues, id, title);
    if (status) updated = setStatus(issues, id, status);

    writeIssues(root, issues);
    print(updated, asJson);
    return;
  }

  fail(`Unknown verb "${verb}".\n\nRun: bd --help`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
}

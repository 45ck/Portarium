import fs from 'node:fs';
import path from 'node:path';

const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3, undefined: 4 };

function usage() {
  const lines = [
    'Beads (bd) - local issue tracker',
    '',
    'Usage:',
    '  bd issue list   [--open] [--phase <phase>] [--priority <P0|P1|P2|P3>] [--json]',
    '  bd issue next   [--phase <phase>] [--priority <P0|P1|P2|P3>] [--json]',
    '  bd issue view   <id>',
    '  bd issue create --title "..." [--priority P0] [--phase <phase>] [--blocked-by "id1,id2"] [--body "..."] [--json]',
    '  bd issue close  <id> [--json]',
    '  bd issue reopen <id> [--json]',
    '  bd issue update <id> [--title "..."] [--status open|closed] [--priority <P0|P1|P2|P3>]',
    '                       [--phase <phase>] [--blocked-by "id1,id2"] [--add-blocked-by "id1,id2"]',
    '                       [--remove-blocked-by "id1,id2"] [--body "..."] [--json]',
    '',
    'Fields:',
    '  priority   P0 (must-have) | P1 (important) | P2 (nice-to-have) | P3 (future)',
    '  phase      devenv | domain | application | infrastructure | presentation |',
    '             integration | governance | security | release | cross-cutting',
    '  blockedBy  comma-separated list of bead IDs that must be closed first',
    '  body       free-text description / acceptance criteria',
    '',
    'Commands:',
    '  next       shows open beads with no unresolved blockers, sorted by priority',
    '  view       shows all fields of a bead including body and blockers',
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

function readOption(argv, name) {
  const idx = argv.indexOf(name);
  if (idx < 0) return null;
  const value = argv[idx + 1];
  if (!isNonEmptyString(value)) throw new Error(`Missing value for ${name}.`);
  return value;
}

function parseBlockedBy(raw) {
  if (!raw) return undefined;
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) return undefined;
  for (const id of ids) {
    if (!/^bead-\d{4}$/.test(id)) throw new Error(`Invalid bead ID in --blocked-by: "${id}"`);
  }
  return ids;
}

/** Return true if the issue is unblocked (no open prerequisites). */
function isUnblocked(issue, closedIds) {
  const blockedBy = issue.blockedBy;
  if (!blockedBy || blockedBy.length === 0) return true;
  return blockedBy.every((dep) => closedIds.has(dep));
}

function prioritySortKey(issue) {
  return PRIORITY_ORDER[issue.priority] ?? PRIORITY_ORDER['undefined'];
}

/** Sort: priority asc (P0 first), then createdAt asc. */
function sortByPriority(issues) {
  return [...issues].sort((a, b) => {
    const pd = prioritySortKey(a) - prioritySortKey(b);
    if (pd !== 0) return pd;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

function formatPriority(p) {
  if (!p) return '  --';
  return p;
}

function print(value, jsonFlag) {
  if (jsonFlag) {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    return;
  }

  if (Array.isArray(value)) {
    for (const v of value) {
      const pri = formatPriority(v.priority);
      const phase = v.phase ? ` [${v.phase}]` : '';
      process.stdout.write(`${v.id} ${pri} [${v.status}]${phase} ${v.title}\n`);
    }
    return;
  }

  if (value && typeof value === 'object') {
    const pri = formatPriority(value.priority);
    const phase = value.phase ? ` [${value.phase}]` : '';
    process.stdout.write(`${value.id} ${pri} [${value.status}]${phase} ${value.title}\n`);
    return;
  }

  process.stdout.write(String(value) + '\n');
}

function printView(issue) {
  const lines = [
    `ID:        ${issue.id}`,
    `Title:     ${issue.title}`,
    `Status:    ${issue.status}`,
    `Priority:  ${issue.priority ?? '(unset)'}`,
    `Phase:     ${issue.phase ?? '(unset)'}`,
    `BlockedBy: ${issue.blockedBy?.join(', ') ?? '(none)'}`,
    `Created:   ${issue.createdAt}`,
    `Updated:   ${issue.updatedAt}`,
    '',
    issue.body ? issue.body : '(no body)',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

function applyUpdate(issues, id, changes) {
  const idx = findIssueIndex(issues, id);
  const issue = issues[idx];
  issues[idx] = { ...issue, ...changes, updatedAt: nowIsoUtc() };
  return issues[idx];
}

function buildUpdateChanges(argv, existingIssue) {
  const changes = {};

  const title = readOption(argv, '--title');
  if (title) changes.title = title.trim();

  const status = readOption(argv, '--status');
  if (status) {
    if (status !== 'open' && status !== 'closed') {
      throw new Error(`Invalid status "${status}". Expected "open" or "closed".`);
    }
    changes.status = status;
  }

  const priority = readOption(argv, '--priority');
  if (priority) {
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new Error(
        `Invalid priority "${priority}". Expected one of: ${VALID_PRIORITIES.join(', ')}.`,
      );
    }
    changes.priority = priority;
  }

  const phase = readOption(argv, '--phase');
  if (phase) changes.phase = phase.trim();

  const body = readOption(argv, '--body');
  if (body) changes.body = body.trim();

  // --blocked-by replaces entirely
  const blockedByRaw = readOption(argv, '--blocked-by');
  if (blockedByRaw !== null) {
    const parsed = parseBlockedBy(blockedByRaw);
    changes.blockedBy = parsed ?? [];
  }

  // --add-blocked-by merges
  const addRaw = readOption(argv, '--add-blocked-by');
  if (addRaw !== null) {
    const toAdd = parseBlockedBy(addRaw) ?? [];
    const current = changes.blockedBy ?? existingIssue.blockedBy ?? [];
    changes.blockedBy = [...new Set([...current, ...toAdd])];
  }

  // --remove-blocked-by removes
  const removeRaw = readOption(argv, '--remove-blocked-by');
  if (removeRaw !== null) {
    const toRemove = new Set(parseBlockedBy(removeRaw) ?? []);
    const current = changes.blockedBy ?? existingIssue.blockedBy ?? [];
    changes.blockedBy = current.filter((id) => !toRemove.has(id));
  }

  return changes;
}

function main() {
  const root = repoRoot();
  const rawArgv = process.argv.slice(2);

  if (rawArgv.length === 0 || rawArgv.includes('--help') || rawArgv.includes('-h')) {
    usage();
    return;
  }

  const asJson = rawArgv.includes('--json');

  // Split into positional args (non-flag) and flags
  const positional = rawArgv.filter((a) => !a.startsWith('--'));
  const [noun, verb, ...rest] = positional;

  if (noun !== 'issue') {
    fail(`Unknown noun "${noun}". Expected "issue".\n\nRun: bd --help`);
  }

  const issues = readIssues(root);

  // ── list ──────────────────────────────────────────────────────────────────
  if (verb === 'list') {
    const filterPhase = readOption(rawArgv, '--phase');
    const filterPriority = readOption(rawArgv, '--priority');
    const openOnly = rawArgv.includes('--open');

    let result = issues;
    if (openOnly) result = result.filter((i) => i.status === 'open');
    if (filterPhase) result = result.filter((i) => i.phase === filterPhase);
    if (filterPriority) result = result.filter((i) => i.priority === filterPriority);

    print(result, asJson);
    return;
  }

  // ── next ──────────────────────────────────────────────────────────────────
  if (verb === 'next') {
    const filterPhase = readOption(rawArgv, '--phase');
    const filterPriority = readOption(rawArgv, '--priority');

    const closedIds = new Set(issues.filter((i) => i.status === 'closed').map((i) => i.id));

    let open = issues.filter((i) => i.status === 'open');
    let ready = open.filter((i) => isUnblocked(i, closedIds));

    if (filterPhase) ready = ready.filter((i) => i.phase === filterPhase);
    if (filterPriority) ready = ready.filter((i) => i.priority === filterPriority);

    ready = sortByPriority(ready);

    if (asJson) {
      print(ready, true);
    } else {
      if (ready.length === 0) {
        process.stdout.write('No ready beads found.\n');
      } else {
        process.stdout.write(`Ready to work on (${ready.length} beads):\n\n`);
        for (const v of ready) {
          const pri = formatPriority(v.priority);
          const phase = v.phase ? ` [${v.phase}]` : '';
          process.stdout.write(`  ${v.id} ${pri}${phase} ${v.title}\n`);
        }
      }
    }
    return;
  }

  // ── view ──────────────────────────────────────────────────────────────────
  if (verb === 'view') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue view.');
    const idx = findIssueIndex(issues, id);
    if (asJson) {
      process.stdout.write(JSON.stringify(issues[idx], null, 2) + '\n');
    } else {
      printView(issues[idx]);
    }
    return;
  }

  // ── create ────────────────────────────────────────────────────────────────
  if (verb === 'create') {
    const title = readOption(rawArgv, '--title');
    if (!title) fail('Missing --title for issue create.');

    const priority = readOption(rawArgv, '--priority');
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      fail(`Invalid priority "${priority}". Expected one of: ${VALID_PRIORITIES.join(', ')}.`);
    }

    const phase = readOption(rawArgv, '--phase');
    const body = readOption(rawArgv, '--body');
    const blockedByRaw = readOption(rawArgv, '--blocked-by');
    const blockedBy = parseBlockedBy(blockedByRaw);

    const id = nextIssueId(issues);
    const now = nowIsoUtc();
    const issue = {
      id,
      title: title.trim(),
      status: 'open',
      ...(priority ? { priority } : {}),
      ...(phase ? { phase } : {}),
      ...(blockedBy ? { blockedBy } : {}),
      ...(body ? { body: body.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    writeIssues(root, issues);
    print(issue, asJson);
    return;
  }

  // ── close ─────────────────────────────────────────────────────────────────
  if (verb === 'close') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue close.');
    const updated = applyUpdate(issues, id, { status: 'closed' });
    writeIssues(root, issues);
    print(updated, asJson);
    return;
  }

  // ── reopen ────────────────────────────────────────────────────────────────
  if (verb === 'reopen') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue reopen.');
    const updated = applyUpdate(issues, id, { status: 'open' });
    writeIssues(root, issues);
    print(updated, asJson);
    return;
  }

  // ── update ────────────────────────────────────────────────────────────────
  if (verb === 'update') {
    const id = rest[0];
    if (!isNonEmptyString(id)) fail('Missing issue id for issue update.');
    const idx = findIssueIndex(issues, id);
    const changes = buildUpdateChanges(rawArgv, issues[idx]);
    if (Object.keys(changes).length === 0) fail('No changes specified for issue update.');
    const updated = applyUpdate(issues, id, changes);
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

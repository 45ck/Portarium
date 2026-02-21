#!/usr/bin/env node
/**
 * verify-bd-integration.mjs
 *
 * Smoke-tests every piece of the upstream bd integration.
 * Run with:  node scripts/beads/verify-bd-integration.mjs
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BEADS_DIR = path.join(ROOT, '.beads');
const BD_BIN_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'bd');
const ENV = {
  ...process.env,
  PATH: `${BD_BIN_DIR};${process.env.PATH ?? ''}`,
};

let passed = 0;
let failed = 0;
const failures = [];

function run(cmd, args = [], opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', env: ENV, cwd: ROOT, ...opts });
}

function check(label, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`  ✓  ${label}`);
      passed++;
    } else {
      console.log(`  ✗  ${label}`);
      console.log(`     → ${result}`);
      failed++;
      failures.push(label);
    }
  } catch (e) {
    console.log(`  ✗  ${label}`);
    console.log(`     → ${e.message}`);
    failed++;
    failures.push(label);
  }
}

// ─── 1. Binary ────────────────────────────────────────────────────────────────
console.log('\n── 1. Binary ──');

check('bd is on PATH or at known location', () => {
  const r = run('bd', ['version']);
  if (r.status !== 0) return r.stderr || 'exit code ' + r.status;
  if (!r.stdout.includes('bd version')) return 'unexpected output: ' + r.stdout;
  return true;
});

check('bd version is >= 0.55.4', () => {
  const r = run('bd', ['version']);
  const m = r.stdout.match(/bd version (\d+\.\d+\.\d+)/);
  if (!m) return 'could not parse version from: ' + r.stdout;
  const [maj, min, patch] = m[1].split('.').map(Number);
  if (maj > 0 || (maj === 0 && min > 55) || (maj === 0 && min === 55 && patch >= 4)) return true;
  return `version ${m[1]} is below 0.55.4`;
});

// ─── 2. Database ──────────────────────────────────────────────────────────────
console.log('\n── 2. Database ──');

check('.beads/dolt/ directory exists', () => {
  const p = path.join(BEADS_DIR, 'dolt');
  return fs.existsSync(p) || 'missing ' + p;
});

check('bd list returns issues', () => {
  const r = run('bd', ['list', '--json'], { cwd: ROOT });
  if (r.status !== 0) return r.stderr || 'exit ' + r.status;
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    return 'invalid JSON: ' + r.stdout.slice(0, 200);
  }
  if (!Array.isArray(data) || data.length === 0) return 'empty or non-array result';
  return true;
});

check('issue count >= 800 (all 805 imported)', () => {
  // --all includes closed, -n 0 = unlimited
  const r = run('bd', ['list', '--all', '--json', '-n', '0'], { cwd: ROOT });
  if (r.status !== 0) return r.stderr;
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    return 'invalid JSON';
  }
  if (data.length < 800) return `only ${data.length} issues in DB (expected 805)`;
  console.log(`     → ${data.length} total issues in Dolt DB (inc. closed)`);
  return true;
});

check('bd ready returns unblocked issues', () => {
  const r = run('bd', ['ready', '--json'], { cwd: ROOT });
  if (r.status !== 0) return r.stderr || 'exit ' + r.status;
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    return 'invalid JSON: ' + r.stdout.slice(0, 200);
  }
  if (!Array.isArray(data) || data.length === 0) return 'no ready issues returned';
  console.log(`     → ${data.length} ready issues`);
  return true;
});

// ─── 3. Config ────────────────────────────────────────────────────────────────
console.log('\n── 3. Config ──');

check('.beads/config.yaml exists', () => {
  const p = path.join(BEADS_DIR, 'config.yaml');
  return fs.existsSync(p) || 'missing ' + p;
});

check('.beads/config.yaml has issue-prefix: bead', () => {
  const p = path.join(BEADS_DIR, 'config.yaml');
  const content = fs.readFileSync(p, 'utf8');
  return (
    content.includes('issue-prefix: "bead"') ||
    content.includes("issue-prefix: 'bead'") ||
    'missing issue-prefix in config.yaml'
  );
});

check('.gitignore excludes beads.db and bd.sock', () => {
  const content = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  if (!content.includes('.beads/beads.db')) return 'missing .beads/beads.db entry';
  if (!content.includes('.beads/bd.sock')) return 'missing .beads/bd.sock entry';
  return true;
});

// ─── 4. Git hooks ─────────────────────────────────────────────────────────────
console.log('\n── 4. Git hooks ──');

// bd hooks install sets core.hooksPath = .beads/hooks (not .git/hooks)
check('git core.hooksPath points to .beads/hooks', () => {
  const r = run('git', ['config', 'core.hooksPath'], { cwd: ROOT });
  if (r.status !== 0) return 'git config core.hooksPath not set';
  const val = r.stdout.trim();
  if (!val.includes('.beads/hooks')) return `core.hooksPath = "${val}", expected .beads/hooks`;
  console.log(`     → core.hooksPath = ${val}`);
  return true;
});

check('.beads/hooks/ directory has hook scripts', () => {
  const p = path.join(BEADS_DIR, 'hooks');
  if (!fs.existsSync(p)) return 'missing .beads/hooks/';
  const files = fs.readdirSync(p).filter((f) => !f.endsWith('.backup'));
  if (files.length === 0) return 'no hook scripts in .beads/hooks/';
  console.log(`     → hooks: ${files.join(', ')}`);
  return true;
});

// ─── 5. MCP server ────────────────────────────────────────────────────────────
console.log('\n── 5. MCP server ──');

check('beads-mcp is installed (Python)', () => {
  const r = spawnSync('beads-mcp', ['--version'], { encoding: 'utf8', env: process.env });
  // beads-mcp may not have --version but should at least be findable
  if (r.error && r.error.code === 'ENOENT') return 'beads-mcp not found on PATH';
  return true; // any other response means it's installed
});

check('.mcp.json has beads server entry', () => {
  const p = path.join(ROOT, '.mcp.json');
  if (!fs.existsSync(p)) return 'missing .mcp.json';
  const config = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!config.mcpServers?.beads) return 'no "beads" entry in .mcp.json mcpServers';
  return true;
});

// ─── 6. Claude integration ────────────────────────────────────────────────────
console.log('\n── 6. Claude integration ──');

check('~/.claude/settings.json has beads hooks', () => {
  const p = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(p)) return 'missing ~/.claude/settings.json';
  const settings = JSON.parse(fs.readFileSync(p, 'utf8'));
  const hooks = settings.hooks;
  if (!hooks) return 'no hooks in settings.json';
  const hasSessionStart = Object.keys(hooks).some(
    (k) => k === 'SessionStart' || k === 'session_start',
  );
  if (!hasSessionStart) return 'no SessionStart hook found';
  return true;
});

// ─── 7. Custom bd.mjs ─────────────────────────────────────────────────────────
console.log('\n── 7. Custom bd.mjs ──');

check('npm run bd -- issue list works', () => {
  // Use shell:true so npm.cmd resolves on Windows
  const r = spawnSync('npm run bd -- issue list --json', [], {
    shell: true,
    encoding: 'utf8',
    cwd: ROOT,
    env: ENV,
  });
  if (r.status !== 0) return r.stderr?.slice(0, 300) || 'exit ' + r.status;
  const jsonStart = r.stdout.indexOf('[');
  if (jsonStart === -1) return 'no JSON array in output';
  let data;
  try {
    data = JSON.parse(r.stdout.slice(jsonStart));
  } catch {
    return 'invalid JSON';
  }
  if (!Array.isArray(data)) return 'non-array result';
  console.log(`     → ${data.length} issues from bd.mjs`);
  return true;
});

check('npm run bd -- issue next works', () => {
  const r = spawnSync('npm run bd -- issue next --json', [], {
    shell: true,
    encoding: 'utf8',
    cwd: ROOT,
    env: ENV,
  });
  if (r.status !== 0) return r.stderr?.slice(0, 300) || 'exit ' + r.status;
  return true;
});

check('bd.mjs normalizePriority handles integers', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/beads/bd.mjs'), 'utf8');
  if (!src.includes('normalizePriority')) return 'normalizePriority not defined';
  if (!src.includes("typeof p === 'number'")) return 'integer handling missing';
  return true;
});

// ─── 8. Package scripts ───────────────────────────────────────────────────────
console.log('\n── 8. Package scripts ──');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (const script of [
  'bd:sync',
  'bd:ready',
  'bd:daemon:start',
  'bd:daemon:stop',
  'bd:doctor',
  'bd:prime',
  'bd:dep',
]) {
  check(`package.json has "${script}" script`, () => {
    return script in pkg.scripts || `script "${script}" missing`;
  });
}

// ─── 9. AGENTS.md / CLAUDE.md ─────────────────────────────────────────────────
console.log('\n── 9. Documentation ──');

check('AGENTS.md has Beads Workflow section', () => {
  const content = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  return content.includes('## Beads Workflow') || 'missing ## Beads Workflow section';
});

check('CLAUDE.md has upstream bd commands', () => {
  const content = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  return content.includes('bd ready') || 'missing bd ready in CLAUDE.md';
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('\nAll checks passed. bd integration is healthy ✓');
}

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

const priorityToUpstream = new Map([
  ['P0', 0],
  ['P1', 1],
  ['P2', 2],
  ['P3', 3],
]);

export function normalizeIssueForUpstreamImport(issue) {
  if (!issue || typeof issue !== 'object') return issue;
  const next = { ...issue };
  if (typeof next.priority === 'string') {
    const priority = priorityToUpstream.get(next.priority.toUpperCase());
    if (priority !== undefined) {
      next.priority = priority;
    }
  }
  return next;
}

export function normalizeIssuesJsonlForUpstreamImport(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.stringify(normalizeIssueForUpstreamImport(JSON.parse(line))))
    .join('\n')
    .concat('\n');
}

export function isMissingSyncCommand(result) {
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  return result?.status !== 0 && /unknown command "sync" for "bd"/i.test(output);
}

export function isMissingDoltDatabase(result) {
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  return (
    result?.status !== 0 && /database "?bead"? not found|database not found: bead/i.test(output)
  );
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
}

function writeTemporaryImportFile(issuesPath) {
  const raw = fs.readFileSync(issuesPath, 'utf8');
  const normalized = normalizeIssuesJsonlForUpstreamImport(raw);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-bd-sync-'));
  const tempPath = path.join(tempDir, 'issues.upstream.jsonl');
  fs.writeFileSync(tempPath, normalized, 'utf8');
  return { tempDir, tempPath };
}

function ensureDoltDatabase(root, spawn, env) {
  const doltDir = path.join(root, '.beads', 'dolt');
  if (!fs.existsSync(doltDir)) {
    return {
      status: 1,
      stdout: '',
      stderr: `Cannot create Beads Dolt database because ${doltDir} does not exist.\n`,
    };
  }
  return spawn('dolt', ['sql', '-q', 'CREATE DATABASE IF NOT EXISTS bead;'], { cwd: doltDir, env });
}

export function syncBeads(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const bdBin = options.bdBin ?? process.env.BD_SYNC_BIN ?? 'bd';
  const issuesPath =
    options.issuesPath ??
    process.env.BD_SYNC_ISSUES_PATH ??
    path.join(root, '.beads', 'issues.jsonl');
  const env = options.env ?? process.env;
  const spawn = options.spawn ?? run;

  const syncResult = spawn(bdBin, ['sync'], { cwd: root, env });
  if (syncResult.status === 0) return syncResult;
  if (!isMissingSyncCommand(syncResult)) return syncResult;

  let temp;
  try {
    temp = writeTemporaryImportFile(issuesPath);
    let importResult = spawn(bdBin, ['import', temp.tempPath], { cwd: root, env });
    if (isMissingDoltDatabase(importResult)) {
      const ensureResult = ensureDoltDatabase(root, spawn, env);
      if (ensureResult.status !== 0) return ensureResult;
      importResult = spawn(bdBin, ['import', temp.tempPath], { cwd: root, env });
    }
    if (importResult.status === 0) {
      return {
        ...importResult,
        stdout: `${importResult.stdout ?? ''}bd sync unavailable; imported ${issuesPath} via modern bd import fallback.\n`,
      };
    }
    return importResult;
  } finally {
    if (temp) fs.rmSync(temp.tempDir, { recursive: true, force: true });
  }
}

function main() {
  const result = syncBeads();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

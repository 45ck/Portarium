import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

// The subject is a Node CLI script kept as ESM JavaScript so npm can run it directly.
// @ts-expect-error CLI .mjs modules do not publish TypeScript declarations.
import * as bdSyncModule from '../../../scripts/beads/bd-sync.mjs';

interface SpawnResult {
  status: number;
  stdout: string;
  stderr: string;
}

const {
  isMissingDoltDatabase,
  isMissingSyncCommand,
  normalizeIssueForUpstreamImport,
  normalizeIssuesJsonlForUpstreamImport,
  syncBeads,
} = bdSyncModule as {
  isMissingDoltDatabase: (result: SpawnResult) => boolean;
  isMissingSyncCommand: (result: SpawnResult) => boolean;
  normalizeIssueForUpstreamImport: (issue: Record<string, unknown>) => Record<string, unknown>;
  normalizeIssuesJsonlForUpstreamImport: (content: string) => string;
  syncBeads: (options: {
    root: string;
    issuesPath: string;
    bdBin: string;
    spawn: (cmd: string, args: string[]) => SpawnResult;
  }) => SpawnResult;
};

const tempDirs: string[] = [];

function tempRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-bd-sync-'));
  tempDirs.push(repo);
  fs.mkdirSync(path.join(repo, '.beads'), { recursive: true });
  return repo;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('bd sync compatibility wrapper', () => {
  it('converts repo-local priority strings for upstream bd import', () => {
    expect(normalizeIssueForUpstreamImport({ id: 'bead-1', priority: 'P0' })).toMatchObject({
      priority: 0,
    });
    expect(normalizeIssueForUpstreamImport({ id: 'bead-2', priority: 'P3' })).toMatchObject({
      priority: 3,
    });
    expect(normalizeIssueForUpstreamImport({ id: 'bead-3', priority: 2 })).toMatchObject({
      priority: 2,
    });
  });

  it('normalizes JSONL without mutating the tracked representation', () => {
    const raw = [
      JSON.stringify({ id: 'bead-1', title: 'One', status: 'open', priority: 'P1' }),
      JSON.stringify({ id: 'bead-2', title: 'Two', status: 'closed', priority: 'P2' }),
      '',
    ].join('\n');

    const normalized = normalizeIssuesJsonlForUpstreamImport(raw)
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { priority: number });

    expect(normalized.map((issue) => issue.priority)).toEqual([1, 2]);
    expect(raw).toContain('"priority":"P1"');
  });

  it('detects modern bd builds where sync is unavailable', () => {
    expect(
      isMissingSyncCommand({
        status: 1,
        stdout: '',
        stderr: 'Error: unknown command "sync" for "bd"',
      }),
    ).toBe(true);
    expect(isMissingSyncCommand({ status: 1, stdout: '', stderr: 'connection failed' })).toBe(
      false,
    );
  });

  it('detects missing worktree Dolt database errors', () => {
    expect(
      isMissingDoltDatabase({ status: 1, stdout: '', stderr: 'database "bead" not found' }),
    ).toBe(true);
    expect(
      isMissingDoltDatabase({ status: 1, stdout: '', stderr: 'database not found: bead' }),
    ).toBe(true);
    expect(isMissingDoltDatabase({ status: 1, stdout: '', stderr: 'permission denied' })).toBe(
      false,
    );
  });

  it('falls back to bd import using a temporary normalized JSONL file', () => {
    const repo = tempRepo();
    const issuesPath = path.join(repo, '.beads', 'issues.jsonl');
    fs.writeFileSync(
      issuesPath,
      `${JSON.stringify({ id: 'bead-1', title: 'One', status: 'open', priority: 'P1' })}\n`,
      'utf8',
    );
    const calls: { args: string[]; imported?: string }[] = [];

    const result = syncBeads({
      root: repo,
      issuesPath,
      bdBin: 'bd',
      spawn: (_cmd, args) => {
        calls.push({ args });
        if (args[0] === 'sync') {
          return { status: 1, stdout: '', stderr: 'Error: unknown command "sync" for "bd"' };
        }
        const imported = fs.readFileSync(String(args[1]), 'utf8');
        const latestCall = calls.at(-1);
        if (latestCall) latestCall.imported = imported;
        return { status: 0, stdout: 'imported\n', stderr: '' };
      },
    });

    expect(result.status).toBe(0);
    expect(calls.map((call) => call.args[0])).toEqual(['sync', 'import']);
    expect(calls[1]?.imported).toContain('"priority":1');
    expect(fs.readFileSync(issuesPath, 'utf8')).toContain('"priority":"P1"');
  });

  it('creates the expected Dolt database and retries import when worktree storage is empty', () => {
    const repo = tempRepo();
    fs.mkdirSync(path.join(repo, '.beads', 'dolt'), { recursive: true });
    const issuesPath = path.join(repo, '.beads', 'issues.jsonl');
    fs.writeFileSync(
      issuesPath,
      `${JSON.stringify({ id: 'bead-1', title: 'One', status: 'open', priority: 'P1' })}\n`,
      'utf8',
    );
    const calls: { cmd: string; args: string[] }[] = [];
    let importAttempts = 0;

    const result = syncBeads({
      root: repo,
      issuesPath,
      bdBin: 'bd',
      spawn: (cmd, args) => {
        calls.push({ cmd, args });
        if (args[0] === 'sync') {
          return { status: 1, stdout: '', stderr: 'Error: unknown command "sync" for "bd"' };
        }
        if (args[0] === 'import') {
          importAttempts++;
          if (importAttempts === 1) {
            return { status: 1, stdout: '', stderr: 'database "bead" not found' };
          }
          return { status: 0, stdout: 'imported\n', stderr: '' };
        }
        if (cmd === 'dolt') {
          return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: `unexpected ${cmd} ${args.join(' ')}` };
      },
    });

    expect(result.status).toBe(0);
    expect(calls.map((call) => `${call.cmd} ${call.args[0]}`)).toEqual([
      'bd sync',
      'bd import',
      'dolt sql',
      'bd import',
    ]);
  });
});

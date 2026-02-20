import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const BD_SCRIPT = fileURLToPath(new URL('../../../scripts/beads/bd.mjs', import.meta.url));
const BASE_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface IssueSeed {
  id: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  blockedBy?: string[];
}

const tempRepos: string[] = [];

function createTempRepo(issues: IssueSeed[]): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-bd-'));
  tempRepos.push(repo);
  const beadsDir = path.join(repo, '.beads');
  fs.mkdirSync(beadsDir, { recursive: true });
  const lines = issues.map((issue) => JSON.stringify(issue));
  fs.writeFileSync(path.join(beadsDir, 'issues.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  return repo;
}

function runBd(repo: string, args: string[]) {
  return spawnSync(process.execPath, [BD_SCRIPT, 'issue', ...args], {
    cwd: repo,
    encoding: 'utf8',
  });
}

function parseStdoutJson(result: { stdout: string }) {
  return JSON.parse(result.stdout.trim()) as unknown;
}

afterEach(() => {
  for (const repo of tempRepos.splice(0)) {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe('bd claim workflow', () => {
  it('claims an open bead and exposes claim metadata', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Claim target',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const claim = runBd(repo, ['claim', 'bead-0001', '--by', 'codex-agent', '--json']);
    expect(claim.status).toBe(0);
    const claimedIssue = parseStdoutJson(claim) as { claimedBy?: string; claimedAt?: string };
    expect(claimedIssue.claimedBy).toBe('codex-agent');
    expect(claimedIssue.claimedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const view = runBd(repo, ['view', 'bead-0001', '--json']);
    expect(view.status).toBe(0);
    const viewedIssue = parseStdoutJson(view) as { claimedBy?: string; claimedAt?: string };
    expect(viewedIssue.claimedBy).toBe('codex-agent');
    expect(viewedIssue.claimedAt).toBeTypeOf('string');
  });

  it('rejects claiming a bead already claimed by another owner unless forced', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Claim conflict',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const firstClaim = runBd(repo, ['claim', 'bead-0001', '--by', 'agent-a', '--json']);
    expect(firstClaim.status).toBe(0);

    const secondClaim = runBd(repo, ['claim', 'bead-0001', '--by', 'agent-b']);
    expect(secondClaim.status).toBe(1);
    expect(secondClaim.stderr).toContain('already claimed');

    const forcedClaim = runBd(repo, ['claim', 'bead-0001', '--by', 'agent-b', '--force', '--json']);
    expect(forcedClaim.status).toBe(0);
    const forced = parseStdoutJson(forcedClaim) as { claimedBy?: string };
    expect(forced.claimedBy).toBe('agent-b');
  });

  it('supports claim-aware list and next filters', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Claimed ready bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0002',
        title: 'Unclaimed ready bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    expect(runBd(repo, ['claim', 'bead-0001', '--by', 'agent-a']).status).toBe(0);

    const claimedOnly = runBd(repo, ['list', '--open', '--claimed', '--json']);
    expect(claimedOnly.status).toBe(0);
    const claimedIssues = parseStdoutJson(claimedOnly) as { id: string }[];
    expect(claimedIssues.map((issue) => issue.id)).toEqual(['bead-0001']);

    const unclaimedReady = runBd(repo, ['next', '--unclaimed', '--json']);
    expect(unclaimedReady.status).toBe(0);
    const unclaimedIssues = parseStdoutJson(unclaimedReady) as { id: string }[];
    expect(unclaimedIssues.map((issue) => issue.id)).toEqual(['bead-0002']);
  });

  it('unclaims and auto-clears claim metadata when a bead is closed', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Closable bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    expect(runBd(repo, ['claim', 'bead-0001', '--by', 'agent-a']).status).toBe(0);

    const mismatchedUnclaim = runBd(repo, ['unclaim', 'bead-0001', '--by', 'agent-b']);
    expect(mismatchedUnclaim.status).toBe(1);
    expect(mismatchedUnclaim.stderr).toContain('Use --force to clear');

    const forcedUnclaim = runBd(repo, [
      'unclaim',
      'bead-0001',
      '--by',
      'agent-b',
      '--force',
      '--json',
    ]);
    expect(forcedUnclaim.status).toBe(0);
    const unclaimedIssue = parseStdoutJson(forcedUnclaim) as { claimedBy?: string };
    expect(unclaimedIssue.claimedBy).toBeUndefined();

    expect(runBd(repo, ['claim', 'bead-0001', '--by', 'agent-a']).status).toBe(0);
    const close = runBd(repo, ['close', 'bead-0001', '--json']);
    expect(close.status).toBe(0);
    const closedIssue = parseStdoutJson(close) as {
      status: string;
      claimedBy?: string;
      claimedAt?: string;
    };
    expect(closedIssue.status).toBe('closed');
    expect(closedIssue.claimedBy).toBeUndefine
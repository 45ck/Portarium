import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const AUDIT_SCRIPT = fileURLToPath(
  new URL('../../../scripts/beads/generate-weekly-pe-audit.mjs', import.meta.url),
);
const BASE_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface IssueSeed {
  id: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  blockedBy?: string[];
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  phase?: string;
}

const tempRepos: string[] = [];

function createTempRepo(issues: IssueSeed[]): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-pe-audit-'));
  tempRepos.push(repo);
  const beadsDir = path.join(repo, '.beads');
  fs.mkdirSync(beadsDir, { recursive: true });
  const lines = issues.map((issue) => JSON.stringify(issue));
  fs.writeFileSync(path.join(beadsDir, 'issues.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  return repo;
}

function runAudit(repo: string, args: string[] = []) {
  return spawnSync(process.execPath, [AUDIT_SCRIPT, ...args], {
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

describe('generate-weekly-pe-audit', () => {
  it('flags orphan beads and deadlock cycles in JSON output', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Orphan candidate',
        status: 'open',
        priority: 'P1',
        phase: 'governance',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0002',
        title: 'Deadlock A',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
        blockedBy: ['bead-0003'],
      },
      {
        id: 'bead-0003',
        title: 'Deadlock B',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
        blockedBy: ['bead-0002'],
      },
      {
        id: 'bead-0004',
        title: 'Dependent bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
        blockedBy: ['bead-0002'],
      },
      {
        id: 'bead-0005',
        title: 'Closed bead',
        status: 'closed',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const result = runAudit(repo, ['--json']);
    expect(result.status).toBe(0);

    const report = parseStdoutJson(result) as {
      snapshot: {
        orphanCount: number;
        deadlockCycleCount: number;
      };
      orphans: { id: string }[];
      deadlocks: { beads: string[] }[];
    };

    expect(report.snapshot.orphanCount).toBe(1);
    expect(report.orphans.map((entry) => entry.id)).toEqual(['bead-0001']);
    expect(report.snapshot.deadlockCycleCount).toBe(1);
    expect(report.deadlocks).toHaveLength(1);
    expect(report.deadlocks[0]?.beads).toEqual(['bead-0002', 'bead-0003']);
  });

  it('writes the weekly report artifact and supports check mode', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Simple open bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const generate = runAudit(repo);
    expect(generate.status).toBe(0);

    const outputPath = path.join(repo, 'docs', 'governance', 'weekly-pe-audit.md');
    const markdown = fs.readFileSync(outputPath, 'utf8');
    expect(markdown).toContain('# Weekly PE Audit: Orphaned Beads And Dependency Deadlocks');
    expect(markdown).toContain('| bead-0001 |');

    const check = runAudit(repo, ['--check']);
    expect(check.status).toBe(0);
  });
});

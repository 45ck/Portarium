import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const STOP_LOSS_SCRIPT = fileURLToPath(
  new URL('../../../scripts/beads/evaluate-stop-loss-thresholds.mjs', import.meta.url),
);
const BASE_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface IssueSeed {
  id: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  body?: string;
  blockedBy?: string[];
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
}

const tempRepos: string[] = [];

function createTempRepo(issues: IssueSeed[]): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-stop-loss-'));
  tempRepos.push(repo);
  const beadsDir = path.join(repo, '.beads');
  fs.mkdirSync(beadsDir, { recursive: true });
  const lines = issues.map((issue) => JSON.stringify(issue));
  fs.writeFileSync(path.join(beadsDir, 'issues.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  return repo;
}

function runStopLoss(repo: string, args: string[] = []) {
  return spawnSync(process.execPath, [STOP_LOSS_SCRIPT, ...args], {
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

describe('evaluate-stop-loss-thresholds', () => {
  it('halts when thresholds are exceeded', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Spec decision A',
        status: 'open',
        blockedBy: ['bead-0002'],
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0002',
        title: 'ADR decision B',
        status: 'open',
        blockedBy: ['bead-0001'],
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0003',
        title: 'Spec decision C',
        status: 'open',
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0004',
        title: 'Spec decision D',
        status: 'open',
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0005',
        title: 'Spec decision E',
        status: 'open',
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0006',
        title: 'Spec decision F',
        status: 'open',
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0007',
        title: 'Spec decision G',
        status: 'open',
        priority: 'P0',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0008',
        title: 'Spec decision H',
        status: 'open',
        priority: 'P1',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const result = runStopLoss(repo, ['--json', '--failed-gates', 'ci:pr']);
    expect(result.status).toBe(0);

    const report = parseStdoutJson(result) as {
      metrics: {
        deadlockCycles: number;
        unresolvedOpenDecisions: number;
      };
      risk: {
        score: number;
      };
      decision: {
        shouldHalt: boolean;
        reasons: string[];
      };
    };

    expect(report.metrics.deadlockCycles).toBe(1);
    expect(report.metrics.unresolvedOpenDecisions).toBe(8);
    expect(report.risk.score).toBeGreaterThanOrEqual(6);
    expect(report.decision.shouldHalt).toBe(true);
    expect(report.decision.reasons.length).toBeGreaterThan(0);

    const enforce = runStopLoss(repo, ['--json', '--failed-gates', 'ci:pr', '--enforce']);
    expect(enforce.status).toBe(1);
    expect(enforce.stderr).toContain('Stop-loss halt triggered');
  });

  it('writes status artifact and passes check mode when stable', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Simple implementation bead',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0002',
        title: 'Closed decision bead',
        status: 'closed',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const generate = runStopLoss(repo);
    expect(generate.status).toBe(0);

    const outputPath = path.join(repo, 'docs', 'governance', 'stop-loss-thresholds-status.md');
    const markdown = fs.readFileSync(outputPath, 'utf8');
    expect(markdown).toContain('# Stop-Loss Threshold Evaluation');
    expect(markdown).toContain('Halt cycle: no');

    const check = runStopLoss(repo, ['--check']);
    expect(check.status).toBe(0);
  });
});

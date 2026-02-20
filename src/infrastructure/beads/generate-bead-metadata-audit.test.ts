import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const AUDIT_SCRIPT = fileURLToPath(
  new URL('../../../scripts/beads/generate-bead-metadata-audit.mjs', import.meta.url),
);
const BASE_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface IssueSeed {
  id: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  body?: string;
  owner?: string;
  closeCriteria?: string;
  rollbackTrigger?: string;
  claimedBy?: string;
  claimedAt?: string;
}

const tempRepos: string[] = [];

function createTempRepo(issues: IssueSeed[]): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-meta-audit-'));
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

describe('generate-bead-metadata-audit', () => {
  it('flags missing owner, close criteria, and rollback trigger', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Fully compliant via body + claim owner',
        status: 'open',
        claimedBy: 'codex-agent',
        claimedAt: BASE_TIMESTAMP,
        body: 'AC: complete all tasks. rollback if quality gate fails.',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0002',
        title: 'Missing close and rollback',
        status: 'open',
        owner: 'principal-engineer',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
      {
        id: 'bead-0003',
        title: 'Missing owner only',
        status: 'open',
        closeCriteria: 'Tests pass',
        rollbackTrigger: 'On regression',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const result = runAudit(repo, ['--json']);
    expect(result.status).toBe(0);
    const report = parseStdoutJson(result) as {
      summary: {
        nonCompliantBeads: number;
        missingOwner: number;
        missingCloseCriteria: number;
        missingRollbackTrigger: number;
      };
      nonCompliant: { id: string; missing: string[] }[];
    };

    expect(report.summary.nonCompliantBeads).toBe(2);
    expect(report.summary.missingOwner).toBe(1);
    expect(report.summary.missingCloseCriteria).toBe(1);
    expect(report.summary.missingRollbackTrigger).toBe(1);
    expect(report.nonCompliant.map((entry) => entry.id)).toEqual(['bead-0002', 'bead-0003']);
    expect(report.nonCompliant[0]?.missing).toEqual(['closeCriteria', 'rollbackTrigger']);
    expect(report.nonCompliant[1]?.missing).toEqual(['owner']);
  });

  it('supports check mode and enforce mode', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Missing metadata',
        status: 'open',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const generate = runAudit(repo);
    expect(generate.status).toBe(0);

    const outputPath = path.join(repo, 'docs', 'governance', 'bead-metadata-audit.md');
    expect(fs.readFileSync(outputPath, 'utf8')).toContain('# Bead Metadata Audit');

    const check = runAudit(repo, ['--check']);
    expect(check.status).toBe(0);

    const enforce = runAudit(repo, ['--json', '--enforce']);
    expect(enforce.status).toBe(1);
    expect(enforce.stderr).toContain('Metadata audit failed');
  });
});

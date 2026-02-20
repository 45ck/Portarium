import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const AUDIT_SCRIPT = fileURLToPath(
  new URL('../../../scripts/beads/generate-bead-acceptance-scorecard.mjs', import.meta.url),
);
const BASE_TIMESTAMP = '2026-02-20T00:00:00.000Z';

interface IssueSeed {
  id: string;
  title: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  body?: string;
  phase?: string;
}

const tempRepos: string[] = [];

function createTempRepo(issues: IssueSeed[], linkageMap: Record<string, unknown> = {}): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-scorecard-audit-'));
  tempRepos.push(repo);

  const beadsDir = path.join(repo, '.beads');
  fs.mkdirSync(beadsDir, { recursive: true });
  const lines = issues.map((issue) => JSON.stringify(issue));
  fs.writeFileSync(path.join(beadsDir, 'issues.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(beadsDir, 'bead-linkage-map.json'), JSON.stringify(linkageMap, null, 2), 'utf8');
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

describe('generate-bead-acceptance-scorecard', () => {
  it('scores open beads and reports missing criteria in JSON mode', () => {
    const repo = createTempRepo(
      [
        {
          id: 'bead-0001',
          title: 'Spec and test and review docs with security and performance',
          status: 'open',
          phase: 'security',
          body: 'Spec coverage test review docs security performance.',
          createdAt: BASE_TIMESTAMP,
          updatedAt: BASE_TIMESTAMP,
        },
        {
          id: 'bead-0002',
          title: 'Spec and review only',
          status: 'open',
          body: 'Spec and review notes.',
          createdAt: BASE_TIMESTAMP,
          updatedAt: BASE_TIMESTAMP,
        },
        {
          id: 'bead-0003',
          title: 'Closed bead should not be scored',
          status: 'closed',
          createdAt: BASE_TIMESTAMP,
          updatedAt: BASE_TIMESTAMP,
        },
      ],
      {
        'bead-0002': {
          specPaths: ['.specify/specs/example.md'],
          reviewBeads: ['bead-1000'],
        },
      },
    );

    const result = runAudit(repo, ['--json']);
    expect(result.status).toBe(0);

    const report = parseStdoutJson(result) as {
      summary: {
        openBeads: number;
        green: number;
        red: number;
        missingTests: number;
        missingDocs: number;
      };
      entries: { id: string; band: string }[];
    };

    expect(report.summary.openBeads).toBe(2);
    expect(report.summary.green).toBe(1);
    expect(report.summary.red).toBe(1);
    expect(report.summary.missingTests).toBe(1);
    expect(report.summary.missingDocs).toBe(1);
    expect(report.entries.map((entry) => entry.id)).toEqual(['bead-0001', 'bead-0002']);
    expect(report.entries[0]?.band).toBe('green');
    expect(report.entries[1]?.band).toBe('red');
  });

  it('writes the scorecard artifact and supports check mode', () => {
    const repo = createTempRepo([
      {
        id: 'bead-0001',
        title: 'Spec test review docs',
        status: 'open',
        body: 'spec test review docs',
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ]);

    const generate = runAudit(repo);
    expect(generate.status).toBe(0);

    const outputPath = path.join(repo, 'docs', 'governance', 'bead-acceptance-scorecard.md');
    const markdown = fs.readFileSync(outputPath, 'utf8');
    expect(markdown).toContain('# Bead Acceptance Scorecard');
    expect(markdown).toContain('| bead-0001 |');

    const check = runAudit(repo, ['--check']);
    expect(check.status).toBe(0);
  });
});

/**
 * Contract tests for the runnable-state smoke CI workflow (bead-0737).
 *
 * Validates the structure and correctness of the GitHub Actions workflow
 * that gates the governed-run smoke pipeline.
 *
 * Bead: bead-0737
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// In a git worktree at .trees/bead-XXXX/, __dirname resolves inside the worktree.
// Walk up until we find package.json that contains "portarium" to locate repo root.
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      const content = fs.readFileSync(pkg, 'utf8');
      if (content.includes('"portarium"')) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(import.meta.dirname, '../../../../');
}

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github/workflows/runnable-state-smoke.yml');
const SMOKE_TEST_PATH = path.join(
  REPO_ROOT,
  'src/infrastructure/adapters/governed-run-smoke.test.ts',
);
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readWorkflow(): string {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

function readPackageJson(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// File presence
// ---------------------------------------------------------------------------

describe('runnable-state CI — file presence', () => {
  it('workflow file exists', () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('governed-run smoke test file exists', () => {
    expect(fs.existsSync(SMOKE_TEST_PATH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Workflow triggers
// ---------------------------------------------------------------------------

describe('runnable-state CI — workflow triggers', () => {
  it('triggers on pull_request', () => {
    expect(readWorkflow()).toContain('pull_request:');
  });

  it('triggers on push to main', () => {
    const wf = readWorkflow();
    expect(wf).toContain('push:');
    expect(wf).toContain('main');
  });

  it('triggers on workflow_dispatch', () => {
    expect(readWorkflow()).toContain('workflow_dispatch:');
  });

  it('has integration_mode dispatch input', () => {
    expect(readWorkflow()).toContain('integration_mode:');
  });

  it('pull_request paths include smoke test file', () => {
    expect(readWorkflow()).toContain('governed-run-smoke.test.ts');
  });

  it('pull_request paths include submit-approval command', () => {
    expect(readWorkflow()).toContain('submit-approval.ts');
  });

  it('pull_request paths include application ports', () => {
    expect(readWorkflow()).toContain('src/application/ports/**');
  });

  it('pull_request paths include domain primitives', () => {
    expect(readWorkflow()).toContain('src/domain/primitives/**');
  });
});

// ---------------------------------------------------------------------------
// Unit-smoke job
// ---------------------------------------------------------------------------

describe('runnable-state CI — unit-smoke job', () => {
  it('has unit-smoke job', () => {
    expect(readWorkflow()).toContain('unit-smoke:');
  });

  it('unit-smoke runs on ubuntu-latest', () => {
    const wf = readWorkflow();
    const unitSmokeSection = wf.slice(wf.indexOf('unit-smoke:'));
    expect(unitSmokeSection.slice(0, 500)).toContain('ubuntu-latest');
  });

  it('unit-smoke uses Node 24', () => {
    const wf = readWorkflow();
    const unitSmokeSection = wf.slice(wf.indexOf('unit-smoke:'));
    expect(unitSmokeSection.slice(0, 500)).toContain('node-version: 24');
  });

  it('unit-smoke runs npm ci', () => {
    const wf = readWorkflow();
    const unitSmokeSection = wf.slice(wf.indexOf('unit-smoke:'));
    expect(unitSmokeSection.slice(0, 500)).toContain('npm ci');
  });

  it('unit-smoke runs the governed-run smoke test', () => {
    const wf = readWorkflow();
    const unitSmokeSection = wf.slice(wf.indexOf('unit-smoke:'));
    expect(unitSmokeSection.slice(0, 1000)).toContain('governed-run-smoke.test.ts');
  });

  it('unit-smoke runs typecheck', () => {
    const wf = readWorkflow();
    const unitSmokeSection = wf.slice(wf.indexOf('unit-smoke:'));
    expect(unitSmokeSection.slice(0, 1000)).toContain('noEmit');
  });
});

// ---------------------------------------------------------------------------
// Integration-smoke job
// ---------------------------------------------------------------------------

describe('runnable-state CI — integration-smoke job', () => {
  it('has integration-smoke job', () => {
    expect(readWorkflow()).toContain('integration-smoke:');
  });

  it('integration-smoke is gated on workflow_dispatch with integration_mode=true', () => {
    const wf = readWorkflow();
    const integSection = wf.slice(wf.indexOf('integration-smoke:'));
    expect(integSection.slice(0, 500)).toContain('workflow_dispatch');
    expect(integSection.slice(0, 500)).toContain('integration_mode');
  });

  it('integration-smoke sets GOVERNED_RUN_INTEGRATION env var', () => {
    const wf = readWorkflow();
    const integSection = wf.slice(wf.indexOf('integration-smoke:'));
    expect(integSection.slice(0, 2000)).toContain('GOVERNED_RUN_INTEGRATION');
  });

  it('integration-smoke sets LOCAL_STACK_URL env var', () => {
    const wf = readWorkflow();
    const integSection = wf.slice(wf.indexOf('integration-smoke:'));
    expect(integSection.slice(0, 2000)).toContain('LOCAL_STACK_URL');
  });

  it('integration-smoke has a health-checked service', () => {
    const wf = readWorkflow();
    const integSection = wf.slice(wf.indexOf('integration-smoke:'));
    expect(integSection.slice(0, 2000)).toContain('health-cmd');
  });

  it('integration-smoke runs the governed-run smoke test', () => {
    const wf = readWorkflow();
    const integSection = wf.slice(wf.indexOf('integration-smoke:'));
    expect(integSection.slice(0, 2000)).toContain('governed-run-smoke.test.ts');
  });
});

// ---------------------------------------------------------------------------
// Gate job
// ---------------------------------------------------------------------------

describe('runnable-state CI — gate job', () => {
  it('has gate job', () => {
    expect(readWorkflow()).toContain('gate:');
  });

  it('gate runs if: always()', () => {
    const wf = readWorkflow();
    const gateSection = wf.slice(wf.indexOf('gate:'));
    expect(gateSection.slice(0, 500)).toContain('always()');
  });

  it('gate needs unit-smoke', () => {
    const wf = readWorkflow();
    const gateSection = wf.slice(wf.indexOf('gate:'));
    expect(gateSection.slice(0, 500)).toContain('unit-smoke');
  });

  it('gate checks unit-smoke result', () => {
    const wf = readWorkflow();
    const gateSection = wf.slice(wf.indexOf('gate:'));
    expect(gateSection.slice(0, 1000)).toContain('unit-smoke.result');
  });

  it('gate exits non-zero on failure', () => {
    const wf = readWorkflow();
    const gateSection = wf.slice(wf.indexOf('gate:'));
    expect(gateSection.slice(0, 1000)).toContain('exit 1');
  });
});

// ---------------------------------------------------------------------------
// npm scripts
// ---------------------------------------------------------------------------

describe('runnable-state CI — npm scripts', () => {
  it('npm test script exists', () => {
    const pkg = readPackageJson();
    const scripts = pkg['scripts'] as Record<string, string> | undefined;
    expect(scripts?.['test']).toBeDefined();
  });

  it('npm typecheck script exists', () => {
    const pkg = readPackageJson();
    const scripts = pkg['scripts'] as Record<string, string> | undefined;
    expect(scripts?.['typecheck']).toBeDefined();
  });
});

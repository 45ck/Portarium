/**
 * Contract tests for cockpit-demo-ci.yml (bead-0728).
 *
 * Validates:
 *  - workflow YAML structure and job definitions
 *  - trigger path coverage for demo assets
 *  - validate job steps: test, dry-run, clip count, clip sections
 *  - regenerate-media job steps: puppeteer, pillow, ffmpeg, artifacts
 *  - gate job requires validate
 *  - npm scripts for gallery and dry-run are registered
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../../../');
const workflowPath = path.join(rootDir, '.github/workflows/cockpit-demo-ci.yml');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readWorkflow(): string {
  return fs.readFileSync(workflowPath, 'utf8');
}

// ---------------------------------------------------------------------------
// Workflow existence
// ---------------------------------------------------------------------------

describe('cockpit-demo-ci.yml exists', () => {
  it('workflow file exists at expected path', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('file is non-empty', () => {
    const content = readWorkflow();
    expect(content.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Trigger configuration
// ---------------------------------------------------------------------------

describe('workflow triggers', () => {
  const wf = () => readWorkflow();

  it('triggers on pull_request', () => {
    expect(wf()).toContain('pull_request:');
  });

  it('triggers on workflow_dispatch', () => {
    expect(wf()).toContain('workflow_dispatch:');
  });

  it('PR trigger covers demo clip specs path', () => {
    expect(wf()).toContain('docs/internal/ui/cockpit/demo-machine/**');
  });

  it('PR trigger covers render-demo-gallery.mjs', () => {
    expect(wf()).toContain('scripts/qa/render-demo-gallery.mjs');
  });

  it('PR trigger covers cockpit index.html', () => {
    expect(wf()).toContain('docs/internal/ui/cockpit/index.html');
  });

  it('PR trigger covers demo-gallery-pipeline test file', () => {
    expect(wf()).toContain('src/infrastructure/adapters/demo-gallery-pipeline.test.ts');
  });

  it('dispatch has regenerate_media input', () => {
    expect(wf()).toContain('regenerate_media');
  });
});

// ---------------------------------------------------------------------------
// Validate job
// ---------------------------------------------------------------------------

describe('validate job', () => {
  const wf = () => readWorkflow();

  it('has a validate job', () => {
    expect(wf()).toContain('validate:');
  });

  it('validate job runs demo gallery pipeline tests', () => {
    expect(wf()).toContain('demo-gallery-pipeline.test.ts');
  });

  it('validate job runs dry-run gallery script', () => {
    expect(wf()).toContain('cockpit:demo:gallery:dry-run');
  });

  it('validate job checks clip count with minimum 6', () => {
    expect(wf()).toContain('-lt 6');
  });

  it('validate job checks for required YAML sections', () => {
    expect(wf()).toContain('action: screenshot');
    expect(wf()).toContain('meta runner chapters pacing');
  });

  it('validate job uses node 24', () => {
    expect(wf()).toContain('node-version: 24');
  });
});

// ---------------------------------------------------------------------------
// Regenerate media job
// ---------------------------------------------------------------------------

describe('regenerate-media job', () => {
  const wf = () => readWorkflow();

  it('has a regenerate-media job', () => {
    expect(wf()).toContain('regenerate-media:');
  });

  it('regenerate-media job is conditional on workflow_dispatch with flag', () => {
    expect(wf()).toContain("regenerate_media == 'true'");
  });

  it('regenerate-media job installs Puppeteer browser', () => {
    expect(wf()).toContain('puppeteer browsers install');
  });

  it('regenerate-media job installs Pillow', () => {
    expect(wf()).toContain('Pillow');
  });

  it('regenerate-media job installs ffmpeg', () => {
    expect(wf()).toContain('ffmpeg');
  });

  it('regenerate-media job runs cockpit:demo:gallery', () => {
    expect(wf()).toContain('cockpit:demo:gallery');
  });

  it('regenerate-media job runs approvals-v2 showcase', () => {
    expect(wf()).toContain('cockpit:demo:approvals-v2:showcase');
  });

  it('regenerate-media job uploads gallery artifact', () => {
    expect(wf()).toContain('demo-gallery');
    expect(wf()).toContain('actions/upload-artifact@v4');
  });

  it('regenerate-media job retains artifacts for at least 30 days', () => {
    expect(wf()).toContain('retention-days: 30');
  });
});

// ---------------------------------------------------------------------------
// Gate job
// ---------------------------------------------------------------------------

describe('gate job', () => {
  const wf = () => readWorkflow();

  it('has a gate job', () => {
    expect(wf()).toContain('gate:');
  });

  it('gate job runs if: always()', () => {
    expect(wf()).toContain('if: always()');
  });

  it('gate job needs validate', () => {
    expect(wf()).toContain('needs: [validate]');
  });

  it('gate job checks validate result', () => {
    expect(wf()).toContain('needs.validate.result');
  });
});

// ---------------------------------------------------------------------------
// npm scripts
// ---------------------------------------------------------------------------

describe('npm script registration', () => {
  it('package.json has cockpit:demo:gallery script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.scripts['cockpit:demo:gallery']).toBeDefined();
    expect(pkg.scripts['cockpit:demo:gallery']).toContain('render-demo-gallery.mjs');
  });

  it('package.json has cockpit:demo:gallery:dry-run script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.scripts['cockpit:demo:gallery:dry-run']).toBeDefined();
    expect(pkg.scripts['cockpit:demo:gallery:dry-run']).toContain('--dry-run');
  });

  it('package.json has cockpit:demo:approvals-v2:showcase script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.scripts['cockpit:demo:approvals-v2:showcase']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Gallery script referenced in workflow matches real script path
// ---------------------------------------------------------------------------

describe('workflow references real files', () => {
  it('render-demo-gallery.mjs exists', () => {
    expect(fs.existsSync(path.join(rootDir, 'scripts/qa/render-demo-gallery.mjs'))).toBe(true);
  });

  it('render-approvals-v2-showcase.mjs exists', () => {
    expect(fs.existsSync(path.join(rootDir, 'scripts/qa/render-approvals-v2-showcase.mjs'))).toBe(
      true,
    );
  });

  it('demo-gallery-pipeline.test.ts exists', () => {
    expect(
      fs.existsSync(
        path.join(rootDir, 'src/infrastructure/adapters/demo-gallery-pipeline.test.ts'),
      ),
    ).toBe(true);
  });
});

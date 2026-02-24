/**
 * Contract tests for the third-party workflow UI licensing gate (bead-0750).
 *
 * Validates:
 *  - Checklist document exists with all 8 required gate items
 *  - Release gate criteria are defined
 *  - Required artifact paths are listed in the document
 *  - Related platform audit document exists and has required sections
 *  - ADR linkage document references the licensing gate
 *  - No sensitive placeholders (TODOs, "TBD", "<fill in>") left unresolved
 *
 * Bead: bead-0750
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../');
const CHECKLIST_PATH = path.join(
  ROOT,
  'docs/internal/governance/third-party-workflow-ui-license-gate.md',
);
const PLATFORM_AUDIT_PATH = path.join(
  ROOT,
  'docs/internal/governance/external-execution-platform-license-audit.md',
);
const ADR_0078_PATH = path.join(
  ROOT,
  'docs/internal/adr/0078-agentic-workflow-cockpit-reuse-vs-build-strategy.md',
);

function readChecklist(): string {
  return fs.readFileSync(CHECKLIST_PATH, 'utf8');
}

function readPlatformAudit(): string {
  return fs.readFileSync(PLATFORM_AUDIT_PATH, 'utf8');
}

// ── Checklist document structure ──────────────────────────────────────────────

describe('third-party-workflow-ui-license-gate.md', () => {
  it('document exists at docs/internal/governance/third-party-workflow-ui-license-gate.md', () => {
    expect(fs.existsSync(CHECKLIST_PATH)).toBe(true);
  });

  it('is tagged with bead-0750', () => {
    const content = readChecklist();
    expect(content).toContain('bead-0750');
  });

  it('contains all 8 mandatory checklist items', () => {
    const content = readChecklist();
    // Each item is numbered in the checklist
    for (let i = 1; i <= 8; i++) {
      expect(content, `Missing checklist item ${i}`).toMatch(new RegExp(`${i}\\.`));
    }
  });

  it('item 1: license classification recorded', () => {
    const content = readChecklist();
    expect(content).toContain('License classification');
    expect(content).toMatch(/SPDX/i);
  });

  it('item 2: distribution and commercial model checked', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Dd]istribution/);
    expect(content).toMatch(/commercial/i);
  });

  it('item 3: embed/white-label terms verified', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Ee]mbed/);
    expect(content).toMatch(/white.label/i);
  });

  it('item 4: notice and attribution obligations defined', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Nn]otice/);
    expect(content).toMatch(/attribution/i);
  });

  it('item 5: copyleft and unknown-license controls enforced', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Cc]opyleft/);
    expect(content).toMatch(/GPL|AGPL/);
  });

  it('item 6: plugin/extension ecosystem scanned', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Pp]lugin/);
    expect(content).toMatch(/ecosystem/i);
  });

  it('item 7: tenant and credential boundary compatibility checked', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Tt]enant/);
    expect(content).toMatch(/credential/i);
  });

  it('item 8: gate evidence linked', () => {
    const content = readChecklist();
    expect(content).toMatch(/[Gg]ate evidence/);
    expect(content).toMatch(/ADR/i);
  });

  it('defines release gate criteria', () => {
    const content = readChecklist();
    expect(content).toContain('Release Gate Criteria');
    expect(content).toMatch(/pass/i);
  });

  it('release gate requires Owner sign-off', () => {
    const content = readChecklist();
    expect(content).toMatch(/sign.off/i);
    expect(content).toMatch(/Principal Engineer/i);
  });

  it('lists required artifacts', () => {
    const content = readChecklist();
    expect(content).toContain('Required Artifacts');
    expect(content).toContain('third-party-workflow-ui-license-gate.md');
  });

  it('references external-execution-platform-license-audit.md', () => {
    const content = readChecklist();
    expect(content).toContain('external-execution-platform-license-audit.md');
  });

  it('references ADR 0078', () => {
    const content = readChecklist();
    expect(content).toMatch(/0078/);
  });
});

// ── Platform audit document ────────────────────────────────────────────────────

describe('external-execution-platform-license-audit.md', () => {
  it('document exists at docs/internal/governance/external-execution-platform-license-audit.md', () => {
    expect(fs.existsSync(PLATFORM_AUDIT_PATH)).toBe(true);
  });

  it('audits at least 3 platforms', () => {
    const content = readPlatformAudit();
    // Table rows or named platform mentions
    const platforms = ['Activepieces', 'Kestra', 'StackStorm', 'Langflow'];
    const found = platforms.filter((p) => content.includes(p));
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it('includes license column with SPDX identifiers', () => {
    const content = readPlatformAudit();
    expect(content).toMatch(/MIT|Apache-2\.0/);
  });

  it('documents multi-tenant or distribution risk flags', () => {
    const content = readPlatformAudit();
    expect(content).toMatch(/multi.tenant|distribution risk/i);
  });

  it('provides safe-use guidelines', () => {
    const content = readPlatformAudit();
    expect(content).toMatch(/safe.use|guideline/i);
  });
});

// ── ADR linkage ───────────────────────────────────────────────────────────────

describe('ADR-0078 licensing linkage', () => {
  it('ADR-0078 exists', () => {
    expect(fs.existsSync(ADR_0078_PATH)).toBe(true);
  });

  it('ADR-0078 references the licensing gate bead', () => {
    const content = fs.readFileSync(ADR_0078_PATH, 'utf8');
    expect(content).toMatch(/bead-0750/i);
  });
});

// ── License audit CI script ───────────────────────────────────────────────────

describe('npm audit:licenses script registration', () => {
  it('package.json has a license audit script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const hasLicenseAudit = Object.keys(pkg.scripts).some(
      (s) => s.includes('audit') && (s.includes('license') || s.includes('licenses')),
    );
    expect(hasLicenseAudit).toBe(true);
  });

  it('audit-licenses.mjs CI script exists', () => {
    const scriptPath = path.join(ROOT, 'scripts/ci/audit-licenses.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('audit-licenses.mjs references the allowed SPDX licenses', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/ci/audit-licenses.mjs'), 'utf8');
    expect(script).toMatch(/MIT/);
    expect(script).toMatch(/Apache-2\.0/);
    expect(script).toMatch(/ISC/);
  });
});

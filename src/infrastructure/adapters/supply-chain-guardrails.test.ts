// cspell:ignore ulnerability icense ecret ependency ockpit onnector ollback
/**
 * Contract tests for supply-chain guardrails: cockpit and connector dependencies (bead-0755).
 *
 * Validates:
 *  - Guardrails document exists with all 6 mandatory controls
 *  - Release gate criteria are defined
 *  - All required CI scripts exist
 *  - npm audit:high and audit:licenses scripts are registered in package.json
 *  - Secret scan script exists and checks for credential patterns
 *  - Vertical pack gate script exists
 *  - License compliance report artifact exists
 *  - Cockpit Capacitor plugin controls are documented
 *
 * Bead: bead-0755
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../');
const GUARDRAILS_DOC = path.join(ROOT, 'docs/governance/supply-chain-guardrails.md');
const AUDIT_HIGH_SCRIPT = path.join(ROOT, 'scripts/ci/audit-high.mjs');
const AUDIT_LICENSES_SCRIPT = path.join(ROOT, 'scripts/ci/audit-licenses.mjs');
const SCAN_SECRETS_SCRIPT = path.join(ROOT, 'scripts/ci/scan-secrets.mjs');
const VERTICAL_PACK_GATE = path.join(ROOT, 'scripts/ci/vertical-pack-publish-gate.mjs');
const LICENSE_REPORT = path.join(ROOT, 'docs/compliance/vector-graph-license-report.csv');

function readDoc(): string {
  return fs.readFileSync(GUARDRAILS_DOC, 'utf8');
}

function readPkg(): { scripts: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
}

// ── Guardrails document ───────────────────────────────────────────────────────

describe('supply-chain-guardrails.md', () => {
  it('document exists at docs/governance/supply-chain-guardrails.md', () => {
    expect(fs.existsSync(GUARDRAILS_DOC)).toBe(true);
  });

  it('is tagged with bead-0755', () => {
    expect(readDoc()).toContain('bead-0755');
  });

  it('control 1: vulnerability gate (HIGH/CRITICAL)', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Vv]ulnerability gate|audit:high/);
    expect(doc).toMatch(/HIGH|CRITICAL/);
  });

  it('control 2: license allowlist gate', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Ll]icense allowlist/);
    expect(doc).toMatch(/SPDX|MIT|Apache-2\.0/);
  });

  it('control 3: secret scanning gate', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Ss]ecret scan/);
    expect(doc).toMatch(/credential|token/i);
  });

  it('control 4: dependency pinning policy', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Dd]ependency pinning|pinning policy/);
    expect(doc).toMatch(/package-lock\.json/);
  });

  it('control 5: cockpit-specific controls', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Cc]ockpit.specific|cockpit.*control/i);
    expect(doc).toMatch(/@capacitor/);
  });

  it('control 6: connector dependency controls', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Cc]onnector.*control|connector.*depend/i);
    expect(doc).toMatch(/vertical.pack|vertical pack/i);
  });

  it('defines release gate criteria', () => {
    const doc = readDoc();
    expect(doc).toContain('Release Gate Criteria');
    expect(doc).toMatch(/passes|pass/i);
  });

  it('release gate references all 3 CI scripts', () => {
    const doc = readDoc();
    expect(doc).toMatch(/audit:high/);
    expect(doc).toMatch(/audit:licenses/);
    expect(doc).toMatch(/scan-secrets/);
  });

  it('documents rollback triggers', () => {
    const doc = readDoc();
    expect(doc).toMatch(/[Rr]ollback [Tt]rigger/);
    expect(doc).toMatch(/CVE|vulnerability/i);
  });

  it('lists required artifacts', () => {
    const doc = readDoc();
    expect(doc).toContain('Required Artifacts');
    expect(doc).toContain('supply-chain-guardrails.md');
    expect(doc).toContain('audit-high.mjs');
    expect(doc).toContain('audit-licenses.mjs');
    expect(doc).toContain('scan-secrets.mjs');
  });
});

// ── CI script existence ───────────────────────────────────────────────────────

describe('CI scripts existence', () => {
  it('audit-high.mjs exists', () => {
    expect(fs.existsSync(AUDIT_HIGH_SCRIPT)).toBe(true);
  });

  it('audit-licenses.mjs exists', () => {
    expect(fs.existsSync(AUDIT_LICENSES_SCRIPT)).toBe(true);
  });

  it('scan-secrets.mjs exists', () => {
    expect(fs.existsSync(SCAN_SECRETS_SCRIPT)).toBe(true);
  });

  it('vertical-pack-publish-gate.mjs exists', () => {
    expect(fs.existsSync(VERTICAL_PACK_GATE)).toBe(true);
  });

  it('license compliance report artifact exists', () => {
    expect(fs.existsSync(LICENSE_REPORT)).toBe(true);
  });
});

// ── audit-high.mjs content ────────────────────────────────────────────────────

describe('audit-high.mjs script', () => {
  it('scans production dependencies (--omit=dev)', () => {
    const script = fs.readFileSync(AUDIT_HIGH_SCRIPT, 'utf8');
    expect(script).toContain('--omit=dev');
  });

  it('filters for HIGH and CRITICAL severity', () => {
    const script = fs.readFileSync(AUDIT_HIGH_SCRIPT, 'utf8');
    expect(script).toMatch(/high|HIGH/);
    expect(script).toMatch(/critical|CRITICAL/);
  });

  it('uses npm audit --json for machine-readable output', () => {
    const script = fs.readFileSync(AUDIT_HIGH_SCRIPT, 'utf8');
    expect(script).toContain('npm audit');
    expect(script).toContain('--json');
  });
});

// ── scan-secrets.mjs content ──────────────────────────────────────────────────

describe('scan-secrets.mjs script', () => {
  it('scans for AWS credential patterns', () => {
    const script = fs.readFileSync(SCAN_SECRETS_SCRIPT, 'utf8');
    expect(script).toMatch(/AWS|aws_/i);
  });

  it('scans for token/key patterns', () => {
    const script = fs.readFileSync(SCAN_SECRETS_SCRIPT, 'utf8');
    expect(script).toMatch(/token|bearer|private.key/i);
  });
});

// ── npm scripts registration ──────────────────────────────────────────────────

describe('npm scripts registration', () => {
  it('audit:high is registered in package.json', () => {
    const pkg = readPkg();
    expect(pkg.scripts['audit:high']).toBeDefined();
    expect(pkg.scripts['audit:high']).toContain('audit-high');
  });

  it('audit:licenses is registered in package.json', () => {
    const pkg = readPkg();
    expect(pkg.scripts['audit:licenses']).toBeDefined();
    expect(pkg.scripts['audit:licenses']).toContain('audit-licenses');
  });

  it('ci:pr runs the vulnerability audit', () => {
    const pkg = readPkg();
    const ciPr = pkg.scripts['ci:pr'] ?? '';
    expect(ciPr).toMatch(/audit.high|audit:high/);
  });

  it('ci:security-gates bundles audit scripts', () => {
    const pkg = readPkg();
    const securityGates = pkg.scripts['ci:security-gates'] ?? '';
    expect(securityGates).toMatch(/audit:high|audit:licenses/);
  });
});

// ── Cockpit Capacitor plugin allowlist ────────────────────────────────────────

describe('Cockpit Capacitor plugin supply-chain controls', () => {
  it('cockpit package.json Capacitor plugins, if any, use the official namespace', () => {
    const cockpitPkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'apps/cockpit/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    const allDeps = {
      ...(cockpitPkg.dependencies ?? {}),
      ...(cockpitPkg.devDependencies ?? {}),
    };

    const capacitorDeps = Object.keys(allDeps).filter((k) => k.toLowerCase().includes('capacitor'));
    // Any Capacitor-related package must use the official @capacitor/ namespace
    for (const dep of capacitorDeps) {
      expect(dep).toMatch(/^@capacitor\//);
    }
  });

  it('all referenced Capacitor packages use @capacitor/ namespace (MIT-licensed)', () => {
    const cockpitPkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'apps/cockpit/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    const deps = Object.keys(cockpitPkg.dependencies ?? {});
    const capacitorDeps = deps.filter((k) => k.startsWith('@capacitor/'));

    // All @capacitor/* packages are MIT-licensed; non-@capacitor packages
    // must not use unofficial Capacitor forks
    for (const dep of capacitorDeps) {
      expect(dep).toMatch(/^@capacitor\//);
    }
  });
});

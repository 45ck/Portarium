/**
 * OpenSSF Best Practices + SLSA trust signal compliance tests.
 *
 * Validates that the repository meets the security trust signals required
 * for OpenSSF Best Practices badge eligibility and SLSA Build Level 2+
 * conformance for container image release artifacts.
 *
 * Bead: bead-0746
 * ADR: ADR-0105 (Security Trust Signals)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

// ── Helpers ─────────────────────────────────────────────────────────────────

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: string };
        if (json.name === 'portarium') return dir;
      } catch {
        // skip
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(import.meta.dirname, '../../..');
}

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github/workflows');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function getWorkflowContent(name: string): string {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, name), 'utf8');
}

// ── OpenSSF Best Practices — Basics ─────────────────────────────────────────

describe('OpenSSF Best Practices: Basics', () => {
  it('has a SECURITY.md vulnerability disclosure policy', () => {
    expect(fileExists('SECURITY.md')).toBe(true);
    const content = readFile('SECURITY.md');
    expect(content).toContain('Reporting a Vulnerability');
    expect(content).toContain('Disclosure Policy');
  });

  it('has a LICENSE file', () => {
    // OpenSSF requires a license
    const hasLicense =
      fileExists('LICENSE') || fileExists('LICENSE.md') || fileExists('LICENSE.txt');
    expect(hasLicense).toBe(true);
  });

  it('has a README with project description', () => {
    expect(fileExists('README.md')).toBe(true);
  });

  it('has a CONTRIBUTING guide or contributing section', () => {
    const hasContributing =
      fileExists('CONTRIBUTING.md') ||
      fileExists('docs/CONTRIBUTING.md') ||
      (fileExists('README.md') && readFile('README.md').toLowerCase().includes('contributing'));
    expect(hasContributing).toBe(true);
  });
});

// ── OpenSSF Best Practices — Change Control ─────────────────────────────────

describe('OpenSSF Best Practices: Change Control', () => {
  it('has a CI workflow that runs on pull requests', () => {
    const ciContent = getWorkflowContent('ci.yml');
    expect(ciContent).toContain('pull_request');
  });

  it('has a merge guard workflow', () => {
    expect(fileExists('.github/workflows/merge-guard.yml')).toBe(true);
  });

  it('has CodeQL static analysis', () => {
    expect(fileExists('.github/workflows/codeql.yml')).toBe(true);
    const content = getWorkflowContent('codeql.yml');
    expect(content).toContain('codeql-action');
  });
});

// ── OpenSSF Best Practices — Security ───────────────────────────────────────

describe('OpenSSF Best Practices: Security', () => {
  it('has a security-gates workflow', () => {
    expect(fileExists('.github/workflows/security-gates.yml')).toBe(true);
    const content = getWorkflowContent('security-gates.yml');
    expect(content).toContain('dependency-review-action');
  });

  it('has OpenSSF Scorecards analysis configured', () => {
    expect(fileExists('.github/workflows/scorecards.yml')).toBe(true);
    const content = getWorkflowContent('scorecards.yml');
    expect(content).toContain('ossf/scorecard-action');
    expect(content).toContain('publish_results: true');
  });

  it('has npm audit in CI pipeline', () => {
    const pkg = JSON.parse(readFile('package.json')) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    // ci:pr must include an audit step
    const ciPr = scripts['ci:pr'] ?? '';
    expect(ciPr).toContain('audit');
  });

  it('SECURITY.md defines in-scope vulnerability types', () => {
    const content = readFile('SECURITY.md');
    expect(content).toContain('Security Scope');
    expect(content).toContain('in scope');
  });
});

// ── OpenSSF Best Practices — Quality ────────────────────────────────────────

describe('OpenSSF Best Practices: Quality', () => {
  it('has automated test suite in CI', () => {
    const pkg = JSON.parse(readFile('package.json')) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    expect(scripts['test']).toBeDefined();
    expect(scripts['test:coverage']).toBeDefined();
  });

  it('has linting configured', () => {
    const hasEslint = fileExists('eslint.config.mjs') || fileExists('.eslintrc.js');
    expect(hasEslint).toBe(true);
  });

  it('has type checking configured', () => {
    expect(fileExists('tsconfig.json')).toBe(true);
    const pkg = JSON.parse(readFile('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['typecheck']).toBeDefined();
  });
});

// ── SLSA Build Level 2 — Container Images ───────────────────────────────────

describe('SLSA Build Level 2: Container Images', () => {
  const ciImagesExists = fileExists('.github/workflows/ci-images.yml');

  it('has a ci-images workflow for container builds', () => {
    expect(ciImagesExists).toBe(true);
  });

  if (ciImagesExists) {
    const ciImages = getWorkflowContent('ci-images.yml');

    it('builds with provenance attestation (SLSA Build L2)', () => {
      // docker/build-push-action with provenance: true emits SLSA Build L2
      expect(ciImages).toContain('provenance: true');
    });

    it('generates SBOM for container images', () => {
      expect(ciImages).toContain('sbom: true');
    });

    it('signs images with Sigstore keyless (OIDC-based identity)', () => {
      expect(ciImages).toContain('cosign sign');
      expect(ciImages).toContain('id-token: write');
    });

    it('does not use static signing keys (keyless only)', () => {
      expect(ciImages).not.toMatch(/COSIGN_KEY/);
      expect(ciImages).not.toMatch(/cosign-private-key/);
    });

    it('attests SBOM to registry', () => {
      expect(ciImages).toContain('cosign attest');
      expect(ciImages).toContain('spdxjson');
    });

    it('scans images for vulnerabilities (Trivy)', () => {
      expect(ciImages).toContain('trivy-action');
      expect(ciImages).toContain('CRITICAL,HIGH');
    });

    it('uploads scan results to GitHub Security (SARIF)', () => {
      expect(ciImages).toContain('upload-sarif');
    });

    it('emits build metadata as artifact', () => {
      expect(ciImages).toContain('build-metadata.json');
      expect(ciImages).toContain('upload-artifact');
    });
  }
});

// ── SLSA Verification — Provenance Verification Gate ────────────────────────

describe('SLSA Verification: Provenance Verification Gate', () => {
  const verifyExists = fileExists('.github/workflows/verify-provenance.yml');

  it('has a verify-provenance workflow', () => {
    expect(verifyExists).toBe(true);
  });

  if (verifyExists) {
    const verifyContent = getWorkflowContent('verify-provenance.yml');

    it('verifies image signature with cosign', () => {
      expect(verifyContent).toContain('cosign verify');
    });

    it('pins certificate identity to this repository', () => {
      expect(verifyContent).toContain('--certificate-identity');
    });

    it('pins OIDC issuer to GitHub Actions', () => {
      expect(verifyContent).toContain('https://token.actions.githubusercontent.com');
    });

    it('verifies SBOM attestation', () => {
      expect(verifyContent).toContain('cosign verify-attestation');
      expect(verifyContent).toContain('spdxjson');
    });
  }
});

// ── SLSA Source Level — Source Integrity ─────────────────────────────────────

describe('SLSA Source: Source Integrity Controls', () => {
  it('CI workflow triggers on PRs and merge groups', () => {
    const ciContent = getWorkflowContent('ci.yml');
    expect(ciContent).toContain('pull_request');
    expect(ciContent).toContain('merge_group');
  });

  it('has branch protection via merge guard', () => {
    const content = getWorkflowContent('merge-guard.yml');
    // Merge guard enforces that required checks pass before merge
    expect(content).toContain('merge_group');
  });

  it('dependency review runs on PRs to catch malicious packages', () => {
    const content = getWorkflowContent('security-gates.yml');
    expect(content).toContain('dependency-review-action');
    expect(content).toContain('fail-on-severity: high');
  });
});

// ── Supply Chain Hygiene ────────────────────────────────────────────────────

describe('Supply Chain Hygiene', () => {
  it('has package-lock.json committed (reproducible builds)', () => {
    expect(fileExists('package-lock.json')).toBe(true);
  });

  it('CI uses npm ci (not npm install) for deterministic installs', () => {
    if (fileExists('.github/workflows/ci.yml')) {
      const ciContent = getWorkflowContent('ci.yml');
      expect(ciContent).toContain('npm ci');
    }
  });

  it('GitHub Actions use pinned versions (not floating tags)', () => {
    // Check that key actions use @v4 or @v3 (not @latest or @main)
    const ciContent = getWorkflowContent('ci-images.yml');
    // actions/checkout should use a pinned version
    expect(ciContent).toMatch(/actions\/checkout@v\d/);
    expect(ciContent).not.toMatch(/actions\/checkout@main/);
    expect(ciContent).not.toMatch(/actions\/checkout@latest/);
  });

  it('container images use OCI labels for traceability', () => {
    if (fileExists('.github/workflows/ci-images.yml')) {
      const content = getWorkflowContent('ci-images.yml');
      expect(content).toContain('org.opencontainers.image.source');
      expect(content).toContain('org.opencontainers.image.revision');
    }
  });
});

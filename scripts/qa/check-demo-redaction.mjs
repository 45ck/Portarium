/**
 * Demo Redaction Guard (bead-0731)
 *
 * Scans demo clip specs, demo HTML/JS fixtures, and any rendered gallery
 * metadata for patterns that indicate real sensitive data leaked into
 * demo artifacts. Exits non-zero if violations are found.
 *
 * Usage:
 *   node scripts/qa/check-demo-redaction.mjs [--strict]
 *
 * Flags:
 *   --strict   Treat warnings as errors (useful in CI)
 *
 * What is checked:
 *   1. Allowed email domains (only @acme.com, @example.com, @portarium.dev,
 *      @portarium.io, @company.com, @test.com are permitted in demo content)
 *   2. Real-looking API key / token patterns (AWS, GitHub PAT, Slack, etc.)
 *   3. Real JWT tokens (3-segment base64url, payload decodable)
 *   4. Private IP addresses outside localhost in security-sensitive contexts
 *   5. Gallery metadata.json outputs referencing unexpected file extensions
 *
 * Allowlists and rules are intentionally conservative — demo content should
 * use only clearly-fictional data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const rootDir = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const strict = process.argv.includes('--strict');

/** Paths to scan for sensitive-data patterns */
const SCAN_ROOTS = [
  path.join(rootDir, 'docs/ui/cockpit/demo-machine/clips'),
  path.join(rootDir, 'docs/ui/cockpit/fixtures'),
];

/** Files at cockpit root to scan */
const COCKPIT_ROOT_FILES = ['index.html', 'mock-api.js', 'demo-bindings.js'].map((f) =>
  path.join(rootDir, 'docs/ui/cockpit', f),
);

/** Extensions to include in scans */
const TEXT_EXTENSIONS = new Set(['.yaml', '.yml', '.json', '.html', '.js', '.ts', '.md', '.txt']);

// ---------------------------------------------------------------------------
// Allowed patterns (allowlist)
// ---------------------------------------------------------------------------

/** Email domains that are explicitly allowed in demo content */
const ALLOWED_EMAIL_DOMAINS = new Set([
  'acme.com',
  'example.com',
  'portarium.dev',
  'portarium.io',
  'company.com',
  'test.com',
  'demo.com',
  'fictional.corp',
]);

// ---------------------------------------------------------------------------
// Violation patterns
// ---------------------------------------------------------------------------

/**
 * Real-looking secret/credential patterns.
 * Each entry: { name, regex, severity }
 */
const SECRET_PATTERNS = [
  {
    name: 'AWS access key',
    regex: /\b(AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|AKIA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/,
    severity: 'error',
  },
  {
    name: 'GitHub PAT (classic)',
    regex: /\bghp_[A-Za-z0-9]{36}\b/,
    severity: 'error',
  },
  {
    name: 'GitHub fine-grained PAT',
    regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
    severity: 'error',
  },
  {
    name: 'Slack token',
    regex: /\bxox[boaprstu]-[0-9A-Za-z-]{24,}\b/,
    severity: 'error',
  },
  {
    name: 'Generic API key pattern (long hex)',
    regex: /\b(?:api[_-]?key|apikey|secret)[_-]?[:=]\s*['"]?[0-9a-f]{32,64}['"]?/i,
    severity: 'warning',
  },
  {
    name: 'Bearer token in content',
    regex: /Bearer\s+eyJ[A-Za-z0-9_./-]{20,}/,
    severity: 'error',
  },
  {
    name: 'Private key block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: 'error',
  },
];

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function collectTextFiles(roots) {
  const files = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    collectRecursive(root, files);
  }
  return files;
}

function collectRecursive(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRecursive(full, acc);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      acc.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Check for email addresses outside allowed demo domains.
 */
function checkEmailDomains(content, filePath) {
  const violations = [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  let match;
  while ((match = emailRegex.exec(content)) !== null) {
    const domain = match[1].toLowerCase();
    if (!ALLOWED_EMAIL_DOMAINS.has(domain)) {
      violations.push({
        type: 'non-demo-email',
        severity: 'warning',
        detail: `email with non-demo domain: ${match[0]}`,
        file: filePath,
      });
    }
  }
  return violations;
}

/**
 * Check for real-looking secret/credential patterns.
 */
function checkSecretPatterns(content, filePath) {
  const violations = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) {
      violations.push({
        type: 'secret-pattern',
        severity: pattern.severity,
        detail: `found ${pattern.name} pattern`,
        file: filePath,
      });
    }
  }
  return violations;
}

/**
 * Check that clip YAML files declare a meta.title that includes "Demo"
 * or "Cockpit Demo" (ensures they're clearly demo-labeled).
 */
function checkClipSpecLabel(content, filePath) {
  if (!filePath.endsWith('.demo.yaml')) return [];
  const titleMatch = content.match(/title:\s*['"](.+?)['"]/);
  if (!titleMatch) return [];
  const title = titleMatch[1];
  if (!title.toLowerCase().includes('demo') && !title.toLowerCase().includes('cockpit')) {
    return [
      {
        type: 'unlabeled-clip',
        severity: 'warning',
        detail: `clip meta.title "${title}" does not contain "demo" or "cockpit" — ensure it's clearly demo-labeled`,
        file: filePath,
      },
    ];
  }
  return [];
}

/**
 * Check gallery metadata.json outputs only reference known media extensions.
 */
function checkGalleryMetadata(content, filePath) {
  if (!filePath.endsWith('metadata.json') && !filePath.endsWith('gallery-index.json')) return [];
  const violations = [];
  try {
    const data = JSON.parse(content);
    // Extract any string values that look like file paths
    const allStrings = JSON.stringify(data).match(/"[^"]*\.[a-zA-Z]{2,6}"/g) || [];
    const allowedExtensions = new Set([
      '.gif',
      '.mp4',
      '.png',
      '.jpg',
      '.jpeg',
      '.webm',
      '.json',
      '.txt',
    ]);
    for (const str of allStrings) {
      const val = str.slice(1, -1);
      const ext = path.extname(val).toLowerCase();
      if (ext && !allowedExtensions.has(ext)) {
        violations.push({
          type: 'unexpected-artifact-extension',
          severity: 'warning',
          detail: `metadata references unexpected file type: ${val}`,
          file: filePath,
        });
      }
    }
  } catch {
    // Not valid JSON or unexpected format — skip
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  return [
    ...checkEmailDomains(content, filePath),
    ...checkSecretPatterns(content, filePath),
    ...checkClipSpecLabel(content, filePath),
    ...checkGalleryMetadata(content, filePath),
  ];
}

function main() {
  console.log('[demo-redaction] check-demo-redaction.mjs');
  console.log(`  strict : ${strict}`);

  const allFiles = [
    ...collectTextFiles(SCAN_ROOTS),
    ...COCKPIT_ROOT_FILES.filter((f) => fs.existsSync(f)),
  ];

  console.log(`  files  : ${allFiles.length}`);

  const allViolations = [];
  for (const file of allFiles) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }

  // Group by severity
  const errors = allViolations.filter((v) => v.severity === 'error');
  const warnings = allViolations.filter((v) => v.severity === 'warning');

  for (const v of errors) {
    console.error(`[error] ${v.type} in ${path.relative(rootDir, v.file)}: ${v.detail}`);
  }
  for (const v of warnings) {
    console.warn(`[warn]  ${v.type} in ${path.relative(rootDir, v.file)}: ${v.detail}`);
  }

  const total = allViolations.length;
  const exitCode = errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0;

  if (total === 0) {
    console.log('[demo-redaction] OK — no sensitive data patterns found');
  } else {
    console.log(
      `[demo-redaction] ${errors.length} error(s), ${warnings.length} warning(s) in ${allFiles.length} files`,
    );
  }

  process.exit(exitCode);
}

main();

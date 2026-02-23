#!/usr/bin/env node
/**
 * audit-licenses.mjs — CI license gate for production dependencies.
 *
 * bead-0767: Licensing/compliance gate for vector+graph+embedding dependencies.
 *
 * Scans direct + transitive production npm dependencies that are physically
 * installed in node_modules, reads their declared SPDX license, and fails if
 * any license is not on the allowlist.
 *
 * Design decisions:
 * - Only checks packages that exist in node_modules (skips NOT_FOUND).
 * - Uses npm ls --omit=dev --all for the production dep graph.
 * - Writes a CSV report to docs/compliance/vector-graph-license-report.csv.
 *
 * Usage:
 *   node scripts/ci/audit-licenses.mjs [--csv <path>]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * OSI-approved permissive licenses safe for MIT-licensed projects.
 * Excludes copyleft (GPL, LGPL, MPL) unless explicitly noted.
 */
const ALLOWED_LICENSES = new Set([
  'MIT',
  'MIT-0', // Zero-clause MIT (even more permissive)
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'PostgreSQL', // Very permissive, BSD-like
  'Python-2.0', // Permissive, used for some older packages
  'CC0-1.0', // Public domain equivalent
  'Unlicense', // Public domain equivalent
  '0BSD', // Zero-clause BSD
  'BlueOak-1.0.0', // Permissive
  'CC-BY-3.0', // Attribution only
  'CC-BY-4.0', // Attribution only
  'SIL OFL 1.1', // For fonts — permissive within font use
  'OFL-1.1', // SIL Open Font License
  'Public Domain',
  'WTFPL', // Do-whatever-you-want
]);

/**
 * Per-package overrides for packages with unusual or non-SPDX license fields
 * that are known to be acceptable.
 */
const PACKAGE_OVERRIDES = new Map([
  // Portarium's own package
  ['@portarium/cockpit', { license: 'MIT', allowed: true, note: 'Internal package' }],
  // Build tools / bundler internals that are not part of the distributed runtime
  [
    'lightningcss',
    { license: 'MPL-2.0', allowed: true, note: 'Build tool — not distributed in runtime' },
  ],
  ['lightningcss-win32-x64-msvc', { license: 'MPL-2.0', allowed: true, note: 'Build tool' }],
  // Accessibility testing library — used in test/dev, not distributed runtime
  [
    'axe-core',
    { license: 'MPL-2.0', allowed: true, note: 'Accessibility testing — build-time only' },
  ],
  // Ethical license — frontend mapping lib included via cockpit, not server runtime
  [
    'react-leaflet',
    { license: 'Hippocratic-2.1', allowed: true, note: 'Frontend mapping lib — Cockpit UI only' },
  ],
  [
    '@react-leaflet/core',
    { license: 'Hippocratic-2.1', allowed: true, note: 'Frontend mapping lib — Cockpit UI only' },
  ],
  // Geist font — SIL OFL permissive for font use
  ['geist', { license: 'SIL OFL 1.1', allowed: true, note: 'Font — SIL OFL permissive' }],
  // LGPL plugins used for dev lint only
  [
    'eslint-plugin-sonarjs',
    { license: 'LGPL-3.0-only', allowed: true, note: 'Dev lint tool — not distributed' },
  ],
  // CC BY-SA dictionary data
  [
    '@cspell/dict-en-common-misspellings',
    { license: 'CC-BY-SA-4.0', allowed: true, note: 'Dev spell-check data only' },
  ],
  // Unionfs — filesystem virtualization for testing
  ['unionfs', { license: 'MIT', allowed: true, note: 'MIT (UNSPECIFIED in package.json)' }],
  // @csstools packages
  ['@csstools/color-helpers', { license: 'MIT-0', allowed: true, note: 'Zero-clause MIT' }],
  // sharp native binary — dual-licensed, Apache portion governs use as a library
  [
    '@img/sharp-win32-x64',
    {
      license: 'Apache-2.0 AND LGPL-3.0-or-later',
      allowed: true,
      note: 'Image processing — LGPL via dynamic linking only',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLicense(raw) {
  if (!raw) return 'UNKNOWN';
  // Strip outer parentheses from compound expressions like "(MIT OR CC0-1.0)"
  const s = (typeof raw === 'string' ? raw : (raw?.type ?? 'UNKNOWN'))
    .trim()
    .replace(/^\(|\)$/g, '');
  const map = {
    'MIT License': 'MIT',
    'ISC License': 'ISC',
    'Apache License, Version 2.0': 'Apache-2.0',
    'Apache License 2.0': 'Apache-2.0',
    'Apache-2': 'Apache-2.0',
    'Apache 2': 'Apache-2.0',
    'Apache 2.0': 'Apache-2.0',
    BSD: 'BSD-3-Clause',
    'BSD-3': 'BSD-3-Clause',
    'BSD-2': 'BSD-2-Clause',
    'Public Domain': 'Public Domain',
    'SIL Open Font License 1.1': 'SIL OFL 1.1',
    'SIL OPEN FONT LICENSE': 'SIL OFL 1.1',
    'OFL-1.1': 'SIL OFL 1.1',
  };
  return map[s] ?? s;
}

function isAllowed(license) {
  const norm = normalizeLicense(license);
  if (ALLOWED_LICENSES.has(norm)) return true;
  // Compound AND: all parts must be allowed
  if (/\bAND\b/.test(norm)) {
    return norm.split(/\bAND\b/).every((p) => ALLOWED_LICENSES.has(p.trim()));
  }
  // Compound OR: at least one part must be allowed
  if (/\bOR\b/.test(norm)) {
    return norm.split(/\bOR\b/).some((p) => ALLOWED_LICENSES.has(p.trim()));
  }
  return false;
}

function readPackageLicense(name, nodeModulesRoot) {
  const pkgJsonPath = join(nodeModulesRoot, name, 'package.json');
  if (!existsSync(pkgJsonPath)) return null; // Not installed — skip
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    if (pkg.license) {
      return typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNKNOWN');
    }
    if (pkg.licenses && Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
      return pkg.licenses.map((l) => (typeof l === 'string' ? l : l.type)).join(' OR ');
    }
    return 'UNSPECIFIED';
  } catch {
    return 'PARSE_ERROR';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const nodeModulesRoot = join(repoRoot, 'node_modules');

const args = process.argv.slice(2);
const csvIdx = args.indexOf('--csv');
const csvPath =
  csvIdx !== -1
    ? resolve(args[csvIdx + 1])
    : join(repoRoot, 'docs/compliance/vector-graph-license-report.csv');

// Collect production dep tree
console.log('[audit-licenses] Resolving production dependency tree...');
let lsOutput = '';
try {
  lsOutput = execSync('npm ls --json --omit=dev --all 2>NUL', {
    encoding: 'utf8',
    cwd: repoRoot,
    maxBuffer: 100 * 1024 * 1024,
  });
} catch (err) {
  lsOutput = err.stdout ?? '';
}

if (!lsOutput.trim()) {
  console.error('[audit-licenses] npm ls produced no output');
  process.exit(1);
}

let depTree;
try {
  const clean = lsOutput.charCodeAt(0) === 0xfeff ? lsOutput.slice(1) : lsOutput;
  depTree = JSON.parse(clean);
} catch {
  console.error('[audit-licenses] Failed to parse npm ls JSON');
  process.exit(1);
}

// Collect unique package names from the tree
const allPackages = new Set();
function walk(deps) {
  for (const [name] of Object.entries(deps ?? {})) {
    allPackages.add(name);
  }
  for (const info of Object.values(deps ?? {})) {
    if (info.dependencies) walk(info.dependencies);
  }
}
walk(depTree.dependencies);
console.log(`[audit-licenses] Found ${allPackages.size} unique packages in dep tree.`);

// Check each package
const results = [];
const violations = [];
let skipped = 0;

for (const pkg of [...allPackages].sort()) {
  // Check for override first
  if (PACKAGE_OVERRIDES.has(pkg)) {
    const override = PACKAGE_OVERRIDES.get(pkg);
    results.push({
      pkg,
      license: override.license,
      allowed: override.allowed,
      note: override.note ?? '',
    });
    if (!override.allowed) violations.push({ pkg, license: override.license });
    continue;
  }

  const rawLicense = readPackageLicense(pkg, nodeModulesRoot);
  if (rawLicense === null) {
    // Not installed locally — skip (likely a peer dep or workspace dep not present)
    skipped++;
    continue;
  }

  const license = normalizeLicense(rawLicense);
  const allowed = isAllowed(license);

  results.push({ pkg, license, allowed, note: '' });
  if (!allowed) {
    violations.push({ pkg, license });
  }
}

console.log(
  `[audit-licenses] Checked ${results.length} packages, skipped ${skipped} (not installed).`,
);

// Write CSV
const csvLines = [
  'package,license,allowed,note',
  ...results.map((r) => `"${r.pkg}","${r.license}","${r.allowed ? 'YES' : 'NO'}","${r.note}"`),
];
writeFileSync(csvPath, csvLines.join('\n') + '\n', 'utf8');
console.log(`[audit-licenses] Report written to: ${csvPath}`);

// Summary
const allowedCount = results.filter((r) => r.allowed).length;
const blockedCount = violations.length;
const unknownCount = results.filter(
  (r) => r.license === 'UNKNOWN' || r.license === 'UNSPECIFIED',
).length;

console.log(
  `[audit-licenses] Summary: ${allowedCount} allowed, ${blockedCount} blocked, ${unknownCount} unspecified`,
);

if (violations.length > 0) {
  console.error('\n[audit-licenses] FAIL — disallowed licenses:');
  for (const v of violations) {
    console.error(`  ${v.pkg}: ${v.license}`);
  }
  process.exit(1);
} else {
  console.log('[audit-licenses] PASS — all production licenses are compliant.');
}

#!/usr/bin/env node

/**
 * Prepare a release: bump version, update changelog, create git tag.
 *
 * Usage:
 *   node scripts/release/prepare-release.mjs patch          # 0.1.0 → 0.1.1
 *   node scripts/release/prepare-release.mjs minor          # 0.1.0 → 0.2.0
 *   node scripts/release/prepare-release.mjs major          # 0.1.0 → 1.0.0
 *   node scripts/release/prepare-release.mjs --dry-run patch
 *   node scripts/release/prepare-release.mjs --skip-changelog minor
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries, toMarkdown } from './collect-changelog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipChangelog = args.includes('--skip-changelog');
const bumpType = args.find((a) => ['major', 'minor', 'patch'].includes(a));

if (!bumpType) {
  console.error('Usage: prepare-release.mjs [--dry-run] [--skip-changelog] <major|minor|patch>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version: ${current}`);
  }
  const [major, minor, patch] = parts;
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

const status = git('status --porcelain');
if (status && !dryRun) {
  console.error('Error: Working tree is not clean. Commit or stash changes first.');
  console.error(status);
  process.exit(1);
}

const branch = git('rev-parse --abbrev-ref HEAD');
if (branch !== 'main' && !dryRun) {
  console.error(`Error: Releases must be prepared from the main branch (currently on ${branch}).`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Version bump
// ---------------------------------------------------------------------------

const pkgPath = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;
const newVersion = bumpVersion(currentVersion, bumpType);
const tagName = `v${newVersion}`;

console.log(`Version: ${currentVersion} → ${newVersion} (${bumpType})`);
console.log(`Tag:     ${tagName}`);
if (dryRun) {
  console.log('[dry-run] No changes will be made.');
}

// Check tag doesn't already exist
try {
  git(`rev-parse ${tagName}`);
  console.error(`Error: Tag ${tagName} already exists.`);
  process.exit(1);
} catch {
  // Tag doesn't exist — good
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

let changelogSection = '';
if (!skipChangelog) {
  const { entries } = collectEntries();
  changelogSection = toMarkdown(entries);
  if (changelogSection) {
    console.log('\nChangelog entries:');
    console.log(changelogSection);
  } else {
    console.log('\nNo changelog entries found (empty release).');
  }
}

if (dryRun) process.exit(0);

// ---------------------------------------------------------------------------
// Apply changes
// ---------------------------------------------------------------------------

// 1. Bump package.json version
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
console.log(`\nUpdated package.json version to ${newVersion}`);

// 2. Update changelog
if (!skipChangelog && changelogSection) {
  const changelogPath = resolve(ROOT, 'docs/changelog.md');
  let changelog;
  try {
    changelog = readFileSync(changelogPath, 'utf-8');
  } catch {
    changelog = '# Changelog\n\n## Unreleased\n';
  }

  const today = new Date().toISOString().split('T')[0];
  const releaseHeader = `## ${newVersion} — ${today}`;

  // Replace "## Unreleased" section with the release + a fresh Unreleased
  const unreleased = '## Unreleased';
  const idx = changelog.indexOf(unreleased);
  if (idx >= 0) {
    const afterUnreleased = changelog.indexOf('\n## ', idx + unreleased.length);
    const freshUnreleased = [
      '## Unreleased',
      '',
      '### Added',
      '',
      '### Changed',
      '',
      '### Fixed',
      '',
      '### Removed',
      '',
    ].join('\n');

    const before = changelog.slice(0, idx);
    const rest = afterUnreleased >= 0 ? changelog.slice(afterUnreleased) : '';

    changelog = `${before}${freshUnreleased}\n${releaseHeader}\n\n${changelogSection}\n${rest}`;
  } else {
    // No Unreleased section — prepend after title
    const titleEnd = changelog.indexOf('\n') + 1;
    changelog = `${changelog.slice(0, titleEnd)}\n${releaseHeader}\n\n${changelogSection}\n${changelog.slice(titleEnd)}`;
  }

  writeFileSync(changelogPath, changelog, 'utf-8');
  console.log(`Updated docs/changelog.md with ${newVersion} entries`);
}

// 3. Commit
git('add package.json docs/changelog.md');
git(`commit -m "release: ${newVersion}"`);
console.log(`Committed release: ${newVersion}`);

// 4. Tag
git(`tag -a ${tagName} -m "Release ${newVersion}"`);
console.log(`Created tag: ${tagName}`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log(`
Release ${newVersion} prepared successfully.

Next steps:
  git push origin main --follow-tags    # push commit + tag
  gh release create ${tagName} --generate-notes   # create GitHub release (optional)
`);

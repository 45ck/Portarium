#!/usr/bin/env node

/**
 * Collect changelog entries from bead closures and git commits since the last
 * version tag. Outputs structured JSON or formatted Keep-a-Changelog markdown.
 *
 * Usage:
 *   node scripts/release/collect-changelog.mjs                # markdown output
 *   node scripts/release/collect-changelog.mjs --json         # JSON output
 *   node scripts/release/collect-changelog.mjs --since v0.1.0 # from specific tag
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

function latestTag() {
  try {
    return git('describe --tags --abbrev=0');
  } catch {
    return null;
  }
}

function commitsSince(since) {
  const range = since ? `${since}..HEAD` : 'HEAD';
  const raw = git(`log ${range} --pretty=format:"%H|%s" --no-merges`);
  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const pipe = line.indexOf('|');
    return {
      hash: line.slice(1, pipe), // strip leading "
      subject: line.slice(pipe + 1).replace(/"$/, ''),
    };
  });
}

// ---------------------------------------------------------------------------
// Bead helpers
// ---------------------------------------------------------------------------

function loadClosedBeads(sinceDate) {
  const path = resolve(ROOT, '.beads/issues.jsonl');
  let lines;
  try {
    lines = readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((b) => b.status === 'closed')
    .filter((b) => {
      if (!sinceDate) return true;
      const closed = b.closed_at || b.closedAt;
      return closed && new Date(closed) >= new Date(sinceDate);
    });
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

const CATEGORY_PATTERNS = [
  { prefix: 'feat', category: 'Added' },
  { prefix: 'add', category: 'Added' },
  { prefix: 'fix', category: 'Fixed' },
  { prefix: 'bug', category: 'Fixed' },
  { prefix: 'change', category: 'Changed' },
  { prefix: 'refactor', category: 'Changed' },
  { prefix: 'perf', category: 'Changed' },
  { prefix: 'remove', category: 'Removed' },
  { prefix: 'deprecate', category: 'Removed' },
  { prefix: 'chore', category: null }, // skip chores
  { prefix: 'ci', category: null },
  { prefix: 'docs', category: null },
  { prefix: 'test', category: null },
  { prefix: 'merge', category: null },
  { prefix: 'style', category: null },
];

function categorize(subject) {
  const lower = subject.toLowerCase();
  for (const { prefix, category } of CATEGORY_PATTERNS) {
    if (lower.startsWith(`${prefix}:`) || lower.startsWith(`${prefix}(`)) {
      return category;
    }
  }
  // Default: treat as Added (feature work)
  return 'Added';
}

function stripPrefix(subject) {
  return subject.replace(/^[a-z]+(\([^)]*\))?:\s*/i, '');
}

// ---------------------------------------------------------------------------
// Collect entries
// ---------------------------------------------------------------------------

function collectEntries(since) {
  const tag = since || latestTag();
  const sinceDate = tag
    ? (() => {
        try {
          return git(`log -1 --format=%aI ${tag}`);
        } catch {
          return null;
        }
      })()
    : null;

  const commits = commitsSince(tag);
  const beads = loadClosedBeads(sinceDate);

  /** @type {Map<string, string[]>} */
  const entries = new Map([
    ['Added', []],
    ['Changed', []],
    ['Fixed', []],
    ['Removed', []],
  ]);

  // Bead titles → entries (deduplicated against commits)
  const beadIds = new Set(beads.map((b) => b.id));
  for (const bead of beads) {
    const cat = categorize(bead.title);
    if (cat && entries.has(cat)) {
      entries.get(cat).push(`${stripPrefix(bead.title)} (${bead.id})`);
    }
  }

  // Commits → entries (skip those already captured via bead)
  for (const commit of commits) {
    const mentionsBead = [...beadIds].some(
      (id) => commit.subject.includes(id) || commit.subject.includes(id.replace('bead-', '')),
    );
    if (mentionsBead) continue;

    const cat = categorize(commit.subject);
    if (cat && entries.has(cat)) {
      const text = stripPrefix(commit.subject);
      // Deduplicate
      if (!entries.get(cat).some((e) => e.startsWith(text))) {
        entries.get(cat).push(text);
      }
    }
  }

  return { since: tag, entries };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function toMarkdown(entries) {
  const sections = [];
  for (const [category, items] of entries) {
    if (items.length === 0) continue;
    sections.push(`### ${category}\n`);
    for (const item of items) {
      sections.push(`- ${item}`);
    }
    sections.push('');
  }
  return sections.join('\n').trim();
}

function toJson(entries, since) {
  const result = {};
  for (const [category, items] of entries) {
    if (items.length > 0) {
      result[category] = items;
    }
  }
  return JSON.stringify({ since, categories: result }, null, 2);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const sinceIdx = args.indexOf('--since');
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : undefined;

  const { since: resolvedSince, entries } = collectEntries(since);

  if (jsonMode) {
    console.log(toJson(entries, resolvedSince));
  } else {
    const md = toMarkdown(entries);
    if (md) {
      console.log(md);
    } else {
      console.log('No changelog entries found.');
    }
  }
}

export { collectEntries, toMarkdown, categorize, stripPrefix };

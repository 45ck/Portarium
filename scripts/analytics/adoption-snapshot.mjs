#!/usr/bin/env node
/**
 * adoption-snapshot.mjs
 *
 * Pulls CHAOSS-aligned adoption and community-responsiveness metrics from
 * the GitHub API and prints a Markdown snapshot table.
 *
 * Usage:
 *   node scripts/analytics/adoption-snapshot.mjs --token $GH_TOKEN [--repo owner/repo]
 *
 * Without --token the script uses the GITHUB_TOKEN env var.
 * Public repos work without a token for most endpoints (60 req/h limit).
 *
 * Bead: bead-0745
 */

import { parseArgs } from 'node:util';

// ── CLI args ──────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    token: { type: 'string' },
    repo: { type: 'string', default: '45ck/Portarium' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: false,
});

if (args['help']) {
  console.log(`
adoption-snapshot.mjs — CHAOSS-aligned adoption metrics

Usage:
  node scripts/analytics/adoption-snapshot.mjs [options]

Options:
  --token  <token>     GitHub personal access token (or set GITHUB_TOKEN env var)
  --repo   <owner/repo> Repository to analyse (default: 45ck/Portarium)
  -h, --help           Print this help text

Output:
  Markdown table to stdout — paste into monthly community update.
`);
  process.exit(0);
}

const REPO = /** @type {string} */ (args['repo']);
const TOKEN = args['token'] ?? process.env['GITHUB_TOKEN'] ?? '';
const API_BASE = 'https://api.github.com';

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * @param {string} path
 * @param {string} [accept]
 * @returns {Promise<unknown>}
 */
async function ghGet(path, accept = 'application/vnd.github+json') {
  const headers = /** @type {Record<string, string>} */ ({
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portarium-adoption-snapshot/1.0',
  });
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} → ${res.status.toString()} ${res.statusText}`);
  }
  return res.json();
}

// ── Metric collectors ─────────────────────────────────────────────────────────

/**
 * @returns {Promise<{uniqueClones: number, totalClones: number}>}
 */
async function getClones() {
  if (!TOKEN) return { uniqueClones: -1, totalClones: -1 };
  try {
    const data = /** @type {{uniques: number, count: number}} */ (
      await ghGet(`/repos/${REPO}/traffic/clones`)
    );
    return { uniqueClones: data.uniques, totalClones: data.count };
  } catch {
    return { uniqueClones: -1, totalClones: -1 };
  }
}

/**
 * @returns {Promise<{uniqueViews: number, totalViews: number}>}
 */
async function getViews() {
  if (!TOKEN) return { uniqueViews: -1, totalViews: -1 };
  try {
    const data = /** @type {{uniques: number, count: number}} */ (
      await ghGet(`/repos/${REPO}/traffic/views`)
    );
    return { uniqueViews: data.uniques, totalViews: data.count };
  } catch {
    return { uniqueViews: -1, totalViews: -1 };
  }
}

/**
 * @returns {Promise<number>}
 */
async function getStarCount() {
  try {
    const data = /** @type {{stargazers_count: number}} */ (await ghGet(`/repos/${REPO}`));
    return data.stargazers_count;
  } catch {
    return -1;
  }
}

/**
 * @returns {Promise<number>}
 */
async function getForkCount() {
  try {
    const data = /** @type {{forks_count: number}} */ (await ghGet(`/repos/${REPO}`));
    return data.forks_count;
  } catch {
    return -1;
  }
}

/**
 * @returns {Promise<{open: number, closed: number, staleCount: number}>}
 */
async function getIssueStats() {
  try {
    const openData = await ghGet(`/repos/${REPO}/issues?state=open&per_page=100`);
    const openIssues = /** @type {Array<{created_at: string, updated_at: string}>} */ (
      Array.isArray(openData) ? openData : []
    );
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const staleCount = openIssues.filter((i) => new Date(i.updated_at) < thirtyDaysAgo).length;
    return { open: openIssues.length, closed: -1, staleCount };
  } catch {
    return { open: -1, closed: -1, staleCount: -1 };
  }
}

/**
 * Compute median time-to-first-response for recently closed issues (last 30).
 * @returns {Promise<number>} median hours, or -1 if unavailable
 */
async function getMedianFirstResponse() {
  if (!TOKEN) return -1;
  try {
    const issues = /** @type {Array<{number: number, created_at: string}>} */ (
      await ghGet(`/repos/${REPO}/issues?state=closed&per_page=30&sort=updated`)
    );
    if (!Array.isArray(issues) || issues.length === 0) return -1;

    const durations = /** @type {number[]} */ ([]);
    for (const issue of issues.slice(0, 10)) {
      try {
        const comments = /** @type {Array<{created_at: string}>} */ (
          await ghGet(`/repos/${REPO}/issues/${issue.number.toString()}/comments?per_page=1`)
        );
        if (Array.isArray(comments) && comments.length > 0 && comments[0]) {
          const created = new Date(issue.created_at).getTime();
          const firstReply = new Date(comments[0].created_at).getTime();
          durations.push((firstReply - created) / (1000 * 60 * 60));
        }
      } catch {
        // skip individual issue errors
      }
    }
    if (durations.length === 0) return -1;
    durations.sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    return durations.length % 2 === 0
      ? ((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2
      : (durations[mid] ?? 0);
  } catch {
    return -1;
  }
}

/**
 * @returns {Promise<{total: number, daysSinceLast: number}>}
 */
async function getReleaseStats() {
  try {
    const releases = /** @type {Array<{published_at: string}>} */ (
      await ghGet(`/repos/${REPO}/releases?per_page=10`)
    );
    if (!Array.isArray(releases) || releases.length === 0) {
      return { total: 0, daysSinceLast: -1 };
    }
    const latest = releases[0];
    const daysSinceLast = latest
      ? Math.floor((Date.now() - new Date(latest.published_at).getTime()) / (1000 * 60 * 60 * 24))
      : -1;
    return { total: releases.length, daysSinceLast };
  } catch {
    return { total: -1, daysSinceLast: -1 };
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * @param {number} val
 * @param {string} [suffix]
 */
function fmt(val, suffix = '') {
  return val < 0 ? '_n/a_' : `${val.toString()}${suffix}`;
}

/**
 * @param {number} hours
 */
function fmtHours(hours) {
  if (hours < 0) return '_n/a_';
  if (hours < 1) return `${Math.round(hours * 60).toString()} min`;
  return `${hours.toFixed(1)} h`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.error(`Collecting metrics for ${REPO} …`);
  const now = new Date().toISOString().slice(0, 10);

  const [clones, views, stars, forks, issues, medianResponse, releases] = await Promise.all([
    getClones(),
    getViews(),
    getStarCount(),
    getForkCount(),
    getIssueStats(),
    getMedianFirstResponse(),
    getReleaseStats(),
  ]);

  const stalePercent =
    issues.open > 0 && issues.staleCount >= 0
      ? `${((issues.staleCount / issues.open) * 100).toFixed(0)}%`
      : '_n/a_';

  const output = `## Portarium Adoption Snapshot — ${now}

> Generated by \`scripts/analytics/adoption-snapshot.mjs\`
> CHAOSS-aligned metrics for \`${REPO}\`

### Adoption Funnel

| Stage | Metric | Value |
| --- | --- | --- |
| Awareness | Unique cloners (14d) | ${fmt(clones.uniqueClones)} |
| Awareness | Total clones (14d) | ${fmt(clones.totalClones)} |
| Awareness | Unique page views (14d) | ${fmt(views.uniqueViews)} |
| Interest | GitHub stars | ${fmt(stars)} |
| Interest | Forks | ${fmt(forks)} |
| Activation | Open issues | ${fmt(issues.open)} |
| Health | Stale issues (> 30d no activity) | ${stalePercent} |

### Community Responsiveness

| Metric | Value | Target SLO |
| --- | --- | --- |
| Median time-to-first-response | ${fmtHours(medianResponse)} | ≤ 48 h |
| Stale issues | ${stalePercent} | < 20% |

### Release Cadence

| Metric | Value | Target |
| --- | --- | --- |
| Releases tracked (last 10) | ${fmt(releases.total)} | — |
| Days since last release | ${fmt(releases.daysSinceLast, ' days')} | ≤ 90 days |
`;

  process.stdout.write(output);
  console.error('Done.');
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

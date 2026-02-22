# Release Analytics: Adoption Funnel & Community Responsiveness

> **Audience**: Project maintainers, DevRel, and community managers.
>
> **Goal**: Track the health of community adoption and maintainer responsiveness using
> CHAOSS-aligned metrics that can be computed from GitHub data alone (no third-party SaaS
> required to start).

---

## 1. Metric families (CHAOSS-aligned)

### 1.1 Adoption funnel

| Stage          | Metric                                        | CHAOSS reference           | Data source                        |
| -------------- | --------------------------------------------- | -------------------------- | ---------------------------------- |
| **Awareness**  | Unique repository cloners (14-day window)     | Clones                     | GitHub Traffic API                 |
| **Awareness**  | Unique page views (14-day window)             | Views                      | GitHub Traffic API                 |
| **Interest**   | New GitHub stars (weekly)                     | Stars                      | GitHub Events API                  |
| **Interest**   | Forks created (weekly)                        | Forks                      | GitHub Events API                  |
| **Activation** | Issues opened by first-time contributors      | New Contributors           | CHAOSS: `contributors`             |
| **Activation** | PRs opened by first-time contributors         | New Contributors           | GitHub Search API                  |
| **Retention**  | Contributors active in ≥ 2 consecutive months | Contributor Absence Factor | CHAOSS: contributor-absence-factor |
| **Referral**   | External mentions / backlinks                 | Social Listening           | manual / Google Alerts             |

### 1.2 Community responsiveness

| Metric                                      | Target SLO | CHAOSS reference            | Data source       |
| ------------------------------------------- | ---------- | --------------------------- | ----------------- |
| Median time-to-first-response on issues     | ≤ 48 h     | Time to First Response      | GitHub Issues API |
| Median time-to-close on bugs                | ≤ 14 days  | Issue Resolution Duration   | GitHub Issues API |
| PR review turnaround (first review comment) | ≤ 72 h     | Code Review Turnaround Time | GitHub PRs API    |
| Stale issues (open > 30 days, no activity)  | < 20 %     | Issue Age                   | GitHub Issues API |

### 1.3 Release cadence

| Metric                                   | Target | CHAOSS reference        | Data source         |
| ---------------------------------------- | ------ | ----------------------- | ------------------- |
| Releases per quarter                     | ≥ 1    | Release Frequency       | GitHub Releases API |
| Days since last release                  | ≤ 90   | Time Since Last Release | GitHub Releases API |
| Changelog coverage (% of PRs with entry) | 100 %  | manual                  | `docs/changelog.md` |

---

## 2. Data collection approach

### 2.1 GitHub API queries (no token required for public repos, 60 req/h)

```bash
# Clones (requires repo:read token)
curl -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/45ck/Portarium/traffic/clones

# Views
curl -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/45ck/Portarium/traffic/views

# Stars timeline
curl https://api.github.com/repos/45ck/Portarium/stargazers \
  -H "Accept: application/vnd.github.v3.star+json"

# First-time contributors (issues)
curl "https://api.github.com/search/issues?q=repo:45ck/Portarium+type:issue+author:app/first-contributor"
```

### 2.2 Causal Metrics script (optional, local)

A minimal Node.js script to pull and aggregate the above into a markdown table
can be placed at `scripts/analytics/adoption-snapshot.mjs`:

```bash
node scripts/analytics/adoption-snapshot.mjs --token $GH_TOKEN
```

Output is a Markdown table suitable for pasting into monthly community updates.

### 2.3 GitHub Insights (built-in, zero setup)

For quick checks without scripting:

1. **Traffic**: `github.com/45ck/Portarium/graphs/traffic` — clones, views, referrers
2. **Contributors**: `github.com/45ck/Portarium/graphs/contributors`
3. **Community health**: `github.com/45ck/Portarium/community`

---

## 3. Reporting cadence

| Report                                    | Frequency          | Owner           | Audience             |
| ----------------------------------------- | ------------------ | --------------- | -------------------- |
| Weekly pulse (stars, clones, open issues) | Weekly (Monday)    | DevRel          | Maintainers          |
| Monthly community health dashboard        | 1st of each month  | Lead maintainer | Core team + sponsors |
| Quarterly release retrospective           | After each release | Release manager | All contributors     |

### Monthly dashboard template

```markdown
## Community Health — YYYY-MM

### Adoption funnel

| Stage            | Count | Δ vs last month |
| ---------------- | ----- | --------------- |
| Clones (unique)  | N     | ±N              |
| Stars            | N     | ±N              |
| New contributors | N     | ±N              |

### Responsiveness

| Metric                        | Actual | Target |
| ----------------------------- | ------ | ------ |
| Median time-to-first-response | N h    | ≤ 48 h |
| Stale issues                  | N %    | < 20 % |
| PR review turnaround          | N h    | ≤ 72 h |

### Release

| Metric                  | Value |
| ----------------------- | ----- |
| Releases this quarter   | N     |
| Days since last release | N     |
```

---

## 4. Thresholds and alerts

| Signal                                       | Alert threshold                          | Action                         |
| -------------------------------------------- | ---------------------------------------- | ------------------------------ |
| Clones drop > 50 % week-over-week            | Investigate README / quickstart friction | Review top referrer pages      |
| Stale issues > 20 %                          | Triage sprint                            | Schedule dedicated triage hour |
| Time-to-first-response > 72 h on bug reports | Escalate to on-call maintainer           | Assign directly via `@mention` |
| Zero releases in 90 days                     | Release readiness review                 | Check bead gate status         |

---

## 5. Privacy and data handling

- GitHub Traffic API data is **aggregate only** — no individual user tracking.
- Stars/forks are public events; no PII collected.
- If a third-party analytics platform (Plausible, PostHog) is added later, add an ADR.
- All metric snapshots stored in `docs/analytics/` are commit-safe (no tokens, no PII).

---

## 6. Related documents

| Document                                     | Purpose                                |
| -------------------------------------------- | -------------------------------------- |
| `docs/how-to/technical-adopter-gtm.md`       | Conversion funnel targets and outreach |
| `docs/how-to/demo-launch-kit.md`             | Launch outreach checklist              |
| `docs/how-to/runnable-state-mvp-campaign.md` | Integration-complete gate              |
| `docs/changelog.md`                          | Release history                        |

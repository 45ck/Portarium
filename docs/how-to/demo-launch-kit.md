# Demo Launch Kit

> Bead: bead-0732 — Demo launch kit: outreach templates, publish checklist, and post-launch metrics

This document packages everything needed to launch the Portarium Cockpit demo campaign: outreach copy templates, a publish checklist, and a metrics tracking plan.

---

## Overview

The launch kit covers three personas:

| Persona                 | Goal                                                    | Primary asset                             |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------- |
| **Technical adopter**   | Evaluate integration posture and run governed workflows | `examples/hello-connector` + demo clip 06 |
| **Governance reviewer** | See approval gate, evidence chain, and audit trail      | Demo clips 01–03                          |
| **Platform operator**   | Understand fleet connectivity and robotics map UX       | Demo clips 04–05                          |

---

## 1. Outreach Templates

### 1.1 GitHub repository description

```
Portarium — Governed automation platform with approval gates, evidence chains, and connector SDK. Try the Cockpit demo in 30 seconds.
```

### 1.2 README hero section (short pitch)

```markdown
## What is Portarium?

Portarium is an open-source governed automation platform that:

- **Routes work** through human approval gates before execution
- **Captures evidence** at every step — hash-chained and auditable
- **Connects anything** via a typed adapter SDK (hello-connector scaffold in `examples/`)
- **Shows fleet status** with a real-time operations map

**Try it in 30 seconds:**

\`\`\`bash
npx --yes http-server docs/ui/cockpit -p 4174

# open http://localhost:4174

\`\`\`
```

### 1.3 LinkedIn / dev.to announcement post

```
🚀 We just open-sourced Portarium — a governed automation platform for teams who need:

✅ Human-in-the-loop approval gates
✅ Hash-chained evidence for every decision
✅ A connector SDK that wires up any external system in ~30 min
✅ A real-time fleet operations map

The Cockpit UI runs as a zero-install static demo.

Try it now → [repo link]

#OpenSource #Automation #GovernedAI #Robotics
```

### 1.4 Hacker News "Show HN" post

**Title:** Show HN: Portarium – open-source governed automation with approval gates and evidence chains

**Body:**

```
I built Portarium to solve a recurring problem: teams need human checkpoints before high-stakes automation runs, and they need a permanent, auditable record of every decision.

Key things I'd love feedback on:
- The approval gate + evidence chain model (docs/ui/cockpit demo shows this end-to-end)
- The connector SDK design (examples/hello-connector walks you through wiring up any external system)
- The robotics/fleet integration story (VDA 5050 v2.0, MassRobotics, Open-RMF adapters are in src/infrastructure/)

30-second demo (no install required):
  npx --yes http-server docs/ui/cockpit -p 4174

Full integration walkthrough: docs/integration/integration-ladder.md

Looking for: early adopters, integration partners, and anyone who's felt the pain of "we approved this in Slack and now nobody can find the audit trail."
```

### 1.5 Cold outreach email (technical buyer)

**Subject:** Quick question about [Company]'s automation approval workflow

```
Hi [Name],

I noticed [Company] is [building / operating] automated workflows — I thought you might find Portarium relevant.

Portarium is an open-source platform that routes automation runs through structured approval gates and captures hash-chained evidence at each step. It includes:

- A connector SDK (examples/hello-connector) — wire up any external system in ~30 min
- VDA 5050 v2.0 / MassRobotics / Open-RMF adapters for robotics fleets
- A governed Cockpit UI with real-time evidence audit trail

30-second demo: npx --yes http-server docs/ui/cockpit -p 4174

Happy to do a 15-min walkthrough if that's useful.

[Your name]
```

---

## 2. Publish Checklist

Run this checklist before the public announcement. Check off each item as complete.

### 2.1 Code quality

- [ ] `npm run ci:pr` passes (typecheck + format + depcruise + knip + tests)
- [ ] `npm run cockpit:demo:redaction:check` passes (no sensitive data in demo artifacts)
- [ ] `npm run cockpit:demo:gallery:dry-run` exits 0 (all 6 clip specs valid)
- [ ] `npm run cockpit:assets:check` passes (no orphaned assets)

### 2.2 Demo UX

- [ ] `npx --yes http-server docs/ui/cockpit -p 4174` starts without error
- [ ] Approval gate demo (clip 01) flows end-to-end: approve → run unblocked
- [ ] Evidence chain demo (clip 02) shows hash-chained entries
- [ ] Correlation traversal (clip 03) opens context drawer correctly
- [ ] `#demoResetButton` works on all demo pages
- [ ] Mobile breakpoints verified at 375px and 768px widths

### 2.3 Documentation

- [ ] `README.md` has 30-second getting-started snippet
- [ ] `examples/hello-connector/README.md` complete with prerequisites and steps
- [ ] `docs/integration/integration-ladder.md` published (L0–L3)
- [ ] `docs/how-to/run-cockpit-demos-locally.md` accurate and tested
- [ ] `CONTRIBUTING.md` has development setup instructions

### 2.4 Repository hygiene

- [ ] Repository description set (use template in §1.1)
- [ ] Topics set: `automation`, `governance`, `approval-workflow`, `robotics`, `open-source`
- [ ] License file present (MIT or Apache-2.0)
- [ ] No secrets in git history (`git log --all --full-history -S "key\|token\|secret"` returns nothing suspicious)
- [ ] `scripts/ci/scan-secrets.mjs` passes on current HEAD

### 2.5 Media

- [ ] Hero GIF or MP4 embedded in README (from demo clip 01 or 02)
- [ ] Gallery artifacts published at `docs/ui/cockpit/demo-machine/gallery/`
- [ ] Screenshots at `docs/ui/cockpit/screenshots/` up-to-date

### 2.6 Announcement prep

- [ ] Outreach copy reviewed and personalised (§1.2–§1.5)
- [ ] Primary launch channel confirmed (HN, LinkedIn, dev.to, Twitter/X)
- [ ] Launch date/time set (aim for Tuesday–Thursday, 9–11 AM Pacific)
- [ ] Tracking links set up for each channel (UTM params or similar)

---

## 3. Post-Launch Metrics Plan

Track these metrics for the first 30 days after launch.

### 3.1 Reach metrics (leading indicators)

| Metric                  | Target (30d) | Tracking source    |
| ----------------------- | ------------ | ------------------ |
| GitHub stars            | 100          | GitHub Insights    |
| GitHub forks            | 15           | GitHub Insights    |
| Unique visitors to repo | 500          | GitHub Traffic     |
| HN Show HN upvotes      | 20           | HN post            |
| LinkedIn impressions    | 2,000        | LinkedIn Analytics |

### 3.2 Engagement metrics (quality signal)

| Metric                                           | Target (30d) | Tracking source       |
| ------------------------------------------------ | ------------ | --------------------- |
| Issues opened (feature/bug)                      | 5            | GitHub Issues         |
| Pull requests from external contributors         | 2            | GitHub PRs            |
| Discussion threads started                       | 3            | GitHub Discussions    |
| `hello-connector` scaffold downloads (examples/) | 50           | Traffic + clone count |

### 3.3 Demo funnel metrics

| Step                 | Event                                       | Target conversion |
| -------------------- | ------------------------------------------- | ----------------- |
| Repo visit           | Lands on README                             | —                 |
| Demo viewed          | Clicks demo GIF / runs http-server          | 30% of visitors   |
| Connector tried      | Clones repo + runs examples/hello-connector | 10% of visitors   |
| Integration question | Opens issue or discussion                   | 3% of visitors    |

### 3.4 Metrics review cadence

- **Day 3**: Quick check — did the announcement land? Any spam/negative signals?
- **Day 7**: First metrics snapshot. Adjust outreach channels if HN < 10 upvotes.
- **Day 14**: Mid-point review. Identify top-performing content. Draft follow-up posts.
- **Day 30**: Full retrospective. Document what worked. Plan v2 campaign.

### 3.5 Metrics log template

Copy this template to `docs/sprints/launch-metrics-YYYY-MM-DD.md` for each review:

```markdown
# Launch Metrics — YYYY-MM-DD

## Reach

- GitHub stars: N
- GitHub forks: N
- Unique repo visitors (7d): N

## Engagement

- Issues opened: N (feature: N, bug: N)
- External PRs: N
- Discussions: N

## Demo funnel

- Demo GIF views (README): estimated via traffic
- hello-connector clones: N

## Notes / observations

[Free text]

## Actions for next period

- [ ] Action 1
- [ ] Action 2
```

---

## 4. Quick Reference

| Script                                       | Purpose                          |
| -------------------------------------------- | -------------------------------- |
| `npm run cockpit:demo:gallery`               | Render all 6 clip GIFs + MP4s    |
| `npm run cockpit:demo:gallery:dry-run`       | Validate clips without browser   |
| `npm run cockpit:demo:redaction:check`       | Scan for sensitive data          |
| `npm run cockpit:demo:approvals-v2:showcase` | Render approvals-v2 showcase GIF |
| `npm run cockpit:assets:check`               | Validate asset manifest          |

---

_Last updated: 2026-02-22 — bead-0732_

# Technical-Adopter GTM & Onboarding Readiness

> **Audience**: Engineering leads, developer-relations, and community maintainers preparing
> for the first wave of external technical adopters.
>
> **Goal**: Ensure every touch-point a technical adopter encounters — from README to first
> successful smoke test — is friction-free, trust-building, and conversion-oriented.

---

## 1. Adopter personas

| Persona | Primary goal | Entry point | Success signal |
|---------|-------------|-------------|----------------|
| **Integration engineer** | Wire an existing ERP/CRM into a governed workflow | `docs/tutorials/hello-governed-workflow.md` | First `npm run seed:local` + smoke test green |
| **Platform / SRE** | Run the stack in their infra, hook into observability | `docs/onboarding/sre-track.md` | Health probes live, evidence chain verifiable |
| **Security / compliance lead** | Validate audit trail and auth model | `docs/onboarding/secops-track.md` | Evidence chain verified, policy tier understood |
| **OSS contributor** | Fix a bug or add a feature | `CONTRIBUTING.md` + dev-track | First PR merged |

---

## 2. Pre-launch readiness checklist

### 2.1 Documentation completeness

- [ ] `README.md` — one-sentence value prop, 60-second quick-start, badges (CI, license)
- [ ] `docs/tutorials/hello-governed-workflow.md` — end-to-end in ≤ 30 min
- [ ] `docs/onboarding/dev-track.md` — environment + first adapter
- [ ] `docs/onboarding/sre-track.md` — runtime topology + health probes
- [ ] `docs/onboarding/secops-track.md` — evidence chain + auth model
- [ ] `docs/how-to/first-run-local-integrations.md` — local integrations guide
- [ ] `CONTRIBUTING.md` — commit conventions, PR workflow, bead tracking
- [ ] `docs/faq.md` — at least 10 questions seeded from design-partner sessions

### 2.2 Code readiness gates

- [ ] `npm run seed:local` completes without errors on Node ≥ 22
- [ ] `npm run ci:pr` green on a clean checkout
- [ ] Smoke tests pass: `npm run test` (≥ 295 test files)
- [ ] `src/sdk/evidence-chain-verifier.ts` published and importable
- [ ] `src/sdk/mis-v1.ts` published and importable
- [ ] MIS v0.1 descriptor frozen at `schemaVersion: 1`

### 2.3 Community infrastructure

- [ ] GitHub Discussions enabled (Q&A + Show-and-tell categories)
- [ ] `CODEOWNERS` file maps each layer to a maintainer
- [ ] Issue templates: bug report, feature request, integration request
- [ ] Discord / Slack invite link in README (or decision to skip async chat)
- [ ] Security policy (`SECURITY.md`) with responsible-disclosure flow

---

## 3. First-adopter activation path

```
GitHub README
      │
      ▼
"Quick Start" (60 seconds)
      │  npm run seed:local && npm test
      ▼
Hello Governed Workflow tutorial (≤ 30 min)
      │  implement stub MisAdapterV1
      ▼
Role-based onboarding track (Dev / SRE / SecOps)
      │
      ▼
Design-partner conversation
      │  structured feedback session
      ▼
First contribution or integration PR
```

---

## 4. Messaging framework

### 4.1 Core value proposition

> **Portarium (VAOP)** gives every agentic workflow an auditable, policy-governed execution
> layer — so you can ship AI-driven automation with the same compliance guarantees as your
> manual business processes.

### 4.2 Pain-point mapping

| Pain point | Portarium answer |
|------------|-----------------|
| "AI agents are a black box — we can't audit what they did" | Hash-chained evidence log (`EvidenceEntryV1`) — every action is recorded and tamper-evident |
| "We need human approval before high-risk steps" | Four-tier approval policy: Auto / Assisted / HumanApprove / ManualOnly |
| "Our integrations are bespoke and fragile" | MIS v0.1 adapter interface — one contract, 20 port families |
| "Compliance team wants SOC 2 / ISO 27001 artefacts" | Evidence chain maps directly to CC6/CC7 and A.12.4 controls |

### 4.3 Proof points to surface early

1. `npm run seed:local` works in < 2 minutes on a fresh clone
2. End-to-end smoke test produces a verifiable evidence chain
3. Domain code has **zero** external dependencies (enforced by dependency-cruiser)
4. Full test suite (≥ 295 files) passes in < 60 seconds

---

## 5. Outreach channels and sequencing

### Week 0 — Design-partner seeding (private)

- Identify 3–5 engineering leads from target verticals (FinTech, HealthTech, GovTech)
- Invite to private GitHub repo access
- Async review of `hello-governed-workflow.md` + 30-min feedback call
- Capture verbatim pain points for FAQ and messaging refinement

### Week 1 — Soft launch (semi-public)

- Open GitHub repo visibility
- Post in relevant communities (Hacker News "Ask HN: who wants to try?", relevant subreddits,
  AI-engineering Slack/Discord servers)
- Target: 50 repo stars, 10 issues filed, 3 PRs from external contributors

### Week 2–4 — Content distribution

- Technical blog post: "How we built a tamper-evident evidence chain in TypeScript"
- Show-and-tell: record a 10-min demo (seed → smoke test → evidence verification)
- Submit to: CNCF TAG App Delivery, OpenFGA community, relevant newsletter curators

### Week 4+ — Community flywheel

- Respond to every issue within 48 h
- Triage PRs within 72 h
- Monthly community sync (async video or live call)

---

## 6. Conversion funnel metrics

| Stage | Event | Target (week 4) |
|-------|-------|-----------------|
| Awareness | Unique repo visitors | 500 |
| Interest | README → tutorial click-through | 20 % |
| Activation | `npm run seed:local` attempted | 50 |
| Retention | Returns within 7 days | 30 % |
| Referral | External mention / share | 10 |

Track with: GitHub Traffic → Insights (clones, views), Discussions activity, PR/issue counts.

---

## 7. Feedback collection mechanism

### In-repository

- GitHub Discussions "Q&A" category — all support questions
- GitHub Discussions "Ideas" category — feature requests
- Issue template `integration-request.yml` — new port-family proposals

### Out-of-band

- Monthly 30-min "adopter office hours" video call (Zoom/Google Meet)
- Structured survey after first week of use (3 questions max):
  1. What's the single most confusing thing you encountered?
  2. Which integration family do you need most urgently?
  3. Would you recommend Portarium to a colleague today? (NPS 0–10)

---

## 8. Related documents

| Document | Purpose |
|----------|---------|
| `docs/tutorials/hello-governed-workflow.md` | Entry-point tutorial |
| `docs/onboarding/dev-track.md` | Developer onboarding |
| `docs/onboarding/sre-track.md` | SRE onboarding |
| `docs/onboarding/secops-track.md` | SecOps onboarding |
| `docs/how-to/runnable-state-mvp-campaign.md` | Integration-complete campaign gate |
| `docs/how-to/demo-launch-kit.md` | Demo outreach kit |

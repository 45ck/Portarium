# Spec: Adoption Campaign — Technical-Adopter GTM and Onboarding Readiness (v1)

**Bead:** bead-0740 (campaign)

## Context

Portarium needs a structured technical-adopter go-to-market (GTM) path that enables
integration partners, enterprise platform teams, and OSS contributors to progress from
discovery to production deployment. This campaign delivers the onboarding documentation,
adoption-ladder milestones, and tooling required to make that journey self-service.

## Goals

1. Define a 5-level adoption ladder (L0–L4) with clear entry/exit criteria.
2. Provide a "Hello Portarium" quickstart guide that gets an adopter to a running local
   instance within 30 minutes.
3. Publish an Adoption Readiness Checklist that a platform team can use to gate their
   production rollout.
4. Document SDK integration patterns for the three primary adopter personas:
   - Connector author (publishes vertical packs)
   - Orchestration consumer (runs workflows via Portarium SDK)
   - Governance reviewer (reads evidence chains and approves runs)
5. Create a discovery-to-deploy GTM playbook that maps the adoption ladder to sales/community touchpoints.

## Adoption Ladder

| Level | Label             | Description                                            | Exit Criterion                                  |
| ----- | ----------------- | ------------------------------------------------------ | ----------------------------------------------- |
| L0    | Discovery         | Evaluator reads docs, runs local demo                  | Completes hello-portarium quickstart            |
| L1    | Integration Spike | Connects a single vertical pack in staging             | First workflow run with evidence chain captured |
| L2    | Pilot             | Runs a governed workflow with approval gate in staging | Approval gate exercised; evidence reviewed      |
| L3    | Production-Ready  | Passes Adoption Readiness Checklist                    | All checklist items green                       |
| L4    | Full Adopter      | Multi-tenant production deployment with SLA monitoring | First quarterly review passed                   |

## Requirements

### R1 — Hello Portarium Quickstart

- `docs/getting-started/hello-portarium.md` must exist with:
  - Prerequisites (Node ≥ 20, Docker Compose)
  - `git clone` + `npm install` + `npm run dev` steps
  - First workflow run walkthrough
  - Link to next-step: Adoption Ladder L1

### R2 — Adoption Readiness Checklist

- `docs/adoption/adoption-readiness-checklist.md` must exist with:
  - Security gate: JWT claim schema validated
  - Data residency: tenant storage tier configured
  - Evidence durability: S3 WORM bucket configured or FileSystem adapter accepted
  - Observability: OpenTelemetry export endpoint configured
  - Access control: OpenFGA model deployed
  - Dependency audit: `npm run audit:high` clean
  - Schema migration: `npm run migrate:apply:ci` successful against target DB

### R3 — GTM Playbook

- `docs/adoption/gtm-playbook.md` must exist with:
  - Adopter persona definitions (Connector Author, Orchestration Consumer, Governance Reviewer)
  - Discovery touchpoints (documentation site, GitHub README, demo video links)
  - L0→L1 conversion triggers
  - Community engagement channels (GitHub Discussions, Discord invite placeholder)

### R4 — SDK Integration Patterns

- `docs/sdk/integration-patterns.md` must exist with:
  - Connector Author: vertical pack scaffold walkthrough
  - Orchestration Consumer: `PortariumClient` usage with typed workflow invocation
  - Governance Reviewer: evidence chain verification via `EvidenceChainVerifier`

### R5 — Adoption Ladder Document

- `docs/adoption/adoption-ladder.md` must exist documenting L0–L4 as specified above.

## Test coverage required

- Spec file existence is self-documenting; no unit tests required.
- CI link-check (`docs-lint.yml`) must not 404 on any internal document references added
  by this campaign.

## Acceptance criteria

- [ ] All five documents listed in R1–R5 exist under `docs/`.
- [ ] `docs/getting-started/hello-portarium.md` includes `npm run dev` as a runnable command.
- [ ] Adoption Readiness Checklist references `npm run audit:high` and `npm run migrate:apply:ci`.
- [ ] GTM playbook names all three adopter personas.
- [ ] SDK patterns doc covers all three persona-specific integration examples.

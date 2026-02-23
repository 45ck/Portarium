# Portarium Adoption Ladder

The Adoption Ladder defines a structured progression from first contact with Portarium
to a full production deployment with SLA monitoring.

Each level has clear entry requirements and measurable exit criteria.

## Levels

### L0 — Discovery

**Goal:** Evaluator understands what Portarium is and can run it locally.

**Entry:** None.

**Exit criterion:** Completes the [Hello Portarium quickstart](../getting-started/hello-portarium.md)
and has a workflow run with an evidence chain locally.

---

### L1 — Integration Spike

**Goal:** Team connects a single vertical pack against a staging Portarium instance.

**Entry:** L0 complete; staging environment available.

**Exit criterion:**

- First workflow run via the Portarium SDK in staging.
- Evidence chain captured and verified (`npm run sdk:verify`).
- At least one vertical pack registered in the staging vertical pack registry.

---

### L2 — Pilot

**Goal:** A governed workflow with an approval gate runs end-to-end in staging.

**Entry:** L1 complete; access control model (OpenFGA) deployed to staging.

**Exit criterion:**

- Approval gate exercised: at least one run transitions through `pending_approval → approved → completed`.
- Evidence chain reviewed by a Governance Reviewer persona.
- JWT claim schema validated (`npm run test -- src/infrastructure/auth/jwt-claim-schema-v1.test.ts`).

---

### L3 — Production-Ready

**Goal:** Platform team passes the Adoption Readiness Checklist.

**Entry:** L2 complete; production infrastructure provisioned.

**Exit criterion:** All items in the [Adoption Readiness Checklist](./adoption-readiness-checklist.md) are green.

---

### L4 — Full Adopter

**Goal:** Multi-tenant production deployment operating with SLA monitoring and quarterly review cadence.

**Entry:** L3 complete; observability stack live.

**Exit criterion:**

- Multi-tenant schema migrations applied (`npm run migrate:apply:ci`).
- OpenTelemetry traces flowing to production APM.
- First quarterly governance review completed.

---

## Quick reference

| Level | Label             | Key milestone                                      |
| ----- | ----------------- | -------------------------------------------------- |
| L0    | Discovery         | Hello Portarium quickstart complete                |
| L1    | Integration Spike | First SDK workflow run + evidence chain in staging |
| L2    | Pilot             | Approval gate + evidence review in staging         |
| L3    | Production-Ready  | Adoption Readiness Checklist all-green             |
| L4    | Full Adopter      | Multi-tenant production + quarterly review         |

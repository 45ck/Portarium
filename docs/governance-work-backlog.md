# Governance and Quality Gates Work Backlog

## Backlog ordering

Priority is sorted by dependency order:

1. Process gates (cycle gate, phase transitions)
2. ADR closure tracking
3. Principal engineering governance (execution DAG, audits, quality)
4. Code review gates (per-ADR, per-family)
5. Closeout reviews (per-implementation)
6. Testing and evidence gates
7. Operational readiness (runbooks, onboarding)
8. Release gates

## Epics and stories

### EPIC-V01 — Process gates

Goal: enforce work lifecycle rules across all phases.

- STORY-V01.1 — bead-0160
  - Cycle gate: no implementation without design/spec/review linkage.
  - AC: implementation beads cannot start without linked spec and review.
- STORY-V01.2 — bead-0169
  - Release freeze: block new families while release closure bead is unresolved.
  - AC: freeze enforced; exceptions require explicit override.

### EPIC-V02 — Phase transition gates

Goal: enforce layered delivery — each phase completes before next starts.

- STORY-V02.1 — bead-0161
  - Phase gate: Foundation complete — gate, security baseline, API contract beads closed.
- STORY-V02.2 — bead-0162
  - Phase gate: Domain complete — aggregate invariants, parser coverage, domain factory, ADR traceability closed.
- STORY-V02.3 — bead-0163
  - Phase gate: Application complete — DTOs, use-cases, orchestration tests, approval/run policy mapping closed.
- STORY-V02.4 — bead-0164
  - Phase gate: Infrastructure complete — persistence, outbox, migration, observability, security containment closed.
- STORY-V02.5 — bead-0165
  - Phase gate: Presentation complete — OpenAPI route parity, middleware, authN/RBAC, envelope mapping closed.
- STORY-V02.6 — bead-0166
  - Phase gate: Integration complete — per-family readiness, contract fixtures, E2E smoke closed.
- STORY-V02.7 — bead-0167
  - Phase gate: Security complete — vulnerability, secret hygiene, tenant isolation, SoD, sandboxing closed.
- STORY-V02.8 — bead-0168
  - Phase gate: Release complete — ci:pr, quality gates, review audit, QA evidence closed.

### EPIC-V03 — ADR closure tracking

Goal: ensure every ADR has implementation + review + verification evidence.

- STORY-V03.1 — bead-0170
  - Per-ADR closure: ADR-001 through ADR-040 must have implementation, review, and verification evidence.
  - AC: closure matrix tracks all ADRs; gaps flagged.
- STORY-V03.2 — bead-0171
  - Per-ADR closure: ADR-041 through ADR-043 must be promoted from proposed/accepted before GA.
  - AC: promotion status tracked.
- STORY-V03.3 — bead-0172
  - Per-ADR closure: ADR-048 through ADR-138 legacy gaps mapped to implementation and review beads.
  - AC: gap analysis complete; missing beads created.

### EPIC-V04 — Principal engineering governance

Goal: prevent orphaned work, enforce quality standards, enable audit.

- STORY-V04.1 — bead-0158
  - PE: master execution DAG — encode open beads by phase, dependency, and evidence.
  - AC: DAG generated; critical-path identified.
- STORY-V04.2 — bead-0159
  - PE: dependency resolver — auto-detect missing prerequisites before bead start.
  - AC: resolver blocks incomplete prerequisites.
- STORY-V04.3 — bead-0185
  - PE audit: generate weekly report of orphaned beads and dependency deadlocks.
  - AC: report automated; orphans flagged.
- STORY-V04.4 — bead-0186
  - PE audit: verify no bead exists without owner, close criteria, and rollback trigger.
  - AC: audit checks enforced.
- STORY-V04.5 — bead-0191
  - PE quality: acceptance scorecard for each bead (spec, tests, review, docs, security, performance).
  - AC: scorecard template published; applied to all beads.
  - Artifact: `docs/governance/bead-acceptance-scorecard.md`
- STORY-V04.6 — bead-0192
  - PE quality: stop-loss thresholds (risk score, failed gates, open decisions) that force cycle halt.
  - AC: thresholds documented; enforcement mechanism in place.
  - Artifact: `docs/governance/stop-loss-thresholds.md`
  - Artifact: `docs/governance/bead-stop-loss-thresholds.md`

### EPIC-V05 — Code review gates

Goal: every implementation bead has a tracked code review.

**Per-ADR code reviews:**

| Bead      | Review target                                    |
| --------- | ------------------------------------------------ |
| bead-0063 | Code review: scaffold domain model structure     |
| bead-0064 | Code review: IAM MVP workspace users + RBAC      |
| bead-0065 | Code review: Control plane API v1 OpenAPI        |
| bead-0066 | Code review: ADR-029 hash chain implementation   |
| bead-0067 | Code review: ADR-030 quota-aware primitives      |
| bead-0068 | Code review: ADR-031 SoD model evaluation        |
| bead-0069 | Code review: ADR-032 CloudEvents envelope        |
| bead-0070 | Code review: ADR-033 OTel context propagation    |
| bead-0071 | Code review: ADR-034 containment/least-privilege |
| bead-0072 | Code review: ADR-035 domain-atlas pipeline       |
| bead-0073 | Code review: ADR-036 Portarium naming labels     |
| bead-0074 | Code review: ADR-037 git-backed definitions      |
| bead-0075 | Code review: ADR-038 Work Item binding domain    |
| bead-0076 | Code review: ADR-039 reference-vertical package  |
| bead-0077 | Code review: port-family integration matrix      |
| bead-0078 | Code review: per-family contract stubs           |
| bead-0079 | Code review: provider decision log automation    |

**Other code reviews:**

| Bead      | Review target                                           |
| --------- | ------------------------------------------------------- |
| bead-0058 | Port-family readiness matrix review                     |
| bead-0060 | Per-family contract stubs review                        |
| bead-0178 | Code review: architecture boundaries for scaffold files |
| bead-0323 | Code review: application-layer completion               |

### EPIC-V06 — Closeout reviews

Goal: every major implementation has closeout evidence before close.

**ADR/domain closeout reviews:**

| Bead      | Closeout target                           |
| --------- | ----------------------------------------- |
| bead-0207 | Closeout: scaffold domain model structure |
| bead-0208 | Closeout: IAM MVP                         |
| bead-0209 | Closeout: Control plane API v1            |
| bead-0210 | Closeout: ADR-029 hash chain              |
| bead-0211 | Closeout: ADR-030 quota primitives        |
| bead-0212 | Closeout: ADR-031 SoD model               |
| bead-0213 | Closeout: ADR-032 CloudEvents             |
| bead-0214 | Closeout: ADR-033 OTel propagation        |
| bead-0215 | Closeout: ADR-034 containment             |
| bead-0216 | Closeout: ADR-035 domain-atlas pipeline   |
| bead-0217 | Closeout: ADR-036 Portarium naming        |
| bead-0218 | Closeout: ADR-037 git-backed definitions  |
| bead-0219 | Closeout: ADR-038 Work Item binding       |
| bead-0220 | Closeout: ADR-039 reference-vertical      |
| bead-0221 | Closeout: port-family integration matrix  |
| bead-0222 | Closeout: per-family contract stubs       |

**Phase gate closeout reviews:**

| Bead      | Closeout target                     |
| --------- | ----------------------------------- |
| bead-0259 | Closeout: PE master execution DAG   |
| bead-0260 | Closeout: Foundation phase gate     |
| bead-0261 | Closeout: Domain phase gate         |
| bead-0262 | Closeout: Application phase gate    |
| bead-0263 | Closeout: Infrastructure phase gate |
| bead-0264 | Closeout: Presentation phase gate   |

**Port adapter family closeout reviews:** covered in `docs/integration-layer-work-backlog.md` (bead-0223 through bead-0258).

### EPIC-V07 — Testing and evidence gates

Goal: layered quality assurance with traceability.

- STORY-V07.1 — bead-0181
  - Test evidence: coverage thresholds on all new code.
  - AC: CI blocks PRs below threshold.
- STORY-V07.2 — bead-0182
  - Test evidence: mutation-test or fault-injection for policy and SoD logic.
  - AC: mutation score above threshold; gaps documented.
- STORY-V07.3 — bead-0183
  - Review: tie each spec in .specify/specs to at least one implementation and test bead.
  - AC: traceability matrix complete.
- STORY-V07.4 — bead-0184
  - Review: tie each implementation bead to test evidence and code-review bead.
  - AC: no bead closes without linked evidence.
- STORY-V07.5 — bead-0193
  - E2E data-model: canonical seeds for workspace, policy, run, evidence, work-item.
  - AC: seeds consistent across all test suites.
- STORY-V07.6 — bead-0194
  - E2E data-model: synthetic evidence and retention fixtures for proof-of-retention.
  - AC: legal-hold workflow exercised with fixtures.
  - Artifact: `src/domain/testing/synthetic-evidence-retention-fixtures-v1.ts`
- STORY-V07.7 — bead-0195
  - Tenant-isolated fixture factories for every aggregate and port operation.
  - AC: cross-tenant leakage blocked in tests.
- STORY-V07.8 — bead-0196
  - Review: verify tenant-isolated fixtures block cross-tenant leakage.
  - AC: review passed.

### EPIC-V07c — Operational domain coverage tracking

Goal: maintain a living gap map between Portarium's capabilities and the requirements of each operational domain.

- STORY-V07c.1 — bead-0429
  - Domain coverage matrix — map Portarium port families and canonical objects against operational domain requirements (marketing, finance, accounting, IT support, software delivery) with gap tracking.
  - AC: matrix published in `docs/`; gaps linked to open beads; reviewed each cycle; CI fails if a port family has no linked bead.

### EPIC-V07b — Third-party platform governance

Goal: manage licence risk and commercial obligations for adopted external execution platforms.

- STORY-V07b.1 — bead-0414
  - Licence compliance audit for adopted execution platforms: Activepieces (MIT core, commercial EE carve-outs), Kestra (Apache 2.0, EE features), StackStorm (Apache 2.0), Langflow (MIT).
  - AC: licence obligations documented per platform; EE feature boundaries identified; "safe use" guidelines published for each; any fair-code or multi-tenant restrictions flagged.

### EPIC-V07d — OpenClaw integration quality and security gates

Goal: ensure OpenClaw integration is tested, tool-safe, and multi-tenant by design.

- STORY-V07d.1 — bead-0441
  - Contract tests for machine/agent OpenAPI endpoints — schema validation, RBAC role gating, Problem Details error shapes, multi-tenant scoping assertions (cross-workspace access rejected).
  - AC: every new endpoint tested for auth, RBAC, and multi-tenant isolation; no schema drift from OpenAPI spec.
- STORY-V07d.2 — bead-0442
  - Integration tests for OpenClaw Gateway adapter with stub HTTP server — deterministic fixtures, `429`/`Retry-After` backoff, policy-blocked tool scenarios, agent output capture and evidence linkage.
  - AC: adapter tests run offline (no live Gateway dependency); 429 backoff verified; policy violations produce correct run state.
- STORY-V07d.3 — bead-0443
  - E2E approval-gated agent task run — cockpit starts a run containing an Agent Task step, run pauses at `HumanApprove` gate, approver submits decision, run resumes and completes with evidence entries showing `ActionDispatched`/`ActionCompleted`.
  - AC: approval gate works end-to-end; evidence chain intact; run status transitions verified.
- STORY-V07d.4 — bead-0444
  - OpenClaw tool blast-radius policy — map Gateway tools/skills to Portarium capability tiers; dangerous tools (system exec, browser automation) default to `HumanApprove` or `ManualOnly`; policy violations surface as "Policy blocked" run state in cockpit.
  - AC: policy mapping documented; CI tests verify dangerous tools cannot auto-run; documentation covers rationale per tool category.
- STORY-V07d.5 — bead-0445
  - OpenClaw multi-tenant isolation strategy — define per-workspace or per-security-domain Gateway deployment model; credential scoping requirements; network isolation requirements; decision recorded as ADR.
  - AC: decision document published; isolation requirements enforceable via network policy and credential grants; runbook covers provisioning a new workspace Gateway instance.

### EPIC-V08 — CI gates

Goal: automated quality enforcement in CI pipeline.

- STORY-V08.1 — bead-0179
  - CI gate: require architecture-guard, gate-baseline, and npm audit before merge.
  - AC: PRs blocked without passing gates.
- STORY-V08.2 — bead-0180
  - CI gate: require OpenAPI parser/golden fixture parity on every push and PR.
  - AC: drift detected and blocked.
- STORY-V08.3 — bead-0339
  - Upgrade ajv transitive dependency to >=8.18.0 (ReDoS advisories).
  - AC: npm audit clean for ajv; no moderate+ advisories.

### EPIC-V09 — Operational readiness

Goal: runbooks, onboarding, and rollback procedures documented.

- STORY-V09.1 — bead-0187
  - Onboarding: explain CLAUDE.md, docs, beading schema, and review/closure requirements.
  - AC: onboarding guide published; new contributors can self-serve.
- STORY-V09.2 — bead-0188
  - Runbook: start-to-finish execution order with owner assignments.
  - AC: execution order documented; owners assigned.
  - Artifact: `docs/governance/execution-order-runbook.md`
- STORY-V09.3 — bead-0189
  - Runbook: rollback plan for failing cycle.
  - AC: freeze scope, rollback scope, communication template documented.
  - Artifact: `docs/governance/failing-cycle-rollback-runbook.md`
- STORY-V09.4 — bead-0190
  - Runbook review: validate rollback includes data, evidence, and credential cleanup.
  - AC: review passed.
  - Artifact: `docs/review/bead-0190-rollback-cleanup-validation.md`

## New beads created for this backlog

| Bead      | Title                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bead-0429 | Governance: domain coverage matrix (port families vs operational domain requirements with gap tracking)                                                     |
| bead-0414 | Governance: licence compliance audit for adopted execution platforms (Activepieces MIT EE carve-outs, Kestra Apache 2.0 EE features)                        |
| bead-0441 | Governance: contract tests for machine/agent OpenAPI endpoints (schema, RBAC, Problem Details, multi-tenant scoping)                                        |
| bead-0442 | Governance: integration tests for OpenClaw adapter with stub Gateway (fixtures, 429 backoff, policy-blocked tools)                                          |
| bead-0443 | Governance: E2E approval-gated agent task run (HumanApprove gate, approval decision, evidence chain)                                                        |
| bead-0444 | Governance: OpenClaw tool blast-radius policy (tool-to-capability-tier mapping, dangerous tools default HumanApprove)                                       |
| bead-0445 | Governance: OpenClaw multi-tenant isolation strategy (per-workspace Gateway model, credential scoping, ADR)                                                 |
| bead-0452 | ADR: hybrid orchestration/choreography architecture — Temporal for run-lifecycle orchestration + CloudEvents stream for projection/integration choreography |

## Bead summary

| Category                                  | Bead count |
| ----------------------------------------- | ---------- |
| Process gates                             | 2          |
| Phase transition gates                    | 8          |
| ADR closure tracking                      | 3          |
| PE governance                             | 6          |
| Code reviews (ADR + other)                | 21         |
| Closeout reviews (ADR/domain/phase)       | 22         |
| Testing and evidence gates                | 8          |
| CI gates                                  | 3          |
| Operational readiness                     | 4          |
| Architecture decisions (research-derived) | 1          |
| **Total**                                 | **78**     |

## Delivery notes

- Process gates (EPIC-V01) and phase gates (EPIC-V02) are structural — they enable or block all other work.
- PE governance (EPIC-V04) should be established early to prevent orphaned beads.
- Code reviews (EPIC-V05) and closeout reviews (EPIC-V06) are triggered by their corresponding implementation beads completing.
- CI gates (EPIC-V08) should be established in the Foundation phase.
- Port adapter family closeout reviews are tracked in the integration-layer backlog to keep them co-located with the families they review.

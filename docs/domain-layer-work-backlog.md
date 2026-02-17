# Domain Layer Work Backlog

## Backlog ordering

Priority is sorted by dependency order and delivery risk:

1. Primitives hardening (parsing toolkit, error factory, temporal invariants)
2. Identity and tenancy (TenantId/WorkspaceId unification, domain events correlation)
3. ADR implementations (hash chain, quotas, SoD, CloudEvents, OTel, sandboxing)
4. Capability and contract (canonical enforcement, provider-selection, Work Item binding)
5. Evolution and compatibility (API migration plan, schema versioning)
6. State machines (run lifecycle, approval gates)
7. Release gate

## Epics and stories

### EPIC-D01 — Domain primitives hardening

Goal: consolidate parsing, validation, and error handling across all domain parsers.

- STORY-D01.1 — bead-0302
  - Domain parsing/validation toolkit consolidation (ISO timestamp, integer/enum validation, shared error model).
  - AC: all \*V1 parsers use shared toolkit; no duplicated parsing logic.
- STORY-D01.2 — bead-0338
  - Harden ErrorFactory pattern: path-aware overloads for nested object parsing.
  - AC: parse-utils readBoolean/readString/readOptionalString support nested paths.
- STORY-D01.3 — bead-0303
  - Temporal invariants and ordering checks in domain models (issued/revoked, started/ended, due/created, retention deadlines).
  - AC: invariants enforced at parse time; violated invariants produce typed errors.

### EPIC-D01b — Domain canonical object completeness

Goal: ensure canonical objects cover privacy and consent obligations required for marketing and regulated operations.

- STORY-D01b.1 — bead-0420
  - Add consent and privacy policy canonical objects for marketing operations (opt-in status, suppression lists, consent audit trail).
  - AC: `ConsentRecord` canonical type defined with opt-in/opt-out status, timestamp, and `externalRefs`; parser tests pass; suppression-list linkage documented.

### EPIC-D01c — Machine runtime domain model

Goal: model machine runtime registrations and agent configurations as first-class domain objects.

- STORY-D01c.1 — bead-0430
  - `MachineRegistration` aggregate (gateway URL, display name, capability allowlist, auth config) and `Agent` configuration entity (agentId, machineId, policy tier, allowed tool set).
  - AC: domain types parseable with branded primitives; parsers enforce required fields; no external runtime dependencies.
- STORY-D01c.2 — bead-0431
  - CloudEvents type catalogue for agent lifecycle: `com.portarium.agent.ActionDispatched`, `ActionCompleted`, `ActionFailed` carrying `tenantId`, `correlationId`, `runId`, and `machineId`.
  - AC: CloudEvents types extend the existing envelope; all fields typed and required; used by infra evidence adapter.

### EPIC-D02 — Identity and tenancy

Goal: unify tenant identity and enforce correlation across domain events.

- STORY-D02.1 — bead-0304
  - Tenancy identity unification (TenantId/WorkspaceId alias policy, parser migration, cross-module guard).
  - AC: single canonical identity type; compile-time guard prevents drift.
- STORY-D02.2 — bead-0306
  - Domain events correlation requirements (tenant/workspace id + correlation id on DomainEventV1).
  - AC: every domain event carries tenant context and correlation metadata.

### EPIC-D03 — ADR implementations

Goal: implement core architectural decisions from ADR-028 through ADR-039.

- STORY-D03.1 — bead-0035
  - ADR-029: Implement tamper-evident hash chain + signature hooks on EvidenceEntry and Artifact lineage.
  - AC: evidence entries chained; signature hooks in place; chain break detectable.
- STORY-D03.2 — bead-0037
  - ADR-030: Implement quota-aware execution primitives in orchestration scheduling and adapter call wrapper.
  - AC: quota enforcement at dispatch boundary; backoff/retry budgets observable.
- STORY-D03.3 — bead-0039
  - ADR-031: Implement SoD model evaluation, incompatible role graph, and threshold counters on approval routing.
  - AC: requestor/approver separation enforced; N-role constraints validated.
- STORY-D03.4 — bead-0041
  - ADR-032: Implement CloudEvents envelope for all event emission points and subscription contracts.
  - AC: events use CloudEvents v1 envelope; type, source, subject fields populated.
- STORY-D03.5 — bead-0043
  - ADR-033: Implement OTel context propagation in request, workflow, adapter, and machine call stacks.
  - AC: W3C Trace Context propagated end-to-end; spans correlated.
- STORY-D03.6 — bead-0045
  - ADR-034: Enforce containment and least-privilege in machine and adapter execution environments.
  - AC: per-tenant worker isolation validated; runtime policy enforcement in place.
- STORY-D03.7 — bead-0047
  - ADR-035: Finalize domain-atlas pipeline stages into reproducible CI job and artifact validation stage.
  - AC: atlas regeneration compares upstream pinned commit; drift fails CI.
- STORY-D03.8 — bead-0049
  - ADR-036: Implement product identity labels and telemetry metadata using Portarium naming.
  - AC: docs, packages, error envelopes consistently use Portarium naming.
- STORY-D03.9 — bead-0051
  - ADR-037: Model git-backed definitions and runtime truth divergence handling.
  - AC: deployment modes and truth-mode transitions explicit and auditable.
- STORY-D03.10 — bead-0053
  - ADR-038: Implement Work Item universal binding domain + query surfaces with evidence/run/workflow linkages.
  - AC: Work Item stays thin binding object; linkages queryable.
- STORY-D03.11 — bead-0055
  - ADR-039: Reference-vertical package (software-change-management) with evidence and policy semantics.
  - AC: reference vertical does not alter core scope; gated via vertical-pack lifecycle.

### EPIC-D04 — ADR reviews

Goal: verify each ADR implementation meets its design intent.

- STORY-D04.1 — bead-0034 — ADR-028 review: PII minimization and retention/disposition.
- STORY-D04.2 — bead-0036 — ADR-029 review: hash chain continuity under retention events.
- STORY-D04.3 — bead-0038 — ADR-030 review: 429/backoff, retry budgets bounded.
- STORY-D04.4 — bead-0040 — ADR-031 review: requestor/approver separation enforced.
- STORY-D04.5 — bead-0042 — ADR-032 review: event payload schema and versioning.
- STORY-D04.6 — bead-0044 — ADR-033 review: trace/span IDs, redaction-safe logs.
- STORY-D04.7 — bead-0046 — ADR-034 review: sandbox assertions, egress allowlisting.
- STORY-D04.8 — bead-0050 — ADR-036 review: Portarium naming consistency.
- STORY-D04.9 — bead-0052 — ADR-037 review: deployment modes auditable.
- STORY-D04.10 — bead-0054 — ADR-038 review: Work Item stays thin.
- STORY-D04.11 — bead-0056 — ADR-039 review: reference vertical scope gated.

### EPIC-D05 — Capability and contract enforcement

Goal: ensure adapter operations, port capabilities, and provider selection are hardened.

- STORY-D05.1 — bead-0305
  - Canonical capability enforcement across workflow actions, adapter capability matrices, and port supported operations.
  - AC: PortCapability migration with compatibility strategy complete.
- STORY-D05.2 — bead-0307
  - Provider-selection contract hardening (operation compatibility checks, deterministic tie-break, unsupported-operation tests).
  - AC: unsupported operations fail deterministically; tie-break rules documented.
- STORY-D05.3 — bead-0057
  - Port-family integration candidate matrix: assign owners and blockers for all 18 families.
  - AC: every family has owner, blockers, and required artifact dependencies.
- STORY-D05.4 — bead-0059
  - Per-family operation contract stubs from integration-catalog into machine-readable fixtures.
  - AC: fixture completeness; canonical mapping consistency; source ranking validated.

### EPIC-D06 — Domain model reconciliation

Goal: ensure documentation matches runtime reality.

- STORY-D06.1 — bead-0173
  - Reconcile docs/domain/canonical-objects.md with runtime entity model and canonical mapping contracts.
  - AC: documentation matches code; drift flagged in CI.
- STORY-D06.2 — bead-0175
  - Reconcile docs/domain/erd.md with aggregate ID and reference invariants in repository layer.
  - AC: ERD reflects actual aggregate boundaries.
- STORY-D06.3 — bead-0176
  - Reconcile docs/domain/aggregates.md invariants with aggregate event streams and state-transition beads.
  - AC: every invariant traced to implementation.
- STORY-D06.4 — bead-0177
  - Cross-layer invariants: enforce domain zero-external-dependencies via architecture-guard evidence.
  - AC: dependency-cruiser blocks any domain→infra/presentation import.

### EPIC-D07 — Evolution and compatibility

Goal: safe domain schema evolution with migration support.

- STORY-D07.1 — bead-0309
  - Domain API compatibility and migration plan (schema-versioned operation names, deprecated fields, rollout/rollback).
  - AC: migration path documented; rollback preserves existing payloads.

### EPIC-D08b — Domain contract specs (research-derived)

Goal: lock down ambiguous specifications surfaced in the domain model audit.

- STORY-D08b.1 — bead-0448
  - Policy evaluation rule language: decide grammar for `PolicyInlineRuleV1.condition` (CEL / OPA/Rego / constrained DSL) and implement evaluator.
  - AC: rule language selected and documented; condition parsed and evaluated; security boundary (no arbitrary code execution) enforced; unit tests cover allow/deny/error cases.
- STORY-D08b.2 — bead-0449
  - Workflow action execution semantics: document sequential vs parallel branching, per-action retry and timeout policy, manual-only completion signals, compensation hook interface.
  - AC: specification written; EPIC-D08 state machine (bead-0337) and Temporal worker loop (bead-0425) implement against this spec; no ambiguity on branching or retry.
- STORY-D08b.3 — bead-0450
  - Evidence hash canonicalization: align `EvidenceEntry` hash input serialization to RFC 8785 JCS for deterministic cross-language chain verification.
  - AC: canonicalization aligned to JCS; evidence chain tests pass for non-TypeScript verification scenario; hash break detectable.
- STORY-D08b.4 — bead-0451
  - Saga compensation interface: define `compensationOperation` and `compensationInputSchema` fields in the capability matrix; define per-port-family compensation contract.
  - AC: compensation metadata parseable; domain model maps `PlanV1.plannedEffects` to saga model with explicit compensation steps.

### EPIC-D08 — State machines

Goal: formal lifecycle state machines with machine-checkable transitions.

- STORY-D08.1 — bead-0337
  - State machine for workflow run lifecycle (Pending→Running→Succeeded/Failed/Cancelled with approval gates).
  - AC: machine-checkable state table; invalid transitions fail at compile time.

### EPIC-D09 — Domain release gate

Goal: domain layer completion evidence.

- STORY-D09.1 — bead-0162
  - Phase gate: Domain complete only when aggregate invariants, parser coverage, domain factory, and ADR traceability beads are closed.
- STORY-D09.2 — bead-0311
  - Closeout review: domain hardening release gate confirms all domain-beads merged, tested, and signed.

## New beads created for this backlog

| Bead      | Title                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| bead-0420 | Domain: add consent and privacy policy canonical objects for marketing operations (opt-in status, suppression lists, consent audit trail)              |
| bead-0430 | Domain: MachineRegistration aggregate and Agent configuration entity (machine runtime registry domain model with capability allowlist and auth config) |
| bead-0431 | Domain: CloudEvents type catalogue for agent lifecycle (ActionDispatched/Completed/Failed with tenantId/correlationId/runId propagation)               |
| bead-0448 | Spec: Policy evaluation rule language — CEL/OPA/Rego/DSL decision and evaluator implementation for PolicyInlineRuleV1.condition                        |
| bead-0449 | Spec: Workflow action execution semantics — sequential vs parallel, retry/timeout, manual-only signals, compensation hooks                             |
| bead-0450 | Spec: Evidence hash canonicalization — align EvidenceEntry to RFC 8785 JCS for cross-language chain verification                                       |
| bead-0451 | Spec: Saga compensation interface — compensationOperation and compensationInputSchema in capability matrix; per-family compensation contract           |

## Pre-existing beads (cross-reference)

| Bead      | Status | Title                                                                  |
| --------- | ------ | ---------------------------------------------------------------------- |
| bead-0034 | open   | ADR-028 review: PII minimization and retention in evidence transitions |
| bead-0035 | open   | ADR-029: Tamper-evident hash chain on EvidenceEntry                    |
| bead-0036 | open   | ADR-029 review: hash chain continuity                                  |
| bead-0037 | open   | ADR-030: Quota-aware execution primitives                              |
| bead-0038 | open   | ADR-030 review: 429/backoff bounded                                    |
| bead-0039 | open   | ADR-031: SoD model evaluation                                          |
| bead-0040 | open   | ADR-031 review: requestor/approver separation                          |
| bead-0041 | open   | ADR-032: CloudEvents envelope                                          |
| bead-0042 | open   | ADR-032 review: event payload schema                                   |
| bead-0043 | open   | ADR-033: OTel context propagation                                      |
| bead-0044 | open   | ADR-033 review: trace/span IDs                                         |
| bead-0045 | open   | ADR-034: Containment/least-privilege                                   |
| bead-0046 | open   | ADR-034 review: sandbox assertions                                     |
| bead-0047 | open   | ADR-035: Domain-atlas pipeline CI job                                  |
| bead-0049 | open   | ADR-036: Portarium naming labels                                       |
| bead-0050 | open   | ADR-036 review: naming consistency                                     |
| bead-0051 | open   | ADR-037: Git-backed definitions                                        |
| bead-0052 | open   | ADR-037 review: deployment modes                                       |
| bead-0053 | open   | ADR-038: Work Item binding domain                                      |
| bead-0054 | open   | ADR-038 review: thin binding                                           |
| bead-0055 | open   | ADR-039: Reference-vertical package                                    |
| bead-0056 | open   | ADR-039 review: scope gated                                            |
| bead-0057 | open   | Port-family integration candidate matrix                               |
| bead-0059 | open   | Per-family operation contract stubs                                    |
| bead-0162 | open   | Phase gate: Domain complete                                            |
| bead-0173 | open   | Reconcile canonical-objects.md                                         |
| bead-0175 | open   | Reconcile erd.md                                                       |
| bead-0176 | open   | Reconcile aggregates.md                                                |
| bead-0177 | open   | Cross-layer: domain zero-external-dependencies                         |
| bead-0302 | open   | Domain parsing/validation toolkit                                      |
| bead-0303 | open   | Temporal invariants and ordering checks                                |
| bead-0304 | open   | Tenancy identity unification                                           |
| bead-0305 | open   | Canonical capability enforcement                                       |
| bead-0306 | open   | Domain events correlation                                              |
| bead-0307 | open   | Provider-selection hardening                                           |
| bead-0309 | open   | Domain API compatibility                                               |
| bead-0311 | open   | Closeout review: domain hardening gate                                 |
| bead-0337 | open   | State machine: workflow run lifecycle                                  |
| bead-0338 | open   | Harden ErrorFactory pattern                                            |

## Delivery notes

- Domain primitives hardening (EPIC-D01) is prerequisite for most adapter work.
- ADR implementations (EPIC-D03) can proceed in parallel but each has a review gate (EPIC-D04).
- Identity unification (bead-0304) should be decided early as it impacts all parsers.
- State machine formalization (bead-0337) unblocks application-layer workflow orchestration.
- Domain release gate (bead-0162) blocks transition to integration phase.

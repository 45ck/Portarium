# ADR Amendments & New ADRs (Proposed)

I'll propose (1) concrete amendments to specific existing ADRs and (2) a small set of new ADRs that close the main gaps surfaced by the research: coverage taxonomy, "plan/diff" truthfulness, evidence lifecycle/retention, SoD policy, quota-aware execution, and standards for events/telemetry/security.

---

## High-leverage amendments (summary)

1. **Reframe "single pane"** from "never open SoRs" to **"VAOP-first with explicit escape hatches"** (deep links + context packs + exception path).
2. Make approvals sign off on a **Plan object**; diffs are explicitly **Planned vs Verified effects** (and optionally "predicted").
3. Evolve "immutable evidence" into **audit-grade log + records management**: retention/disposition, PII minimisation, legal holds; immutable metadata + retention-managed payloads.
4. Strengthen evidence defensibility with **tamper-evident integrity controls** and **WORM-style artifact storage** (as a capability, not just a slogan).
5. Expand policy beyond tiers to include **segregation-of-duties (SoD)** and multi-actor constraints (maker/checker, incompatible duties, N-approvers thresholds).
6. Upgrade the **Capability Matrix** to be **action-first**, formal, versioned, and CI-validated; include idempotency/diff support/reversibility/scopes/quotas.
7. Treat **rate limits/quotas as core**, requiring quota-aware scheduling/throttling/backoff/batching and graceful degradation.
8. Add a **port taxonomy aligned to APQC management/support categories** to make "covers non-core ops" credible without canonical bloat.
9. Tighten Temporal decision with explicit product constraints: **determinism discipline + history growth strategy** (continue-as-new/versioning; nondeterministic work as activities).
10. Treat adapters/machines as **untrusted execution** requiring containment (sandboxing, least privilege, egress controls, per-tenant isolation).
11. Standardise "bring-your-own dashboard" with **CloudEvents** for event stream + **OpenTelemetry/W3C trace context** for correlated observability.
12. Make record/replay safe: mandate **fixture redaction + secret hygiene** tooling if replay is required.

---

## Proposed amendments to existing ADRs (by number)

### ADR-002 — Value proposition / positioning

**Amendment:** Replace any implied "one UI replaces SoRs" expectation with:

- "VAOP is the **enforcement + governance + run history** layer; SoRs remain authoritative and are opened mainly for configuration, deep investigation, and exceptions."
- Add explicit success metrics as a product truth: "reduce SoR switching," not "eliminate." (e.g., VAOP-first rate, SoR fallback rate).

### ADR-004 — Workflow semantics (imperative + idempotency)

**Amendments:**

- Add **quota-aware execution** as a first-class requirement: throttling, backoff, batching, scheduling; make "429 handling" a core engine behavior, not adapter glue.
- Add a "selective reconciliation" carve-out for a small subset of "ensure X exists/configured" actions where convergence is safer than one-shot steps.
- Make idempotency **measurable per action** (capability matrix fields + tests) instead of a global promise.

### ADR-005 — Workflow engine (Temporal default)

**Amendments:** Treat these as **product constraints** (not implementation trivia):

- Workflow **determinism discipline**: non-deterministic work (AI calls, network reads) must be isolated into activities and recorded outputs treated as inputs for replay.
- **History growth strategy**: continue-as-new/versioning are part of operational design for long-lived workflows.

### ADR-008 — Capability matrix contract

**Amendments:**

- Make the capability matrix **action-first** (capabilities of specific actions, not just "supports invoices"). Include fields such as: auth scopes granularity, rate limits/bulk semantics, idempotency mechanism, plan/diff support, reversibility/compensation, sandbox availability, eventing/webhooks support.
- Make it a **formal schema artifact**: versioned, validated in CI, and (ideally) linked to contract-test evidence so it can't drift into "truthy but wrong" metadata.

### ADR-009 — Canonical domain model

**Amendments:**

- Add "**External Object References**" as first-class primitives (links to authoritative SoR objects) to avoid canonical bloat while enabling approvals/evidence to reference real SoR artifacts.
- Consider revising "Customer/Lead/Employee/etc." toward a **Party + role tags** approach (or at minimum a shared Party identity primitive), because many SoRs model "party/partner" as a unified concept; this reduces mapping complexity and dedupe pain. (Proposal; may become an open decision if you don't want to change v1 list yet.)
- If you want credible procurement/finance coverage without rebuilding SoRs, add _either_ bridge entities _or_ typed reference categories for: **Supplier/Vendor, Contract, Requisition/PO/Receipt**, and **ledger artifacts (journal entry/account refs)** (even if most fields stay vendor-native).

### ADR-010 — Tenancy/RBAC/credentials

**Amendments:**

- Expand "tenant isolation" to explicitly include: evidence storage isolation, event stream isolation, workflow execution context isolation, credential scoping, and even **fixture/record-replay isolation** (since recordings can contain tenant data).
- Treat adapters/machines as **untrusted code**: require containment/egress controls/least privilege and per-tenant execution isolation assumptions.

### ADR-011 — Policy engine approach

**Amendments:**

- Add explicit policy primitives for **segregation of duties (SoD)** and multi-actor constraints (maker-checker, requestor!=approver, two distinct approvers above thresholds, incompatible duty combinations across steps).
- If OPA is "later," still define stable **policy inputs/outputs** now (context richness: who/what/scope/cost/data sensitivity/blast radius; and structured decision reasons).

### ADR-012 — Approvals

**Amendments:**

- Approvals should sign off on a **Plan** (structured "intended effects") rather than a hand-wavy promise of exact SoR outcomes. Attach: planned writes, constraints, external refs, required scopes, predicted effects confidence.
- Require **diff classification**:
  - _Planned effects_ (what VAOP intends)
  - _Verified effects_ (observed delta after execution)
  - _(Optional)_ predicted effects (best-effort)
    This prevents approvals from being "legally weaker" due to SoR side effects.

- Add "escape hatch UX" to approvals/runs: deep links to exact SoR records plus minimal context snapshot ("context pack").

### ADR-013 — Audit & evidence

**Amendments:**

- Redefine evidence from "append-only + immutable" into **audit-grade log management + records management**: retention periods, tenant-specific retention, confidentiality/integrity/availability controls, and disposal/disposition workflows.
- Resolve "immutability vs privacy" by splitting:
  - **Immutable metadata events** (who approved what, when, under what policy, links to external objects)
  - **Retention-managed payloads** (documents, drafts, raw provider snapshots) that can be destroyed/de-identified per tenant policy, with legal-hold exceptions.

- Add **tamper-evident integrity** (hash chains/signed digests) + WORM-style storage for evidence artifacts where feasible.

### ADR-014 — Ops Shell UI scope

**Amendments:** Keep scope minimal, but add explicit UX requirements that make "VAOP-first" credible:

- Always show **Plan + Verified Effects + Evidence links + SoR deep links**
- Provide repair pathways for exceptions (retry with new plan, re-approval, reconcile).

### ADR-015 — Local testing/V&V

**Amendments:**

- Make capability matrix correctness part of tests: "capabilities are **validated by contract tests**," not documentation.
- Add **fixture hygiene** requirements: cassette recordings must be redacted/scrubbed for secrets and sensitive data; provide tooling rather than relying on developer caution.
- Consider introducing a "Domain Atlas" artifact repo as an output of the research pipeline (see ADR-019 amendment).

### ADR-016 — MVP platform support roadmap

**Amendments:**

- Add a **port family roadmap** aligned to APQC management/support categories (even if adapter coverage is phased): finance/accounting, procurement, HR, IT ops, risk/compliance/resiliency, legal/external relationships, business capability governance.
- Scope MVP proof loops to a governance-heavy wedge (where approvals + evidence matter) to avoid dilution from "cover everything at once."

### ADR-019 — OSS surgical study method

**Amendment:** Make it operational by adding a required artifact pipeline:

- Create a **Domain Atlas repo** storing commit-hash anchored extracted domain snapshots (CIF), mappings, capability instances, and generated contract tests; include license classification as an intake step.

### ADR-021/ADR-022 — API-first + event stream

**Amendments:**

- Standardise events early (CloudEvents suggested) to make BYO dashboard/sinks tractable and consistent.
- Include correlation IDs (tenant/run/action) and adopt a consistent observability posture (OpenTelemetry / trace propagation) so runs are explainable across adapters and machines.

### ADR-025 — Adapter ecosystem discipline

**Amendment:** Expand "provider-grade" to include: quota semantics, idempotency semantics, plan/diff support classification, reversibility/compensation, and security posture (scopes/least privilege).

---

## New ADRs to add (draft candidates)

### ADR-026 — Port taxonomy aligned to APQC management/support landscape (Proposed)

**Decision:** Define and publish a port taxonomy that maps to APQC "management and support services" categories (finance/accounting, procurement, HR, IT ops, risk/compliance/resiliency, legal/external relationships, business capability governance). Adapter coverage can be staged, but the taxonomy is stable.
**Consequence:** Makes "broad non-core coverage" claim precise without expanding the UI or canonical model prematurely.

### ADR-027 — Plan objects and diff truthfulness: Planned vs Verified effects (Proposed)

**Decision:** Approvals sign off on a **Plan** (structured intended effects). Evidence attaches **Verified Effects** captured post-execution. Diffs are explicitly typed (planned/predicted/verified).
**Consequence:** Preserves the approvals/diff promise without overstating predictability across SoRs with side effects and no dry-run.

### ADR-028 — Evidence lifecycle: records management + retention + privacy (Proposed)

**Decision:** Evidence is: immutable metadata + retention-managed payloads. Support tenant retention schedules, disposition (destroy/de-identify), and legal holds. Minimise PII in immutable logs.
**Consequence:** Makes VAOP viable in HR/legal/finance contexts where retention and privacy obligations exist.

### ADR-029 — Evidence integrity: tamper-evident log + WORM artifacts (Proposed)

**Decision:** Evidence integrity is enforced via tamper-evident controls (hash chaining/signed digests) and WORM-style artifact storage where possible.
**Consequence:** "Immutable evidence" becomes technically credible and audit-defensible.

### ADR-030 — Quota-aware execution as a platform feature (Proposed)

**Decision:** VAOP execution includes built-in quota/rate-limit management: throttling, backoff, batching, scheduling, and graceful degradation. Capability matrices expose quota semantics per action.
**Consequence:** Prevents reliability failures that users perceive as "automation is flaky."

### ADR-031 — Segregation of duties (SoD) as policy primitives (Proposed)

**Decision:** Policy can express multi-step/multi-actor constraints: requestor!=approver, N distinct approvers above thresholds, incompatible duty combinations across actions in a workflow.
**Consequence:** Enables real finance/procurement/HR controls beyond simple per-action approvals.

### ADR-032 — Event stream standard: CloudEvents (Proposed)

**Decision:** Publish external events in a standard envelope (CloudEvents) with stable metadata (tenant/run/action/correlation IDs).
**Consequence:** Simplifies building dashboards/sinks and reduces downstream chaos.

### ADR-033 — Observability standard: OpenTelemetry + W3C trace context (Proposed)

**Decision:** Standardise traces/metrics/logs via OpenTelemetry and propagate context across adapters/machines (W3C Trace Context).
**Consequence:** "Defensible execution" includes explainability across distributed components.

### ADR-034 — Untrusted execution containment for adapters/machines (Proposed)

**Decision:** Treat adapter/machine execution as untrusted: sandboxing, least-privilege credentials, network egress controls, per-tenant isolation, and controlled workflow author permissions.
**Consequence:** Reduces catastrophic blast radius given VAOP's choke-point role.

### ADR-035 — Domain Atlas: re-runnable extraction -> contracts/tests (Proposed)

**Decision:** Create a Domain Atlas repo and extraction pipeline producing machine-readable domain snapshots (CIF), canonical mappings, capability instances, and executable contract tests—anchored to upstream commit hashes and license classification.
**Consequence:** Prevents one-off research and keeps model evolution auditable and regenerable.

---

## Open-decision backlog updates (additions)

Add these explicitly to your "next to lock" list (because they're called out as MVP-critical risks in the research):

- Plan/preview contract per port; diff classification (planned/verified/predicted).
- Evidence retention/disposition/PII minimisation/legal holds.
- SoD/multi-actor policy primitives.
- Quota-aware execution baseline and how it's represented in capability matrices.
- Event + telemetry standards (CloudEvents + OpenTelemetry).
- Adapter/machine sandboxing and fixture redaction requirements.

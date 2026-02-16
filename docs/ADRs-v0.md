# Portarium Control Plane -- Architecture Decision Records (ADR) v0

> **Note:** Portarium is the product name; VAOP (Vertical Autonomous Operations Provider) is the internal architecture acronym. See ADR-036.

## ADR Index (accepted unless noted)

- **ADR-001** Scope boundary: control plane vs Systems of Record (SoR)
- **ADR-002** Core value proposition: "governable execution" + Ops Shell _(amended)_
- **ADR-003** Execution tiers: Auto / Assisted / Human-approve _(amended)_
- **ADR-004** Workflow semantics: imperative durable runbooks + idempotency _(amended)_
- **ADR-005** Workflow engine: Temporal (default) _(amended)_
- **ADR-006** Interop architecture: Hexagonal (Ports & Adapters) + ACL
- **ADR-007** Adapter selection: Strategy `selectProvider(tenant, port)`
- **ADR-008** Capability matrix: required metadata contract for adapters _(amended)_
- **ADR-009** Canonical domain model: minimum shared objects (v1 -> v2) _(amended)_
- **ADR-010** Tenancy + RBAC + credential vaulting: first-class _(amended)_
- **ADR-011** Policy engine: simple rules + explicit approval gates (OPA later) _(amended)_
- **ADR-012** Approvals: native VAOP governance surface (non-negotiable) _(amended)_
- **ADR-013** Audit & evidence: append-only run log + immutable artifacts _(amended)_
- **ADR-014** MVP UI ("Ops Shell"): Approvals / Runs / Connectors / Policies (+ optional Projects container) _(amended)_
- **ADR-015** Local testing/V&V: mock + record/replay + contract tests + compose stack _(amended)_
- **ADR-016** MVP platform support: P0 + P1 adapter roadmap _(amended)_
- **ADR-017** Machines vs Adapters: hard separation + wrappers
- **ADR-018** Agent runtime layering: optional/pluggable; VAOP enforces
- **ADR-019** OSS "surgical study": pattern extraction, not code copying
- **ADR-020** Licensing posture: permissive core; avoid fair-code in critical path
- **ADR-021** API-first product surface: dashboard is a client, not the core _(amended)_
- **ADR-022** Public interfaces: Commands + Queries + Event stream _(amended)_
- **ADR-023** AuthN/AuthZ: OIDC for AuthN; tenant RBAC inside VAOP
- **ADR-024** UI extensibility posture: plugin-friendly portal pattern (later)
- **ADR-025** Adapter ecosystem discipline: provider-grade versioning/testing/operator UX _(amended)_
- **ADR-026** Port taxonomy aligned to non-core business coverage _(new)_
- **ADR-027** Plan objects + diff truthfulness: Planned vs Verified _(new)_
- **ADR-028** Evidence lifecycle: retention, privacy, disposition _(new)_
- **ADR-029** Evidence integrity: tamper-evident log + WORM artifacts _(new)_
- **ADR-030** Quota-aware execution as a platform feature _(new)_
- **ADR-031** Segregation of duties (SoD) as policy primitives _(new)_
- **ADR-032** Event stream standard: CloudEvents _(new)_
- **ADR-033** Observability standard: OpenTelemetry + W3C trace context _(new)_
- **ADR-034** Untrusted execution containment for adapters/machines _(new)_
- **ADR-035** Domain Atlas: re-runnable extraction -> contracts/tests _(new)_
- **ADR-036** Product identity: Portarium _(new)_
- **ADR-037** Deployment & collaboration model: server-first, local-first _(new)_
- **ADR-038** Work Items as the universal binding object (thin PM layer) _(new)_
- **ADR-039** Software change management as a reference vertical _(new)_

---

## ADR-001 -- Scope boundary: VAOP is a control plane, not a SoR rebuild

**Context:** Non-core business functions already have mature ERPs/CRMs/helpdesks. Rebuilding them re-owns edge cases and validation burden.
**Decision:** VAOP is a **multi-tenant control plane** for **workflows + policy/approvals + audit/evidence + adapter runtime + machine orchestration**. VAOP does **not** rebuild ERP/CRM/helpdesk/PM in v1; those remain **SoRs** integrated via adapters.
**Consequences:** Faster MVP, less surface area; requires disciplined interop contracts and adapter quality.

## ADR-002 -- Core value proposition: governable execution + unified Ops Shell

**Context:** Users need repeatable execution with defensibility and oversight across tools + AI.
**Decision:** VAOP turns "business intent" into **repeatable, governable, testable execution**. It provides a unified **Ops Shell** for approvals, runs, evidence, connectors, policies.
**Consequences:** Control-plane value is visible even with minimal UI; evidence becomes the differentiator.

> **Amendment:** Reframe "single pane" to **VAOP-first operations with explicit escape hatches**: Portarium is the choke point for plans/approvals/runs/evidence; SoRs are still opened for configuration, deep investigation, and exceptions. Success metrics: "reduce SoR switching," not "eliminate."

## ADR-003 -- Execution tiers: Auto / Assisted / Human-approve

**Context:** Liability varies by action type, scope, cost, and risk.
**Decision:** Enforce tiers **per action**:

- **Auto:** policy-allowed, low risk
- **Assisted:** AI drafts + safe steps auto-run; human final where required
- **Human-approve:** explicit approval for high-liability actions

**Consequences:** Governance is uniform across integrations; requires strong action classification and approval UX.

> **Amendment:** Add a fourth policy outcome: **Manual-only / Untouched** -- explicitly left outside automation. Portarium may create/track a linked task and wait on a completion signal, but does not execute the action.

## ADR-004 -- Workflow semantics: imperative durable runbooks + idempotency

**Context:** MVP must be reliable and debuggable.
**Decision:** MVP uses **imperative durable workflows** (ordered steps) with **idempotent actions + retries**. "Desired-state/reconcile" is optional later.
**Consequences:** Predictable execution; pushes adapter authors to implement idempotency keys, retry safety, and compensations where possible.

> **Amendment:** Make **quota/rate-limit aware execution** a platform concern (throttling, backoff, batching, scheduling), not adapter glue. Permit **selective reconcile** patterns only where convergence is safer than one-shot steps. Make idempotency **measurable per action** via capability matrix fields + tests.

## ADR-005 -- Workflow engine: Temporal (default)

**Context:** Long-running workflows need retries, signals, approvals, and durable state.
**Decision:** Use **one durable orchestrator**; current default is **Temporal**. Visual builder is optional/later.
**Consequences:** Strong primitives for approvals and run history; commits architecture to Temporal's execution model.

> **Amendment:** Treat **determinism discipline** and **history growth strategy** (continue-as-new, versioning) as product constraints, not implementation details. Non-deterministic work (AI calls, network reads) must be isolated into activities.

## ADR-006 -- Interop architecture: Hexagonal + Anti-Corruption Layer

**Context:** Vendor systems differ; canonical domain must not be polluted by vendor quirks.
**Decision:** Use **Hexagonal / Ports & Adapters** with explicit **Anti-Corruption Layer (ACL)** per integration.
**Consequences:** Clean core; more upfront adapter engineering discipline.

## ADR-007 -- Adapter runtime selection: Strategy per tenant + port

**Context:** Tenants may use different providers for the same port and may migrate over time.
**Decision:** Runtime selection via Strategy: `selectProvider(tenant, port) -> adapter`.
**Consequences:** Enables migrations, fallback, and multi-provider; adds configuration and capability negotiation complexity.

## ADR-008 -- Capability matrix is a required adapter contract

**Context:** Automation/policy needs to know what an adapter can safely do.
**Decision:** Each adapter declares a **Capability Matrix** (objects supported, read/write, limits/rate, sandbox availability, webhooks/events, auth modes, scopes).
**Consequences:** Policy and workflow planning become deterministic; adapter onboarding becomes stricter (good).

> **Amendment:** Upgrade to an **action-first, versioned, CI-validated schema** that includes: idempotency method, quota semantics, plan/diff support, reversibility/compensation, sandbox availability, scopes/auth modes, eventing/webhooks. Must be a formal schema artifact validated in CI.

## ADR-009 -- Canonical domain model: minimum shared objects (v1 -> v2)

**Context:** Some shared objects are needed to compose workflows across SoRs.
**Decision:** Minimal canonical objects targeted for v1:
`Customer, Lead, Ticket, Invoice, Payment, Employee, Task, Campaign, Asset, Document`
Everything else stays vendor-native behind adapters.
**Consequences:** Keeps core small; complex domains remain in adapters/SoRs.

> **Amendment (v2):** Add **ExternalObjectRef** as a first-class primitive (typed links to SoR objects). Unify Customer/Lead/Vendor/Employee under **Party** with role tags. Add Subscription, Opportunity, Product, Order, Account as new canonical objects. v2 set (14 objects): Party, Ticket, Invoice, Payment, Task, Campaign, Asset, Document, Subscription, Opportunity, Product, Order, Account, ExternalObjectRef. See `docs/domain/canonical-objects.md` for full rationale.

## ADR-010 -- Tenancy, RBAC, credentials: first-class security posture

**Context:** Control plane must be the choke point for actions and governance.
**Decision:** **Workspace/Tenant isolation** is first-class. Enforce **RBAC** and **credential vaulting** per tenant + per connector scope. Agents/humans request actions **through VAOP**, not directly against vendor APIs.
**Consequences:** Strong governance; requires vault integration and careful isolation controls early.

> **Amendment:** Expand isolation to cover: evidence store, event stream, workflow context, fixtures/recordings, and worker execution context. Treat adapters/machines as **untrusted execution** requiring containment (least privilege + isolation). See ADR-034.

## ADR-011 -- Policy engine: simple rules + explicit approval gates (OPA later)

**Context:** Policy must exist day-1, but full policy-as-code can come later.
**Decision:** MVP uses **simple policy rules** plus **approval gates**. OPA is compatible later, not required day-1.
**Consequences:** Faster delivery; later migration path to policy-as-code should be planned (schemas, evaluation hooks).

> **Amendment:** Add **Segregation-of-duties (SoD)** primitives: maker-checker, requestor!=approver, N-distinct approvers above thresholds, incompatible-duty constraints across steps. See ADR-031. Define stable policy inputs/outputs now (context: who/what/scope/cost/sensitivity/blast-radius; output: structured decision reasons).

## ADR-012 -- Approvals are a native VAOP feature (non-negotiable)

**Context:** Delegating approvals to SoRs fragments governance and evidence.
**Decision:** VAOP must ship approvals: queues, assign/reassign, SLA timers, comments, versioned diffs ("what will change"), approve/deny/request-changes, links to evidence/run context.
**Consequences:** This is a primary UX surface; requires diffing primitives and strong audit linkage.

> **Amendment:** Approvals sign off on a **Plan object** (structured intended effects), not a "perfect prediction." Diffs are explicitly typed: Planned Effects vs Verified Effects (optional Predicted). See ADR-027. Approvals UX includes **role queues + user inbox**, SLA timers, escalation, reassignment.

## ADR-013 -- Audit & evidence: append-only truth + immutable artifacts

**Context:** Defensibility and replayability are key differentiators.
**Decision:** Maintain **append-only run log** and immutable **evidence artifacts** per run: inputs/outputs/approvals/actions/actor/timestamps + links to external objects created/modified.
**Consequences:** Strong compliance story; storage and retention strategy becomes important.

> **Amendment:** Split evidence into: **immutable metadata events** (who/what/when/policy decision/links) and **retention-managed payloads** (artifacts, drafts, snapshots) with tenant retention + disposition + legal-hold support. Add **tamper-evident integrity** (hash chains/signing) and WORM-style storage where feasible. See ADR-028 and ADR-029.

## ADR-014 -- MVP UI ("Ops Shell") scope

**Context:** UI should support governance, not rebuild business apps.
**Decision:** MVP UI includes: **Approvals, Runs, Connectors, Policies**. Optional lightweight **Projects** only as a container to group runs/artifacts.
**Consequences:** Avoids Jira rebuild; still provides operational control.

> **Amendment:** Add "VAOP-first UX minimum": every run/approval shows **Plan + Verified Effects + Evidence + SoR deep links**. Add a minimal Work layer: Work Items as the cross-tool binding object. See ADR-038.

## ADR-015 -- Local testing & verification: mandatory minimum bar

**Context:** Adapters against SaaS APIs are flaky and rate-limited without harnesses.
**Decision:** Adapters must support:

- **Mock adapter** (deterministic, in-memory)
- **Record/replay fixtures** (cassette-style)
- **Sandbox support** where available

Environment: Docker Compose stack (SoR + VAOP + mocks), **contract tests per port**, avoid flaky tests via replay.
**Consequences:** Higher initial effort; dramatically reduces integration regressions and CI instability.

> **Amendment:** Record/replay requires **fixture scrubbing/redaction** (secrets + sensitive data). Capability matrix claims must be **supported by contract tests** (prevent "marketing metadata drift"). See ADR-035 for Domain Atlas pipeline.

## ADR-016 -- MVP platform support roadmap

**Context:** Need fast end-to-end proof loops with local testability.
**Decision:**

- **P0:** LocalMockAdapter, **Odoo (self-hosted Docker)**, **Google Workspace (Gmail/Calendar)**, **Stripe**, optional Slack/Discord for approvals/alerts
- **P1:** Xero/QuickBooks, HubSpot, Zendesk/Freshdesk, Mautic (OSS) or Mailchimp

**Consequences:** Strong local dev story via Odoo; SaaS expansion after control plane stabilizes.

> **Amendment:** Add a **port taxonomy roadmap** covering all 18 port families (see ADR-026) even if adapter coverage is staged. Do not expand canonical objects prematurely -- use ExternalObjectRef + Plan for most domain-specific ops in v1.

## ADR-017 -- Machines vs Adapters: hard separation

**Context:** Avoid conflating "data sync" with "value production".
**Decision:**

- **Adapters:** CRUD/sync inside SoRs and external tools
- **Machines:** generate value-producing outputs (assets/specs/content/video/etc)
  Use **wrappers** to standardize machine interfaces; machines remain interchangeable and repo-separated.
  **Consequences:** Cleaner ecosystem; requires a machine contract (interface + artifact handling).

## ADR-018 -- Agent runtime layering: optional and pluggable

**Context:** OpenClaw/Claude Code/Codex may sit above, but governance must be centralized.
**Decision:** Agent runtime is optional. VAOP exposes durable interface: **start workflow / request approval / fetch evidence / observe runs**. Agents propose; VAOP enforces policy + logging.
**Consequences:** Prevents "agent sprawl" across vendor APIs; makes VAOP the enforcement choke point.

## ADR-019 -- OSS "surgical study" method

**Context:** Mature systems have solved tenancy/RBAC/audit/plugin patterns already.
**Decision:** Run and map exemplars to extract patterns for multi-tenancy, RBAC, audit logs, workflow/orchestration, connector architecture, billing/subscriptions, ops UX. No code copying—pattern extraction.
**Consequences:** Faster architecture maturity; requires disciplined documentation and license awareness.

## ADR-020 -- Licensing posture: permissive core; avoid fair-code critical deps

**Context:** Ecosystem trust and reuse depend on licensing clarity.
**Decision:** Keep VAOP core **permissive**; avoid fair-code/source-available dependencies in the critical path. Perform license checks (GPL/AGPL especially) for integrated OSS; prefer pattern extraction over code copying.
**Consequences:** Limits some dependency choices; improves adoption potential.

## ADR-021 -- API-first product surface: dashboard is a client

**Context:** "Single pane" value should not depend on a monolithic UI.
**Decision:** VAOP's core product surface is the **control plane API + event log + governance**. First-party dashboard is a minimal reference client and can be separate.
**Consequences:** Encourages ecosystem clients/dashboards; forces disciplined API versioning.

> **Amendment:** Standardise external events (CloudEvents, see ADR-032) and correlated observability (OpenTelemetry + trace context, see ADR-033) so "bring-your-own dashboard" is real.

## ADR-022 -- Public interfaces: Commands + Queries + Event stream

**Context:** External clients need stable primitives to build UIs, automations, and sinks.
**Decision:** Publish three interfaces:

- **Commands (write path):** start workflow, request approval, apply decision, rotate credentials
- **Queries (read path):** runs, policies, connectors, artifacts, approvals
- **Event stream:** append-only run/evidence events for realtime UI + external sinks

**Consequences:** Enables "bring-your-own dashboard"; requires event schema/versioning strategy.

> **Amendment:** Events use CloudEvents envelope (ADR-032) with correlation IDs (tenant/run/action). Observability via OpenTelemetry (ADR-033).

## ADR-023 -- AuthN/AuthZ: OIDC + internal tenant RBAC

**Context:** Standardize authentication while keeping authorization centralized.
**Decision:** Use **OIDC** (OAuth2-based) for authentication. Enforce **tenant isolation + RBAC** inside VAOP (tokens map to workspace/roles/scopes).
**Consequences:** Integrates with enterprise identity; requires careful scope mapping and least-privilege defaults.

## ADR-024 -- UI extensibility posture: plugin-friendly portal (later)

**Context:** Teams may want an internal developer portal-style experience.
**Decision (deferred):** Support a plugin-friendly UI posture later (Backstage-like pattern).
**Consequences:** Not MVP-critical; keep the door open by designing APIs/events cleanly.

## ADR-025 -- Adapter ecosystem discipline: provider-grade standards

**Context:** Adapter drift and inconsistent UX kills the platform.
**Decision:** Treat adapters like "providers" with strict versioning, contract tests, capability matrices, operator-grade errors, and consistent configuration experience.
**Consequences:** Higher adapter bar; scalable ecosystem.

> **Amendment:** "Provider-grade" explicitly includes: quota semantics, idempotency semantics, plan/diff support, reversibility/compensation, scopes/least privilege, and lifecycle/versioning requirements.

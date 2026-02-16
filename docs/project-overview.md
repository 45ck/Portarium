# Portarium -- Project Overview

> **Portarium** is the product name. **VAOP** (Vertical Autonomous Operations Provider) is the internal architecture acronym. See ADR-036.

**What this is**
Portarium is an open-source, multi-tenant **control plane** for running non-core business operations with discipline: it orchestrates durable workflows, enforces policy and approvals, centralises credentials and RBAC, and records immutable audit/evidence -- while integrating existing ERP/CRM/helpdesk/marketing tools as **Systems of Record** via adapters and composing "machines" that produce business artifacts.

**Value proposition**
Portarium converts "business intent" into **repeatable, governable, testable execution** across tools and AI: every action is tiered by risk (Auto/Assisted/Human-approve/Manual-only), every run is observable and retryable, and every outcome is defensible through a tamper-evident evidence trail -- giving operators a unified Ops Shell for approvals, runs, connectors, and policies without rebuilding the underlying business apps.

**How it works (one paragraph)**
Work is executed as **imperative durable runbooks** (Temporal by default) that call standardised **ports**; tenant-specific **adapters** implement those ports against vendor systems behind an anti-corruption layer, and each adapter publishes a capability matrix so policy can decide what is safe to do automatically. **Machines** remain separate, interchangeable producers of artifacts (content/specs/video/etc.) wrapped to a common interface, and Portarium coordinates the full loop: propose -> plan -> approve (if required) -> execute -> log evidence (planned vs verified effects) -> link external objects.

**What Portarium is not (v1)**
Portarium does not rebuild ERP/CRM/helpdesk/project management or attempt a mega "single UI for everything"; those remain authoritative SoRs and are integrated rather than replaced. Portarium is the enforcement + governance + run history layer; SoRs are still opened for configuration, deep investigation, and exceptions.

**Non-negotiables (read this before details)**
Approvals are native (queues, SLAs, comments, Plan objects with typed diffs), audit/evidence is **tamper-evident with retention management**, tenancy isolation and RBAC are first-class, adapters must meet a local testing bar (mock + record/replay + contract tests), SoD constraints are policy primitives, and the core remains permissively licensed with careful avoidance of restrictive dependencies.

**Adoption posture**
Portarium is **API-first**: the dashboard is a reference client, not the product; external teams can build their own UIs and automations via stable Commands/Queries and a CloudEvents event stream, while Portarium remains the enforcement and truth layer. Observability is standardised via OpenTelemetry.

**Deployment model**
Portarium ships as an API server + database + evidence store, with a one-command local compose for development. Git is the source of truth for definitions (runbooks, policies, manifests); the Portarium database is the source of truth for runtime state (runs, approvals, evidence). Execution runs on distributed workers reporting back to the control plane.

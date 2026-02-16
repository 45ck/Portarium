# VAOP MVP Research Programme: Domain Atlas

## Objective and Framing

Portarium's MVP problem is not "build an ERP/CRM/helpdesk/marketing suite". It is to build a control plane that can safely operate those suites.

The research programme exists to extract:

- Domain semantics (what concepts mean, how they behave, what invariants matter)
- Safe action surfaces (what can be done, under what constraints, with what proofs)

So Portarium can enforce execution tiers, approvals, RBAC, credential handling, and evidence capture consistently across many Systems of Record (SoRs).

## MVP Outputs (Artefacts, Not Notes)

The MVP research loop is only "done" when it produces machine-checkable artefacts that the control plane and adapters can rely on:

- Source manifests: upstream repo/spec, pinned commit/version, license classification
- CIF snapshots: neutral extracts of entities/fields/relationships/lifecycles/actions/events/extension points
- Mappings: explicit CIF -> canonical mapping tables (anti-corruption layer posture)
- Capability matrices: action-first metadata (limits, idempotency, diff/plan support, safety defaults)
- Contract fixtures/tests: record/replay data to make adapter verification deterministic

See `.specify/specs/vaop-mvp-domain-atlas-research-programme.md` for the minimal MVP requirements and `docs/adr/0035-domain-atlas-research-pipeline.md` for the rationale.

## Research Method (Repeatable Per Provider)

The goal is pattern extraction + model synthesis, anchored to a pinned upstream revision, without code reuse.

1. Repo intake and license classification.
2. Locate where the domain model actually lives:
   - Migrations (often the most honest field list)
   - ORM/entities
   - Schema metadata systems (e.g., DocTypes)
   - OpenAPI/GraphQL schemas
   - Canonical response examples
   - Custom fields / extension subsystems
3. Extract to CIF (`domain-atlas/extracted/<provider>/cif.json`).
4. Map CIF -> VAOP canonical objects via explicit mapping files (`domain-atlas/mappings/<provider>/mapping.json`).
5. Derive the provider capability matrix from actions, not objects (`domain-atlas/capabilities/<provider>/*.capability-matrix.json`).
6. Convert into executable verification:
   - JSON Schema validation of artefacts in CI
   - Adapter contract tests and fixtures (record/replay) so CI does not depend on live SaaS calls

## What To Research First (Ordered By MVP Unlocking Power)

1. Canonical object surface area:
   - Identify which fields and invariants are stable across providers for the canonical objects.
   - Keep the canonical model small; represent variability via explicit extensions and ExternalObjectRefs.
2. Port contracts (typed read/write/actions/events):
   - Query shapes, pagination, filtering
   - Create/update semantics, partial updates, validation failures
   - Event hooks (webhooks/polling/no-events)
   - Limits and safety (rate limits, batching, idempotency keys, concurrency rules)
3. Capability Matrix as a schema:
   - Machine-discoverable, versioned, validated in CI
4. Diff/preview primitives for approvals:
   - Object snapshots (before/after)
   - Field diffs (changed fields)
   - External effects (emails sent, invoices posted, refunds issued), treated as higher-liability
5. Evidence logging as append-only narrative:
   - Inputs, approvals, decisions, retries, outputs, external object references
6. Deterministic local verification:
   - Record/replay fixtures
   - Contract tests that validate adapter behavior against the port contract

## Priority Upstreams To Study (MVP-Focused)

The exact list will evolve, but the intent is consistent: pick upstreams that expose "honest schema" sources and real-world lifecycle semantics.

SoR exemplars (open source; treat as study-first, license-checked intake):

- Odoo: broad ERP surface (party/customer, invoices, payments, products, orders).
- ERPNext/Frappe: DocType-driven modelling with explicit schema metadata.
- Zammad: ticketing objects, custom fields, attachments/comments, lifecycle/status semantics.
- Mautic: marketing automation (contacts, campaigns) with ORM entity sources and extension points.

Closed SaaS schema sources (use specs/SDKs/connectors as the "model source"):

- Stripe: OpenAPI + events as the machine-readable source for Payments/Billing.
- Google Workspace (Gmail/Calendar): official API schemas/clients for comms + scheduling ports.
- HubSpot: connector catalogs and taps enumerate objects/fields (contacts, companies, deals, tickets).

Connector ecosystem patterns (for contracts, schemas, metadata conventions):

- Airbyte: catalog/stream schema conventions, JSON Schema as a typed output contract.
- Singer: tap/target protocol patterns (schema + records + state).

Control-plane pattern sources (durable execution, audit trails, packaging discipline):

- Temporal: durable workflow semantics (event history, retries, idempotency posture).
- Rundeck: audit trail log semantics and operator-grade runbook execution.
- StackStorm: "pack" style modular automation packaging (useful contrast for vertical packs).
- Argo Workflows and Conductor: contrasting orchestration models to sanity-check abstraction boundaries.
- Backstage: plugin ecosystem discipline (core vs community) as an analogy for pack governance.

Policy and credential management references (future posture):

- Open Policy Agent (OPA): policy language + evaluation surface.
- OpenFGA: relationship-based authorization modelling.
- OpenBao/Vault: secrets lifecycle, issuance/rotation, auditing patterns.

Immutability and append-only evidence references:

- immudb: immutable log/data model patterns (append-only, tamper-evident posture).

Track chosen upstream repos/specs in `domain-atlas/sources/*/source.json` and pin commits under `upstream.commit`. Provider-specific artefacts live under `domain-atlas/`.

## Canonical Model and Capability Matrix Synthesis Strategy

Avoid the "average of all upstream schemas".

Use three layers:

1. Canonical objects: minimal stable attributes + lifecycle state + ExternalObjectRefs.
2. Provider ACL normalization: per-provider translations, with explicit extension containers.
3. Raw evidence payloads: store vendor payload snapshots as evidence artefacts (or references), rather than inflating the canonical store.

Capability matrices should be action-first:

- Define actions per Port Family
- Attach safety properties (approval tier default, idempotency mechanism, diff support, rollback/compensation posture)
- Attach constraints (scopes, limits, batching, sandbox availability)

## Failure Modes and Guardrails

- Canonical bloat: variability belongs in extensions, not the canonical model.
- Unsafe retries: adapters must provide idempotency and deterministic diffs, or "Auto" becomes a liability trap.
- License contamination: study strong copyleft and source-available repos, but do not import them into the permissive core.
- Non-repeatable research: prefer extraction pipelines that can be regenerated for a pinned upstream commit.

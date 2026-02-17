# Portarium

Open-source, multi-tenant control plane for governable business operations.

Portarium orchestrates durable workflows across your existing tools (ERP, CRM, helpdesk, marketing, HR, IT ops, and more), enforcing policy, approvals, and audit trails -- so every action is tiered by risk, every run is observable, and every outcome is defensible.

## Architecture (VAOP)

Portarium implements the **VAOP** (Vertical Autonomous Operations Provider) architecture:

- **18 port families** covering finance, payments, procurement, HR, CRM, support, ITSM, IAM, marketing, ads, comms, projects, documents, analytics, monitoring, compliance, and more
- **14 canonical objects** (Party, Ticket, Invoice, Payment, Task, Campaign, Asset, Document, Subscription, Opportunity, Product, Order, Account, ExternalObjectRef) for cross-system workflows
- **5 aggregate roots** (Workspace, Workflow, Run, Policy, AdapterRegistration) with strict consistency boundaries
- **Hexagonal architecture** with ports and adapters -- domain layer has zero external dependencies
- **Evidence-first design** with tamper-evident audit trails and retention management

## Key Features

- **Execution tiers**: Auto / Assisted / Human-approve / Manual-only -- per action, per policy
- **Plan-based approvals**: structured Plan objects with typed diffs (Planned vs Verified Effects)
- **Separation of duties**: maker-checker, N-approvers, incompatible duty constraints
- **Quota-aware execution**: built-in throttling, backoff, batching, scheduling
- **CloudEvents + OpenTelemetry**: standardised event stream and observability
- **Untrusted execution containment**: least-privilege credentials, per-tenant isolation

## Quick Start

```bash
npm install
npm run typecheck
npm run test
npm run ci:pr        # full CI gate
```

Run a local dependency stack for infra parity:

```bash
docker compose up
```

Run the full runnable scaffold (control plane + worker) when you want to validate
readiness/liveness probes and deployable image manifests locally:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

This references the repository root `docker-compose.yml` and the local development
stack described in the Infrastructure ADR (ADR-0056).

## Documentation

- [Project Overview](docs/project-overview.md)
- [Glossary (Ubiquitous Language)](docs/glossary.md)
- [Domain Model](docs/domain/README.md)
- [Integration Catalog (18 port families, 150+ tools)](docs/integration-catalog/README.md)
- [ADRs (Architecture Decision Records)](docs/ADRs-v0.md)
- [Infrastructure Layer Spec](.specify/specs/infrastructure-layer-v1.md)
- [Infrastructure ADR-0056](docs/adr/0056-infrastructure-reference-architecture.md)

## Deployment

Portarium ships as an API server + database + evidence store. Git is the source of truth for definitions (runbooks, policies, manifests); the database is the source of truth for runtime state (runs, approvals, evidence).

```bash
docker compose up    # one-command local dev environment
```

## License

See [ADR-020](docs/ADRs-v0.md) -- permissive core; avoid fair-code in critical path.

# Portarium Domain Model (VAOP Architecture)

> Complete domain model documentation for the Portarium control plane.

## Overview

VAOP is a multi-tenant control plane that orchestrates non-core business operations across external Systems of Record (SoRs). The domain model defines the entities, aggregates, events, ports, and services that make up the core of the system.

The domain layer has **zero external dependencies** -- it consists entirely of TypeScript types, interfaces, and pure functions. Runtime implementations live in the application and infrastructure layers.

## Navigation

| Document                                    | Purpose                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [ERD](./erd.md)                             | Full entity-relationship diagram in Mermaid covering all aggregates, canonical objects, and their relationships |
| [Canonical Objects](./canonical-objects.md) | The 14-object canonical set with rationale for each, mapping SoR entities to a shared vocabulary                |
| [Port Taxonomy](./port-taxonomy.md)         | 18 port families with their standard operations, aligned to the APQC-style capability catalog                   |
| [Aggregates](./aggregates.md)               | Aggregate boundaries, invariants, and consistency rules for each aggregate root                                 |

## Related Resources

| Resource            | Location                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Integration Catalog | [`docs/integration-catalog/`](../integration-catalog/README.md) -- Provider-level detail for all 18 port families                |
| Glossary            | [`docs/glossary.md`](../glossary.md) -- Canonical term definitions                                                               |
| Ubiquitous Language | [`docs/ubiquitous-language.md`](../ubiquitous-language.md) -- Condensed term list                                                |
| ADRs                | [`docs/internal/ADRs-v0.md`](../internal/ADRs-v0.md) -- Architecture decision records                                            |
| ADR Amendments      | [`docs/internal/ADR-amendments-and-new-ADRs.md`](../internal/ADR-amendments-and-new-ADRs.md) -- Proposed amendments and new ADRs |
| Project Overview    | [`docs/project-overview.md`](../project-overview.md) -- Vision and scope                                                         |

## Key Design Principles

1. **Types-only domain layer** -- No runtime logic in entity/event definitions. Pure interfaces and type definitions that compile to nothing. Runtime behaviour lives in domain services (pure functions) and application services.

2. **Branded primitives everywhere** -- Every ID is a branded type (`TenantId`, `WorkflowId`, etc.) preventing accidental mixing. `WorkspaceId` is a v1 alias of `TenantId` with a compile-time guard (`WORKSPACE_ID_ALIAS_GUARD`) to prevent drift. See `src/domain/primitives/`.

3. **Canonical objects as cross-system bridges** -- Fourteen canonical entity types (Party, Ticket, Invoice, Payment, Task, Campaign, Asset, Document, Subscription, Opportunity, Product, Order, Account, ExternalObjectRef) provide a minimal shared vocabulary across all SoRs. They carry only the intersection of fields that every SoR in a domain exposes. SoR-specific fields live behind `ExternalObjectRef`.

4. **ExternalObjectRef for everything else** -- Rather than bloating canonical objects with vendor-specific fields, we use typed deep links (`{ sorName, portFamily, externalId, externalType, deepLinkUrl?, displayLabel? }`) to reference any SoR entity. This keeps the canonical model minimal and avoids N x M field mapping.

5. **Immutable evidence chain** -- Every Run produces an append-only evidence trail. Evidence entries are content-addressed (SHA-256 hashed), timestamped, and governed by retention schedules. This supports WORM compliance and tamper-evident logging.

6. **18 port families** -- Direct 1:1 mapping to the APQC-aligned capability catalog. Each port groups related adapters that share the same entity model and operation set.

7. **Workspace isolation** -- All data is scoped to a Workspace (tenant). Cross-workspace access is never permitted at the domain level. Every query, command, and event carries a `TenantId`.

## Domain Structure

```
src/domain/
├── primitives/           # Branded IDs, value objects, enums
│   ├── index.ts          # Brand helpers + core value objects
│   ├── canonical-ids.ts  # Branded IDs for canonical objects
│   └── port-ids.ts       # PortFamily type + PortId
├── entities/             # Aggregate roots and entities
│   ├── workspace.ts      # Workspace aggregate root (tenancy boundary)
│   ├── workflow.ts       # Workflow aggregate root (runbook definition)
│   ├── run.ts            # Run aggregate root (workflow execution)
│   ├── action.ts         # Action entity (within Workflow)
│   ├── approval.ts       # Approval entity (within Run)
│   ├── plan.ts           # Plan value object (within Run)
│   ├── policy.ts         # Policy aggregate root
│   ├── adapter-registration.ts  # Adapter registration aggregate root
│   ├── machine-registration.ts  # Machine registration entity
│   ├── user.ts           # User entity (within Workspace)
│   ├── project.ts        # Project container entity
│   ├── evidence-entry.ts # Evidence log entry (within Run)
│   ├── artifact.ts       # Artifact entity (within Run)
│   └── credential-grant.ts # Credential grant (within Workspace)
├── canonical/            # Cross-system bridge types
│   ├── account-v1.ts                         # Financial/GL account
│   ├── account-v1.test.ts                    # Account parser tests
│   ├── asset-v1.ts                           # IT/physical/inventory asset
│   ├── asset-v1.test.ts                      # Asset parser tests
│   ├── campaign-v1.ts                        # Marketing/advertising campaign
│   ├── campaign-v1.test.ts                   # Campaign parser tests
│   ├── canonical-namespace-alignment.test.ts  # Canonical ID/namespace parity tests
│   ├── canonical-v1.test.ts                  # Canonical parser surface tests
│   ├── document-v1.ts                        # Document, file, or attachment
│   ├── document-v1.test.ts                   # Document parser tests
│   ├── external-object-ref.ts                 # Deep link to any SoR entity
│   ├── external-object-ref.test.ts            # ExternalObjectRef parser tests
│   ├── index.ts                              # Canonical barrel exports
│   ├── index.test.ts                         # Canonical barrel export tests
│   ├── invoice-v1.ts                         # Sales invoice or purchase bill
│   ├── invoice-v1.test.ts                    # Invoice parser tests
│   ├── objects-v1.ts                         # Legacy compatibility barrel (deprecated in canonical index)
│   ├── opportunity-v1.ts                     # Sales opportunity or deal
│   ├── opportunity-v1.test.ts                # Opportunity parser tests
│   ├── order-v1.ts                           # Sales or purchase order
│   ├── order-v1.test.ts                      # Order parser tests
│   ├── party-v1.ts                           # Unified person/org with role tags
│   ├── party-v1.test.ts                      # Party parser tests
│   ├── payment-v1.ts                         # Payment record
│   ├── payment-v1.test.ts                    # Payment parser tests
│   ├── product-v1.ts                         # Product, service, or SKU
│   ├── product-v1.test.ts                    # Product parser tests
│   ├── subscription-v1.ts                    # Subscription, contract, or agreement
│   ├── subscription-v1.test.ts               # Subscription parser tests
│   ├── task-v1.ts                            # Work item or project task
│   ├── task-v1.test.ts                       # Task parser tests
│   ├── ticket-v1.ts                          # Support/service/incident ticket
│   └── ticket-v1.test.ts                     # Ticket parser tests
├── events/               # Domain events (past-tense naming)
│   ├── workflow-events.ts
│   ├── run-events.ts
│   ├── approval-events.ts
│   ├── policy-events.ts
│   ├── adapter-events.ts
│   ├── workspace-events.ts
│   ├── evidence-events.ts
│   └── action-events.ts
├── ports/                # Port interfaces and capability matrix
│   ├── index.ts                          # Barrel exports for port domain contracts
│   ├── port-family-capabilities-v1.ts     # Capability matrix by port family
│   ├── port-v1.ts                        # Generic parser for all port-family registrations
│   └── port-v1.test.ts                   # Port parser contract tests
└── services/             # Pure domain logic
    ├── provider-selection.ts
    ├── policy-evaluation.ts
    ├── approval-routing.ts
    ├── planning.ts
    ├── diff.ts
    └── evidence.ts
```

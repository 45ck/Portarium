# VAOP Domain -- Canonical Objects

> The 14-member canonical object set with rationale, design principles, and evolution strategy.

## Rationale

VAOP integrates with 18 port families spanning dozens of SoR vendors. Without a shared vocabulary, every pair of adapters would need a custom mapping -- creating an N x M integration problem. Canonical objects solve this by defining a **minimal, normalised entity set** that every port family can map to.

The design goal is **not** to model every field in every SoR. Instead, canonical objects capture the intersection of fields that appear across all vendors in a domain. Vendor-specific fields, custom fields, and domain-specific extensions are referenced via `ExternalObjectRef` -- a first-class deep link to the original SoR record.

This approach gives VAOP three benefits:

1. **Cross-system workflows**: A workflow can read an Invoice from QuickBooks, match it to a Payment in Stripe, and update a Ticket in Zendesk -- all using the same canonical types.
2. **Adapter simplicity**: Each adapter maps to/from a small, stable canonical interface rather than a sprawling superset of all possible fields.
3. **Evidence traceability**: Every canonical object carries `externalRefs` that link back to the authoritative SoR records, preserving the audit trail.

## Design Principles

1. **Minimal fields (intersection, not union)** -- Canonical objects carry only fields that appear in the majority of SoRs for a domain. If a field is specific to one vendor (e.g., Salesforce `RecordTypeId`), it stays in the SoR and is accessible via `ExternalObjectRef`.

2. **ExternalObjectRef for SoR-specific data** -- Canonical objects support `externalRefs?: readonly ExternalObjectRef[]` as the escape hatch for anything not in the canonical model. Adapters populate these refs when source mappings are available.

3. **Branded IDs** -- Every canonical object has a branded ID type (`PartyId`, `TicketId`, `InvoiceId`, etc.) that prevents accidental mixing. These are defined in `src/domain/primitives/canonical-ids.ts`.

4. **Immutable-first** -- Canonical objects returned from port reads are treated as immutable snapshots. Mutations go through port write operations that produce new evidence entries.

5. **Tenant-scoped** -- Every canonical object carries a `tenantId: TenantId` to enforce workspace isolation at the type level.

6. **Role tags over subtypes** -- Rather than creating separate types for Customer, Vendor, Employee, and Lead, we use a single `Party` with role tags. This matches the reality that SoR entities often have overlapping roles.

## The Canonical Set

| Canonical Object      | Runtime Contract (`src/domain/canonical`)      | Key Runtime Fields                                                                                                                                         |
| --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Party**             | `party-v1.ts` (`PartyV1`)                      | `partyId`, `tenantId`, `displayName`, `roles`, `email?`, `phone?`, `externalRefs?`                                                                         |
| **Ticket**            | `ticket-v1.ts` (`TicketV1`)                    | `ticketId`, `tenantId`, `subject`, `status`, `priority?`, `assigneeId?`, `createdAtIso`, `externalRefs?`                                                   |
| **Invoice**           | `invoice-v1.ts` (`InvoiceV1`)                  | `invoiceId`, `tenantId`, `invoiceNumber`, `status`, `currencyCode`, `totalAmount`, `issuedAtIso`, `dueDateIso?`, `externalRefs?`                           |
| **Payment**           | `payment-v1.ts` (`PaymentV1`)                  | `paymentId`, `tenantId`, `amount`, `currencyCode`, `status`, `paidAtIso?`, `externalRefs?`                                                                 |
| **Task**              | `task-v1.ts` (`CanonicalTaskV1`)               | `canonicalTaskId`, `tenantId`, `title`, `status`, `assigneeId?`, `dueAtIso?`, `externalRefs?`                                                              |
| **Campaign**          | `campaign-v1.ts` (`CampaignV1`)                | `campaignId`, `tenantId`, `name`, `status`, `channelType?`, `startDateIso?`, `endDateIso?`, `externalRefs?`                                                |
| **Asset**             | `asset-v1.ts` (`AssetV1`)                      | `assetId`, `tenantId`, `name`, `assetType`, `status`, `serialNumber?`, `externalRefs?`                                                                     |
| **Document**          | `document-v1.ts` (`DocumentV1`)                | `documentId`, `tenantId`, `title`, `mimeType`, `createdAtIso`, `sizeBytes?`, `storagePath?`, `externalRefs?`                                               |
| **Subscription**      | `subscription-v1.ts` (`SubscriptionV1`)        | `subscriptionId`, `tenantId`, `planName`, `status`, `currencyCode?`, `recurringAmount?`, `currentPeriodStartIso?`, `currentPeriodEndIso?`, `externalRefs?` |
| **Opportunity**       | `opportunity-v1.ts` (`OpportunityV1`)          | `opportunityId`, `tenantId`, `name`, `stage`, `amount?`, `currencyCode?`, `closeDate?`, `probability?`, `externalRefs?`                                    |
| **Product**           | `product-v1.ts` (`ProductV1`)                  | `productId`, `tenantId`, `name`, `active`, `sku?`, `unitPrice?`, `currencyCode?`, `externalRefs?`                                                          |
| **Order**             | `order-v1.ts` (`OrderV1`)                      | `orderId`, `tenantId`, `orderNumber`, `status`, `totalAmount`, `currencyCode`, `lineItemCount?`, `createdAtIso`, `externalRefs?`                           |
| **Account**           | `account-v1.ts` (`AccountV1`)                  | `accountId`, `tenantId`, `accountName`, `accountCode`, `accountType`, `currencyCode`, `isActive`, `externalRefs?`                                          |
| **ExternalObjectRef** | `external-object-ref.ts` (`ExternalObjectRef`) | `sorName`, `portFamily`, `externalId`, `externalType`, `deepLinkUrl?`, `displayLabel?`                                                                     |

## Cross-References Between Canonical Objects

Current runtime contracts keep canonical objects intentionally thin and mostly independent. Direct cross-object links are limited to lightweight identifiers and `ExternalObjectRef`:

- `TicketV1.assigneeId?` and `CanonicalTaskV1.assigneeId?` hold assignment references.
- `externalRefs?: ExternalObjectRef[]` is the primary SoR linkage mechanism across all canonical objects.
- Rich cross-object joins (for example invoice->party or payment->invoice) are handled at application/query composition layers, not inside canonical parser contracts.

## Cross-Port Entity Coverage

The table below shows which canonical objects are produced or consumed by each port family:

| Port Family         | Party | Ticket | Invoice | Payment | Task | Campaign | Asset | Document | Subscription | Opportunity | Product | Order | Account |
| ------------------- | :---: | :----: | :-----: | :-----: | :--: | :------: | :---: | :------: | :----------: | :---------: | :-----: | :---: | :-----: |
| FinanceAccounting   |   x   |        |    x    |    x    |      |          |       |          |              |             |         |   x   |    x    |
| PaymentsBilling     |   x   |        |    x    |    x    |      |          |       |          |      x       |             |    x    |       |    x    |
| ProcurementSpend    |   x   |        |    x    |    x    |      |          |       |    x     |      x       |             |    x    |   x   |         |
| HrisHcm             |   x   |        |         |         |      |          |       |          |      x       |             |         |       |         |
| Payroll             |   x   |        |         |    x    |      |          |       |          |              |             |         |       |         |
| CrmSales            |   x   |        |    x    |         |  x   |    x     |       |    x     |              |      x      |    x    |   x   |         |
| CustomerSupport     |   x   |   x    |         |         |      |          |       |    x     |              |             |         |       |         |
| ItsmItOps           |   x   |   x    |         |         |      |          |   x   |    x     |      x       |             |    x    |       |         |
| IamDirectory        |   x   |        |         |         |      |          |   x   |          |              |             |         |       |         |
| SecretsVaulting     |       |        |         |         |      |          |       |          |              |             |         |       |         |
| MarketingAutomation |   x   |        |         |         |      |    x     |       |    x     |              |             |         |       |         |
| AdsPlatforms        |       |        |         |         |      |    x     |       |    x     |              |             |         |       |         |
| CommsCollaboration  |   x   |        |         |         |  x   |          |       |    x     |              |             |         |       |         |
| ProjectsWorkMgmt    |   x   |        |         |         |  x   |          |       |    x     |              |             |         |       |         |
| DocumentsEsign      |   x   |        |         |         |      |          |       |    x     |              |             |         |       |         |
| AnalyticsBi         |   x   |        |         |         |      |          |       |          |              |             |         |       |         |
| MonitoringIncident  |   x   |   x    |         |         |      |          |       |          |              |             |         |       |         |
| ComplianceGrc       |   x   |   x    |         |         |      |          |   x   |    x     |              |             |         |       |         |

## What Is NOT a Canonical Object

The following entity types are commonly observed across SoRs but are **not** included in the canonical set. They remain accessible via `ExternalObjectRef`.

| Entity                        | Why NOT canonical                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Department / Team**         | Organisational structure varies enormously across HRIS, IAM, and project management tools. Too domain-specific to normalise without losing meaning.                                  |
| **Schedule / Shift**          | Only relevant to HRIS/payroll. Not observed in CRM, accounting, or ITSM. Fails the 3-port-family threshold.                                                                          |
| **SLA / SLA Policy**          | Deeply tied to ITSM and support. Structure varies significantly between vendors (time-based, priority-based, multi-tier).                                                            |
| **Policy / Rule**             | VAOP has its own Policy aggregate for governance. Vendor-side policies (firewall rules, compliance policies) are too heterogeneous to normalise.                                     |
| **Template / Blueprint**      | Every tool has templates (email templates, ticket templates, workflow templates) but the structure is completely vendor-specific.                                                    |
| **Custom Field / Metadata**   | By definition vendor-specific. Canonical objects deliberately exclude custom fields; `ExternalObjectRef` links back to the full record.                                              |
| **Comment / Note / Activity** | While universal (every SoR has comments), the semantics differ (threaded vs flat, public vs internal, rich text vs plain). Better handled as ExternalObjectRef on the parent object. |
| **Attachment**                | Subsumed by Document for standalone files. Inline attachments on tickets/comments are too tightly coupled to their parent entity.                                                    |

The guiding principle: if the entity type appears in **fewer than 3 port families** or if its field structure varies so much that the canonical version would be nearly empty, it stays as `ExternalObjectRef`.

## Evolution Strategy

The canonical set is intentionally small and is expected to grow slowly over time. The process for promoting an `ExternalObjectRef` to a canonical object:

1. **Observation**: Multiple port families (at least 3) independently need to exchange the same entity type in cross-system workflows.
2. **Field intersection**: A meaningful set of shared fields (at least `id`, `tenantId`, `name/title`, `status`, `externalRefs`) can be identified across the relevant SoRs.
3. **Proposal**: An ADR is written documenting the rationale, the proposed field set, the port families that would use it, and the mapping from each SoR.
4. **Review**: The proposal is reviewed against the design principles (minimal fields, branded IDs, ExternalObjectRef for the rest).
5. **Implementation**: A new file is added to `src/domain/canonical/`, a branded ID is added to `src/domain/primitives/canonical-ids.ts`, and affected port interfaces are updated.
6. **Migration**: Existing adapters that were using `ExternalObjectRef` for this entity type are updated to return the new canonical object, with the original SoR record linked via `externalRefs`.

The bar for promotion is intentionally high. It is always better to use `ExternalObjectRef` for a while and observe real usage patterns than to prematurely canonicalise an entity type that turns out to be too heterogeneous.

## Migration from v0

The v0 canonical set (ADR-009) defined 10 objects: Customer, Lead, Ticket, Invoice, Payment, Employee, Task, Campaign, Asset, Document.

This expanded set:

- **Merges** Customer + Lead + Vendor + Employee into **Party** (net -3 types)
- **Keeps** Ticket, Invoice, Payment, Task, Campaign, Asset, Document unchanged
- **Adds** Subscription, Opportunity, Product, Order, Account (net +5 types)
- **Adds** ExternalObjectRef as a new primitive (net +1 type)

**Net change**: 10 -> 14 objects (13 canonical + 1 primitive). The Party unification removes 3 types while adding 6 new ones, for a net gain of 4 types that cover significantly more of the integration landscape.

# VAOP Port Taxonomy

> Comprehensive taxonomy of all 18 port families, their standard operations, and the canonical objects they produce and consume.

## Overview

In VAOP's hexagonal architecture, **ports** define the domain's contract with the outside world. Each port family represents a business capability area and groups the abstract interfaces that adapters must implement. Ports are purely declarative: they specify what operations exist, what inputs they accept, and what canonical objects they return. Adapters provide the concrete implementation for a specific System of Record (SoR).

A single adapter maps to exactly one port family and one provider (e.g., `StripeAdapter` implements `PaymentsBillingPort` for the Stripe provider). Each adapter declares a **Capability Matrix** listing which operations it supports, enabling the control plane to route workflow actions to the correct adapter at runtime.

The 18 port families are aligned to the APQC-style capability catalog, ensuring that every major non-core business function has a stable, well-defined integration surface.

## Port Family Index

| #   | Family                                                      | Identifier            | Primary Canonical Objects                                   | Operations |
| --- | ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------- | ---------- |
| 1   | [Finance & Accounting](#1-finance--accounting)              | `FinanceAccounting`   | Account, Invoice, Payment, Party, Order                     | 16         |
| 2   | [Payments & Billing](#2-payments--billing)                  | `PaymentsBilling`     | Payment, Invoice, Subscription, Product, Account, Party     | 15         |
| 3   | [Procurement & Spend](#3-procurement--spend)                | `ProcurementSpend`    | Order, Invoice, Payment, Party, Subscription, Document      | 14         |
| 4   | [HRIS & HCM](#4-hris--hcm)                                  | `HrisHcm`             | Party, Subscription                                         | 12         |
| 5   | [Payroll](#5-payroll)                                       | `Payroll`             | Party, Payment                                              | 12         |
| 6   | [CRM & Sales](#6-crm--sales)                                | `CrmSales`            | Party, Opportunity, Task, Campaign, Product, Order, Invoice | 16         |
| 7   | [Customer Support](#7-customer-support)                     | `CustomerSupport`     | Ticket, Party, Document                                     | 15         |
| 8   | [ITSM & IT Ops](#8-itsm--it-ops)                            | `ItsmItOps`           | Ticket, Asset, Party, Document, Subscription, Product       | 17         |
| 9   | [IAM & Directory](#9-iam--directory)                        | `IamDirectory`        | Party, Asset                                                | 18         |
| 10  | [Secrets & Vaulting](#10-secrets--vaulting)                 | `SecretsVaulting`     | _(none — infrastructure-level)_                             | 15         |
| 11  | [Marketing Automation](#11-marketing-automation)            | `MarketingAutomation` | Party, Campaign, Document                                   | 18         |
| 12  | [Ads Platforms](#12-ads-platforms)                          | `AdsPlatforms`        | Campaign, Document                                          | 19         |
| 13  | [Comms & Collaboration](#13-comms--collaboration)           | `CommsCollaboration`  | Party, Task, Document                                       | 19         |
| 14  | [Projects & Work Management](#14-projects--work-management) | `ProjectsWorkMgmt`    | Task, Party, Document                                       | 21         |
| 15  | [Documents & E-Signature](#15-documents--e-signature)       | `DocumentsEsign`      | Document, Party                                             | 17         |
| 16  | [Analytics & BI](#16-analytics--bi)                         | `AnalyticsBi`         | Party                                                       | 16         |
| 17  | [Monitoring & Incident](#17-monitoring--incident)           | `MonitoringIncident`  | Ticket, Party                                               | 18         |
| 18  | [Compliance & GRC](#18-compliance--grc)                     | `ComplianceGrc`       | Ticket, Asset, Document, Party                              | 22         |

## Capability Notation

Each port operation maps to a **capability string** using the format:

```
entity:operation
```

Examples:

| Capability String      | Meaning                                    |
| ---------------------- | ------------------------------------------ |
| `party:read`           | Read access to person/organisation records |
| `invoice:write`        | Create or update invoice records           |
| `ticket:read`          | List/query ticket records                  |
| `reconciliation:write` | Execute a reconciliation process           |
| `report:read`          | Read-only access to generated reports      |

The capability string is the key used in an adapter's Capability Matrix to declare which operations it supports. During workflow planning, the control plane checks the matrix to determine whether a given adapter can fulfil a requested action.

**Conventions**:

- **Nouns** are lowercase, hyphen-separated (e.g., `journal`, `ad-group`, `change`).
- **Operations** use a fixed vocabulary: `read` (single fetch or filtered list), `write` (create, update, or delete), `approve` (approval decision), `send` (dispatch), `rotate` (credential lifecycle), `export` (produce downloadable output), `assign` (change ownership).
- A capability covers both single-record and list operations for the same entity (e.g., `account:read` covers both `getAccount` and `listAccounts`).
- A `write` capability covers create, update, and delete unless the port explicitly separates them.

---

## Port Families

### 1. Finance & Accounting

**Identifier**: `FinanceAccounting`

**Canonical Objects**: Account, Invoice, Payment, Party, Order

**Capabilities**: `account:read`, `journal:read`, `journal:write`, `invoice:read`, `invoice:write`, `bill:read`, `bill:write`, `vendor:read`, `reconciliation:write`, `report:read`

| #   | Operation            | Input  | Output                | Capability             |
| --- | -------------------- | ------ | --------------------- | ---------------------- |
| 1   | `listAccounts`       | filter | `Account[]`           | `account:read`         |
| 2   | `getAccount`         | ref    | `Account`             | `account:read`         |
| 3   | `createJournalEntry` | data   | `ExternalObjectRef`   | `journal:write`        |
| 4   | `listJournalEntries` | filter | `ExternalObjectRef[]` | `journal:read`         |
| 5   | `getTrialBalance`    | period | `ExternalObjectRef`   | `report:read`          |
| 6   | `listInvoices`       | filter | `Invoice[]`           | `invoice:read`         |
| 7   | `getInvoice`         | ref    | `Invoice`             | `invoice:read`         |
| 8   | `createInvoice`      | data   | `Invoice`             | `invoice:write`        |
| 9   | `listBills`          | filter | `Invoice[]`           | `bill:read`            |
| 10  | `getBill`            | ref    | `Invoice`             | `bill:read`            |
| 11  | `createBill`         | data   | `Invoice`             | `bill:write`           |
| 12  | `listVendors`        | filter | `Party[]`             | `vendor:read`          |
| 13  | `getVendor`          | ref    | `Party`               | `vendor:read`          |
| 14  | `reconcileAccount`   | params | `ExternalObjectRef`   | `reconciliation:write` |
| 15  | `getBalanceSheet`    | period | `ExternalObjectRef`   | `report:read`          |
| 16  | `getProfitAndLoss`   | period | `ExternalObjectRef`   | `report:read`          |

> **Notes**: Bills (AP) are returned as `Invoice` with `direction: payable`. Journal entries remain as `ExternalObjectRef` because line-level debit/credit structures vary across providers. Vendors are returned as `Party` with `role: vendor`.

---

### 2. Payments & Billing

**Identifier**: `PaymentsBilling`

**Canonical Objects**: Payment, Invoice, Subscription, Product, Account, Party

**Capabilities**: `charge:read`, `charge:write`, `refund:write`, `subscription:read`, `subscription:write`, `invoice:read`, `invoice:write`, `payment-method:read`, `payout:write`, `balance:read`

| #   | Operation            | Input       | Output                | Capability            |
| --- | -------------------- | ----------- | --------------------- | --------------------- |
| 1   | `createCharge`       | data        | `Payment`             | `charge:write`        |
| 2   | `getCharge`          | ref         | `Payment`             | `charge:read`         |
| 3   | `refundCharge`       | ref, amount | `Payment`             | `refund:write`        |
| 4   | `listCharges`        | filter      | `Payment[]`           | `charge:read`         |
| 5   | `createSubscription` | data        | `Subscription`        | `subscription:write`  |
| 6   | `getSubscription`    | ref         | `Subscription`        | `subscription:read`   |
| 7   | `cancelSubscription` | ref         | `Subscription`        | `subscription:write`  |
| 8   | `listSubscriptions`  | filter      | `Subscription[]`      | `subscription:read`   |
| 9   | `createInvoice`      | data        | `Invoice`             | `invoice:write`       |
| 10  | `getInvoice`         | ref         | `Invoice`             | `invoice:read`        |
| 11  | `listInvoices`       | filter      | `Invoice[]`           | `invoice:read`        |
| 12  | `getPaymentMethod`   | ref         | `ExternalObjectRef`   | `payment-method:read` |
| 13  | `listPaymentMethods` | filter      | `ExternalObjectRef[]` | `payment-method:read` |
| 14  | `createPayout`       | data        | `Payment`             | `payout:write`        |
| 15  | `getBalance`         | —           | `Account`             | `balance:read`        |

> **Notes**: Charges and refunds are both returned as `Payment` with a `paymentType` discriminant. Payment methods vary too widely across providers (card, bank, wallet) to warrant a canonical object; they are returned as `ExternalObjectRef`. The `getBalance` operation returns an `Account` representing the platform balance.

---

### 3. Procurement & Spend

**Identifier**: `ProcurementSpend`

**Canonical Objects**: Order, Invoice, Payment, Party, Subscription, Document

**Capabilities**: `po:read`, `po:write`, `po:approve`, `expense:read`, `expense:write`, `expense:approve`, `vendor:read`, `vendor:write`, `rfq:write`, `contract:read`

| #   | Operation              | Input         | Output                | Capability        |
| --- | ---------------------- | ------------- | --------------------- | ----------------- |
| 1   | `createPurchaseOrder`  | data          | `Order`               | `po:write`        |
| 2   | `getPurchaseOrder`     | ref           | `Order`               | `po:read`         |
| 3   | `approvePurchaseOrder` | ref, decision | `Order`               | `po:approve`      |
| 4   | `listPurchaseOrders`   | filter        | `Order[]`             | `po:read`         |
| 5   | `createExpenseReport`  | data          | `ExternalObjectRef`   | `expense:write`   |
| 6   | `getExpenseReport`     | ref           | `ExternalObjectRef`   | `expense:read`    |
| 7   | `approveExpenseReport` | ref, decision | `ExternalObjectRef`   | `expense:approve` |
| 8   | `listExpenseReports`   | filter        | `ExternalObjectRef[]` | `expense:read`    |
| 9   | `createVendor`         | data          | `Party`               | `vendor:write`    |
| 10  | `getVendor`            | ref           | `Party`               | `vendor:read`     |
| 11  | `listVendors`          | filter        | `Party[]`             | `vendor:read`     |
| 12  | `createRFQ`            | data          | `ExternalObjectRef`   | `rfq:write`       |
| 13  | `listContracts`        | filter        | `Subscription[]`      | `contract:read`   |
| 14  | `getContract`          | ref           | `Subscription`        | `contract:read`   |

> **Notes**: Vendors are returned as `Party` with `role: vendor`. Contracts map to `Subscription` since they share the same status/start/end date lifecycle. Expense reports are kept as `ExternalObjectRef` due to wide structural variance across providers (line items, receipts, approval chains).

---

### 4. HRIS & HCM

**Identifier**: `HrisHcm`

**Canonical Objects**: Party, Subscription

**Capabilities**: `employee:read`, `employee:write`, `department:read`, `position:read`, `time-off:read`, `time-off:write`, `benefit:read`, `org:read`

| #   | Operation               | Input       | Output                | Capability        |
| --- | ----------------------- | ----------- | --------------------- | ----------------- |
| 1   | `listEmployees`         | filter      | `Party[]`             | `employee:read`   |
| 2   | `getEmployee`           | ref         | `Party`               | `employee:read`   |
| 3   | `createEmployee`        | data        | `Party`               | `employee:write`  |
| 4   | `updateEmployee`        | ref, data   | `Party`               | `employee:write`  |
| 5   | `terminateEmployee`     | ref, reason | `Party`               | `employee:write`  |
| 6   | `listDepartments`       | filter      | `ExternalObjectRef[]` | `department:read` |
| 7   | `getDepartment`         | ref         | `ExternalObjectRef`   | `department:read` |
| 8   | `listJobPositions`      | filter      | `ExternalObjectRef[]` | `position:read`   |
| 9   | `getTimeOff`            | ref         | `ExternalObjectRef`   | `time-off:read`   |
| 10  | `requestTimeOff`        | data        | `ExternalObjectRef`   | `time-off:write`  |
| 11  | `listBenefitEnrolments` | filter      | `Subscription[]`      | `benefit:read`    |
| 12  | `getCompanyStructure`   | —           | `ExternalObjectRef`   | `org:read`        |

> **Notes**: Employees are returned as `Party` with `role: employee`. Benefits map to `Subscription` since enrolments share the same status/start/end date lifecycle. Departments, job positions, and time-off records are structurally variable across providers and are kept as `ExternalObjectRef`.

---

### 5. Payroll

**Identifier**: `Payroll`

**Canonical Objects**: Party, Payment

**Capabilities**: `payroll:read`, `payroll:write`, `payroll:approve`, `paystub:read`, `tax:read`, `schedule:read`, `deduction:read`, `earning:read`, `contractor:read`

| #   | Operation                  | Input         | Output                | Capability        |
| --- | -------------------------- | ------------- | --------------------- | ----------------- |
| 1   | `runPayroll`               | params        | `ExternalObjectRef`   | `payroll:write`   |
| 2   | `getPayrollRun`            | ref           | `ExternalObjectRef`   | `payroll:read`    |
| 3   | `listPayrollRuns`          | filter        | `ExternalObjectRef[]` | `payroll:read`    |
| 4   | `getPayStub`               | ref           | `ExternalObjectRef`   | `paystub:read`    |
| 5   | `listPayStubs`             | filter        | `ExternalObjectRef[]` | `paystub:read`    |
| 6   | `calculateTax`             | params        | `ExternalObjectRef`   | `tax:read`        |
| 7   | `getPaySchedule`           | ref           | `ExternalObjectRef`   | `schedule:read`   |
| 8   | `listDeductions`           | filter        | `ExternalObjectRef[]` | `deduction:read`  |
| 9   | `listEarnings`             | filter        | `ExternalObjectRef[]` | `earning:read`    |
| 10  | `submitPayrollForApproval` | ref           | `ExternalObjectRef`   | `payroll:approve` |
| 11  | `approvePayroll`           | ref, decision | `ExternalObjectRef`   | `payroll:approve` |
| 12  | `listContractorPayments`   | filter        | `Payment[]`           | `contractor:read` |

> **Notes**: Payroll runs, tax calculations, pay schedules, deductions, and earnings vary widely across providers and remain as `ExternalObjectRef`. Contractor payments are returned as `Payment` since they represent a cash disbursement with amount, currency, and status. The distinction between `submitPayrollForApproval` and `approvePayroll` supports two-phase payroll workflows.

---

### 6. CRM & Sales

**Identifier**: `CrmSales`

**Canonical Objects**: Party, Opportunity, Task, Campaign, Product, Order, Invoice

**Capabilities**: `party:read`, `party:write`, `company:read`, `company:write`, `opportunity:read`, `opportunity:write`, `pipeline:read`, `activity:read`, `activity:write`, `note:read`, `note:write`

| #   | Operation                | Input      | Output                | Capability          |
| --- | ------------------------ | ---------- | --------------------- | ------------------- |
| 1   | `listContacts`           | filter     | `Party[]`             | `party:read`        |
| 2   | `getContact`             | ref        | `Party`               | `party:read`        |
| 3   | `createContact`          | data       | `Party`               | `party:write`       |
| 4   | `updateContact`          | ref, data  | `Party`               | `party:write`       |
| 5   | `listCompanies`          | filter     | `Party[]`             | `company:read`      |
| 6   | `getCompany`             | ref        | `Party`               | `company:read`      |
| 7   | `createCompany`          | data       | `Party`               | `company:write`     |
| 8   | `listOpportunities`      | filter     | `Opportunity[]`       | `opportunity:read`  |
| 9   | `getOpportunity`         | ref        | `Opportunity`         | `opportunity:read`  |
| 10  | `createOpportunity`      | data       | `Opportunity`         | `opportunity:write` |
| 11  | `updateOpportunityStage` | ref, stage | `Opportunity`         | `opportunity:write` |
| 12  | `listPipelines`          | filter     | `ExternalObjectRef[]` | `pipeline:read`     |
| 13  | `listActivities`         | filter     | `Task[]`              | `activity:read`     |
| 14  | `createActivity`         | data       | `Task`                | `activity:write`    |
| 15  | `listNotes`              | filter     | `Document[]`          | `note:read`         |
| 16  | `createNote`             | data       | `Document`            | `note:write`        |

> **Notes**: Contacts and companies are both returned as `Party` — contacts with `role: contact` or `role: lead`, companies with `role: org`. Activities (calls, meetings, emails logged against deals) map to `Task`. Notes map to `Document`. Pipelines are structural metadata unique to each CRM and remain as `ExternalObjectRef`.

---

### 7. Customer Support

**Identifier**: `CustomerSupport`

**Canonical Objects**: Ticket, Party, Document

**Capabilities**: `ticket:read`, `ticket:write`, `ticket:assign`, `agent:read`, `comment:read`, `comment:write`, `tag:read`, `tag:write`, `kb:read`, `sla:read`, `csat:read`

| #   | Operation                         | Input         | Output                | Capability      |
| --- | --------------------------------- | ------------- | --------------------- | --------------- |
| 1   | `listTickets`                     | filter        | `Ticket[]`            | `ticket:read`   |
| 2   | `getTicket`                       | ref           | `Ticket`              | `ticket:read`   |
| 3   | `createTicket`                    | data          | `Ticket`              | `ticket:write`  |
| 4   | `updateTicket`                    | ref, data     | `Ticket`              | `ticket:write`  |
| 5   | `closeTicket`                     | ref           | `Ticket`              | `ticket:write`  |
| 6   | `listAgents`                      | filter        | `Party[]`             | `agent:read`    |
| 7   | `assignTicket`                    | ref, assignee | `Ticket`              | `ticket:assign` |
| 8   | `addComment`                      | ref, content  | `ExternalObjectRef`   | `comment:write` |
| 9   | `listComments`                    | ref           | `ExternalObjectRef[]` | `comment:read`  |
| 10  | `listTags`                        | filter        | `ExternalObjectRef[]` | `tag:read`      |
| 11  | `createTag`                       | data          | `ExternalObjectRef`   | `tag:write`     |
| 12  | `getKnowledgeArticle`             | ref           | `Document`            | `kb:read`       |
| 13  | `listKnowledgeArticles`           | filter        | `Document[]`          | `kb:read`       |
| 14  | `getSLA`                          | ref           | `ExternalObjectRef`   | `sla:read`      |
| 15  | `listCustomerSatisfactionRatings` | filter        | `ExternalObjectRef[]` | `csat:read`     |

> **Notes**: Knowledge articles are returned as `Document` since they share the title/content/media-type structure. Agents are returned as `Party` with `role: user`. SLA definitions and CSAT ratings are provider-specific and remain as `ExternalObjectRef`.

---

### 8. ITSM & IT Ops

**Identifier**: `ItsmItOps`

**Canonical Objects**: Ticket, Asset, Party, Document, Subscription, Product

**Capabilities**: `incident:read`, `incident:write`, `change:read`, `change:write`, `change:approve`, `asset:read`, `asset:write`, `cmdb:read`, `problem:read`, `problem:write`, `sr:read`

| #   | Operation              | Input         | Output     | Capability       |
| --- | ---------------------- | ------------- | ---------- | ---------------- |
| 1   | `listIncidents`        | filter        | `Ticket[]` | `incident:read`  |
| 2   | `getIncident`          | ref           | `Ticket`   | `incident:read`  |
| 3   | `createIncident`       | data          | `Ticket`   | `incident:write` |
| 4   | `updateIncident`       | ref, data     | `Ticket`   | `incident:write` |
| 5   | `resolveIncident`      | ref           | `Ticket`   | `incident:write` |
| 6   | `listChangeRequests`   | filter        | `Ticket[]` | `change:read`    |
| 7   | `createChangeRequest`  | data          | `Ticket`   | `change:write`   |
| 8   | `approveChangeRequest` | ref, decision | `Ticket`   | `change:approve` |
| 9   | `listAssets`           | filter        | `Asset[]`  | `asset:read`     |
| 10  | `getAsset`             | ref           | `Asset`    | `asset:read`     |
| 11  | `createAsset`          | data          | `Asset`    | `asset:write`    |
| 12  | `updateAsset`          | ref, data     | `Asset`    | `asset:write`    |
| 13  | `listCMDBItems`        | filter        | `Asset[]`  | `cmdb:read`      |
| 14  | `getCMDBItem`          | ref           | `Asset`    | `cmdb:read`      |
| 15  | `listProblems`         | filter        | `Ticket[]` | `problem:read`   |
| 16  | `createProblem`        | data          | `Ticket`   | `problem:write`  |
| 17  | `listServiceRequests`  | filter        | `Ticket[]` | `sr:read`        |

> **Notes**: Incidents, change requests, problems, and service requests all map to `Ticket` with distinct status and priority semantics. CMDB items map to `Asset` for discoverable configuration items. The `approveChangeRequest` operation uses the dedicated `change:approve` capability to distinguish it from standard write operations, reflecting the formal CAB approval process in ITSM.

---

### 9. IAM & Directory

**Identifier**: `IamDirectory`

**Canonical Objects**: Party, Asset

**Capabilities**: `user:read`, `user:write`, `group:read`, `group:write`, `role:read`, `role:write`, `app:read`, `auth:write`, `mfa:write`, `audit:read`

| #   | Operation             | Input             | Output                | Capability    |
| --- | --------------------- | ----------------- | --------------------- | ------------- |
| 1   | `listUsers`           | filter            | `Party[]`             | `user:read`   |
| 2   | `getUser`             | ref               | `Party`               | `user:read`   |
| 3   | `createUser`          | data              | `Party`               | `user:write`  |
| 4   | `updateUser`          | ref, data         | `Party`               | `user:write`  |
| 5   | `deactivateUser`      | ref               | `Party`               | `user:write`  |
| 6   | `listGroups`          | filter            | `ExternalObjectRef[]` | `group:read`  |
| 7   | `getGroup`            | ref               | `ExternalObjectRef`   | `group:read`  |
| 8   | `createGroup`         | data              | `ExternalObjectRef`   | `group:write` |
| 9   | `addUserToGroup`      | userRef, groupRef | `void`                | `group:write` |
| 10  | `removeUserFromGroup` | userRef, groupRef | `void`                | `group:write` |
| 11  | `listRoles`           | filter            | `ExternalObjectRef[]` | `role:read`   |
| 12  | `assignRole`          | userRef, roleRef  | `void`                | `role:write`  |
| 13  | `revokeRole`          | userRef, roleRef  | `void`                | `role:write`  |
| 14  | `listApplications`    | filter            | `ExternalObjectRef[]` | `app:read`    |
| 15  | `getApplication`      | ref               | `ExternalObjectRef`   | `app:read`    |
| 16  | `authenticateUser`    | credentials       | `ExternalObjectRef`   | `auth:write`  |
| 17  | `verifyMFA`           | ref, factor       | `ExternalObjectRef`   | `mfa:write`   |
| 18  | `listAuditLogs`       | filter            | `ExternalObjectRef[]` | `audit:read`  |

> **Notes**: Users are returned as `Party` with `role: user`. Groups, roles, and applications are structural IAM constructs that vary across providers (Entra ID, Okta, JumpCloud) and remain as `ExternalObjectRef`. Devices managed in directory services map to `Asset` with `assetType: device` when accessed through asset-related operations. The `void` return type on membership operations indicates that no canonical object is produced — only an `EvidenceEntry` is recorded.

---

### 10. Secrets & Vaulting

**Identifier**: `SecretsVaulting`

**Canonical Objects**: _(none — infrastructure-level)_

**Capabilities**: `secret:read`, `secret:write`, `secret:rotate`, `cert:read`, `cert:write`, `crypto:read`, `crypto:write`, `key:read`, `key:write`, `audit:read`, `policy:write`

| #   | Operation           | Input        | Output                | Capability      |
| --- | ------------------- | ------------ | --------------------- | --------------- |
| 1   | `getSecret`         | path         | `ExternalObjectRef`   | `secret:read`   |
| 2   | `putSecret`         | path, value  | `ExternalObjectRef`   | `secret:write`  |
| 3   | `deleteSecret`      | path         | `void`                | `secret:write`  |
| 4   | `listSecrets`       | path         | `ExternalObjectRef[]` | `secret:read`   |
| 5   | `rotateSecret`      | path         | `ExternalObjectRef`   | `secret:rotate` |
| 6   | `createCertificate` | params       | `ExternalObjectRef`   | `cert:write`    |
| 7   | `getCertificate`    | ref          | `ExternalObjectRef`   | `cert:read`     |
| 8   | `renewCertificate`  | ref          | `ExternalObjectRef`   | `cert:write`    |
| 9   | `listCertificates`  | filter       | `ExternalObjectRef[]` | `cert:read`     |
| 10  | `encrypt`           | data, keyRef | `ExternalObjectRef`   | `crypto:write`  |
| 11  | `decrypt`           | data, keyRef | `ExternalObjectRef`   | `crypto:read`   |
| 12  | `createKey`         | params       | `ExternalObjectRef`   | `key:write`     |
| 13  | `listKeys`          | filter       | `ExternalObjectRef[]` | `key:read`      |
| 14  | `getAuditLog`       | filter       | `ExternalObjectRef[]` | `audit:read`    |
| 15  | `setSecretPolicy`   | path, policy | `ExternalObjectRef`   | `policy:write`  |

> **Notes**: Secrets & Vaulting is an infrastructure-level port. It produces no canonical business objects — all outputs are `ExternalObjectRef`. VAOP never inspects secret values; it only orchestrates their lifecycle (creation, rotation, renewal). VAOP interacts with this port primarily through the `CredentialGrant` entity in the Workspace aggregate. Providers include HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, and GCP Secret Manager.

---

### 11. Marketing Automation

**Identifier**: `MarketingAutomation`

**Canonical Objects**: Party, Campaign, Document

**Capabilities**: `contact:read`, `contact:write`, `list:read`, `list:write`, `campaign:read`, `campaign:write`, `campaign:send`, `stats:read`, `automation:read`, `automation:write`, `form:read`

| #   | Operation               | Input               | Output                | Capability         |
| --- | ----------------------- | ------------------- | --------------------- | ------------------ |
| 1   | `listContacts`          | filter              | `Party[]`             | `contact:read`     |
| 2   | `getContact`            | ref                 | `Party`               | `contact:read`     |
| 3   | `createContact`         | data                | `Party`               | `contact:write`    |
| 4   | `updateContact`         | ref, data           | `Party`               | `contact:write`    |
| 5   | `listLists`             | filter              | `ExternalObjectRef[]` | `list:read`        |
| 6   | `getList`               | ref                 | `ExternalObjectRef`   | `list:read`        |
| 7   | `addContactToList`      | contactRef, listRef | `void`                | `list:write`       |
| 8   | `removeContactFromList` | contactRef, listRef | `void`                | `list:write`       |
| 9   | `listCampaigns`         | filter              | `Campaign[]`          | `campaign:read`    |
| 10  | `getCampaign`           | ref                 | `Campaign`            | `campaign:read`    |
| 11  | `createCampaign`        | data                | `Campaign`            | `campaign:write`   |
| 12  | `sendCampaign`          | ref                 | `Campaign`            | `campaign:send`    |
| 13  | `getCampaignStats`      | ref                 | `ExternalObjectRef`   | `stats:read`       |
| 14  | `listAutomations`       | filter              | `ExternalObjectRef[]` | `automation:read`  |
| 15  | `getAutomation`         | ref                 | `ExternalObjectRef`   | `automation:read`  |
| 16  | `triggerAutomation`     | ref, data           | `ExternalObjectRef`   | `automation:write` |
| 17  | `listForms`             | filter              | `ExternalObjectRef[]` | `form:read`        |
| 18  | `getFormSubmissions`    | ref                 | `ExternalObjectRef[]` | `form:read`        |

> **Notes**: Marketing contacts are returned as `Party` with `role: contact` or `role: lead`. Mailing lists, automations, campaign statistics, and forms are provider-specific structures (Mailchimp audiences vs. HubSpot workflows vs. ActiveCampaign automations) and remain as `ExternalObjectRef`. The `sendCampaign` operation uses the dedicated `campaign:send` capability to distinguish sending from creation/editing.

---

### 12. Ads Platforms

**Identifier**: `AdsPlatforms`

**Canonical Objects**: Campaign, Document

**Capabilities**: `campaign:read`, `campaign:write`, `ad-group:read`, `ad-group:write`, `ad:read`, `ad:write`, `stats:read`, `audience:read`, `audience:write`, `budget:read`, `budget:write`, `keyword:read`

| #   | Operation          | Input       | Output                | Capability       |
| --- | ------------------ | ----------- | --------------------- | ---------------- |
| 1   | `listCampaigns`    | filter      | `Campaign[]`          | `campaign:read`  |
| 2   | `getCampaign`      | ref         | `Campaign`            | `campaign:read`  |
| 3   | `createCampaign`   | data        | `Campaign`            | `campaign:write` |
| 4   | `updateCampaign`   | ref, data   | `Campaign`            | `campaign:write` |
| 5   | `pauseCampaign`    | ref         | `Campaign`            | `campaign:write` |
| 6   | `listAdGroups`     | filter      | `ExternalObjectRef[]` | `ad-group:read`  |
| 7   | `getAdGroup`       | ref         | `ExternalObjectRef`   | `ad-group:read`  |
| 8   | `createAdGroup`    | data        | `ExternalObjectRef`   | `ad-group:write` |
| 9   | `listAds`          | filter      | `ExternalObjectRef[]` | `ad:read`        |
| 10  | `getAd`            | ref         | `ExternalObjectRef`   | `ad:read`        |
| 11  | `createAd`         | data        | `ExternalObjectRef`   | `ad:write`       |
| 12  | `getCampaignStats` | ref, period | `ExternalObjectRef`   | `stats:read`     |
| 13  | `getAdGroupStats`  | ref, period | `ExternalObjectRef`   | `stats:read`     |
| 14  | `getAdStats`       | ref, period | `ExternalObjectRef`   | `stats:read`     |
| 15  | `listAudiences`    | filter      | `ExternalObjectRef[]` | `audience:read`  |
| 16  | `createAudience`   | data        | `ExternalObjectRef`   | `audience:write` |
| 17  | `getBudget`        | ref         | `ExternalObjectRef`   | `budget:read`    |
| 18  | `updateBudget`     | ref, amount | `ExternalObjectRef`   | `budget:write`   |
| 19  | `listKeywords`     | filter      | `ExternalObjectRef[]` | `keyword:read`   |

> **Notes**: Ad groups, individual ads, audiences, keywords, and performance statistics are deeply platform-specific (Google Ads responsive search ads vs. Meta carousel ads vs. LinkedIn sponsored content) and remain as `ExternalObjectRef`. The `pauseCampaign` operation uses `campaign:write` because pausing is a status mutation on the campaign object.

---

### 13. Comms & Collaboration

**Identifier**: `CommsCollaboration`

**Canonical Objects**: Party, Task, Document

**Capabilities**: `message:read`, `message:write`, `channel:read`, `channel:write`, `user:read`, `email:read`, `email:write`, `meeting:read`, `meeting:write`, `calendar:read`, `calendar:write`, `file:read`, `file:write`

| #   | Operation             | Input               | Output                | Capability       |
| --- | --------------------- | ------------------- | --------------------- | ---------------- |
| 1   | `sendMessage`         | data                | `ExternalObjectRef`   | `message:write`  |
| 2   | `listMessages`        | filter              | `ExternalObjectRef[]` | `message:read`   |
| 3   | `getMessageThread`    | ref                 | `ExternalObjectRef`   | `message:read`   |
| 4   | `listChannels`        | filter              | `ExternalObjectRef[]` | `channel:read`   |
| 5   | `createChannel`       | data                | `ExternalObjectRef`   | `channel:write`  |
| 6   | `archiveChannel`      | ref                 | `ExternalObjectRef`   | `channel:write`  |
| 7   | `addUserToChannel`    | userRef, channelRef | `void`                | `channel:write`  |
| 8   | `listUsers`           | filter              | `Party[]`             | `user:read`      |
| 9   | `getUser`             | ref                 | `Party`               | `user:read`      |
| 10  | `sendEmail`           | data                | `ExternalObjectRef`   | `email:write`    |
| 11  | `listEmails`          | filter              | `ExternalObjectRef[]` | `email:read`     |
| 12  | `getEmail`            | ref                 | `ExternalObjectRef`   | `email:read`     |
| 13  | `createMeeting`       | data                | `ExternalObjectRef`   | `meeting:write`  |
| 14  | `getMeeting`          | ref                 | `ExternalObjectRef`   | `meeting:read`   |
| 15  | `listMeetings`        | filter              | `ExternalObjectRef[]` | `meeting:read`   |
| 16  | `listCalendarEvents`  | filter              | `Task[]`              | `calendar:read`  |
| 17  | `createCalendarEvent` | data                | `Task`                | `calendar:write` |
| 18  | `uploadFile`          | data                | `Document`            | `file:write`     |
| 19  | `listFiles`           | filter              | `Document[]`          | `file:read`      |

> **Notes**: Most comms entities (messages, channels, meetings, emails) are structurally unique to each platform (Slack blocks vs. Teams adaptive cards vs. Discord embeds) and remain as `ExternalObjectRef`. Calendar events map to `Task` since they share the title/time/assignee structure. File attachments map to `Document`. Users are returned as `Party` with `role: user`.

---

### 14. Projects & Work Management

**Identifier**: `ProjectsWorkMgmt`

**Canonical Objects**: Task, Party, Document

**Capabilities**: `project:read`, `project:write`, `task:read`, `task:write`, `task:assign`, `board:read`, `sprint:read`, `sprint:write`, `milestone:read`, `comment:read`, `comment:write`, `label:read`, `time:read`, `time:write`

| #   | Operation         | Input         | Output                | Capability       |
| --- | ----------------- | ------------- | --------------------- | ---------------- |
| 1   | `listProjects`    | filter        | `ExternalObjectRef[]` | `project:read`   |
| 2   | `getProject`      | ref           | `ExternalObjectRef`   | `project:read`   |
| 3   | `createProject`   | data          | `ExternalObjectRef`   | `project:write`  |
| 4   | `listTasks`       | filter        | `Task[]`              | `task:read`      |
| 5   | `getTask`         | ref           | `Task`                | `task:read`      |
| 6   | `createTask`      | data          | `Task`                | `task:write`     |
| 7   | `updateTask`      | ref, data     | `Task`                | `task:write`     |
| 8   | `deleteTask`      | ref           | `void`                | `task:write`     |
| 9   | `assignTask`      | ref, assignee | `Task`                | `task:assign`    |
| 10  | `listBoards`      | filter        | `ExternalObjectRef[]` | `board:read`     |
| 11  | `getBoard`        | ref           | `ExternalObjectRef`   | `board:read`     |
| 12  | `listSprints`     | filter        | `ExternalObjectRef[]` | `sprint:read`    |
| 13  | `getSprint`       | ref           | `ExternalObjectRef`   | `sprint:read`    |
| 14  | `createSprint`    | data          | `ExternalObjectRef`   | `sprint:write`   |
| 15  | `listMilestones`  | filter        | `ExternalObjectRef[]` | `milestone:read` |
| 16  | `getMilestone`    | ref           | `ExternalObjectRef`   | `milestone:read` |
| 17  | `listComments`    | ref           | `ExternalObjectRef[]` | `comment:read`   |
| 18  | `addComment`      | ref, content  | `ExternalObjectRef`   | `comment:write`  |
| 19  | `listLabels`      | filter        | `ExternalObjectRef[]` | `label:read`     |
| 20  | `listTimeEntries` | filter        | `ExternalObjectRef[]` | `time:read`      |
| 21  | `logTime`         | ref, data     | `ExternalObjectRef`   | `time:write`     |

> **Notes**: Tasks are the primary canonical object, mapping to Jira Issues, Asana Tasks, Monday Items, Linear Issues, etc. Projects, boards, sprints, milestones, and labels are structural containers that vary across providers and remain as `ExternalObjectRef`. The `assignTask` operation uses the dedicated `task:assign` capability to distinguish ownership changes from general field updates. This port family has the most operations (21) reflecting the breadth of the project management domain.

---

### 15. Documents & E-Signature

**Identifier**: `DocumentsEsign`

**Canonical Objects**: Document, Party

**Capabilities**: `document:read`, `document:write`, `folder:read`, `folder:write`, `share:write`, `permission:read`, `permission:write`, `esign:read`, `esign:write`, `template:read`, `template:write`, `audit:read`

| #   | Operation                | Input       | Output                | Capability         |
| --- | ------------------------ | ----------- | --------------------- | ------------------ |
| 1   | `listDocuments`          | filter      | `Document[]`          | `document:read`    |
| 2   | `getDocument`            | ref         | `Document`            | `document:read`    |
| 3   | `uploadDocument`         | data        | `Document`            | `document:write`   |
| 4   | `deleteDocument`         | ref         | `void`                | `document:write`   |
| 5   | `createFolder`           | data        | `ExternalObjectRef`   | `folder:write`     |
| 6   | `listFolders`            | filter      | `ExternalObjectRef[]` | `folder:read`      |
| 7   | `moveDocument`           | ref, dest   | `Document`            | `document:write`   |
| 8   | `shareDocument`          | ref, target | `ExternalObjectRef`   | `share:write`      |
| 9   | `getPermissions`         | ref         | `ExternalObjectRef[]` | `permission:read`  |
| 10  | `setPermissions`         | ref, perms  | `ExternalObjectRef`   | `permission:write` |
| 11  | `createSignatureRequest` | data        | `ExternalObjectRef`   | `esign:write`      |
| 12  | `getSignatureRequest`    | ref         | `ExternalObjectRef`   | `esign:read`       |
| 13  | `listSignatureRequests`  | filter      | `ExternalObjectRef[]` | `esign:read`       |
| 14  | `downloadSignedDocument` | ref         | `Document`            | `esign:read`       |
| 15  | `createTemplate`         | data        | `Document`            | `template:write`   |
| 16  | `listTemplates`          | filter      | `Document[]`          | `template:read`    |
| 17  | `getAuditTrail`          | ref         | `ExternalObjectRef`   | `audit:read`       |

> **Notes**: Documents and templates both map to `Document` with different `mediaType` values. Signature requests, folders, and signing workflows are provider-specific (DocuSign envelopes vs. Adobe Sign agreements vs. HelloSign signature requests) and remain as `ExternalObjectRef`. Completed signed documents are downloadable as `Document`. The `getAuditTrail` operation returns provider-specific signing audit data as `ExternalObjectRef`.

---

### 16. Analytics & BI

**Identifier**: `AnalyticsBi`

**Canonical Objects**: Party

**Capabilities**: `dashboard:read`, `report:read`, `report:write`, `report:export`, `query:read`, `query:write`, `datasource:read`, `datasource:write`, `dataset:read`, `dataset:write`, `metric:read`, `user:read`, `share:write`

| #   | Operation          | Input       | Output                | Capability         |
| --- | ------------------ | ----------- | --------------------- | ------------------ |
| 1   | `listDashboards`   | filter      | `ExternalObjectRef[]` | `dashboard:read`   |
| 2   | `getDashboard`     | ref         | `ExternalObjectRef`   | `dashboard:read`   |
| 3   | `listReports`      | filter      | `ExternalObjectRef[]` | `report:read`      |
| 4   | `getReport`        | ref         | `ExternalObjectRef`   | `report:read`      |
| 5   | `runQuery`         | query       | `ExternalObjectRef`   | `query:write`      |
| 6   | `getQueryResults`  | ref         | `ExternalObjectRef`   | `query:read`       |
| 7   | `listDataSources`  | filter      | `ExternalObjectRef[]` | `datasource:read`  |
| 8   | `getDataSource`    | ref         | `ExternalObjectRef`   | `datasource:read`  |
| 9   | `createDataSource` | data        | `ExternalObjectRef`   | `datasource:write` |
| 10  | `listDatasets`     | filter      | `ExternalObjectRef[]` | `dataset:read`     |
| 11  | `getDataset`       | ref         | `ExternalObjectRef`   | `dataset:read`     |
| 12  | `refreshDataset`   | ref         | `ExternalObjectRef`   | `dataset:write`    |
| 13  | `listMetrics`      | filter      | `ExternalObjectRef[]` | `metric:read`      |
| 14  | `exportReport`     | ref, format | `Document`            | `report:export`    |
| 15  | `listUsers`        | filter      | `Party[]`             | `user:read`        |
| 16  | `shareReport`      | ref, target | `ExternalObjectRef`   | `share:write`      |

> **Notes**: Reports, dashboards, queries, and datasets are deeply platform-specific (Looker LookML vs. Tableau workbooks vs. Power BI datasets vs. Metabase questions) and are exclusively referenced via `ExternalObjectRef`. The `exportReport` operation is the exception — it produces a `Document` representing the exported file (PDF, CSV, etc.). The `runQuery` / `getQueryResults` pair supports asynchronous query execution patterns common in BI platforms. Users in the BI context are returned as `Party` for sharing and permission management.

---

### 17. Monitoring & Incident

**Identifier**: `MonitoringIncident`

**Canonical Objects**: Ticket, Party

**Capabilities**: `alert:read`, `alert:write`, `incident:read`, `incident:write`, `schedule:read`, `schedule:write`, `escalation:read`, `service:read`, `statuspage:write`, `maintenance:read`, `notification:write`

| #   | Operation                | Input     | Output                | Capability           |
| --- | ------------------------ | --------- | --------------------- | -------------------- |
| 1   | `listAlerts`             | filter    | `ExternalObjectRef[]` | `alert:read`         |
| 2   | `getAlert`               | ref       | `ExternalObjectRef`   | `alert:read`         |
| 3   | `acknowledgeAlert`       | ref       | `ExternalObjectRef`   | `alert:write`        |
| 4   | `resolveAlert`           | ref       | `ExternalObjectRef`   | `alert:write`        |
| 5   | `listIncidents`          | filter    | `Ticket[]`            | `incident:read`      |
| 6   | `getIncident`            | ref       | `Ticket`              | `incident:read`      |
| 7   | `createIncident`         | data      | `Ticket`              | `incident:write`     |
| 8   | `updateIncident`         | ref, data | `Ticket`              | `incident:write`     |
| 9   | `listOnCallSchedules`    | filter    | `ExternalObjectRef[]` | `schedule:read`      |
| 10  | `getOnCallSchedule`      | ref       | `ExternalObjectRef`   | `schedule:read`      |
| 11  | `createOnCallSchedule`   | data      | `ExternalObjectRef`   | `schedule:write`     |
| 12  | `listEscalationPolicies` | filter    | `ExternalObjectRef[]` | `escalation:read`    |
| 13  | `listServices`           | filter    | `ExternalObjectRef[]` | `service:read`       |
| 14  | `getService`             | ref       | `ExternalObjectRef`   | `service:read`       |
| 15  | `createStatusPage`       | data      | `ExternalObjectRef`   | `statuspage:write`   |
| 16  | `updateStatusPage`       | ref, data | `ExternalObjectRef`   | `statuspage:write`   |
| 17  | `listMaintenanceWindows` | filter    | `ExternalObjectRef[]` | `maintenance:read`   |
| 18  | `sendNotification`       | data      | `ExternalObjectRef`   | `notification:write` |

> **Notes**: Incidents map to `Ticket` with monitoring-specific status values (triggered, acknowledged, resolved). Alerts are kept as `ExternalObjectRef` because they are transient, provider-specific signals (PagerDuty events vs. Datadog monitors vs. Grafana alerts) that differ fundamentally from the incident lifecycle. On-call schedules, escalation policies, services, and status pages are operational constructs specific to each monitoring platform and remain as `ExternalObjectRef`.

---

### 18. Compliance & GRC

**Identifier**: `ComplianceGrc`

**Canonical Objects**: Ticket, Asset, Document, Party

**Capabilities**: `control:read`, `control:write`, `risk:read`, `risk:write`, `policy:read`, `policy:write`, `audit:read`, `audit:write`, `finding:read`, `finding:write`, `evidence:read`, `evidence:write`, `framework:read`, `framework:write`

| #   | Operation               | Input                    | Output                | Capability        |
| --- | ----------------------- | ------------------------ | --------------------- | ----------------- |
| 1   | `listControls`          | filter                   | `ExternalObjectRef[]` | `control:read`    |
| 2   | `getControl`            | ref                      | `ExternalObjectRef`   | `control:read`    |
| 3   | `createControl`         | data                     | `ExternalObjectRef`   | `control:write`   |
| 4   | `updateControlStatus`   | ref, status              | `ExternalObjectRef`   | `control:write`   |
| 5   | `listRisks`             | filter                   | `ExternalObjectRef[]` | `risk:read`       |
| 6   | `getRisk`               | ref                      | `ExternalObjectRef`   | `risk:read`       |
| 7   | `createRisk`            | data                     | `ExternalObjectRef`   | `risk:write`      |
| 8   | `assessRisk`            | ref, data                | `ExternalObjectRef`   | `risk:write`      |
| 9   | `listPolicies`          | filter                   | `ExternalObjectRef[]` | `policy:read`     |
| 10  | `getPolicy`             | ref                      | `ExternalObjectRef`   | `policy:read`     |
| 11  | `createPolicy`          | data                     | `ExternalObjectRef`   | `policy:write`    |
| 12  | `publishPolicy`         | ref                      | `ExternalObjectRef`   | `policy:write`    |
| 13  | `listAudits`            | filter                   | `ExternalObjectRef[]` | `audit:read`      |
| 14  | `getAudit`              | ref                      | `ExternalObjectRef`   | `audit:read`      |
| 15  | `createAudit`           | data                     | `ExternalObjectRef`   | `audit:write`     |
| 16  | `listFindings`          | filter                   | `Ticket[]`            | `finding:read`    |
| 17  | `createFinding`         | data                     | `Ticket`              | `finding:write`   |
| 18  | `listEvidenceRequests`  | filter                   | `ExternalObjectRef[]` | `evidence:read`   |
| 19  | `uploadEvidence`        | data                     | `Document`            | `evidence:write`  |
| 20  | `listFrameworks`        | filter                   | `ExternalObjectRef[]` | `framework:read`  |
| 21  | `getFramework`          | ref                      | `ExternalObjectRef`   | `framework:read`  |
| 22  | `mapControlToFramework` | controlRef, frameworkRef | `ExternalObjectRef`   | `framework:write` |

> **Notes**: Findings map to `Ticket` because they share the same subject/status/priority/assignee structure as support tickets and incidents. Evidence artefacts map to `Document`. Controls, risks, audits, policies, and frameworks are deeply domain-specific constructs (Drata controls vs. Vanta tests vs. OneTrust assessments) and remain as `ExternalObjectRef`. The `policy` operations in this port refer to GRC policies in external compliance tools, **not** to VAOP's own `Policy` aggregate — VAOP's internal policies (approval rules, SoD constraints) are a separate domain concept. This port family has the most operations (22) reflecting the breadth of the GRC domain.

---

## Cross-Cutting Concerns

### Workspace Scoping

All port operations are scoped to a workspace (tenant). Every operation implicitly receives a `TenantId` from the Run context. Adapters must ensure that all API calls to the underlying SoR are made with the correct tenant credentials, and that no data leaks across workspace boundaries.

### Evidence Production

All write operations (`*:write`, `*:approve`, `*:send`, `*:rotate`, `*:assign`, `*:export`) produce `EvidenceEntry` records attached to the current Run. Evidence entries capture:

- The operation name and capability used
- Input parameters (redacted of secrets)
- Output canonical object or `ExternalObjectRef`
- Timestamp and actor identity
- The adapter and provider that executed the operation

Evidence entries are append-only and governed by retention schedules per ADR-028.

### Capability Matrix

Each adapter declares a `CapabilityMatrix` listing the capabilities it supports from its port family. The control plane uses this matrix during workflow planning to:

1. **Route actions** to the correct adapter for the tenant's configured provider.
2. **Validate workflows** at design time — actions referencing unsupported capabilities produce validation errors.
3. **Generate diffs** — the planner can preview which operations will be called and what their expected outputs are.

An adapter is not required to implement all operations in its port family. Partial implementations are expected and encouraged — a read-only adapter that supports only `*:read` capabilities is valid.

### Rate Limiting and Retry

Rate limiting and retry logic are adapter-level concerns, not port-level. Each adapter is responsible for:

- Respecting the SoR's rate limits (via `Retry-After` headers or exponential backoff)
- Implementing idempotency keys for write operations where the SoR supports them
- Reporting rate-limit events as evidence entries for observability

### Canonical Object Guarantees

When a port operation declares a canonical object as its output type, the adapter must:

1. Map the SoR entity to the canonical object's shared fields.
2. Attach `ExternalObjectRef` entries linking back to the source record(s).
3. Preserve the SoR's native ID in the external reference for round-trip operations.

Operations that return `ExternalObjectRef` directly indicate that the underlying entity has no canonical mapping — the adapter passes through a typed deep link without attempting normalisation.

### Error Handling

Port operations use a standard error taxonomy:

| Error Type        | Meaning                                        | Retryable             |
| ----------------- | ---------------------------------------------- | --------------------- |
| `NotFound`        | The requested entity does not exist in the SoR | No                    |
| `Unauthorized`    | Credentials are invalid or expired             | No (requires re-auth) |
| `Forbidden`       | Valid credentials but insufficient permissions | No                    |
| `RateLimited`     | SoR rate limit exceeded                        | Yes (after backoff)   |
| `Conflict`        | Concurrent modification detected               | Yes (with fresh read) |
| `ValidationError` | Input fails SoR-side validation                | No                    |
| `ProviderError`   | Unclassified SoR error                         | Depends on context    |

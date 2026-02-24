# ADR-0026: Port Taxonomy Aligned to Business Coverage

## Status

Accepted

## Context

VAOP claims to cover "non-core business operations" but without a defined taxonomy, the scope is vague. The integration catalog identifies 18 distinct business capability domains, each with dozens of SoR vendors. Without a stable, published taxonomy, adapter teams lack clear boundaries and the platform risks unbounded canonical model growth.

## Decision

Define and publish a stable port taxonomy aligned to management/support business categories:

- FinanceAccounting
- PaymentsBilling
- ProcurementSpend
- HrisHcm
- Payroll
- CrmSales
- CustomerSupport
- ItsmItOps
- IamDirectory
- SecretsVaulting
- MarketingAutomation
- AdsPlatforms
- CommsCollaboration
- ProjectsWorkMgmt
- DocumentsEsign
- AnalyticsBi
- MonitoringIncident
- ComplianceGrc

Adapter coverage is phased; the taxonomy itself is stable and versioned. Each port family defines standard operations and capability keys. New port families require an ADR amendment.

## Consequences

- Makes the "broad non-core coverage" claim precise and verifiable.
- Prevents premature canonical model expansion by constraining scope to declared port families.
- Adapter teams can work independently against stable port interfaces without cross-team coordination.
- Port taxonomy changes require an ADR, ensuring deliberate governance over scope evolution.

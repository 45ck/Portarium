# Port-Family Integration Candidate Matrix

This matrix assigns an owner and current blockers for all 18 standard Portarium port families, with required artefact dependencies for family kickoff.

Source of truth for this matrix: `domain-atlas/decisions/port-family-integration-candidate-matrix.json`.

## Required Artifact Dependencies

Every port family candidate must provide:

1. `sourceManifest` (`domain-atlas/sources/<provider>/source.json`)
2. `providerDecision` (`domain-atlas/decisions/providers/<provider>.md`)
3. `cifExtract` (`domain-atlas/extracted/<provider>/cif.json`)
4. `canonicalMapping` (`domain-atlas/mappings/<provider>/*.mapping.json`)
5. `capabilityMatrix` (`domain-atlas/capabilities/<provider>/*.capability-matrix.json`)
6. `contractFixtures` (`test/fixtures/**` or provider contract fixture path)

## Family Assignments

| Port Family | Owner | Candidate Providers | Current Blockers |
| --- | --- | --- | --- |
| FinanceAccounting | `integration-finance` | `odoo`, `erpnext`, `xero`, `openapi-directory` | Select primary MVP provider between `odoo` and `erpnext`. |
| PaymentsBilling | `integration-finance` | `stripe`, `killbill`, `chargebee-openapi`, `square`, `openapi-directory` | Resolve primary provider order between `stripe` and `killbill`. |
| ProcurementSpend | `integration-finance` | `odoo`, `erpnext` | Add at least one `safe_to_reuse` candidate to reduce GPL/LGPL-only reliance. |
| HrisHcm | `integration-people` | `deputy` | No `ACTIVE` or `DONE` candidate providers yet. |
| Payroll | `integration-people` | _(none)_ | No source manifest candidates defined. |
| CrmSales | `integration-growth` | `openapi-directory` | No `ACTIVE` or `DONE` candidate providers yet. |
| CustomerSupport | `integration-service-ops` | `zammad`, `openapi-directory` | Primary `DONE` candidate is `study_only`; add `safe_to_reuse` fallback. |
| ItsmItOps | `integration-service-ops` | _(none)_ | No source manifest candidates defined. |
| IamDirectory | `integration-security` | `keycloak`, `openfga`, `keycloak-openapi` | Resolve primary provider order between `keycloak` and `openfga`. |
| SecretsVaulting | `integration-security` | `vault` | Only `DONE` candidate is `unsafe_dependency`; add `safe_to_reuse` path. |
| MarketingAutomation | `integration-growth` | `mautic` | Primary `DONE` candidate is `study_only`; add `safe_to_reuse` fallback. |
| AdsPlatforms | `integration-growth` | _(none)_ | No source manifest candidates defined. |
| CommsCollaboration | `integration-collab` | `twilio-oai`, `openapi-directory` | No `ACTIVE` or `DONE` candidate providers yet. |
| ProjectsWorkMgmt | `integration-collab` | `canvas-lms`, `moodle` | No `ACTIVE` or `DONE` candidate providers yet. |
| DocumentsEsign | `integration-collab` | `paperless-ngx`, `docusign-openapi` | Add `safe_to_reuse` `DONE` candidate to reduce GPL-only reliance. |
| AnalyticsBi | `integration-data` | _(none)_ | No source manifest candidates defined. |
| MonitoringIncident | `integration-service-ops` | _(none)_ | No source manifest candidates defined. |
| ComplianceGrc | `integration-security` | `opencontrol`, `oscal` | No `ACTIVE` or `DONE` candidate providers yet. |

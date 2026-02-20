# Bead-0403 Spike: Activepieces Piece Coverage Across Port Families

Date: 2026-02-20  
Bead: `bead-0403`

## Scope

Evaluate Activepieces community-piece coverage against Portarium Port Families and identify where Activepieces can be used immediately versus where custom pieces/adapters are still required.

## Method

- Source snapshot: Activepieces OSS repo community pieces directory.
- Source endpoint: `https://api.github.com/repos/activepieces/activepieces/contents/packages/pieces/community`
- Snapshot artifact: `reports/activepieces-piece-names-2026-02-20.txt`
- Snapshot size: 621 piece directories.

Coverage status definitions used in this spike:

- `Ready`: broad family coverage with multiple directly relevant pieces.
- `Partial`: limited coverage (single provider or adjacent tooling only).
- `Gap`: no directly relevant piece found in snapshot.

Note: historical bead text mentions 18 families; current Portarium glossary enumerates 19 families (including `RoboticsActuation`). Matrix below uses current taxonomy.

## Coverage Matrix

| Port Family         | Coverage | Evidence (sample Activepieces pieces)                                                                             | Gap/Priority Signal                                                          |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| FinanceAccounting   | Ready    | `netsuite`, `quickbooks`, `xero`, `zoho-books`                                                                    | Strong base for reference adapters.                                          |
| PaymentsBilling     | Ready    | `stripe`, `square`, `razorpay`, `mollie`                                                                          | Good payments baseline; billing depth still provider-specific.               |
| ProcurementSpend    | Partial  | `sap-ariba`                                                                                                       | Single-provider footprint; likely needs custom pieces.                       |
| HrisHcm             | Partial  | `bamboohr`                                                                                                        | Minimal coverage; expand with custom/family-specific pieces.                 |
| Payroll             | Gap      | None found                                                                                                        | High-priority custom integration gap.                                        |
| CrmSales            | Ready    | `salesforce`, `hubspot`, `pipedrive`, `zoho-crm`, `close`, `insightly`                                            | Strong multi-provider coverage.                                              |
| CustomerSupport     | Ready    | `zendesk`, `freshdesk`, `intercom`, `front`                                                                       | Strong support baseline.                                                     |
| ItsmItOps           | Partial  | `service-now`, `jira-cloud`                                                                                       | Limited ITSM coverage; incident/tooling depth still sparse.                  |
| IamDirectory        | Partial  | `okta`                                                                                                            | Directory coverage is narrow; needs expansion.                               |
| SecretsVaulting     | Partial  | `hashi-corp-vault`, `amazon-secrets-manager`                                                                      | Viable starter set; enterprise vault coverage still limited.                 |
| MarketingAutomation | Ready    | `activecampaign`, `mailchimp`, `customer-io`, `convertkit`, `campaign-monitor`, `zoho-campaigns`                  | Strong coverage for campaign automation.                                     |
| AdsPlatforms        | Partial  | `facebook-leads`, `facebook-pages`, `linkedin`                                                                    | Lacks major ad-network breadth (for example Google Ads).                     |
| CommsCollaboration  | Ready    | `slack`, `microsoft-teams`, `discord`, `telegram-bot`, `twilio`, `whatsapp`, `gmail`, `microsoft-outlook`, `zoom` | Broad comms coverage.                                                        |
| ProjectsWorkMgmt    | Ready    | `asana`, `monday`, `trello`, `clickup`, `jira-cloud`, `notion`, `linear`, `airtable`, `github`, `gitlab`          | Very strong immediate coverage.                                              |
| DocumentsEsign      | Ready    | `docusign`, `pandadoc`, `box`, `dropbox`, `google-drive`, `microsoft-onedrive`, `microsoft-sharepoint`            | Good document + e-sign starter set.                                          |
| AnalyticsBi         | Ready    | `metabase`, `microsoft-power-bi`, `mixpanel`, `posthog`, `tableau`                                                | Strong analytics/BI surface.                                                 |
| MonitoringIncident  | Partial  | `datadog`                                                                                                         | Narrow coverage; add incident-provider breadth.                              |
| ComplianceGrc       | Gap      | None found                                                                                                        | High-priority custom integration gap.                                        |
| RoboticsActuation   | Gap      | None found                                                                                                        | Out-of-scope for current Activepieces catalog; use dedicated robotics stack. |

## Families Ready For Immediate Adapter Acceleration

- `CrmSales`
- `CustomerSupport`
- `ProjectsWorkMgmt`
- `CommsCollaboration`
- `FinanceAccounting`
- `MarketingAutomation`
- `DocumentsEsign`
- `AnalyticsBi`
- `PaymentsBilling`

## Priority Gap Backlog (drives follow-on work)

1. `Payroll` and `ComplianceGrc` require custom piece development or non-Activepieces primary adapters.
2. `RoboticsActuation` should remain on dedicated robotics protocols/runtimes, not Activepieces-first.
3. `ProcurementSpend`, `HrisHcm`, `IamDirectory`, `MonitoringIncident`, and `AdsPlatforms` need targeted gap-fill pieces before claiming broad family readiness.

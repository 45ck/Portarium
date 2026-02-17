# Integration Layer Work Backlog

## Backlog ordering

Priority is sorted by dependency order and delivery risk:

1. Integration readiness (candidate matrix, contract stubs, reviews)
2. Core families first (IamDirectory, SecretsVaulting, FinanceAccounting, PaymentsBilling)
3. Extended families (remaining 14 families)
4. Cross-family closeout reviews
5. Integration phase gate

## Port adapter family lifecycle

Each port adapter family follows a 4-bead lifecycle:

1. **Foundation** — capability mapping, canonical object adapters, auth scopes, regression contract
2. **Code review** — API operations, capability claims, idempotency guarantees, evidence capture
3. **Integration tests** — CRUD paths + failure/tenant/SoD scenarios
4. **Test evidence review** — contract tests, fixture coverage, adapter readiness evidence

Plus 2 closeout reviews per family (foundation closeout + tests closeout).

## Epics and stories

### EPIC-G01 — Integration readiness

Goal: ensure all prerequisites are in place before family implementation starts.

- STORY-G01.1 — bead-0057
  - Port-family integration candidate matrix: assign owners and blockers for all 18 families.
  - AC: every family has owner, blockers, and artifact dependencies documented.
- STORY-G01.2 — bead-0058
  - Port-family readiness matrix review: verify source intent, operation mapping, evidence chain.
  - AC: readiness review passed for all families before start.
- STORY-G01.3 — bead-0059
  - Per-family operation contract stubs from integration-catalog into machine-readable fixtures.
  - AC: fixtures complete; canonical mapping consistent.
- STORY-G01.4 — bead-0060
  - Per-family contract stubs review: fixture completeness, canonical mapping, source ranking.
  - AC: review passed.
- STORY-G01.5 — bead-0174
  - Review: no adapter work starts without canonical-to-provider mapping evidence and operation matrix completeness.
  - AC: gate enforced before any family moves to implementation.

### EPIC-G02 — IamDirectory adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0112 | IamDirectory port adapter foundation |
| Code review | bead-0113 | Code review: IamDirectory port adapter foundation |
| Integration tests | bead-0114 | IamDirectory port adapter integration tests |
| Test evidence review | bead-0115 | Review: IamDirectory port adapter test evidence |
| Closeout: foundation | bead-0239 | Closeout review: IamDirectory port adapter foundation |
| Closeout: tests | bead-0240 | Closeout review: IamDirectory port adapter integration tests |

### EPIC-G03 — SecretsVaulting adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0116 | SecretsVaulting port adapter foundation |
| Code review | bead-0117 | Code review: SecretsVaulting port adapter foundation |
| Integration tests | bead-0118 | SecretsVaulting port adapter integration tests |
| Test evidence review | bead-0119 | Review: SecretsVaulting port adapter test evidence |
| Closeout: foundation | bead-0241 | Closeout review: SecretsVaulting port adapter foundation |
| Closeout: tests | bead-0242 | Closeout review: SecretsVaulting port adapter integration tests |

### EPIC-G04 — FinanceAccounting adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0080 | FinanceAccounting port adapter foundation |
| Code review | bead-0081 | Code review: FinanceAccounting port adapter foundation |
| Integration tests | bead-0082 | FinanceAccounting port adapter integration tests |
| Test evidence review | bead-0083 | Review: FinanceAccounting port adapter test evidence |
| Closeout: foundation | bead-0223 | Closeout review: FinanceAccounting port adapter foundation |
| Closeout: tests | bead-0224 | Closeout review: FinanceAccounting port adapter integration tests |

### EPIC-G05 — PaymentsBilling adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0084 | PaymentsBilling port adapter foundation |
| Code review | bead-0085 | Code review: PaymentsBilling port adapter foundation |
| Integration tests | bead-0086 | PaymentsBilling port adapter integration tests |
| Test evidence review | bead-0087 | Review: PaymentsBilling port adapter test evidence |
| Closeout: foundation | bead-0225 | Closeout review: PaymentsBilling port adapter foundation |
| Closeout: tests | bead-0226 | Closeout review: PaymentsBilling port adapter integration tests |

### EPIC-G06 — ProcurementSpend adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0088 | ProcurementSpend port adapter foundation |
| Code review | bead-0089 | Code review: ProcurementSpend port adapter foundation |
| Integration tests | bead-0090 | ProcurementSpend port adapter integration tests |
| Test evidence review | bead-0091 | Review: ProcurementSpend port adapter test evidence |
| Closeout: foundation | bead-0227 | Closeout review: ProcurementSpend port adapter foundation |
| Closeout: tests | bead-0228 | Closeout review: ProcurementSpend port adapter integration tests |

### EPIC-G07 — HrisHcm adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0092 | HrisHcm port adapter foundation |
| Code review | bead-0093 | Code review: HrisHcm port adapter foundation |
| Integration tests | bead-0094 | HrisHcm port adapter integration tests |
| Test evidence review | bead-0095 | Review: HrisHcm port adapter test evidence |
| Closeout: foundation | bead-0229 | Closeout review: HrisHcm port adapter foundation |
| Closeout: tests | bead-0230 | Closeout review: HrisHcm port adapter integration tests |

### EPIC-G08 — Payroll adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0096 | Payroll port adapter foundation |
| Code review | bead-0097 | Code review: Payroll port adapter foundation |
| Integration tests | bead-0098 | Payroll port adapter integration tests |
| Test evidence review | bead-0099 | Review: Payroll port adapter test evidence |
| Closeout: foundation | bead-0231 | Closeout review: Payroll port adapter foundation |
| Closeout: tests | bead-0232 | Closeout review: Payroll port adapter integration tests |

### EPIC-G09 — CrmSales adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0100 | CrmSales port adapter foundation |
| Code review | bead-0101 | Code review: CrmSales port adapter foundation |
| Integration tests | bead-0102 | CrmSales port adapter integration tests |
| Test evidence review | bead-0103 | Review: CrmSales port adapter test evidence |
| Closeout: foundation | bead-0233 | Closeout review: CrmSales port adapter foundation |
| Closeout: tests | bead-0234 | Closeout review: CrmSales port adapter integration tests |

### EPIC-G10 — CustomerSupport adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0104 | CustomerSupport port adapter foundation |
| Code review | bead-0105 | Code review: CustomerSupport port adapter foundation |
| Integration tests | bead-0106 | CustomerSupport port adapter integration tests |
| Test evidence review | bead-0107 | Review: CustomerSupport port adapter test evidence |
| Closeout: foundation | bead-0235 | Closeout review: CustomerSupport port adapter foundation |
| Closeout: tests | bead-0236 | Closeout review: CustomerSupport port adapter integration tests |

### EPIC-G11 — ItsmItOps adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0108 | ItsmItOps port adapter foundation |
| Code review | bead-0109 | Code review: ItsmItOps port adapter foundation |
| Integration tests | bead-0110 | ItsmItOps port adapter integration tests |
| Test evidence review | bead-0111 | Review: ItsmItOps port adapter test evidence |
| Closeout: foundation | bead-0237 | Closeout review: ItsmItOps port adapter foundation |
| Closeout: tests | bead-0238 | Closeout review: ItsmItOps port adapter integration tests |

### EPIC-G12 — MarketingAutomation adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0120 | MarketingAutomation port adapter foundation |
| Code review | bead-0121 | Code review: MarketingAutomation port adapter foundation |
| Integration tests | bead-0122 | MarketingAutomation port adapter integration tests |
| Test evidence review | bead-0123 | Review: MarketingAutomation port adapter test evidence |
| Closeout: foundation | bead-0243 | Closeout review: MarketingAutomation port adapter foundation |
| Closeout: tests | bead-0244 | Closeout review: MarketingAutomation port adapter integration tests |

### EPIC-G13 — AdsPlatforms adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0124 | AdsPlatforms port adapter foundation |
| Code review | bead-0125 | Code review: AdsPlatforms port adapter foundation |
| Integration tests | bead-0126 | AdsPlatforms port adapter integration tests |
| Test evidence review | bead-0127 | Review: AdsPlatforms port adapter test evidence |
| Closeout: foundation | bead-0245 | Closeout review: AdsPlatforms port adapter foundation |
| Closeout: tests | bead-0246 | Closeout review: AdsPlatforms port adapter integration tests |

### EPIC-G14 — CommsCollaboration adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0128 | CommsCollaboration port adapter foundation |
| Code review | bead-0129 | Code review: CommsCollaboration port adapter foundation |
| Integration tests | bead-0130 | CommsCollaboration port adapter integration tests |
| Test evidence review | bead-0131 | Review: CommsCollaboration port adapter test evidence |
| Closeout: foundation | bead-0247 | Closeout review: CommsCollaboration port adapter foundation |
| Closeout: tests | bead-0248 | Closeout review: CommsCollaboration port adapter integration tests |

### EPIC-G15 — ProjectsWorkMgmt adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0132 | ProjectsWorkMgmt port adapter foundation |
| Code review | bead-0133 | Code review: ProjectsWorkMgmt port adapter foundation |
| Integration tests | bead-0134 | ProjectsWorkMgmt port adapter integration tests |
| Test evidence review | bead-0135 | Review: ProjectsWorkMgmt port adapter test evidence |
| Closeout: foundation | bead-0249 | Closeout review: ProjectsWorkMgmt port adapter foundation |
| Closeout: tests | bead-0250 | Closeout review: ProjectsWorkMgmt port adapter integration tests |

### EPIC-G16 — DocumentsEsign adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0136 | DocumentsEsign port adapter foundation |
| Code review | bead-0137 | Code review: DocumentsEsign port adapter foundation |
| Integration tests | bead-0138 | DocumentsEsign port adapter integration tests |
| Test evidence review | bead-0139 | Review: DocumentsEsign port adapter test evidence |
| Closeout: foundation | bead-0251 | Closeout review: DocumentsEsign port adapter foundation |
| Closeout: tests | bead-0252 | Closeout review: DocumentsEsign port adapter integration tests |

### EPIC-G17 — AnalyticsBi adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0140 | AnalyticsBi port adapter foundation |
| Code review | bead-0141 | Code review: AnalyticsBi port adapter foundation |
| Integration tests | bead-0142 | AnalyticsBi port adapter integration tests |
| Test evidence review | bead-0143 | Review: AnalyticsBi port adapter test evidence |
| Closeout: foundation | bead-0253 | Closeout review: AnalyticsBi port adapter foundation |
| Closeout: tests | bead-0254 | Closeout review: AnalyticsBi port adapter integration tests |

### EPIC-G18 — MonitoringIncident adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0144 | MonitoringIncident port adapter foundation |
| Code review | bead-0145 | Code review: MonitoringIncident port adapter foundation |
| Integration tests | bead-0146 | MonitoringIncident port adapter integration tests |
| Test evidence review | bead-0147 | Review: MonitoringIncident port adapter test evidence |
| Closeout: foundation | bead-0255 | Closeout review: MonitoringIncident port adapter foundation |
| Closeout: tests | bead-0256 | Closeout review: MonitoringIncident port adapter integration tests |

### EPIC-G19 — ComplianceGrc adapters

| Step | Bead | Title |
|---|---|---|
| Foundation | bead-0148 | ComplianceGrc port adapter foundation |
| Code review | bead-0149 | Code review: ComplianceGrc port adapter foundation |
| Integration tests | bead-0150 | ComplianceGrc port adapter integration tests |
| Test evidence review | bead-0151 | Review: ComplianceGrc port adapter test evidence |
| Closeout: foundation | bead-0257 | Closeout review: ComplianceGrc port adapter foundation |
| Closeout: tests | bead-0258 | Closeout review: ComplianceGrc port adapter integration tests |

### EPIC-G20 — Integration phase gate

Goal: integration layer completion evidence.

- STORY-G20.1 — bead-0166
  - Phase gate: Integration complete only when per-family readiness, contract fixtures, and E2E smoke beads are closed.

## Bead summary by family

| Family | Foundation | Code Review | Integration Tests | Test Review | Closeout (x2) |
|---|---|---|---|---|---|
| IamDirectory | bead-0112 | bead-0113 | bead-0114 | bead-0115 | bead-0239, bead-0240 |
| SecretsVaulting | bead-0116 | bead-0117 | bead-0118 | bead-0119 | bead-0241, bead-0242 |
| FinanceAccounting | bead-0080 | bead-0081 | bead-0082 | bead-0083 | bead-0223, bead-0224 |
| PaymentsBilling | bead-0084 | bead-0085 | bead-0086 | bead-0087 | bead-0225, bead-0226 |
| ProcurementSpend | bead-0088 | bead-0089 | bead-0090 | bead-0091 | bead-0227, bead-0228 |
| HrisHcm | bead-0092 | bead-0093 | bead-0094 | bead-0095 | bead-0229, bead-0230 |
| Payroll | bead-0096 | bead-0097 | bead-0098 | bead-0099 | bead-0231, bead-0232 |
| CrmSales | bead-0100 | bead-0101 | bead-0102 | bead-0103 | bead-0233, bead-0234 |
| CustomerSupport | bead-0104 | bead-0105 | bead-0106 | bead-0107 | bead-0235, bead-0236 |
| ItsmItOps | bead-0108 | bead-0109 | bead-0110 | bead-0111 | bead-0237, bead-0238 |
| MarketingAutomation | bead-0120 | bead-0121 | bead-0122 | bead-0123 | bead-0243, bead-0244 |
| AdsPlatforms | bead-0124 | bead-0125 | bead-0126 | bead-0127 | bead-0245, bead-0246 |
| CommsCollaboration | bead-0128 | bead-0129 | bead-0130 | bead-0131 | bead-0247, bead-0248 |
| ProjectsWorkMgmt | bead-0132 | bead-0133 | bead-0134 | bead-0135 | bead-0249, bead-0250 |
| DocumentsEsign | bead-0136 | bead-0137 | bead-0138 | bead-0139 | bead-0251, bead-0252 |
| AnalyticsBi | bead-0140 | bead-0141 | bead-0142 | bead-0143 | bead-0253, bead-0254 |
| MonitoringIncident | bead-0144 | bead-0145 | bead-0146 | bead-0147 | bead-0255, bead-0256 |
| ComplianceGrc | bead-0148 | bead-0149 | bead-0150 | bead-0151 | bead-0257, bead-0258 |

**Total beads:** 108 family beads + 5 readiness beads + 1 phase gate = 114

## Delivery notes

- IamDirectory and SecretsVaulting are critical-path families (auth and vault infrastructure).
- All families depend on domain primitives hardening (EPIC-D01) and canonical capability enforcement (bead-0305).
- Readiness gate (bead-0174) blocks all family implementation starts.
- Family implementation can be parallelized across teams once readiness is confirmed.
- Integration phase gate (bead-0166) blocks transition to release phase.

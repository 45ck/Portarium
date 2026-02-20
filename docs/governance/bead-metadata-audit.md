# Bead Metadata Audit: Owner, Close Criteria, Rollback Trigger

Generated: 2026-02-20T02:59:43.554Z
Source: `.beads/issues.jsonl`

## Snapshot

- Total beads: 586
- Fully compliant beads: 0
- Non-compliant beads: 586
- Missing owner: 585
- Missing close criteria: 456
- Missing rollback trigger: 584

## Non-Compliant Beads

| Bead | Status | Owner | Missing Fields | Title |
| --- | --- | --- | --- | --- |
| bead-0001 | closed | (none) | owner, closeCriteria, rollbackTrigger | Versioned vertical packs: manifest + registry + resolver (v1) |
| bead-0002 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: CIF + capability matrix schemas + CI validation |
| bead-0003 | closed | (none) | owner, closeCriteria, rollbackTrigger | Plan + Evidence v1: structured plans + hash-chained evidence log |
| bead-0004 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: single source-of-truth upstream registry |
| bead-0005 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-0042: dependency vulnerability gate (npm audit) |
| bead-0006 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Odoo intake (vendor + res.partner CIF) |
| bead-0007 | closed | (none) | owner, closeCriteria, rollbackTrigger | Scaffold domain model structure (aggregates, ports, events, canonical objects) |
| bead-0008 | closed | (none) | owner, closeCriteria, rollbackTrigger | Draft default Project UI/UX plan (shared for teams and individuals) |
| bead-0009 | closed | (none) | owner, closeCriteria, rollbackTrigger | DUPLICATE: Domain Atlas Odoo intake (use bead-0006) |
| bead-0010 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: ERPNext upstream intake + initial CIF/mapping/capabilities |
| bead-0011 | closed | (none) | owner, closeCriteria, rollbackTrigger | Work Item v1: domain model + parser + tests |
| bead-0012 | closed | (none) | owner, closeCriteria, rollbackTrigger | DUPLICATE: Scaffold Work Item v1 domain model (use bead-0011) |
| bead-0013 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Stripe (OpenAPI) extract CIF + mapping hardening |
| bead-0014 | closed | (none) | owner, closeCriteria, rollbackTrigger | OpenAPI contract gate: validate OpenAPI + add boundary tests |
| bead-0015 | closed | (none) | owner, closeCriteria, rollbackTrigger | Control plane API v1 contract: OpenAPI + specs for workspaces/users + Plan/Evidence |
| bead-0016 | closed | (none) | owner, rollbackTrigger | IAM MVP: workspace users + RBAC roles + auth integration |
| bead-0017 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Kill Bill initial artefacts (CIF + mapping + capability matrix) |
| bead-0018 | closed | (none) | owner, closeCriteria, rollbackTrigger | Policy v1: SoD constraints primitives + parser + tests |
| bead-0019 | closed | (none) | owner, closeCriteria, rollbackTrigger | Control Plane API v1: domain schemas for Workspace + User (RBAC) |
| bead-0020 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Keycloak initial artefacts (CIF + mapping + capability matrix) |
| bead-0021 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-0030: Quota semantics v1 (domain + tests) |
| bead-0022 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-0032: Event stream CloudEvents v1 (domain + tests) |
| bead-0023 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Mautic initial artefacts (CIF + mapping + capability matrix) |
| bead-0024 | closed | (none) | owner, closeCriteria, rollbackTrigger | Run v1: domain model + parser + tests |
| bead-0025 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Vault initial artefacts (CIF + mapping + capability matrix) |
| bead-0026 | closed | (none) | owner, closeCriteria, rollbackTrigger | Low-fi UI prototype: Inbox + Project/Work Items/Run/Approvals/Evidence (v1) |
| bead-0027 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Zammad initial artefacts (CIF + mapping + capability matrix) |
| bead-0028 | closed | (none) | owner, closeCriteria, rollbackTrigger | Approval v1: domain model + parser + tests |
| bead-0029 | closed | (none) | owner, closeCriteria, rollbackTrigger | Workflow v1: domain model + parser + tests |
| bead-0030 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: Paperless-ngx initial artefacts (CIF + mapping + capability matrix) |
| bead-0031 | closed | (none) | owner, closeCriteria, rollbackTrigger | Control plane API v1: approvals/workflows/runs OpenAPI |
| bead-0032 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: OpenFGA initial artefacts (CIF + mapping + capability matrix) |
| bead-0033 | closed | (none) | owner, closeCriteria, rollbackTrigger | Lo-fi prototype alternatives: Command-Palette (A), Activity-Stream (B), Board-First (C) |
| bead-0034 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-028 review: Verify PII minimization and retention/disposition precedence in all evidence transitions |
| bead-0035 | closed | (none) | owner, rollbackTrigger | ADR-029: Implement tamper-evident hash chain + signature hooks on EvidenceEntry and Artifact lineage |
| bead-0036 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-029 review: Verify hash chain continuity and chain break behavior under retention/disposition events |
| bead-0037 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-030: Implement quota-aware execution primitives in orchestration scheduling and adapter call wrapper |
| bead-0038 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-030 review: Verify 429/backoff, retry budgets, and burst controls are observable and bounded |
| bead-0039 | closed | (none) | owner, rollbackTrigger | ADR-031: Implement SoD model evaluation, incompatible role graph, and threshold counters on approval routing |
| bead-0040 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-031 review: Verify requestor/approver separation and N-role constraints are enforced before any state transition |
| bead-0041 | closed | (none) | owner, rollbackTrigger | ADR-032: Implement CloudEvents envelope for all event emission points and subscription contracts |
| bead-0042 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-032 review: Verify event payload schema, versioning, and correlation IDs across event consumers and sinks |
| bead-0043 | closed | (none) | owner, rollbackTrigger | ADR-033: Implement OTel context propagation in request, workflow, adapter, and machine call stacks |
| bead-0044 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-033 review: Verify trace/span IDs, metrics hooks, and redaction-safe structured logs in critical paths |
| bead-0045 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-034: Enforce containment and least-privilege assumptions in machine and adapter execution environments |
| bead-0046 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-034 review: Verify sandbox policy assertions, egress allowlisting, and per-tenant isolation controls in runtime integration tests |
| bead-0047 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-035: Finalize domain-atlas pipeline stages into reproducible CI job and artifact validation stage |
| bead-0048 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-035 review: Verify atlas regeneration compares upstream pinned commit and fails on schema drift |
| bead-0049 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-036: Implement product identity labels and telemetry metadata using Portarium naming across docs/spec/error envelopes |
| bead-0050 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-036 review: Verify docs, package metadata, and external interfaces consistently use Portarium naming where required |
| bead-0051 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-037: Model git-backed definitions and runtime truth divergence handling in services and reconciliation flows |
| bead-0052 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-037 review: Verify deployment modes and truth-mode transitions are explicit and auditable under failure conditions |
| bead-0053 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-038: Implement Work Item universal binding domain + query surfaces with evidence/run/workflow linkages |
| bead-0054 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-038 review: Verify Work Item remains thin binding object and is not over-modeled as standalone PM system |
| bead-0055 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-039 reference-vertical package: Add software-change-management reference pack with evidence and policy semantics |
| bead-0056 | closed | (none) | owner, closeCriteria, rollbackTrigger | ADR-039 review: Verify reference vertical does not alter core scope and stays gated via vertical-pack lifecycle |
| bead-0057 | closed | (none) | owner, closeCriteria, rollbackTrigger | Port-family integration candidate matrix: assign owners and blockers for all 18 families with required artifact dependencies |
| bead-0058 | closed | (none) | owner, closeCriteria, rollbackTrigger | Port-family readiness matrix: verify every candidate has source intent, operation mapping, and evidence chain before family start |
| bead-0059 | closed | (none) | owner, closeCriteria, rollbackTrigger | Per-family operation contract stubs from integration-catalog tables into testable machine-readable fixtures |
| bead-0060 | closed | (none) | owner, closeCriteria, rollbackTrigger | Per-family contract stubs: verify fixture completeness, canonical mapping consistency, and source ranking assumptions |
| bead-0061 | closed | (none) | owner, closeCriteria, rollbackTrigger | Provider decision log automation: generate and validate source manifests from research index and decisions with canonical IDs |
| bead-0062 | closed | (none) | owner, closeCriteria, rollbackTrigger | Provider decision logs: verify each source decision includes license, extraction constraints, and capability hypotheses |
| bead-0063 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: Scaffold domain model structure (aggregates, ports, events, canonical objects) |
| bead-0064 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: IAM MVP: workspace users + RBAC roles + auth integration |
| bead-0065 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: Control plane API v1: approvals/workflows/runs OpenAPI |
| bead-0066 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-029: implement tamper-evident hash chain + signature hooks on EvidenceEntry and Artifact lineage |
| bead-0067 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-030: implement quota-aware execution primitives in orchestration scheduling and adapter call wrapper |
| bead-0068 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-031: implement SoD model evaluation, incompatible role graph, and threshold counters on approval routing |
| bead-0069 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-032: implement CloudEvents envelope for all event emission points and subscription contracts |
| bead-0070 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-033: implement OTel context propagation in request, workflow, adapter, and machine call stacks |
| bead-0071 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-034: enforce containment and least-privilege assumptions in machine and adapter execution environments |
| bead-0072 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-035: finalize domain-atlas pipeline stages into reproducible CI job and artifact validation stage |
| bead-0073 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-036: implement product identity labels and telemetry metadata using Portarium naming across docs/spec/error envelopes |
| bead-0074 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-037: model git-backed definitions and runtime truth divergence handling in services and reconciliation flows |
| bead-0075 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-038: implement Work Item universal binding domain + query surfaces with evidence/run/workflow linkages |
| bead-0076 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ADR-039 reference-vertical package: add software-change-management reference pack with evidence and policy semantics |
| bead-0077 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: port-family integration candidate matrix: assign owners and blockers for all 18 families with required artifact dependencies |
| bead-0078 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: per-family operation contract stubs from integration-catalog tables into testable machine-readable fixtures |
| bead-0079 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: provider decision log automation: generate and validate source manifests from research index and decisions with canonical IDs |
| bead-0080 | closed | (none) | owner, closeCriteria, rollbackTrigger | FinanceAccounting port adapter foundation |
| bead-0081 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: FinanceAccounting port adapter foundation |
| bead-0082 | closed | (none) | owner, closeCriteria, rollbackTrigger | FinanceAccounting port adapter integration tests |
| bead-0083 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: FinanceAccounting port adapter test evidence |
| bead-0084 | closed | (none) | owner, closeCriteria, rollbackTrigger | PaymentsBilling port adapter foundation |
| bead-0085 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: PaymentsBilling port adapter foundation |
| bead-0086 | closed | (none) | owner, closeCriteria, rollbackTrigger | PaymentsBilling port adapter integration tests |
| bead-0087 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: PaymentsBilling port adapter test evidence |
| bead-0088 | closed | (none) | owner, closeCriteria, rollbackTrigger | ProcurementSpend port adapter foundation |
| bead-0089 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ProcurementSpend port adapter foundation |
| bead-0090 | closed | (none) | owner, closeCriteria, rollbackTrigger | ProcurementSpend port adapter integration tests |
| bead-0091 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: ProcurementSpend port adapter test evidence |
| bead-0092 | closed | (none) | owner, closeCriteria, rollbackTrigger | HrisHcm port adapter foundation |
| bead-0093 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: HrisHcm port adapter foundation |
| bead-0094 | closed | (none) | owner, closeCriteria, rollbackTrigger | HrisHcm port adapter integration tests |
| bead-0095 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: HrisHcm port adapter test evidence |
| bead-0096 | closed | (none) | owner, closeCriteria, rollbackTrigger | Payroll port adapter foundation |
| bead-0097 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: Payroll port adapter foundation |
| bead-0098 | closed | (none) | owner, closeCriteria, rollbackTrigger | Payroll port adapter integration tests |
| bead-0099 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: Payroll port adapter test evidence |
| bead-0100 | closed | (none) | owner, closeCriteria, rollbackTrigger | CrmSales port adapter foundation |
| bead-0101 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: CrmSales port adapter foundation |
| bead-0102 | closed | (none) | owner, closeCriteria, rollbackTrigger | CrmSales port adapter integration tests |
| bead-0103 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: CrmSales port adapter test evidence |
| bead-0104 | closed | (none) | owner, closeCriteria, rollbackTrigger | CustomerSupport port adapter foundation |
| bead-0105 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: CustomerSupport port adapter foundation |
| bead-0106 | closed | (none) | owner, closeCriteria, rollbackTrigger | CustomerSupport port adapter integration tests |
| bead-0107 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: CustomerSupport port adapter test evidence |
| bead-0108 | closed | (none) | owner, closeCriteria, rollbackTrigger | ItsmItOps port adapter foundation |
| bead-0109 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ItsmItOps port adapter foundation |
| bead-0110 | closed | (none) | owner, closeCriteria, rollbackTrigger | ItsmItOps port adapter integration tests |
| bead-0111 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: ItsmItOps port adapter test evidence |
| bead-0112 | closed | (none) | owner, closeCriteria, rollbackTrigger | IamDirectory port adapter foundation |
| bead-0113 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: IamDirectory port adapter foundation |
| bead-0114 | closed | (none) | owner, closeCriteria, rollbackTrigger | IamDirectory port adapter integration tests |
| bead-0115 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: IamDirectory port adapter test evidence |
| bead-0116 | closed | (none) | owner, closeCriteria, rollbackTrigger | SecretsVaulting port adapter foundation |
| bead-0117 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: SecretsVaulting port adapter foundation |
| bead-0118 | closed | (none) | owner, closeCriteria, rollbackTrigger | SecretsVaulting port adapter integration tests |
| bead-0119 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: SecretsVaulting port adapter test evidence |
| bead-0120 | closed | (none) | owner, closeCriteria, rollbackTrigger | MarketingAutomation port adapter foundation |
| bead-0121 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: MarketingAutomation port adapter foundation |
| bead-0122 | closed | (none) | owner, closeCriteria, rollbackTrigger | MarketingAutomation port adapter integration tests |
| bead-0123 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: MarketingAutomation port adapter test evidence |
| bead-0124 | closed | (none) | owner, closeCriteria, rollbackTrigger | AdsPlatforms port adapter foundation |
| bead-0125 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: AdsPlatforms port adapter foundation |
| bead-0126 | closed | (none) | owner, closeCriteria, rollbackTrigger | AdsPlatforms port adapter integration tests |
| bead-0127 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: AdsPlatforms port adapter test evidence |
| bead-0128 | closed | (none) | owner, closeCriteria, rollbackTrigger | CommsCollaboration port adapter foundation |
| bead-0129 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: CommsCollaboration port adapter foundation |
| bead-0130 | closed | (none) | owner, closeCriteria, rollbackTrigger | CommsCollaboration port adapter integration tests |
| bead-0131 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: CommsCollaboration port adapter test evidence |
| bead-0132 | closed | (none) | owner, closeCriteria, rollbackTrigger | ProjectsWorkMgmt port adapter foundation |
| bead-0133 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ProjectsWorkMgmt port adapter foundation |
| bead-0134 | closed | (none) | owner, closeCriteria, rollbackTrigger | ProjectsWorkMgmt port adapter integration tests |
| bead-0135 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: ProjectsWorkMgmt port adapter test evidence |
| bead-0136 | closed | (none) | owner, closeCriteria, rollbackTrigger | DocumentsEsign port adapter foundation |
| bead-0137 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: DocumentsEsign port adapter foundation |
| bead-0138 | closed | (none) | owner, closeCriteria, rollbackTrigger | DocumentsEsign port adapter integration tests |
| bead-0139 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: DocumentsEsign port adapter test evidence |
| bead-0140 | closed | (none) | owner, closeCriteria, rollbackTrigger | AnalyticsBi port adapter foundation |
| bead-0141 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: AnalyticsBi port adapter foundation |
| bead-0142 | closed | (none) | owner, closeCriteria, rollbackTrigger | AnalyticsBi port adapter integration tests |
| bead-0143 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: AnalyticsBi port adapter test evidence |
| bead-0144 | closed | (none) | owner, closeCriteria, rollbackTrigger | MonitoringIncident port adapter foundation |
| bead-0145 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: MonitoringIncident port adapter foundation |
| bead-0146 | closed | (none) | owner, closeCriteria, rollbackTrigger | MonitoringIncident port adapter integration tests |
| bead-0147 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: MonitoringIncident port adapter test evidence |
| bead-0148 | closed | (none) | owner, closeCriteria, rollbackTrigger | ComplianceGrc port adapter foundation |
| bead-0149 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: ComplianceGrc port adapter foundation |
| bead-0150 | closed | (none) | owner, closeCriteria, rollbackTrigger | ComplianceGrc port adapter integration tests |
| bead-0151 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: ComplianceGrc port adapter test evidence |
| bead-0152 | closed | (none) | owner, closeCriteria, rollbackTrigger | Reference-Verticals port adapter foundation (cross-cutting) |
| bead-0153 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: (cross-cutting) Reference-Verticals port adapter foundation |
| bead-0154 | closed | (none) | owner, closeCriteria, rollbackTrigger | Reference-Verticals port adapter integration tests (cross-cutting) |
| bead-0155 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: Reference-Verticals port adapter test evidence (cross-cutting) |
| bead-0156 | closed | (none) | owner, closeCriteria, rollbackTrigger | Implement workspace domain v1: optional membership identifier arrays and validation |
| bead-0157 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: workspace domain v1: membership identifier parsing and invariant validation |
| bead-0158 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE: master execution DAG — encode open beads by phase, dependency, and evidence |
| bead-0159 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE: dependency resolver — auto-detect missing prerequisites before bead start |
| bead-0160 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cycle gate: no implementation without design/spec/review linkage |
| bead-0161 | closed | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Foundation complete — requires gate, security baseline, and API contract beads are closed |
| bead-0162 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Domain complete — requires aggregate invariants, parser coverage, domain factory, and ADR traceability beads are closed |
| bead-0163 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Application complete — requires DTOs, use-cases, orchestration tests, and approval/run policy mapping are closed |
| bead-0164 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Infrastructure complete — requires persistence, outbox, migration, observability, and security containment beads are closed |
| bead-0165 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Presentation complete — requires OpenAPI route parity, middleware, authN/RBAC, and envelope mapping beads are closed |
| bead-0166 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Integration complete — requires per-family readiness, contract fixtures, and end-to-end smoke beads are closed |
| bead-0167 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Security complete — requires vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed |
| bead-0168 | open | (none) | owner, closeCriteria, rollbackTrigger | Phase gate: Release complete — requires ci:pr, quality gates, review audit, and QA evidence are closed |
| bead-0169 | open | (none) | owner, closeCriteria, rollbackTrigger | Release freeze: block new families while release closure bead is unresolved |
| bead-0170 | open | (none) | owner, closeCriteria, rollbackTrigger | Per-ADR closure: ADR-001 through ADR-0040 must each have implementation, review, and verification evidence before any dependent Bead close |
| bead-0171 | open | (none) | owner, closeCriteria, rollbackTrigger | Per-ADR closure: ADR-0041 through ADR-0043 must be promoted from proposed/accepted states before GA release |
| bead-0172 | open | (none) | owner, closeCriteria, rollbackTrigger | Per-ADR closure: ADR-0048 to ADR-0138 legacy gaps from research pipeline must be mapped to implementation and review Beads |
| bead-0173 | closed | (none) | owner, closeCriteria, rollbackTrigger | Reconcile docs/domain/canonical-objects.md with runtime entity model and canonical mapping contracts before further adapter work |
| bead-0174 | open | (none) | owner, closeCriteria, rollbackTrigger | Review: verify no adapter work starts without canonical-to-provider mapping evidence and operation matrix completeness |
| bead-0175 | closed | (none) | owner, closeCriteria, rollbackTrigger | Reconcile docs/domain/erd.md with aggregate ID and reference invariants in repository layer |
| bead-0176 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: reconcile docs/domain/aggregates.md invariants with all aggregate event streams and state-transition Beads |
| bead-0177 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cross-layer: enforce domain zero-external-dependencies across domain packages via architecture-guard evidence |
| bead-0178 | open | (none) | owner, closeCriteria, rollbackTrigger | Code review: validate architecture boundaries for every new scaffold file before code merge |
| bead-0179 | open | (none) | owner, closeCriteria, rollbackTrigger | CI gate: require architecture-guard, gate-baseline, and npm audit before each merge |
| bead-0180 | open | (none) | owner, closeCriteria, rollbackTrigger | CI gate: require OpenAPI parser/golden fixture parity on every push and PR for all operationIds |
| bead-0181 | open | (none) | owner, closeCriteria, rollbackTrigger | Test evidence: require coverage thresholds on all newly added domain/application/infrastructure code |
| bead-0182 | open | (none) | owner, closeCriteria, rollbackTrigger | Test evidence: require mutation-test or targeted fault-injection tests for policy and SoD logic before closure |
| bead-0183 | open | (none) | owner, closeCriteria, rollbackTrigger | Review: tie each spec in .specify/specs to at least one implementation and one test bead |
| bead-0184 | open | (none) | owner, closeCriteria, rollbackTrigger | Review: tie each open implementation bead to at least one test evidence bead and one code-review bead before transition |
| bead-0185 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE audit: generate weekly report of orphaned Beads and dependency deadlocks |
| bead-0186 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE audit: verify no Bead exists without owner, close criteria, and rollback trigger |
| bead-0187 | closed | (none) | owner, closeCriteria, rollbackTrigger | Onboarding: explain CLAUDE.md, docs, beading schema, and review/closure requirements |
| bead-0188 | closed | (none) | owner, closeCriteria, rollbackTrigger | Runbook: start-to-finish execution order with owner assignments for Domain Atlas, adapter families, control-plane API, and evidence pipeline |
| bead-0189 | closed | (none) | owner, closeCriteria, rollbackTrigger | Runbook: rollback plan for failing cycle (what to freeze, rollback scope, and communication template) |
| bead-0190 | closed | (none) | owner, closeCriteria, rollbackTrigger | Runbook review: validate rollback plan includes data, evidence, and credential cleanup actions |
| bead-0191 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE quality: define acceptance scorecard for each Bead (spec alignment, tests, review, docs, security, performance) |
| bead-0192 | closed | (none) | owner, closeCriteria, rollbackTrigger | PE quality: define stop-loss thresholds (risk score, failed gates, unresolved open decisions) that force cycle halt |
| bead-0193 | closed | (none) | owner, closeCriteria, rollbackTrigger | E2E data-model: define canonical seeds for workspace, policy, run, evidence, and work-item across all tests |
| bead-0194 | open | (none) | owner, closeCriteria, rollbackTrigger | E2E data-model: define synthetic evidence and retention fixtures for proof-of-retention and legal-hold workflows |
| bead-0195 | open | (none) | owner, closeCriteria, rollbackTrigger | Generate tenant-isolated fixture factories for every aggregate and port operation |
| bead-0196 | open | (none) | owner, closeCriteria, rollbackTrigger | Review: verify tenant-isolated fixtures block cross-tenant leakage in tests and docs |
| bead-0197 | closed | (none) | owner, closeCriteria, rollbackTrigger | Formalize status/state matrices for all run states, approval states, and plan states in one machine-checkable table |
| bead-0198 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: verify state machine matrices match spec, domain tests, and UI journey transitions |
| bead-0199 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create performance bead: define load envelopes for list APIs, run dispatch, and approval queues |
| bead-0200 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: verify load envelopes are covered in smoke/perf tests and CI gating before merge |
| bead-0201 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create dependency-management bead: track dependency-upgrade policy with severity bands and override governance for unsafe dependencies |
| bead-0202 | closed | (none) | owner, closeCriteria, rollbackTrigger | Review: verify dependency policy decisions are recorded with rationale and re-evaluation dates |
| bead-0203 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create documentation bead: ensure every open Bead has a corresponding docs update in project docs or ADR notes before close |
| bead-0204 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create documentation bead: ensure every docs update references owning Bead IDs and expected close criteria |
| bead-0205 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create cross-team bead: create handoff packet template between Foundation->Domain->Application cycles with risk and evidence summary |
| bead-0206 | closed | (none) | owner, closeCriteria, rollbackTrigger | Create final-cycle bead: no Bead closes without traceable evidence chain from ADR/spec/test/review to Bead close |
| bead-0207 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Scaffold domain model structure (aggregates, ports, events, canonical objects) |
| bead-0208 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: IAM MVP: workspace users + RBAC roles + auth integration |
| bead-0209 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Control plane API v1: approvals/workflows/runs OpenAPI |
| bead-0210 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-029: Implement tamper-evident hash chain + signature hooks on EvidenceEntry and Artifact lineage |
| bead-0211 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-030: Implement quota-aware execution primitives in orchestration scheduling and adapter call wrapper |
| bead-0212 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-031: Implement SoD model evaluation, incompatible role graph, and threshold counters on approval routing |
| bead-0213 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-032: Implement CloudEvents envelope for all event emission points and subscription contracts |
| bead-0214 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-033: Implement OTel context propagation in request, workflow, adapter, and machine call stacks |
| bead-0215 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-034: Enforce containment and least-privilege assumptions in machine and adapter execution environments |
| bead-0216 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-035: Finalize domain-atlas pipeline stages into reproducible CI job and artifact validation stage |
| bead-0217 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-036: Implement product identity labels and telemetry metadata using Portarium naming across docs/spec/error envelopes |
| bead-0218 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-037: Model git-backed definitions and runtime truth divergence handling in services and reconciliation flows |
| bead-0219 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-038: Implement Work Item universal binding domain + query surfaces with evidence/run/workflow linkages |
| bead-0220 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ADR-039 reference-vertical package: Add software-change-management reference pack with evidence and policy semantics |
| bead-0221 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Port-family integration candidate matrix: assign owners and blockers for all 18 families with required artifact dependencies |
| bead-0222 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Per-family operation contract stubs from integration-catalog tables into testable machine-readable fixtures |
| bead-0223 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: FinanceAccounting port adapter foundation |
| bead-0224 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: FinanceAccounting port adapter integration tests |
| bead-0225 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PaymentsBilling port adapter foundation |
| bead-0226 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PaymentsBilling port adapter integration tests |
| bead-0227 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ProcurementSpend port adapter foundation |
| bead-0228 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ProcurementSpend port adapter integration tests |
| bead-0229 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: HrisHcm port adapter foundation |
| bead-0230 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: HrisHcm port adapter integration tests |
| bead-0231 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Payroll port adapter foundation |
| bead-0232 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Payroll port adapter integration tests |
| bead-0233 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CrmSales port adapter foundation |
| bead-0234 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CrmSales port adapter integration tests |
| bead-0235 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CustomerSupport port adapter foundation |
| bead-0236 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CustomerSupport port adapter integration tests |
| bead-0237 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ItsmItOps port adapter foundation |
| bead-0238 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ItsmItOps port adapter integration tests |
| bead-0239 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: IamDirectory port adapter foundation |
| bead-0240 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: IamDirectory port adapter integration tests |
| bead-0241 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: SecretsVaulting port adapter foundation |
| bead-0242 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: SecretsVaulting port adapter integration tests |
| bead-0243 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: MarketingAutomation port adapter foundation |
| bead-0244 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: MarketingAutomation port adapter integration tests |
| bead-0245 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: AdsPlatforms port adapter foundation |
| bead-0246 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: AdsPlatforms port adapter integration tests |
| bead-0247 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CommsCollaboration port adapter foundation |
| bead-0248 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CommsCollaboration port adapter integration tests |
| bead-0249 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ProjectsWorkMgmt port adapter foundation |
| bead-0250 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ProjectsWorkMgmt port adapter integration tests |
| bead-0251 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: DocumentsEsign port adapter foundation |
| bead-0252 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: DocumentsEsign port adapter integration tests |
| bead-0253 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: AnalyticsBi port adapter foundation |
| bead-0254 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: AnalyticsBi port adapter integration tests |
| bead-0255 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: MonitoringIncident port adapter foundation |
| bead-0256 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: MonitoringIncident port adapter integration tests |
| bead-0257 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ComplianceGrc port adapter foundation |
| bead-0258 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: ComplianceGrc port adapter integration tests |
| bead-0259 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PE: master execution DAG — encode open beads by phase, dependency, and evidence |
| bead-0260 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Foundation complete — requires gate, security baseline, and API contract beads are closed |
| bead-0261 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Domain complete — requires aggregate invariants, parser coverage, domain factory, and ADR traceability beads are closed |
| bead-0262 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Application complete — requires DTOs, use-cases, orchestration tests, and approval/run policy mapping are closed |
| bead-0263 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Infrastructure complete — requires persistence, outbox, migration, observability, and security containment beads are closed |
| bead-0264 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Presentation complete — requires OpenAPI route parity, middleware, authN/RBAC, and envelope mapping beads are closed |
| bead-0265 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Integration complete — requires per-family readiness, contract fixtures, and end-to-end smoke beads are closed |
| bead-0266 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Phase gate: Security complete — requires vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed |
| bead-0267 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Release freeze: block new families while release closure bead is unresolved |
| bead-0268 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Per-ADR closure: ADR-0041 through ADR-0043 must be promoted from proposed/accepted states before GA release |
| bead-0269 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Reconcile docs/domain/canonical-objects.md with runtime entity model and canonical mapping contracts before further adapter work |
| bead-0270 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Reconcile docs/domain/erd.md with aggregate ID and reference invariants in repository layer |
| bead-0271 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Cross-layer: enforce domain zero-external-dependencies across domain packages via architecture-guard evidence |
| bead-0272 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CI gate: require architecture-guard, gate-baseline, and npm audit before each merge |
| bead-0273 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: CI gate: require OpenAPI parser/golden fixture parity on every push and PR for all operationIds |
| bead-0274 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Test evidence: require coverage thresholds on all newly added domain/application/infrastructure code |
| bead-0275 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Test evidence: require mutation-test or targeted fault-injection tests for policy and SoD logic before closure |
| bead-0276 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PE audit: generate weekly report of orphaned Beads and dependency deadlocks |
| bead-0277 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PE audit: verify no Bead exists without owner, close criteria, and rollback trigger |
| bead-0278 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Runbook: start-to-finish execution order with owner assignments for Domain Atlas, adapter families, control-plane API, and evidence pipeline |
| bead-0279 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Runbook: rollback plan for failing cycle (what to freeze, rollback scope, and communication template) |
| bead-0280 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: PE quality: define stop-loss thresholds (risk score, failed gates, unresolved open decisions) that force cycle halt |
| bead-0281 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: E2E data-model: define canonical seeds for workspace, policy, run, evidence, and work-item across all tests |
| bead-0282 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: E2E data-model: define synthetic evidence and retention fixtures for proof-of-retention and legal-hold workflows |
| bead-0283 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Generate tenant-isolated fixture factories for every aggregate and port operation |
| bead-0284 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Formalize status/state matrices for all run states, approval states, and plan states in one machine-checkable table |
| bead-0285 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Create performance bead: define load envelopes for list APIs, run dispatch, and approval queues |
| bead-0286 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Create dependency-management bead: track dependency-upgrade policy with severity bands and override governance for unsafe dependencies |
| bead-0287 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Create documentation bead: ensure every open Bead has a corresponding docs update in project docs or ADR notes before close |
| bead-0288 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Create documentation bead: ensure every docs update references owning Bead IDs and expected close criteria |
| bead-0289 | closed | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Create cross-team bead: create handoff packet template between Foundation->Domain->Application cycles with risk and evidence summary |
| bead-0290 | closed | (none) | owner, closeCriteria, rollbackTrigger | IN-PROGRESS: Create implementation bead for canonical object v1 domain scaffolding |
| bead-0291 | closed | (none) | owner, closeCriteria, rollbackTrigger | Implement domain events parser and expose domain events aggregate parsing |
| bead-0292 | closed | (none) | owner, closeCriteria, rollbackTrigger | Code review: domain events parser and event stream parsing coverage |
| bead-0293 | closed | (none) | owner, closeCriteria, rollbackTrigger | feat(cockpit): implement cockpit prototype UX fixes (persona layout, drawer push, visual hierarchy) |
| bead-0294 | closed | (none) | owner, closeCriteria, rollbackTrigger | Implement infrastructure baseline ADR-0056, local compose, and infra specs |
| bead-0295 | closed | (none) | owner, closeCriteria, rollbackTrigger | Implement first-pass Portarium presentation layer reference package and roadmap artifacts |
| bead-0296 | closed | (none) | owner, closeCriteria, rollbackTrigger | Add CI image build pipeline with tagged Control Plane/worker artefacts for infra baseline |
| bead-0297 | closed | (none) | owner, closeCriteria, rollbackTrigger | Harden infra baseline scaffolding and runnable image manifests for ADR-0056 |
| bead-0298 | open | (none) | owner, closeCriteria, rollbackTrigger | Implement concrete infrastructure execution baseline (Terraform and deploy automation) |
| bead-0299 | open | (none) | owner, closeCriteria, rollbackTrigger | AuthZ: application-layer authorization actions and forbidden-action typing contract |
| bead-0300 | closed | (none) | owner, rollbackTrigger | Add end-to-end application integration tests for command/query flows with idempotency + outbox + CloudEvent emission under transient failure scenarios |
| bead-0301 | closed | (none) | owner, closeCriteria, rollbackTrigger | Run full ci:pr for application-layer changes and triage any failures (typecheck/lint/tests/deps/audit/coverage) |
| bead-0302 | closed | (none) | owner, rollbackTrigger | Domain parsing/validation toolkit consolidation (ISO timestamp parsing, integer/enum validation, shared error model) across all *V1 domain parsers |
| bead-0303 | closed | (none) | owner, rollbackTrigger | Temporal invariants and ordering checks in domain models (issued/revoked, started/ended, due/created, retention deadlines, run/work-item event timelines) |
| bead-0304 | closed | (none) | owner, rollbackTrigger | Tenancy identity unification (alias/aliasing policy for TenantId and WorkspaceId, parser migration, and cross-module compile-time guard) |
| bead-0305 | closed | (none) | owner, rollbackTrigger | Canonical capability enforcement across workflow actions, adapter capability matrices, and port supported operations (PortCapability migration with compatibility strategy) |
| bead-0306 | closed | (none) | owner, rollbackTrigger | Domain events correlation requirements (tenant/workspace id and correlation id as required metadata on DomainEventV1 and related parser invariants) |
| bead-0307 | closed | (none) | owner, rollbackTrigger | Provider-selection contract hardening (operation compatibility checks by family, deterministic tie-break rules, and unsupported-operation failure tests) |
| bead-0308 | closed | (none) | owner, closeCriteria, rollbackTrigger | Repository-level aggregate invariants (workspace policy: active workflow versioning, one-active-adapter-per-port, cross-aggregate uniqueness checks), to be enforced in application boundaries |
| bead-0309 | closed | (none) | owner | Domain API compatibility and migration plan (schema-versioned operation names, deprecated fields, and rollout/rollback to preserve existing workflow/adapters payloads) |
| bead-0310 | closed | (none) | owner, rollbackTrigger | Evidence/audit schema debt clean-up (CloudEvent time, tenant correlation, evidence chain timestamp consistency, and schema docs + ADR evidence) |
| bead-0311 | open | (none) | owner, closeCriteria, rollbackTrigger | Closeout review: Domain hardening release gate must confirm all new domain-beads above are merged, tested, and owner-signed |
| bead-0312 | open | (none) | owner, closeCriteria, rollbackTrigger | Application-layer implementation roadmap: scope and acceptance criteria for register-workspace/start-workflow/submit-approval + remaining core use-cases |
| bead-0313 | open | (none) | owner, closeCriteria, rollbackTrigger | Application-level observability: traces/logs/metrics correlation (traceparent, OTel spans, security-safe attributes) |
| bead-0314 | closed | (none) | owner, rollbackTrigger | Implement durable workflow adapter integration (start activity, await signals, retry/backoff policy, deterministic execution boundary) |
| bead-0315 | open | (none) | owner, closeCriteria, rollbackTrigger | Application query read-model projection strategy (denormalized read tables or materialized views) with cache + invalidation |
| bead-0316 | closed | (none) | owner, rollbackTrigger | Application outbox + event dispatcher for atomic publish of CloudEvents with idempotency and retry semantics |
| bead-0317 | open | (none) | owner, closeCriteria, rollbackTrigger | Application-level rate limiting and anti-abuse guard (tenant/user/action quotas, 429 semantics, retry-after policy) |
| bead-0318 | open | (none) | owner, closeCriteria, rollbackTrigger | Implement and wire policy/authorization matrix for all app commands and queries (APP_ACTIONS coverage + tenant-aware checks) |
| bead-0319 | closed | (none) | owner, rollbackTrigger | Add missing application command/query handlers for workspace/run/approval lifecycle list/read/search/pagination |
| bead-0320 | open | (none) | owner, rollbackTrigger | Add contract tests for application command/query surface (.specify specs) including operation authorization, Forbidden action mapping, and schema diffs |
| bead-0321 | open | (none) | owner, closeCriteria, rollbackTrigger | Add end-to-end integration tests for application-layer idempotency, replay safety, outbox dispatch ordering, and failure injections |
| bead-0322 | open | (none) | owner, closeCriteria, rollbackTrigger | Provision and document Terraform remote state + locking for all infra stacks |
| bead-0323 | open | (none) | owner, closeCriteria, rollbackTrigger | Code review: application-layer completion: acceptance evidence, test coverage, architecture-guard evidence, and rollback plan |
| bead-0324 | open | (none) | owner, closeCriteria, rollbackTrigger | Add Terraform state validation matrix in CI (format/init/validate + cost/security lint) across AWS/Azure/GCP stacks |
| bead-0325 | open | (none) | owner, closeCriteria, rollbackTrigger | Build and validate AWS control-plane bootstrap script (EKS/VPC/RDS/S3/KMS) + one-click dev/staging/prod apply pattern |
| bead-0326 | closed | (none) | owner, closeCriteria, rollbackTrigger | API transport strategy: HTTP/1.1, HTTP/2, optional gRPC and WebSocket event stream in app/presentation boundary |
| bead-0327 | open | (none) | owner, closeCriteria, rollbackTrigger | Hardening pass: enforce egress allowlist, namespace isolation, and Vault workload auth in Kubernetes execution plane |
| bead-0328 | open | (none) | owner, closeCriteria, rollbackTrigger | AuthN/AuthZ production hardening (OIDC validation claims, tenancy checks, role scoping, token refresh and rotation strategy) |
| bead-0329 | open | (none) | owner, closeCriteria, rollbackTrigger | Implement CI/CD provenance and image signing for control-plane/execution-plane containers (SBOM + attestation) |
| bead-0330 | open | (none) | owner, closeCriteria, rollbackTrigger | Draft Azure and GCP Terraform baselines to match AWS control-plane contract and evidence immutability assumptions |
| bead-0331 | closed | (none) | owner, closeCriteria, rollbackTrigger | Close infrastructure hardening debt from existing failed gates: fix k8s and workflow manifest formatting blockers and re-run ci:pr in full |
| bead-0332 | closed | (none) | owner, closeCriteria, rollbackTrigger | Refactor start-workflow.ts: reduce complexity (22→≤10) and cognitive-complexity (21→≤15) via helper extraction |
| bead-0333 | closed | (none) | owner, closeCriteria, rollbackTrigger | Improve ops-cockpit http-client.ts test coverage from 61% to 80%+ (error paths, response parsing, edge cases) |
| bead-0334 | closed | (none) | owner, closeCriteria, rollbackTrigger | Add test coverage for application/common/errors.ts (currently 0%) |
| bead-0335 | closed | (none) | owner, rollbackTrigger | Wire infrastructure layer adapters: implement PostgreSQL stores, event publisher, and ID generator behind application ports |
| bead-0336 | closed | (none) | owner, closeCriteria, rollbackTrigger | Implement ops-cockpit presentation layer: route handlers, middleware, OpenAPI spec, and end-to-end integration tests |
| bead-0337 | closed | (none) | owner, rollbackTrigger | Implement state machine for workflow run lifecycle (Pending→Running→Succeeded/Failed/Cancelled with approval gates) |
| bead-0338 | closed | (none) | owner, rollbackTrigger | Harden ErrorFactory pattern: add path-aware overloads to parse-utils readBoolean/readString/readOptionalString for nested object parsing |
| bead-0339 | closed | (none) | owner, closeCriteria, rollbackTrigger | Upgrade ajv transitive dependency to ≥8.18.0 to resolve 20 moderate ReDoS advisories (GHSA-2g4f-4pwh-qvx6) |
| bead-0340 | open | (none) | owner, rollbackTrigger | Complete remaining application-layer use-cases beyond register-workspace/start-workflow/submit-approval |
| bead-0341 | closed | (none) | owner, closeCriteria, rollbackTrigger | Document session 2026-02-18 quality gate sweep: ErrorFactory fix, ESLint test overrides, adapter-registration key bug, complexity refactors |
| bead-0342 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: generate typed API client from OpenAPI + runtime response validation at boundary |
| bead-0343 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: app shell — workspace selector, system state region, primary navigation layout |
| bead-0344 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: persona-aware route defaults (Operator→inbox, Approver→queue, Auditor→evidence) |
| bead-0345 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: system-state banners (empty/misconfigured/policy-blocked/RBAC-limited/degraded-realtime) |
| bead-0346 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: EffectsList domain primitive (Planned/Predicted/Verified rendering) |
| bead-0347 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: EvidenceTimeline domain primitive (actor/category filter, chain verification cues) |
| bead-0348 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: ApprovalDecisionForm domain primitive (required rationale, error recovery) |
| bead-0349 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: approval command orchestration (apply/deny/request-changes + Problem Details) |
| bead-0350 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: run cancel command (idempotent feedback, status revalidation) |
| bead-0351 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: Work Item to Run detail drill-down with evidence linking |
| bead-0352 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: event stream client adapter (near-realtime updates when healthy) |
| bead-0353 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: degraded-mode fallback polling + staleness indicator UX |
| bead-0354 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: route-level lazy loading for heavy views (workflow builder, evidence explorer) |
| bead-0355 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: pagination-first list rendering + memoized mapping helpers |
| bead-0356 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: CSP policy definition (report-only stage then enforce) |
| bead-0357 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: command payload encoding lockdown + ban dangerous HTML rendering |
| bead-0358 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: CSRF/token handling strategy + documentation for cookie-based auth paths |
| bead-0359 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: unit/component test coverage for Problem Details mapping + domain primitives |
| bead-0360 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: E2E smoke tests for approval + run detail + evidence fallback flows |
| bead-0361 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: visual acceptance tests for trust UI states (effects, evidence, approval forms) |
| bead-0362 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: feature-flag gated rollout by domain slice (read-only first, then commands) |
| bead-0363 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: state management architecture — TanStack Query (server state) + Zustand (UI state) |
| bead-0364 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: Storybook + a11y addon setup for domain primitives development |
| bead-0365 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: OpenTelemetry browser instrumentation (RUM navigation traces, API latency, error rates) |
| bead-0366 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: WCAG 2.2 AA accessibility baseline + keyboard-first interaction for all critical workflows |
| bead-0367 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: Trusted Types pilot for DOM XSS prevention |
| bead-0368 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: HSTS enforcement for production domains |
| bead-0369 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: Chromatic visual regression for trust UI components (effects, evidence, approval) |
| bead-0370 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: rendering strategy decision — CSR default with static asset deployment, SSR hybrid only if required |
| bead-0371 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: static asset caching strategy (immutable hashed assets, short-lived HTML) per RFC 9111 |
| bead-0372 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: RunStatusChip + WorkspaceSwitcher shared domain primitives |
| bead-0373 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: error UX mapping — Problem Details (RFC 9457) to actionable banners with instance IDs for support |
| bead-0374 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: CI gate — lint, typecheck, unit, component, build artefact, E2E smoke, visual regression |
| bead-0375 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: immutable versioned artefact deployment with CDN caching + fast rollback |
| bead-0376 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: alerting SLOs — page load, approval interaction latency, API error rate, stale-data duration |
| bead-0377 | closed | (none) | owner, closeCriteria, rollbackTrigger | Pres: dual-run migration mode (old UI + new UI in parallel with audit parity verification) |
| bead-0378 | open | (none) | owner, closeCriteria, rollbackTrigger | App: API backward compatibility and versioning strategy (versioned paths, additive-only field rules, deprecation policy, content negotiation) |
| bead-0379 | open | (none) | owner, closeCriteria, rollbackTrigger | App: input validation framework at command/query boundary (schema validation, allow-lists, RFC 9457 rejection for invalid inputs) |
| bead-0380 | open | (none) | owner, closeCriteria, rollbackTrigger | CI: security gates (OpenAPI breaking-change diff checks, dependency vulnerability scanning, secret scanning) |
| bead-0381 | open | (none) | owner, closeCriteria, rollbackTrigger | App: load and stress testing (rate-limit validation under synthetic load, 429/Retry-After correctness, graceful shedding) |
| bead-0382 | closed | (none) | owner, closeCriteria, rollbackTrigger | App: GraphQL BFF evaluation (evaluate GraphQL as backend-for-frontend for ops cockpit vs REST-only) |
| bead-0383 | open | (none) | owner, closeCriteria, rollbackTrigger | App: event schema versioning governance (CloudEvents type versioning rules, schema registry pattern, consumer resilience) |
| bead-0384 | open | (none) | owner, closeCriteria, rollbackTrigger | App: HTTP precondition support for optimistic concurrency (ETag, If-Match, 412 Precondition Failed) |
| bead-0385 | closed | (none) | owner, rollbackTrigger | Infra: Docker Compose local development stack (DB, Temporal dev, vault dev, object store, OTel Collector) |
| bead-0386 | closed | (none) | owner, rollbackTrigger | Infra: OCI container images for API server and worker runtime (Dockerfiles, multi-stage builds, image build CI pipeline) |
| bead-0387 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: environment model and artefact promotion pipeline (dev/staging/prod definitions, config-per-env, artefact-based promotion) |
| bead-0388 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Temporal workflow runtime deployment (Helm chart, persistence stores, HA configuration, visibility backend) |
| bead-0389 | closed | (none) | owner, rollbackTrigger | Infra: evidence payload WORM storage controls (S3 Object Lock or equivalent, retention periods, legal holds, compliance mode) |
| bead-0390 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: OTel Collector deployment and observability backend wiring (Collector Helm chart, OTLP pipelines, metrics/traces/logs backend integration) |
| bead-0391 | closed | (none) | owner | Infra: database schema migration framework (versioned migrations, expand/contract pattern, rollback safety, tenant-aware migrations) |
| bead-0392 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: multi-tenant storage tier automation (schema-per-tenant provisioning, DB-per-tenant lifecycle, backup/restore per tier) |
| bead-0393 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: SLO definitions, dashboards, and alerting (API latency/error, workflow completion, worker actions, evidence integrity) |
| bead-0394 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: progressive delivery pipeline (canary or blue-green deployment, traffic shifting, automated rollback on SLO breach) |
| bead-0395 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: CI OIDC federation for cloud access (GitHub Actions OIDC to cloud providers, no long-lived credentials) |
| bead-0396 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Kubernetes health probes and PodDisruptionBudgets for all control-plane and worker services |
| bead-0397 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: DR drills and automated recovery validation (DB restore, cluster recreation from IaC, evidence store replication verification) |
| bead-0398 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: FinOps tagging and cost governance (resource tagging, environment budgets, right-sizing, autoscaling strategy) |
| bead-0399 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: workflow durability fault-injection testing (pod kill, DB failover, network partition, verify workflow resume) |
| bead-0400 | closed | (none) | owner, rollbackTrigger | Infra: migrate Temporal compose image from temporalio/auto-setup to temporalio/server (upstream deprecated, urgent) |
| bead-0401 | closed | (none) | owner, rollbackTrigger | ADR: external execution plane strategy - adopt Activepieces as primary connector runtime and Langflow as agentic runtime alongside Temporal |
| bead-0402 | closed | (none) | owner, rollbackTrigger | Infra: install Temporal TypeScript SDK and wire WorkflowOrchestrator port adapter against local dev instance |
| bead-0403 | open | (none) | owner, rollbackTrigger | Spike: evaluate Activepieces piece coverage for the 18 port adapter families |
| bead-0404 | open | (none) | owner, rollbackTrigger | Infra: Activepieces self-hosted deployment configuration (Docker Compose dev stack entry and Helm production chart) |
| bead-0405 | open | (none) | owner, rollbackTrigger | Infra: Activepieces action executor adapter - invoke Activepieces flows as Portarium workflow actions with correlation header propagation |
| bead-0406 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: DomainEvent trigger routing to Activepieces webhook endpoint with tenantId and correlationId headers |
| bead-0407 | open | (none) | owner, rollbackTrigger | Infra: Langflow isolated deployment - per-environment instances, disabled auto-login, hardened auth, reverse proxy, network policies |
| bead-0408 | open | (none) | owner, rollbackTrigger | Infra: Langflow agent flow HTTP adapter - invoke Langflow flows from Portarium workflow steps with correlation header propagation |
| bead-0409 | closed | (none) | owner, closeCriteria, rollbackTrigger | App: external action runner port interface for dispatching workflow actions to external execution planes |
| bead-0410 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Activepieces custom piece TypeScript npm package pattern for Portarium port adapter families |
| bead-0411 | open | (none) | owner, closeCriteria, rollbackTrigger | App: trigger-to-execution-plane routing - route TriggerKind to correct execution plane adapter at workflow start |
| bead-0412 | open | (none) | owner, closeCriteria, rollbackTrigger | Spike: evaluate Kestra for CloudEvents-triggered ops and pipeline workloads (OTel integration, scalable execution) |
| bead-0413 | open | (none) | owner, closeCriteria, rollbackTrigger | Spike: evaluate StackStorm for event-driven IT ops automation (sensors, rules, workflows pattern for ITSM and monitoring families) |
| bead-0414 | open | (none) | owner, closeCriteria, rollbackTrigger | Governance: licence compliance audit for adopted execution platforms (Activepieces MIT EE carve-outs, Kestra Apache 2.0 EE features) |
| bead-0415 | open | (none) | owner, rollbackTrigger | Infra: implement control plane HTTP server handlers to match OpenAPI v1 contract (Workspaces, Users, WorkItems, Workflows, Runs, Approvals, Evidence, AdapterRegistrations, CredentialGrants) |
| bead-0416 | closed | (none) | owner, rollbackTrigger | Infra: replace bootstrap.sh scaffold containers with production entrypoints for API server and worker runtime |
| bead-0417 | closed | (none) | owner, rollbackTrigger | App: implement production-grade JWT validation and principal extraction against bearerAuth defined in OpenAPI contract |
| bead-0418 | closed | (none) | owner, rollbackTrigger | App: wire AuthorizationPort to a real authorisation system (Keycloak OIDC + OpenFGA fine-grained authz) with role gating per OpenAPI route |
| bead-0419 | closed | (none) | owner, rollbackTrigger | App: close submit-approval RequestChanges gap - command currently rejects RequestChanges decision; implement approval cycle support for RequestChanges with re-route to initiator |
| bead-0420 | open | (none) | owner, closeCriteria, rollbackTrigger | Domain: add consent and privacy policy canonical objects for marketing operations (opt-in status, suppression lists, consent audit trail) |
| bead-0421 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Mautic reference adapter for MarketingAutomation port family (campaign CRUD, contact segmentation, workflow trigger integration) |
| bead-0422 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Odoo or ERPNext reference adapter for FinanceAccounting port family (GL, AR/AP, invoice lifecycle, period close hooks) |
| bead-0423 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: Zammad reference adapter for CustomerSupport port family (ticket intake, triage, SLA tracking, knowledge base integration) |
| bead-0424 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: GitHub reference adapter for software development operations (PR lifecycle, deployment events, DORA metrics collection - lead time, deployment frequency, change failure rate, MTTR) |
| bead-0425 | closed | (none) | owner, rollbackTrigger | App: implement Temporal worker execution loop - resolve approvals, build plan, execute via adapter, collect verified effects, compute planned vs verified diff, write evidence, transition run status |
| bead-0426 | closed | (none) | owner, rollbackTrigger | App: idempotent workflow start - repeated StartWorkflow with same idempotency key returns same runId without creating duplicate Temporal executions |
| bead-0427 | closed | (none) | owner, rollbackTrigger | Presentation: cockpit UI MVP - approver queue (approve/deny with rationale), run list with planned-vs-verified diff, work item creation, adapter registration overview |
| bead-0428 | open | (none) | owner, closeCriteria, rollbackTrigger | Infra: OTel Collector production pipeline - add OTLP trace/metrics/logs backend, alerting, and cross-signal correlation beyond current logging-only config |
| bead-0429 | open | (none) | owner, closeCriteria, rollbackTrigger | Governance: domain coverage matrix - map Portarium port families and canonical objects against operational domain requirements (marketing, finance, accounting, IT support, software delivery) with gap tracking |
| bead-0430 | closed | (none) | owner, rollbackTrigger | Domain: MachineRegistration aggregate and Agent configuration entity (machine runtime registry domain model with capability allowlist and auth config) |
| bead-0431 | closed | (none) | owner, rollbackTrigger | Domain: CloudEvents type catalogue for agent lifecycle - com.portarium.agent.ActionDispatched, ActionCompleted, ActionFailed with tenantId/correlationId/runId propagation |
| bead-0432 | closed | (none) | owner, rollbackTrigger | App: MachineInvokerPort - port interface for invoking external machine/agent runtimes (runAgent via /v1/responses and invokeTool via /tools/invoke) with credential injection contract |
| bead-0433 | open | (none) | owner, rollbackTrigger | App: Agent Task action execution path in workflow runner - dispatch to MachineInvokerPort, policy tier gating (Auto/Assisted pass-through, HumanApprove pauses run), status transitions |
| bead-0434 | open | (none) | owner, closeCriteria, rollbackTrigger | App: Machine/agent registration command handlers - RegisterMachine, CreateAgent, UpdateAgentCapabilities with tenancy enforcement and evidence emission |
| bead-0435 | open | (none) | owner, rollbackTrigger | Infra: OpenClaw Gateway HTTP adapter implementing MachineInvokerPort - POST /v1/responses client with model selection, bearer-token credential injection, and retry/backoff |
| bead-0436 | open | (none) | owner, rollbackTrigger | Infra: OpenClaw /tools/invoke constrained-tool client - tool policy gating, 429/Retry-After compliance, per-session key routing, and dry-run support |
| bead-0437 | open | (none) | owner, rollbackTrigger | Infra: Evidence logging hooks for agent step lifecycle - persist ActionDispatched/ActionCompleted/ActionFailed evidence entries with payloadRefs, hash chain, and CloudEvents emission |
| bead-0438 | closed | (none) | owner, rollbackTrigger | Presentation: OpenAPI v1 machine runtime registry endpoints - GET/POST /v1/workspaces/{ws}/machines and POST /v1/workspaces/{ws}/machines/{id}/test (smoke-test to Gateway) |
| bead-0439 | closed | (none) | owner, rollbackTrigger | Presentation: OpenAPI v1 agent configuration endpoints - GET/POST /v1/workspaces/{ws}/agents and PATCH /v1/workspaces/{ws}/agents/{id} with RBAC enforcement and Problem Details |
| bead-0440 | closed | (none) | owner, rollbackTrigger | Presentation: Cockpit Agents screen - machine connection test, capability allowlist editing, used-by-workflows query; depends on bead-0427 cockpit MVP and bead-0438/0439 API endpoints |
| bead-0441 | open | (none) | owner, closeCriteria, rollbackTrigger | Testing: Contract tests for machine/agent OpenAPI endpoints - schema validation, RBAC role gating, Problem Details error shapes, multi-tenant scoping assertions |
| bead-0442 | open | (none) | owner, closeCriteria, rollbackTrigger | Testing: Integration tests for OpenClaw Gateway adapter with stub HTTP server - deterministic fixtures, 429/Retry-After backoff, policy-blocked tool scenarios, agent output capture |
| bead-0443 | closed | (none) | owner, closeCriteria, rollbackTrigger | Testing: E2E approval-gated agent task run - cockpit starts run with Agent Task, run pauses at HumanApprove gate, approver submits decision, run resumes and completes with evidence entries |
| bead-0444 | open | (none) | owner, closeCriteria, rollbackTrigger | Governance: OpenClaw tool blast-radius policy - map Gateway tools/skills to Portarium capability tiers; dangerous tools default to HumanApprove; policy violations surface as Policy blocked run state |
| bead-0445 | open | (none) | owner, closeCriteria, rollbackTrigger | Governance: OpenClaw multi-tenant isolation strategy - per-workspace or per-security-domain Gateway deployment model; credential scoping; network isolation requirements; documented decision record |
| bead-0446 | closed | (none) | owner, closeCriteria, rollbackTrigger | DUPLICATE: use bead-0447 — OpenAPI contract alignment AdapterRegistration capability matrix |
| bead-0447 | closed | (none) | owner, rollbackTrigger | Spec: OpenAPI contract alignment — add AdapterRegistration capability matrix and machineRegistrations to portarium-control-plane.v1.yaml; reconcile WorkItem, CredentialGrant, and Policy schemas against domain parsers to fix governance gap where policy tiers cannot be validated at the API boundary |
| bead-0448 | open | (none) | owner, rollbackTrigger | Spec: Policy evaluation rule language — decide and document condition grammar for PolicyInlineRuleV1.condition (CEL, OPA/Rego, or constrained DSL) and implement evaluator; current bare-string condition is ambiguous, unevaluable, and a security risk |
| bead-0449 | open | (none) | owner, rollbackTrigger | Spec: Workflow action execution semantics — document sequential vs parallel branching, per-action retry and timeout policy, manual-only action completion signals, and compensation hook interface; required before EPIC-D08 state machine and Temporal worker loop are implemented |
| bead-0450 | closed | (none) | owner, rollbackTrigger | Spec: Evidence hash canonicalization — align EvidenceEntry hash input serialization to RFC 8785 JCS (JSON Canonicalization Scheme) for deterministic cross-language chain verification; current bespoke serialization breaks verification in non-TypeScript consumers |
| bead-0451 | open | (none) | owner, rollbackTrigger | Spec: Saga compensation interface — define standard compensation metadata fields in capability matrix (compensationOperation, compensationInputSchema) and a per-port-family compensation contract so long-lived workflow failures can trigger reversals; maps to PlanV1.plannedEffects saga model |
| bead-0452 | closed | (none) | owner, rollbackTrigger | ADR: hybrid orchestration/choreography architecture — record formal decision that Portarium uses Temporal for run-lifecycle orchestration (correctness and governance) and CloudEvents stream for projection/integration choreography (downstream consumers); distinguishes internal durable execution from external event choreography |
| bead-0453 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Adapter Integration Gallery — plan how 18 port-adapter families display in cockpit Settings > Integrations (capability matrices, connection health, provider logos, status indicators) |
| bead-0454 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Adapter Integration Gallery |
| bead-0455 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement Adapter Integration Gallery + Nielsen review |
| bead-0456 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Agent and Machine Runtime screens (registration, config, capabilities, connection testing) |
| bead-0457 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement Agent and Machine Runtime screens + Nielsen review |
| bead-0458 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Approval flow depth (decision rationale, SoD evaluation, request-changes cycle, policy display) |
| bead-0459 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement deep approval flows + Nielsen review |
| bead-0460 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Evidence and audit trail (chain verification cues, hash integrity, tamper-evident indicators, export) |
| bead-0461 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement evidence explorer and audit trail + Nielsen review |
| bead-0462 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Real-time updates and degraded mode (event stream, staleness indicators, fallback polling UX) |
| bead-0463 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement real-time and degraded mode indicators + Nielsen review |
| bead-0464 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: IAM and access control (RBAC role matrix, credential management, OIDC indicators, fine-grained authz) |
| bead-0465 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement IAM and access control screens + Nielsen review |
| bead-0466 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Workflow execution state machine (lifecycle visualization, branching, compensation, retry indicators) |
| bead-0467 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement workflow state machine visualization + Nielsen review |
| bead-0468 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Domain primitive components (EffectsList, EvidenceTimeline, ApprovalForm, RunStatusChip, error UX) |
| bead-0469 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement domain primitive components + Nielsen review |
| bead-0470 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Observability and health dashboard (OTel traces, status bar health, metrics, log viewer) |
| bead-0471 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement observability and health UI + Nielsen review |
| bead-0472 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Governance and policy deep-dive (rule language display, blast-radius visualization, tenant isolation) |
| bead-0473 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement governance and policy screens + Nielsen review |
| bead-0474 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Onboarding and progressive disclosure (first-run experience, guided setup, empty state transitions) |
| bead-0475 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement onboarding flow and progressive disclosure + Nielsen review |
| bead-0476 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: WCAG 2.2 AA accessibility and keyboard-first (focus management, screen reader, aria, skip links) |
| bead-0477 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement accessibility layer and keyboard-first polish + Nielsen review |
| bead-0478 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Performance perception (skeleton screens, lazy loading, pagination patterns, loading states) |
| bead-0479 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Implement loading and pagination patterns + Nielsen review |
| bead-0480 | closed | (none) | owner, rollbackTrigger | Review: domain parsing toolkit (bead-0302) — verify shared parsers eliminate duplication, error model is consistent, all *V1 parsers migrated |
| bead-0481 | closed | (none) | owner, rollbackTrigger | Review: tenancy identity unification (bead-0304) — verify TenantId/WorkspaceId alias policy, compile-time guard blocks drift |
| bead-0482 | closed | (none) | owner, rollbackTrigger | Review: workflow run lifecycle state machine (bead-0337) — verify state table is complete and invalid transitions compile-fail |
| bead-0483 | closed | (none) | owner, rollbackTrigger | Review: OpenAPI contract alignment (bead-0447) — verify AdapterRegistration capability matrix present and all reconciled schemas pass CI |
| bead-0484 | closed | (none) | owner, rollbackTrigger | Review: infrastructure adapters wiring (bead-0335) — verify all application ports have working implementations, integration tests pass, no port left mocked in production path |
| bead-0485 | closed | (none) | owner, rollbackTrigger | Review: Temporal SDK integration (bead-0402) — verify WorkflowOrchestrator port adapter starts workflows and determinism constraints are documented |
| bead-0486 | closed | (none) | owner, rollbackTrigger | Review: outbox + event dispatcher (bead-0316) — verify exactly-once-ish publish semantics and outbox retry correctness |
| bead-0487 | closed | (none) | owner, rollbackTrigger | Review: IAM MVP + JWT validation + AuthZ wiring (bead-0016, bead-0417, bead-0418) — verify RBAC enforced, OWASP BOLA scenarios pass, deny-by-default |
| bead-0488 | closed | (none) | owner, rollbackTrigger | Review: Temporal worker execution loop (bead-0425) — verify plan/diff/evidence/run-status all correct end-to-end; hash chain intact |
| bead-0489 | closed | (none) | owner, rollbackTrigger | Review: evidence hash chain implementation (bead-0035) — verify chain is tamper-evident, break detectable, signature hooks present |
| bead-0490 | closed | (none) | owner, rollbackTrigger | Review: CloudEvents envelope implementation (bead-0041) — verify required fields, tenantid/correlationid extensions present on every event |
| bead-0491 | open | (none) | owner, rollbackTrigger | Review: control plane HTTP handlers (bead-0415) — verify all routes match OpenAPI v1, problem+json used, no schema drift |
| bead-0492 | closed | (none) | owner, rollbackTrigger | Doc review: domain model docs (domain-layer-work-backlog, canonical-objects, erd, aggregates) align with implemented code after P0 domain beads close |
| bead-0493 | open | (none) | owner, rollbackTrigger | Doc review: OpenAPI spec and backlog docs aligned after bead-0447 (contract alignment) and bead-0415 (HTTP handlers) close |
| bead-0494 | open | (none) | owner, rollbackTrigger | Doc review: application layer backlog docs aligned after P0 application beads close (bead-0316, bead-0319, bead-0340, bead-0425) |
| bead-0495 | open | (none) | owner, rollbackTrigger | Doc review: spec files (.specify/specs/) aligned with implementation for all P0 use-cases |
| bead-0496 | closed | (none) | owner, rollbackTrigger | Domain Atlas: robotics and physical actuation taxonomy — robot classes, integration patterns, protocol inventory, scoring rubric |
| bead-0497 | closed | (none) | owner, rollbackTrigger | Domain Atlas: robotics taxonomy — robot classes, integration patterns, protocol inventory, scoring rubric |
| bead-0498 | closed | (none) | owner, rollbackTrigger | Domain Atlas: robotics open-source project inventory with scored rubric entries |
| bead-0499 | closed | (none) | owner, rollbackTrigger | Domain Atlas: robotics OSS project inventory scored against atlas rubric |
| bead-0500 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: robotics OSS project inventory scored against atlas rubric |
| bead-0501 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain Atlas: robotics OSS project inventory scored against atlas rubric |
| bead-0502 | closed | (none) | owner, closeCriteria, rollbackTrigger | test bead |
| bead-0503 | closed | (none) | owner, closeCriteria, rollbackTrigger | test body bead |
| bead-0504 | closed | (none) | owner, rollbackTrigger | Domain Atlas: cockpit UX taxonomy for robots and agents |
| bead-0505 | closed | (none) | owner, rollbackTrigger | ADR: robotics integration architecture — control-plane vs edge-gateway split, protocol selection |
| bead-0506 | closed | (none) | owner, rollbackTrigger | ADR: robotics safety boundary — what Portarium governs vs what the edge safety controller must own |
| bead-0507 | closed | (none) | owner, rollbackTrigger | Domain: RoboticsActuation port family — port family entry and capability matrix operations |
| bead-0508 | closed | (none) | owner, rollbackTrigger | Domain: RobotId, FleetId, MissionId, GatewayId branded primitives |
| bead-0509 | closed | (none) | owner, rollbackTrigger | Domain: Robot and Fleet aggregate root types with capabilities and safety profile |
| bead-0510 | closed | (none) | owner, rollbackTrigger | Domain: Mission aggregate and ActionExecution entity for robot mission lifecycle |
| bead-0511 | closed | (none) | owner, rollbackTrigger | Domain: CloudEvents type catalogue for robot lifecycle events |
| bead-0512 | closed | (none) | owner, rollbackTrigger | Domain: SafetyConstraint and SafetyCase value objects for robotics policy gating |
| bead-0513 | closed | (none) | owner, rollbackTrigger | App: MissionPort interface for dispatching robot missions to edge gateway |
| bead-0514 | closed | (none) | owner, rollbackTrigger | Spec: robotics workflow action semantics — pre-emption, stop-path, retry policy, idempotency for physical actions |
| bead-0515 | open | (none) | owner, rollbackTrigger | Infra: gRPC edge gateway adapter implementing MissionPort — prototype |
| bead-0516 | open | (none) | owner, rollbackTrigger | Infra: MQTT gateway adapter for IoT-style actuator commands and telemetry — prototype |
| bead-0517 | open | (none) | owner, rollbackTrigger | Infra: ROS 2 Action bridge via edge gateway — Nav2 NavigateTo mission prototype |
| bead-0518 | open | (none) | owner, rollbackTrigger | Infra: OPC UA connector prototype using node-opcua for industrial PLC actuation |
| bead-0519 | open | (none) | owner, rollbackTrigger | Infra: simulation CI harness for robotics integration — Gazebo or Webots regression suite |
| bead-0520 | open | (none) | owner, rollbackTrigger | Security: SROS2 and DDS-Security hardening for ROS 2 mission traffic across trust boundaries |
| bead-0521 | open | (none) | owner, rollbackTrigger | Security: mTLS workload identity for robot gateways using SPIFFE/SPIRE |
| bead-0522 | closed | (none) | owner, rollbackTrigger | Governance: safety-aware policy tiers — HumanApprove mandatory for hazardous robot actions |
| bead-0523 | open | codex | rollbackTrigger | Governance: SoD constraints for robot control — operator cannot approve own mission in hazardous zones |
| bead-0524 | closed | (none) | owner, rollbackTrigger | Governance: machinery compliance planning — ISO 12100 risk assessment and EU/UK/US regulations timeline |
| bead-0525 | closed | (none) | owner, rollbackTrigger | Presentation: Cockpit Robots and Fleet screen — enrolment, health, connectivity, capability matrix |
| bead-0526 | closed | (none) | owner, rollbackTrigger | Presentation: Cockpit Missions screen — create/submit, monitor feedback, pre-empt/cancel, post-run evidence |
| bead-0527 | closed | (none) | owner, rollbackTrigger | Presentation: Cockpit Safety screen — global E-stop, per-site constraints, approval policy thresholds |
| bead-0528 | open | (none) | owner, rollbackTrigger | Testing: evidence-chain verification under adversarial retries for robot actions |
| bead-0529 | open | (none) | owner, rollbackTrigger | Testing: pre-emption and stop-path latency benchmark for robot missions |
| bead-0530 | open | (none) | owner, rollbackTrigger | Testing: multi-robot dispatch and fleet coordination via Open-RMF integration |
| bead-0531 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Robots/Fleet screen — enrolment grid, robot detail drawer, telemetry sparkline stub |
| bead-0532 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Missions screen — create/dispatch, status board, pre-empt/cancel, evidence link |
| bead-0533 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Safety/E-Stop screen — global E-Stop, per-site constraints, clear gate, audit log |
| bead-0534 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Cockpit lo-fi v2 — Workforce/People directory screen |
| bead-0535 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Cockpit lo-fi v2 — Human task queue as first-class Inbox surface |
| bead-0536 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Cockpit lo-fi v2 — Work Item owner assignment with workforce picker |
| bead-0537 | closed | (none) | owner, closeCriteria, rollbackTrigger | UX Design: Cockpit lo-fi v2 — execution tier visualization in run detail |
| bead-0538 | closed | (none) | owner, closeCriteria, rollbackTrigger | Prototype: update cockpit lo-fi HTML — add Workforce nav section and screen sketches |
| bead-0539 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain: WorkforceMember aggregate — operational resource overlay on WorkspaceUser |
| bead-0540 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain: HumanTask value object — formalise Manual-only as tracked assignment with completion signal |
| bead-0541 | closed | (none) | owner, closeCriteria, rollbackTrigger | Domain: WorkforceQueue aggregate — capability routing and group assignment |
| bead-0542 | closed | (none) | owner, closeCriteria, rollbackTrigger | App: AssignWorkforceMember use-case — assign a workforce member to Work Item or HumanTask |
| bead-0543 | closed | (none) | owner, closeCriteria, rollbackTrigger | App: CompleteHumanTask use-case — signal completion, resume suspended run, log evidence |
| bead-0544 | closed | (none) | owner, closeCriteria, rollbackTrigger | Spec: OpenAPI v1 workforce and human-task endpoints |
| bead-0545 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: People/Workforce screen — directory, capabilities, queue membership |
| bead-0546 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: Inbox — workforce queue filter and human task items |
| bead-0547 | closed | (none) | owner, closeCriteria, rollbackTrigger | Infra: HumanTask assignment and completion evidence hooks |
| bead-0548 | closed | (none) | owner, closeCriteria, rollbackTrigger | Governance: workforce RBAC — manage/assign/complete roles and routing policy |
| bead-0549 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit lo-fi prototype: workforce screens, triage undo, HCI polish, Settings Workforce tab |
| bead-0550 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit prototype: Nielsen heuristic evaluation — workforce integration + surface audit |
| bead-0551 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit prototype hardening: triage integrity, shortcut safety, RBAC visibility, agent detail consistency |
| bead-0552 | closed | (none) | owner, rollbackTrigger | Spec: location-integrated map operations v1 — contracts for LocationEvent, MapLayer, and live map APIs |
| bead-0553 | closed | (none) | owner, rollbackTrigger | Infrastructure: localisation ingestion pipeline — normalize GPS/RTLS/SLAM/odometry into LocationEvent stream |
| bead-0554 | closed | (none) | owner, rollbackTrigger | Presentation/API: live map transport — WebSocket or SSE subscriptions plus trails/playback query endpoints |
| bead-0555 | closed | (none) | owner, rollbackTrigger | Cockpit v1: uncertainty overlays — covariance ellipse/halo with operator legend and toggles |
| bead-0556 | closed | (none) | owner, rollbackTrigger | Cockpit v1: fleet-scale map UX — clustering, aggregation badges, and queue-first drill-down |
| bead-0557 | closed | (none) | owner, rollbackTrigger | Cockpit v2: multi-level indoor map support with floor switching and optional 2D/3D view |
| bead-0558 | open | (none) | owner, rollbackTrigger | Governance v2: policy-gated high-risk map commands with SoD checks and audit-ready command intent |
| bead-0559 | closed | (none) | owner, rollbackTrigger | Accessibility/mobile hardening: WCAG 2.2 map interaction parity (keyboard + single-pointer alternatives) |
| bead-0560 | closed | (none) | owner, rollbackTrigger | Domain: LocationEvent v1 — frame-aware pose telemetry with uncertainty and source metadata |
| bead-0561 | closed | (none) | owner, rollbackTrigger | Domain: MapLayer v1 — floorplans, occupancy grids, geofences, and semantic zones with versioned registration |
| bead-0562 | closed | (none) | owner, rollbackTrigger | Infrastructure: map data services — hot state cache, pose history queries, and map-layer retrieval |
| bead-0563 | closed | (none) | owner, rollbackTrigger | Cockpit MVP: location map surface — overview map + list, filters/search, live positions, short trails |
| bead-0564 | closed | (none) | owner, rollbackTrigger | Governance: location telemetry privacy, retention, and RBAC baseline for map data |
| bead-0565 | closed | (none) | owner, rollbackTrigger | Cockpit MVP: spatial alert triage — stale telemetry, geofence violation, low localisation quality, stopped robot |
| bead-0566 | closed | (none) | owner, rollbackTrigger | Cockpit v1: temporal playback with incident bookmarks and evidence-linked timeline |
| bead-0567 | open | (none) | owner, rollbackTrigger | Integration v1: ingest adapters for VDA 5050 and MassRobotics location/state feeds |
| bead-0568 | closed | (none) | owner, rollbackTrigger | Cockpit v2: analytics layers — coverage and dwell heatmaps with explicit time-window semantics |
| bead-0569 | closed | (none) | owner, rollbackTrigger | Cockpit: Workflow Builder example blueprints for robotics, machines, and hybrid operations |
| bead-0570 | closed | (none) | owner, rollbackTrigger | Cockpit: Workflow Builder node interaction parity across template and non-template graphs |
| bead-0571 | closed | (none) | owner, rollbackTrigger | Cockpit: Workflow Builder low-fi gap - step add and edge editing interactions |
| bead-0572 | closed | (none) | owner, rollbackTrigger | Cockpit: Workflow Builder low-fi gap - validation/readiness and keyboard flows |
| bead-0573 | closed | (none) | owner, rollbackTrigger | Cockpit: Robots Operations Map low-fi Leaflet renderer with static fallback |
| bead-0574 | closed | (none) | owner, rollbackTrigger | Cockpit: Approvals triage A/B layout with optional side diff panel |
| bead-0575 | closed | (none) | owner, rollbackTrigger | Cockpit: HCI hardening pass for triage and workflow graph interactions |
| bead-0576 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit: screenshot-audit declutter pass for approvals triage and UX-note noise |
| bead-0577 | closed | (none) | owner, closeCriteria, rollbackTrigger | Sprint plan: location foundation execution slice (2026-02-19) |
| bead-0578 | closed | (none) | owner, closeCriteria, rollbackTrigger | Documentation scaffold and visual assets automation baseline |
| bead-0579 | closed | (none) | owner, closeCriteria, rollbackTrigger | feat(cockpit-ui): React+Storybook component library scaffold |
| bead-0580 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit demo: high-fidelity frontend with mocked API + deterministic fixtures |
| bead-0581 | closed | (none) | owner, closeCriteria, rollbackTrigger | feat(queries): list/get query use-cases for runs, approvals, workspaces |
| bead-0582 | closed | (none) | owner, closeCriteria, rollbackTrigger | feat(cockpit-ui): 3-theme design system — Arctic Ops, Midnight, Warm Slate |
| bead-0583 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit demo: fix approval submit rebinding and follow-up evidence entry |
| bead-0584 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit asset pipeline: generated icons and entity imagery (hi-fi prototype) |
| bead-0585 | closed | (none) | owner, rollbackTrigger | Beads: add claim/unclaim workflow and update contributor docs |
| bead-0586 | closed | (none) | owner, closeCriteria, rollbackTrigger | Cockpit assets: domain icon gap expansion + transparent icon pipeline |

## Rules

- Owner: `owner` field, falling back to active `claimedBy`.
- Close criteria: `closeCriteria` field or explicit `AC:` / acceptance criteria text in `body`.
- Rollback trigger: `rollbackTrigger` field or explicit rollback text in `body`.

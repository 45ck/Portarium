# Port 18: Compliance & GRC — Integration Catalog

> Audit, risk assessment, policy management, compliance tracking, and governance frameworks.

---

## Port Operations

| Operation               | Description                                                                                     | Idempotent | Webhook-Eligible |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| `listControls`          | Paginated list of controls with optional filters (framework, status, owner, category)           | Yes        | —                |
| `getControl`            | Retrieve a single control by ID, including test results, evidence links, and framework mappings | Yes        | —                |
| `createControl`         | Define a new control with title, description, category, owner, and framework mapping            | No         | Yes              |
| `updateControlStatus`   | Update the operational status of a control (passing, failing, needs review, not applicable)     | No         | Yes              |
| `listRisks`             | Paginated list of risks with optional filters (category, rating, owner, treatment status)       | Yes        | —                |
| `getRisk`               | Retrieve a single risk by ID, including assessments, linked controls, and treatment plan        | Yes        | —                |
| `createRisk`            | Register a new risk with description, category, inherent rating, and risk owner                 | No         | Yes              |
| `assessRisk`            | Record a risk assessment with likelihood, impact, residual rating, and review date              | No         | Yes              |
| `listPolicies`          | Paginated list of policies with optional filters (status, category, approver)                   | Yes        | —                |
| `getPolicy`             | Retrieve a single policy by ID, including version history and acknowledgement status            | Yes        | —                |
| `createPolicy`          | Create a new policy document with title, content, category, and approval workflow               | No         | Yes              |
| `publishPolicy`         | Publish a draft policy, making it active and triggering acknowledgement requests                | No         | Yes              |
| `listAudits`            | Paginated list of audit engagements with optional filters (status, type, date range)            | Yes        | —                |
| `getAudit`              | Retrieve a single audit by ID, including scope, findings, and workpapers                        | Yes        | —                |
| `createAudit`           | Create a new audit engagement with scope, auditor assignments, and timeline                     | No         | Yes              |
| `listFindings`          | Paginated list of findings with optional filters (severity, status, audit, control)             | Yes        | —                |
| `createFinding`         | Record a new finding with description, severity, affected control, and remediation plan         | No         | Yes              |
| `listEvidenceRequests`  | List pending evidence requests with associated controls and due dates                           | Yes        | —                |
| `uploadEvidence`        | Upload evidence (document, screenshot, log export) against a specific control or finding        | No         | Yes              |
| `listFrameworks`        | List all compliance frameworks configured in the platform (SOC 2, ISO 27001, GDPR, etc.)        | Yes        | —                |
| `getFramework`          | Retrieve a single framework with its requirements, control mappings, and completion status      | Yes        | —                |
| `mapControlToFramework` | Create or update a mapping between a control and one or more framework requirements             | No         | Yes              |
| `listVendorAssessments` | List third-party/vendor risk assessments with status and risk ratings                           | Yes        | —                |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider           | Source | Adoption | Est. Customers                                                                | API Style                                                                                                                                                | Webhooks                                                                                                                                               | Key Entities                                                                                                                                        |
| ------------------ | ------ | -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ServiceNow GRC** | S2     | A1       | ~8,000+ enterprise GRC customers (within ~50,000+ total ServiceNow customers) | REST (ServiceNow Table API and GRC-specific APIs). No dedicated OpenAPI spec for GRC modules; uses generic Table API patterns. OAuth 2.0 and basic auth. | Limited (ServiceNow Business Rules can trigger outbound REST; no dedicated GRC webhook subscriptions — requires custom Scripted REST or Flow Designer) | Policy, Control, Risk, Audit, Finding, Issue, ControlTest, RiskAssessment, Indicator, Framework, ComplianceTask, Attestation, Exception, VendorRisk |

### Tier A2 — Must-Support Providers (P1)

| Provider                  | Source | Adoption | Est. Customers                              | API Style                                                                                                                                                                                    | Webhooks                                                                                                                | Key Entities                                                                                                                 |
| ------------------------- | ------ | -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Drata**                 | S1     | A2       | ~5,000+ customers                           | REST (Drata Public API). OpenAPI spec available. Sandbox via developer programme. API key auth.                                                                                              | Yes (webhook notifications for control status changes, evidence collection events, monitor alerts)                      | Control, Test, Evidence, Monitor, Asset, Personnel, Vendor, Framework, Policy, Risk, Audit, Connection, Compliance           |
| **Vanta**                 | S1     | A2       | ~8,000+ customers                           | REST (Vanta API — limited public surface). API key auth. Some endpoints in beta. Documentation improving but gaps remain in evidence and audit endpoints.                                    | Limited (webhook support for integration events and compliance status changes — not all entity types covered)           | Control, Test, Evidence, Integration, Vulnerability, Person, Resource, Policy, Framework, TrustReport, VendorReview          |
| **OneTrust**              | S2     | A2       | ~14,000+ customers (privacy + GRC combined) | REST (OneTrust API). Multiple API modules (Privacy, GRC, Consent, DSAR). No unified OpenAPI spec; separate documentation per module. OAuth 2.0.                                              | Limited (event-driven notifications for DSAR requests and assessment completions; not comprehensive across all modules) | Assessment, Risk, DataMap, PrivacyRight (DSAR), Consent, Policy, Vendor, Incident, Cookie, DataInventory, Framework, Control |
| **Archer (RSA / Archer)** | S2     | A2       | ~3,000+ enterprise customers                | REST (Archer REST API). Proprietary data model; entities are configured as "Applications" with custom fields. API documentation available but requires Archer expertise. Session-based auth. | No native webhooks (polling or Archer Data Feed for outbound integration)                                               | Record, Application, Field, Content, ValuesListValue, Control, Risk, Finding, Policy, Audit, Questionnaire                   |
| **LogicGate Risk Cloud**  | S1     | A2       | ~1,500+ customers                           | REST (LogicGate API v2). OpenAPI spec available. Modern API design with good documentation. API key auth.                                                                                    | Yes (webhook notifications for record creation, status changes, workflow step transitions)                              | Record, Workflow, Step, Field, Application, User, Attachment, Assessment, Finding                                            |
| **AuditBoard**            | S2     | A2       | ~2,000+ customers                           | REST (AuditBoard API — limited public documentation). API access requires enterprise tier. Partner-level documentation.                                                                      | Limited (notification events for audit status changes)                                                                  | Audit, Control, Risk, Issue, Finding, Framework, Workpaper, Evidence, Request                                                |

### Best OSS for Domain Extraction

| Project                        | Source | API Style                                                                                                                 | Key Entities                                                                                                             | Notes                                                                                                                                                                                                                             |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Eramba (Community Edition)** | S2     | REST (limited — Eramba API covers core entities but documentation is sparse). PHP-based. Docker deployment available.     | Risk, Control, Policy, CompliancePackage, Audit, Finding, Asset, ThirdParty, SecurityService, SecurityIncident, DataFlow | Most established open-source GRC platform. Community edition is feature-rich but API surface lags behind UI capabilities. Good reference for GRC entity relationships (risk-to-control-to-policy linkages).                       |
| **CISO Assistant**             | S1     | REST (Django REST Framework with auto-generated OpenAPI spec). Python-based. Docker-first deployment. Active development. | Framework, Control, Risk, Evidence, Compliance, Asset, Threat, Vulnerability, Policy, Audit, Project                     | Modern open-source GRC tool with strong API-first design. Clean entity model aligned with ISO 27001 and NIST frameworks. Excellent reference implementation for framework-to-control mapping patterns. Rapidly growing community. |

### Tier A3/A4 — Long-Tail Candidates

| Provider                         | Source | Adoption | Notes                                                                                                                                                                                                                                                |
| -------------------------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprinto**                      | S1     | A3       | Compliance automation platform (SOC 2, ISO 27001, GDPR). REST API with good documentation. ~2,000+ customers primarily in startup/SMB segment. Key entities: Control, Test, Evidence, Policy, CloudAccount. Strong in automated evidence collection. |
| **Secureframe**                  | S1     | A3       | SOC 2, ISO 27001, HIPAA, PCI DSS compliance automation. REST API available. ~1,500+ customers. Entities: Control, Test, Personnel, Repository, CloudResource, Vendor. Competes directly with Drata and Vanta.                                        |
| **Hyperproof**                   | S1     | A3       | Compliance operations platform. REST API with good documentation. ~1,000+ customers. Entities: Control, Program, Requirement, Label, Proof, Task, Risk. Strong in multi-framework mapping and evidence management.                                   |
| **Tugboat Logic (now OneTrust)** | S2     | A3       | Compliance automation platform acquired by OneTrust in 2022. REST API with limited documentation. Existing customers may still run standalone instances. Entities: Control, Policy, Evidence, Framework. Migration path to OneTrust GRC.             |
| **Scrut Automation**             | S1     | A4       | Indian-origin GRC platform. REST API available. Growing in APAC and startup segments. Entities: Control, Risk, Policy, Evidence, CloudAccount, Vendor. Competitive with Sprinto in the Indian market.                                                |
| **Thoropass (formerly Laika)**   | S2     | A4       | Compliance-as-a-service combining platform with auditor services. REST API with limited public documentation. ~500+ customers. Entities: Control, Evidence, Audit, Policy, Vendor. Differentiated by bundled audit services.                         |
| **Anecdotes.ai**                 | S2     | A4       | Compliance OS with automated evidence collection from SaaS tools. REST API in development. ~300+ customers. Entities: Control, Evidence, Plugin, Framework, Policy. Focus on evidence automation and compliance analytics.                           |

---

## Universal Entity Catalog

Every entity type observed across all Compliance & GRC providers, grouped by functional domain.

### Controls & Compliance

| Entity                    | Also Known As                              | Observed In                                        |
| ------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **Control**               | SecurityControl, Safeguard, Countermeasure | All providers                                      |
| **ControlTest**           | Test, Monitor, Check                       | ServiceNow, Drata, Vanta, Secureframe, Sprinto     |
| **Framework**             | Standard, Regulation, CompliancePackage    | All providers                                      |
| **ComplianceRequirement** | Obligation, Requirement, Criterion         | ServiceNow, Hyperproof, CISO Assistant, AuditBoard |
| **Indicator**             | KRI (Key Risk Indicator), ComplianceMetric | ServiceNow, LogicGate                              |
| **Exception**             | Exemption, Waiver, Deviation               | ServiceNow, Archer, AuditBoard                     |

### Risk Management

| Entity               | Also Known As                            | Observed In                                     |
| -------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Risk**             | RiskRegisterEntry, Threat                | All providers                                   |
| **RiskAssessment**   | Assessment, RiskEvaluation, RiskAnalysis | ServiceNow, OneTrust, Archer, LogicGate, Eramba |
| **VendorAssessment** | ThirdPartyRisk, VendorRisk, VendorReview | ServiceNow, Drata, Vanta, OneTrust, Eramba      |
| **Vulnerability**    | SecurityGap, Weakness                    | Vanta, CISO Assistant                           |
| **Threat**           | ThreatScenario, ThreatVector             | CISO Assistant, Eramba                          |

### Policy & Governance

| Entity            | Also Known As                                    | Observed In                 |
| ----------------- | ------------------------------------------------ | --------------------------- |
| **Policy**        | PolicyDocument, GovernancePolicy                 | All providers               |
| **Attestation**   | Acknowledgement, PolicyAcceptance, Certification | ServiceNow, Drata, Vanta    |
| **Consent**       | ConsentRecord, ConsentPreference                 | OneTrust                    |
| **Questionnaire** | Survey, AssessmentForm                           | Archer, OneTrust, LogicGate |

### Audit & Findings

| Entity              | Also Known As                                | Observed In                                           |
| ------------------- | -------------------------------------------- | ----------------------------------------------------- |
| **Audit**           | AuditEngagement, AuditProject, InternalAudit | ServiceNow, Drata, AuditBoard, Eramba, CISO Assistant |
| **Finding**         | Issue, Observation, NonConformity, Gap       | All providers                                         |
| **Evidence**        | Workpaper, Artifact, Proof, Attachment       | All providers                                         |
| **EvidenceRequest** | Request, InformationRequest, DataRequest     | AuditBoard, Hyperproof, Drata                         |
| **Remediation**     | CorrectiveAction, ActionPlan, ComplianceTask | ServiceNow, LogicGate, Hyperproof                     |

### Privacy (OneTrust-specific, but observed in GRC context)

| Entity           | Also Known As                                      | Observed In      |
| ---------------- | -------------------------------------------------- | ---------------- |
| **DataMap**      | DataInventory, DataFlow, ProcessingActivity        | OneTrust, Eramba |
| **PrivacyRight** | DSAR (Data Subject Access Request), SubjectRequest | OneTrust         |
| **Cookie**       | CookieConsent, TrackingTechnology                  | OneTrust         |

### Assets & People

| Entity               | Also Known As                              | Observed In                                   |
| -------------------- | ------------------------------------------ | --------------------------------------------- |
| **Asset**            | Resource, CloudAccount, Repository, System | Drata, Vanta, Eramba, CISO Assistant, Sprinto |
| **Personnel**        | Person, User, Employee                     | Drata, Vanta, Secureframe                     |
| **Vendor**           | ThirdParty, Supplier, ServiceProvider      | Drata, Vanta, OneTrust, Eramba, Sprinto       |
| **SecurityIncident** | Incident, Breach, SecurityEvent            | Eramba, OneTrust                              |
| **SecurityService**  | —                                          | Eramba                                        |

### Workflow & Configuration

| Entity          | Also Known As              | Observed In                   |
| --------------- | -------------------------- | ----------------------------- |
| **Workflow**    | Process, Pipeline          | LogicGate                     |
| **Step**        | WorkflowStep, Stage        | LogicGate                     |
| **Application** | Module, Programme, Program | Archer, LogicGate, Hyperproof |
| **Connection**  | Integration, Plugin        | Drata, Vanta, Anecdotes.ai    |
| **TrustReport** | TrustCenter, SecurityPage  | Vanta                         |
| **Project**     | Engagement, Initiative     | CISO Assistant, AuditBoard    |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. GRC entities are heavily domain-specific; most map to `ExternalObjectRef` with notable exceptions for documents, tickets, people, and assets.

| Universal Entity                   | VAOP Canonical Object | Canonical Role / Type | Notes                                                                                                                           |
| ---------------------------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Control / SecurityControl          | **ExternalObjectRef** | —                     | Controls are domain-specific definitions. VAOP orchestrates status updates and evidence linkage but does not own control logic. |
| Risk / RiskAssessment              | **ExternalObjectRef** | —                     | Risk registers are provider-specific. VAOP references risks for cross-system correlation.                                       |
| Policy / PolicyDocument            | **ExternalObjectRef** | —                     | Note: distinct from VAOP's own internal Policy aggregate. GRC policies are external governance documents.                       |
| Audit / AuditEngagement            | **ExternalObjectRef** | —                     | Audit lifecycle management remains in the GRC platform. VAOP orchestrates evidence collection.                                  |
| Finding / Issue / Exception        | **Ticket**            | `type: finding`       | Findings represent actionable items requiring remediation. Maps to Ticket for tracking and workflow.                            |
| Evidence / Workpaper / Artifact    | **Document**          | —                     | Evidence files (screenshots, exports, reports) map to Document for storage and retrieval.                                       |
| Framework / Standard / Regulation  | **ExternalObjectRef** | —                     | Framework definitions (SOC 2, ISO 27001, etc.) are reference data. VAOP queries but does not modify.                            |
| ComplianceRequirement / Obligation | **ExternalObjectRef** | —                     | Individual requirements within a framework. Too granular and provider-specific to normalise.                                    |
| VendorAssessment / ThirdPartyRisk  | **ExternalObjectRef** | —                     | Vendor risk evaluations. May cross-reference Procurement (Port 3) vendor records.                                               |
| Attestation / Certification        | **Document**          | `type: attestation`   | Signed attestations and compliance certificates are documents with provenance metadata.                                         |
| ControlTest / Monitor              | **ExternalObjectRef** | —                     | Automated control testing definitions. VAOP triggers tests but does not own test logic.                                         |
| Indicator / KRI                    | **ExternalObjectRef** | —                     | Key risk indicators. Metric-like entities referenced for risk dashboards.                                                       |
| DataMap / DataInventory            | **ExternalObjectRef** | —                     | Privacy-specific data mapping. May cross-reference IAM (Port 9) for system inventory.                                           |
| PrivacyRight / DSAR                | **Ticket**            | `type: dsar`          | Data subject access requests are actionable workflows. Maps to Ticket for lifecycle tracking.                                   |
| Consent / ConsentRecord            | **ExternalObjectRef** | —                     | Privacy consent records. High-volume; VAOP references but does not store consent streams.                                       |
| Vulnerability                      | **ExternalObjectRef** | —                     | Security vulnerabilities. May cross-reference Monitoring (Port 17) security signals.                                            |
| Questionnaire / Assessment         | **ExternalObjectRef** | —                     | Survey-style assessments. Provider-specific form definitions.                                                                   |
| Personnel / User                   | **Party**             | `role: employee`      | GRC platform users are employees. Merged with Party records from HRIS (Port 4) and IAM (Port 9).                                |
| Vendor / ThirdParty                | **Party**             | `role: vendor`        | Third-party vendors under assessment. Merged with Party records from Procurement (Port 3).                                      |
| Asset / Resource                   | **Asset**             | —                     | IT assets, cloud accounts, repositories under compliance scope. Maps to canonical Asset for cross-system inventory.             |
| SecurityIncident                   | **Ticket**            | `type: incident`      | Security incidents requiring investigation. May cross-reference Monitoring (Port 17) incidents.                                 |
| Remediation / CorrectiveAction     | **Task**              | —                     | Remediation work items. Maps to Task for tracking in project management tools.                                                  |
| Threat                             | **ExternalObjectRef** | —                     | Threat catalogue entries. Reference data used in risk assessment methodology.                                                   |

---

## Cross-Port References

| Related Port                     | Relationship                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Port 3: Procurement & Spend      | Vendor risk assessments reference vendors managed in procurement. Vendor onboarding may require GRC approval.                         |
| Port 4: HRIS & HCM               | Personnel records for policy attestation and control ownership. Employee lifecycle events affect compliance scope.                    |
| Port 7: Customer Support         | Compliance findings may generate support tickets. Customer-reported security incidents route through both ports.                      |
| Port 8: ITSM & IT Ops            | CMDB assets are the subjects of compliance controls. Change management feeds into SOC 2 change tracking.                              |
| Port 9: IAM & Directory          | Access reviews and user provisioning are core compliance controls. IAM data feeds into SOC 2 access control evidence.                 |
| Port 10: Secrets & Vaulting      | Secret rotation evidence supports compliance controls. Vault audit logs serve as evidence for key management requirements.            |
| Port 15: Documents & E-Signature | Policy documents and attestations may be stored and signed via the documents port. Evidence uploads cross-reference document storage. |
| Port 17: Monitoring & Incident   | Security monitoring alerts and incidents feed into GRC incident tracking. SLO compliance may be evidence for availability controls.   |

---

## Implementation Notes

1. **ServiceNow GRC table structure** — ServiceNow GRC uses the generic Table API (`/api/now/table/{tableName}`) with GRC-specific tables (`sn_compliance_policy`, `sn_risk_risk`, `sn_audit_engagement`, etc.). The adapter must maintain a mapping of table names to VAOP entity types. Field names are internal sys_names that differ from display labels; use the Table API's `sysparm_display_value=true` parameter for human-readable values.
2. **Framework version management** — Compliance frameworks (SOC 2 Type II, ISO 27001:2022, NIST CSF 2.0) are versioned and periodically updated. The adapter should track framework versions and support mapping controls to multiple framework versions simultaneously. Drata and Vanta handle this natively; ServiceNow and Archer require custom configuration.
3. **Evidence collection automation** — Drata, Vanta, and Sprinto offer automated evidence collection via native integrations with cloud providers (AWS, GCP, Azure), identity providers, and code repositories. The VAOP adapter should support both automated evidence (pulled from integrations) and manual evidence (uploaded via `uploadEvidence`). Evidence metadata should include collection timestamp, source system, and integrity hash.
4. **Archer's meta-model** — Archer uses a highly configurable meta-model where "Applications" define entity types and "Fields" define attributes. The standard GRC entities (Risk, Control, Policy) are pre-configured Applications, but customers extensively customise them. The adapter must introspect the Archer data model at connection time to dynamically map Applications to VAOP entity types.
5. **Multi-framework control mapping** — A single control often satisfies requirements across multiple frameworks (e.g., an access review control may satisfy SOC 2 CC6.1, ISO 27001 A.9.2.5, and NIST AC-2). The `mapControlToFramework` operation must support many-to-many relationships. Most providers store this natively, but the adapter should expose a unified view of all framework mappings per control.
6. **Privacy overlap** — OneTrust's GRC capabilities overlap with its privacy module (DSAR, consent, data mapping). The VAOP adapter should cleanly separate privacy operations (which may warrant a dedicated Privacy port in the future) from core GRC operations. For now, privacy entities are included as `ExternalObjectRef` in this port's scope.

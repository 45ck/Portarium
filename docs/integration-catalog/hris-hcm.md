# Port 4: HRIS & HCM — Integration Catalog

> Employee records, organisational structure, benefits administration, time & attendance.

---

## Port Operations

| Operation               | Description                                                                       | Idempotent | Webhook-Eligible |
| ----------------------- | --------------------------------------------------------------------------------- | ---------- | ---------------- |
| `listEmployees`         | Paginated list of employees with optional filters (status, department, location)  | Yes        | —                |
| `getEmployee`           | Retrieve a single employee record by ID                                           | Yes        | —                |
| `createEmployee`        | Create a new employee record (onboarding)                                         | No         | Yes              |
| `updateEmployee`        | Update mutable fields on an existing employee                                     | No         | Yes              |
| `terminateEmployee`     | Mark an employee as terminated with effective date and reason                     | No         | Yes              |
| `listDepartments`       | List all departments/organisational units                                         | Yes        | —                |
| `getDepartment`         | Retrieve a single department by ID                                                | Yes        | —                |
| `listJobPositions`      | List job titles, roles, and open positions                                        | Yes        | —                |
| `getTimeOff`            | Retrieve a specific time-off request by ID                                        | Yes        | —                |
| `requestTimeOff`        | Submit a new time-off / leave request                                             | No         | Yes              |
| `listBenefitEnrolments` | List benefit enrolments for an employee or company-wide                           | Yes        | —                |
| `getCompanyStructure`   | Retrieve the full organisational hierarchy (divisions, departments, cost centres) | Yes        | —                |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider     | Source | Adoption | Est. Customers                    | API Style                                                                                                          | Webhooks                                                           | Key Entities                                                                                                    |
| ------------ | ------ | -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Workday**  | S2     | A1       | ~10,000+ enterprise orgs          | SOAP (primary), REST (limited — Workday REST API v1). No official OpenAPI spec. Heavy rate-limiting on bulk reads. | Limited (Workday Integration Cloud via EIB / Studio)               | Worker, Position, Organization, Compensation, Benefit, TimeOff, JobProfile, Location, CostCenter, SecurityGroup |
| **BambooHR** | S1     | A1       | ~30,000+ SMB/mid-market customers | REST with published OpenAPI spec. Sandbox available for partners.                                                  | Yes (employee created/updated/terminated, time-off status changes) | Employee, Department, Division, Location, TimeOffRequest, BenefitPlan, JobInfo, EmploymentStatus, CustomField   |

### Tier A2 — Must-Support Providers (P1)

| Provider              | Source | Adoption | Est. Customers                                       | API Style                                                                                                                       | Webhooks                                               | Key Entities                                                                        |
| --------------------- | ------ | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **ADP Workforce Now** | S2     | A2       | ~800,000+ clients (global, includes payroll overlap) | REST (ADP API Central). OAuth 2.0 with certificate-based auth. No public OpenAPI spec; developer portal with Swagger-like docs. | Limited (event notification model via ADP Marketplace) | Worker, WorkAssignment, Organization, Pay, Benefits, TimeCard, Position, Department |
| **Gusto**             | S1     | A2       | ~300,000+ businesses (primarily US SMB)              | REST with OpenAPI spec. Full sandbox environment for partners.                                                                  | Yes (employee onboarded, terminated, updated)          | Employee, Company, Department, JobTitle, Benefit, TimeOff, Compensation, Location   |
| **Rippling**          | S1     | A2       | ~10,000+ businesses                                  | REST with published API docs. Unified platform (HRIS + IT + Payroll). Sandbox available.                                        | Yes (employee lifecycle events)                        | Employee, Department, WorkLocation, Compensation, CustomField, Role, Team           |
| **HiBob**             | S1     | A2       | ~4,000+ mid-market companies                         | REST with published OpenAPI spec. Sandbox available. Focus on mid-market / modern HRIS.                                         | Yes (employee changes, time-off updates)               | Employee, Department, Site, TimeOff, Lifecycle, PayCycle, CustomTable               |

### Best OSS for Domain Extraction

| Project               | Source | API Style                                                                                      | Key Entities                                                                        | Notes                                                                                                                                                  |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OrangeHRM**         | S2     | REST (limited coverage — v2 API covers ~60% of entities). PHP-based.                           | Employee, LeaveRequest, Attendance, JobTitle, Subunit, Nationality                  | Most widely deployed open-source HRIS (~5M+ users claimed). API surface is narrower than UI capabilities. Useful as a reference for SMB entity shapes. |
| **ERPNext HR module** | S1     | REST (Frappe API — full CRUD on all doctypes). Python-based. OpenAPI-like auto-generated docs. | Employee, Department, LeaveApplication, AttendanceRecord, PayrollEntry, Designation | Part of the broader ERPNext suite. Very complete REST surface. Good reference implementation for entity extraction. Active community.                  |

### Tier A3/A4 — Long-Tail Candidates

| Provider      | Source | Adoption | Notes                                                                                                                                         |
| ------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Paylocity** | S2     | A3       | Enterprise HCM focused on US mid-market (~36k clients). REST API available via partner programme. Entities overlap heavily with payroll port. |
| **Paycom**    | S2     | A3       | US enterprise HCM/payroll. Key entities: Employee, Department, JobCode. API access restricted to partners.                                    |
| **Personio**  | S1     | A3       | EU-focused HRIS (Germany HQ). Strong REST API with OpenAPI spec. ~10k EU customers. Good candidate for EU-first deployments.                  |
| **Namely**    | S2     | A4       | Mid-market US HRIS. REST API with limited documentation. Company has faced financial instability; evaluate viability before building adapter. |
| **Keka**      | S2     | A4       | India-focused HRIS/payroll. Growing regional player (~10k+ Indian businesses). API is REST but documentation is sparse.                       |
| **ZingHR**    | S3     | A4       | India-focused HCM. Community SDK only; no official public API documentation. Evaluate ROI carefully before investing in adapter.              |

---

## Universal Entity Catalog

Every entity type observed across all HRIS/HCM providers, grouped by functional domain.

### Core Employee Record

| Entity               | Also Known As                                  | Observed In                          |
| -------------------- | ---------------------------------------------- | ------------------------------------ |
| **Employee**         | Worker, Person, Staff, TeamMember              | All providers                        |
| **EmploymentStatus** | WorkerStatus, EmployeeStatus, LifecycleStatus  | Workday, BambooHR, ADP, Gusto, HiBob |
| **CustomField**      | CustomTable, AdditionalField, UserDefinedField | BambooHR, Rippling, HiBob, Personio  |
| **EmergencyContact** | EmergencyPerson, NextOfKin                     | BambooHR, Gusto, ADP, Workday        |
| **Termination**      | Separation, Offboarding, EndOfEmployment       | All providers (as event or entity)   |

### Organisation Structure

| Entity           | Also Known As                        | Observed In                  |
| ---------------- | ------------------------------------ | ---------------------------- |
| **Department**   | Subunit, Team, BusinessUnit, OrgUnit | All providers                |
| **Division**     | Segment, Group                       | BambooHR, Workday, ADP       |
| **Location**     | Site, WorkLocation, Office, Address  | All providers                |
| **Organization** | Company, LegalEntity, Employer       | Workday, ADP, Gusto, ERPNext |
| **CostCenter**   | CostCentre, FinancialUnit            | Workday, ADP, Paylocity      |

### Job & Position

| Entity            | Also Known As                      | Observed In             |
| ----------------- | ---------------------------------- | ----------------------- |
| **JobTitle**      | JobProfile, Designation, Role      | All providers           |
| **Position**      | WorkAssignment, JobAssignment      | Workday, ADP, Paylocity |
| **SecurityGroup** | Role, PermissionGroup, AccessLevel | Workday, Rippling       |

### Compensation & Benefits

| Entity           | Also Known As                                  | Observed In                             |
| ---------------- | ---------------------------------------------- | --------------------------------------- |
| **Compensation** | Pay, Salary, CompensationPlan, PayRate         | Workday, BambooHR, ADP, Gusto, Rippling |
| **Benefit**      | BenefitPlan, BenefitEnrolment, BenefitElection | Workday, BambooHR, ADP, Gusto           |

### Time & Attendance

| Entity             | Also Known As                                       | Observed In                      |
| ------------------ | --------------------------------------------------- | -------------------------------- |
| **TimeOffRequest** | LeaveRequest, LeaveApplication, PTO, AbsenceRequest | All providers                    |
| **Attendance**     | TimeCard, ClockEntry, TimesheetEntry                | ADP, OrangeHRM, ERPNext, Workday |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. Entities too domain-specific for a canonical object are referenced via `ExternalObjectRef`, which provides a first-class deep link back to the SoR.

| Universal Entity       | VAOP Canonical Object | Canonical Role / Type | Notes                                                                                          |
| ---------------------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Employee / Worker      | **Party**             | `role: employee`      | Core identity. Merged with other Party roles when the same person exists in CRM, payroll, etc. |
| Organization / Company | **Party**             | `role: org`           | The employing legal entity.                                                                    |
| EmergencyContact       | **Party**             | `role: contact`       | Linked to the employee Party via relationship.                                                 |
| Department             | **ExternalObjectRef** | —                     | Too HRIS-specific to normalise. Deep-linked to SoR.                                            |
| Division               | **ExternalObjectRef** | —                     | Organisational grouping; varies too widely across providers.                                   |
| Location / Site        | **ExternalObjectRef** | —                     | Physical or virtual work location.                                                             |
| JobTitle / Position    | **ExternalObjectRef** | —                     | Job classification; no universal schema exists.                                                |
| CostCenter             | **ExternalObjectRef** | —                     | Financial allocation unit. May cross-reference finance port.                                   |
| SecurityGroup / Role   | **ExternalObjectRef** | —                     | Access control grouping within the HRIS.                                                       |
| Compensation / Pay     | **ExternalObjectRef** | —                     | Salary and pay rate structures. Links to payroll port entities.                                |
| Benefit / BenefitPlan  | **Subscription**      | —                     | Benefit enrolments modelled as subscriptions with start/end dates and plan references.         |
| TimeOffRequest / Leave | **ExternalObjectRef** | —                     | Leave requests and balances.                                                                   |
| Attendance / TimeCard  | **ExternalObjectRef** | —                     | Clock-in/out and attendance records.                                                           |
| EmploymentStatus       | **ExternalObjectRef** | —                     | Active, terminated, on-leave — tracked as metadata on the Party.                               |
| Termination            | **ExternalObjectRef** | —                     | Separation event with date and reason. Triggers `terminateEmployee` operation.                 |
| CustomField            | **ExternalObjectRef** | —                     | Provider-specific custom fields preserved as opaque key-value pairs.                           |

---

## Sync Strategy Considerations

| Strategy                     | When to Use                                                                 | Providers                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Full sync (initial)**      | First-time connection; rebuilding cache after corruption                    | All providers — use bulk/directory endpoints where available (BambooHR `/employees/directory`, ADP Worker bulk read)                                       |
| **Incremental sync (delta)** | Ongoing synchronisation; detect changes since last sync timestamp           | BambooHR (Last-Modified header), Gusto (updated_since param), Workday (effective-dated queries), Rippling (cursor-based pagination with updated_at filter) |
| **Webhook-driven**           | Real-time updates for high-priority events (hire, terminate, status change) | BambooHR, Gusto, Rippling, HiBob — all support employee lifecycle webhooks                                                                                 |
| **Polling fallback**         | Providers without webhooks or when webhook delivery is unreliable           | Workday (EIB scheduled exports), ADP (poll event notification queue), Paylocity, Paycom                                                                    |

### Recommended Sync Cadence

- **Employee roster**: Every 15 minutes (incremental) or real-time via webhook
- **Department / org structure**: Every 6 hours (changes infrequently)
- **Time-off requests**: Every 30 minutes or real-time via webhook
- **Benefit enrolments**: Daily (typically batch-updated during open enrolment periods)
- **Compensation changes**: Daily (effective-dated; often processed in batches)

---

## Cross-Port References

| Related Port                        | Relationship                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Port 5: Payroll                     | Employee/Worker identity is shared. Compensation flows into payroll calculations.            |
| Port 9: IAM & Directory             | Employee lifecycle events (hire, terminate) should trigger user provisioning/deprovisioning. |
| Port 1: Finance & Accounting        | CostCenter and Department may map to GL segments in the finance system.                      |
| Port 14: Projects & Work Management | Employee records may link to resource assignments in project management tools.               |

---

## Implementation Notes

1. **Workday complexity** — Workday's SOAP-first API (Human Resources WSDL) requires special handling. The REST API (v1) covers only a subset of entities. Plan for a hybrid adapter that uses SOAP for full coverage and REST where available.
2. **BambooHR rate limits** — BambooHR enforces per-company API rate limits. Implement exponential backoff and consider bulk endpoints (`/employees/directory`) for initial sync.
3. **ADP authentication** — ADP uses certificate-based OAuth 2.0 (two-legged). The adapter must manage X.509 certificates and rotate them before expiry.
4. **Custom fields** — Most HRIS providers support custom fields extensively. The adapter should preserve these as opaque `ExternalObjectRef` payloads with provider-specific metadata, allowing downstream consumers to interpret them.
5. **Employee ID reconciliation** — Employees often exist across multiple SoRs (HRIS, payroll, IAM). The Party canonical object with `role: employee` enables cross-system identity merging via VAOP's identity resolution.
6. **Effective dating** — Many HRIS providers use effective-dated records (especially Workday and ADP). A compensation change scheduled for a future date must not overwrite the current record. The adapter should respect effective dates and expose them as metadata on `ExternalObjectRef` payloads, allowing VAOP orchestration to handle time-based transitions.
7. **Termination workflows** — `terminateEmployee` triggers downstream effects across multiple ports (IAM deprovisioning, payroll final pay run, benefit cancellation). The adapter must emit a `EmployeeTerminated` domain event that VAOP's workflow engine can route to dependent ports.
8. **Data residency** — EU-focused providers like Personio and HiBob enforce GDPR-compliant data residency. The adapter must respect data residency requirements and avoid transferring employee PII to non-compliant regions. Consider per-tenant configuration for data routing.

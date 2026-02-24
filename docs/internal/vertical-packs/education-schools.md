# Education (Schools) Vertical Pack

> Pack ID: `edu-schools` | Namespace: `edu.*` | Status: First vertical (design phase)

This document is the comprehensive reference for the Portarium education vertical pack targeting K-12 and K-10 school environments. It covers interoperability standards, entity models, connector requirements, workflow templates, regulatory constraints, and sample UI templates.

---

## Standards and Interoperability Anchors

The education sector has mature interoperability standards. The `edu-schools` pack aligns to these standards rather than inventing proprietary schemas, enabling conformance testing (ADR-051) and credible market positioning.

### OneRoster 1.2 (IMS Global / 1EdTech)

OneRoster is the dominant standard for SIS-to-LMS data exchange in K-12 education.

- **Purpose**: Rostering, enrolment, demographics, course/class structures, results.
- **Transport**: CSV file exchange (bulk) and REST API (realtime).
- **Roles**: Provider (typically SIS), Consumer (typically LMS), Aggregator (intermediary).
- **Key entities**: `org`, `academicSession`, `course`, `class`, `user`, `enrollment`, `lineItem`, `result`, `category`.
- **Portarium relevance**: The `edu-schools` pack implements OneRoster entity mappings as connector mapping definitions. The pack's conformance test suite validates against the OneRoster 1.2 conformance certification requirements.

### LTI 1.3 / LTI Advantage (1EdTech)

LTI (Learning Tools Interoperability) governs secure tool launches and data exchange between platforms and learning tools.

- **LTI 1.3**: OAuth 2.0-based security model with JWT; replaces LTI 1.1 OAuth 1.0a signatures.
- **LTI Advantage services**:
  - **Assignment and Grade Services (AGS)**: Grade passback from tool to platform.
  - **Names and Role Provisioning Services (NRPS)**: Membership/roster queries from tool to platform.
  - **Deep Linking**: Content item selection and embedding.
- **Portarium relevance**: The connector mapping handles OAuth 2.0 client credentials flow, JWT message signing, and platform-tool registration. Workflow templates cover tool onboarding, launch validation, and grade passback reconciliation.

### Ed-Fi (Ed-Fi Alliance)

Ed-Fi provides a comprehensive data standard and ODS/API for US education data.

- **ODS (Operational Data Store)**: Centralised data repository with a REST API.
- **Descriptor namespaces**: Extensible controlled vocabularies (e.g., `uri://ed-fi.org/GradeLevelDescriptor`).
- **Version matrices**: Ed-Fi Data Standard versions (v3.x, v4.x) with API specification versions.
- **Portarium relevance**: The descriptor mapping subsystem (ADR-046) mirrors Ed-Fi's namespace approach. Pack schema extensions reference Ed-Fi data elements where applicable, and connector mappings translate between Portarium's namespaced fields and Ed-Fi ODS endpoints.

### SIF (A4L -- Access 4 Learning Community)

SIF (Schools Interoperability Framework) provides an XML-based data model for education data exchange, widely adopted in Australia and used internationally.

- **Data model**: Comprehensive entity definitions for students, staff, schools, attendance, timetabling, assessments.
- **Portarium relevance**: SIF entity definitions inform the `edu-schools` schema design, particularly for Australian school deployments. SIF infrastructure (ZIS/agents) is not directly implemented but mapping definitions support SIF data model alignment.

### CEDS (Common Education Data Standards)

CEDS provides a US federal reference for common education data elements across early learning, K-12, and postsecondary.

- **Portarium relevance**: CEDS element definitions are used to validate completeness of the `edu-schools` entity model and to provide interoperability anchors for US deployments.

---

## Common Entities

The following entities represent the core domain objects in a school environment.

| Entity                               | Description                                            | Key Attributes                                                              |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Student                              | A learner enrolled at one or more organisations        | Demographics, grade level, enrolment status, identifiers (state ID, SIS ID) |
| Staff                                | Teaching and administrative personnel                  | Role (teacher, admin, aide), qualifications, employment status              |
| Guardian / Contact                   | Parent, carer, or emergency contact linked to students | Relationship type, contact priority, communication preferences              |
| Organisation                         | School, campus, department, or district                | Type, address, governance level, academic calendar                          |
| Academic Catalogue                   | Course, subject, curriculum, learning area             | Curriculum framework, grade levels, credit value                            |
| Roster / Enrolment                   | Student-to-class or student-to-school membership       | Role (student/teacher), status, start/end dates, section                    |
| Attendance                           | Daily or period-level attendance records               | Status (present/absent/tardy/excused), date, period, reason                 |
| Assessment / Grades                  | Formative and summative assessment results             | Score, grade, scale, assessment type, date, standard alignment              |
| Behaviour / Wellbeing / Safeguarding | Incident records, wellbeing notes, safeguarding alerts | Category, severity, actions taken, follow-up status                         |
| Communications                       | Messages, notifications, letters to families           | Channel, recipient list, template, delivery status                          |
| Fees / Payments                      | School fees, excursion charges, resource levies        | Amount, due date, payment status, category                                  |

---

## Entity Mapping to Portarium Core Extension Points

Each education entity maps to a Portarium core extension point plus a namespaced education profile. This follows the schema extension mechanism defined in ADR-046.

| Education Entity      | Core Extension Point         | Pack Extension         | Notes                                                                         |
| --------------------- | ---------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| Student               | `core.person`                | `edu.student_profile`  | Extends Person with grade level, enrolment status, state IDs, demographics    |
| Staff                 | `core.person`                | `edu.staff_profile`    | Extends Person with role classification, qualifications, teaching assignments |
| Guardian / Contact    | `core.person`                | `edu.guardian_profile` | Extends Person with relationship links to students, contact priority          |
| Organisation (school) | `core.organisation`          | `edu.school_profile`   | Extends Organisation with school type, sector, governance, ACARA ID           |
| Course / Section      | `core.organisation_unit`     | `edu.academic_unit`    | Extends OrganisationUnit with curriculum framework, grade band, credit value  |
| Enrolment             | `core.relationship`          | `edu.enrolment`        | Extends Relationship with enrolment type, FTE, year level, entry/exit codes   |
| Attendance            | `core.event`                 | `edu.attendance_event` | Extends Event with attendance status, period, reason code, reporting flags    |
| Assessment / Grades   | `core.record`                | `edu.assessment`       | Extends Record with score, scale, assessment type, standard alignment         |
| Behaviour / Wellbeing | `core.record`                | `edu.wellbeing_record` | Extends Record with category, severity, safeguarding flags, follow-up chain   |
| Consent               | `core.policy_object`         | `edu.consent_record`   | Extends PolicyObject with consent type, scope, expiry, guardian signatory     |
| Fee / Payment         | `core.financial_transaction` | `edu.fee_payment`      | Extends FinancialTransaction with fee category, student link, term            |
| Communication         | `core.record`                | `edu.communication`    | Extends Record with channel, recipient list, template reference, delivery log |

---

## Required Connectors

The following connectors are required for the `edu-schools` pack to integrate with common school Systems of Record.

| Connector           | Protocol            | Auth Model                                      | Key Operations                                                   | Vendor API Quality                      |
| ------------------- | ------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| OneRoster CSV       | CSV file exchange   | N/A (file-based)                                | Bulk roster import/export, enrolment sync                        | S2 -- standard format, no realtime      |
| OneRoster REST      | REST API            | OAuth 2.0 client credentials                    | Realtime roster queries, delta sync                              | S1 -- 1EdTech conformance certified     |
| LTI 1.3             | OAuth 2.0 + JWT     | Platform-tool registration, JWT message signing | Tool launch, grade passback, NRPS membership                     | S1 -- 1EdTech certified                 |
| Canvas REST API     | REST                | OAuth 2.0 bearer token                          | Courses, sections, enrollments, assignments, submissions, grades | S1 -- OpenAPI spec, sandbox, webhooks   |
| Moodle Web Services | REST (XML-RPC/REST) | Token-based (API key)                           | Courses, users, enrolments, grades, assignments                  | S2 -- documented but no OpenAPI spec    |
| Google Classroom    | REST API            | OAuth 2.0 (Google Workspace)                    | Courses, rosters, coursework, submissions                        | S1 -- Google API discovery doc, sandbox |

---

## Key Workflows

### 1. Rostering Sync (SIS to LMS)

The primary data flow in school environments: student and staff roster data flows from the Student Information System (SIS) to Learning Management Systems (LMS).

- **Trigger**: Scheduled (nightly) or event-driven (enrolment change in SIS).
- **Steps**: Extract roster from SIS (OneRoster provider) -> Validate against `edu.enrolment` schema -> Apply descriptor mappings (grade levels, roles) -> Policy gate (auto for roster sync, human-approve for new school onboarding) -> Transform to target LMS format -> Connector sync to each enabled LMS (Canvas, Moodle, Google Classroom) -> Capture evidence (records synced, delta summary, errors).
- **Rollback**: Compensation workflow to reverse sync if errors detected within window.

### 2. Tool Launch and Grade Passback

LTI tool lifecycle: from platform launch to grade return.

- **Trigger**: Teacher initiates tool launch or tool submits grade.
- **Steps**: Validate LTI JWT -> Resolve tool registration -> Launch with context (course, user, roles via NRPS) -> Tool captures grade -> Grade passback via AGS -> Validate grade against `edu.assessment` schema -> Record evidence.

### 3. Data Governance and Descriptor Mapping

Controlled vocabulary alignment across systems.

- **Trigger**: Pack enablement or descriptor update.
- **Steps**: Load source descriptors (Ed-Fi namespace, SIF codes, vendor values) -> Map to `edu.*` namespaced descriptors -> Validate completeness -> Store mapping ruleset -> Apply to connector mappings.

### 4. Identity Lifecycle

Student and staff identity management across connected systems.

- **Trigger**: New enrolment, transfer, exit, or role change.
- **Steps**: Receive identity event -> Validate against `edu.student_profile` or `edu.staff_profile` -> Policy gate (human-approve for new accounts, auto for updates) -> Provision/update/deprovision across connected SoRs -> Capture evidence.

---

## Sample Workflow Templates

### Student Enrolment Change Request

```
Workflow: edu.enrolment_change_request
Trigger:  manual (staff submits form) or event (SIS enrolment update)

Steps:
  1. Validate enrolment change against edu.enrolment schema
  2. Check policy: requires_approval if change_type in [transfer, withdrawal, new_enrolment]
  3. If approval required:
     a. Route to approval queue (school admin role)
     b. Attach evidence: current enrolment record, proposed change, student profile
     c. Wait for approval decision
  4. On approval:
     a. Transform to target SoR format (SIS, LMS)
     b. Sync enrolment change to SIS via OneRoster connector
     c. Trigger downstream rostering sync to LMS connectors
     d. Capture evidence: before/after state, approval record, sync results
  5. On denial:
     a. Log denial reason
     b. Notify requesting staff member
```

### Excursion / Consent Management

```
Workflow: edu.excursion_consent
Trigger:  manual (staff creates excursion event)

Steps:
  1. Create excursion event with edu.consent_record requirements
  2. Generate consent forms from UI template (excursion details, risk assessment)
  3. Distribute to guardians via edu.communication (email/portal)
  4. Collect consent responses:
     a. Track per-student consent status (granted/denied/pending)
     b. Store signed consent as evidence artefact
  5. Policy gate: excursion proceeds only if minimum consent threshold met
  6. On threshold met:
     a. Generate attendee list
     b. Notify staff with final roster and outstanding consents
     c. Capture evidence: consent summary, risk assessment, attendee list
```

### Attendance Anomaly Workflow

```
Workflow: edu.attendance_anomaly
Trigger:  scheduled (daily analysis) or event (attendance threshold breached)

Steps:
  1. Aggregate attendance data from edu.attendance_event records
  2. Apply anomaly rules (consecutive absences, pattern detection, threshold breach)
  3. If anomaly detected:
     a. Create wellbeing record (edu.wellbeing_record)
     b. Route notification to pastoral care / wellbeing staff
     c. If safeguarding threshold met: escalate to designated safeguarding lead
  4. Track follow-up actions
  5. Capture evidence: anomaly detection criteria, student attendance history, actions taken
```

### Behaviour Incident Workflow

```
Workflow: edu.behaviour_incident
Trigger:  manual (staff logs incident)

Steps:
  1. Validate incident against edu.wellbeing_record schema
  2. Classify severity (minor/moderate/major/critical)
  3. Policy gate:
     a. Minor/moderate: auto-route to year-level coordinator
     b. Major: route to school leadership approval queue
     c. Critical/safeguarding: immediate escalation to safeguarding lead
  4. Notify relevant parties (guardian notification for moderate+)
  5. Track follow-up actions and resolution
  6. Capture evidence: incident record, actions, communications, resolution
```

### Tool Onboarding Workflow

```
Workflow: edu.tool_onboarding
Trigger:  manual (admin requests new LTI tool)

Steps:
  1. Validate tool registration details (LTI 1.3 platform-tool config)
  2. Policy gate: human-approve (IT admin + data governance officer)
  3. Review: data sharing scope, privacy impact, age-appropriateness
  4. On approval:
     a. Register tool in LTI connector (client ID, deployment ID, keys)
     b. Configure grade passback and NRPS scopes
     c. Enable tool in UI template for relevant courses
     d. Capture evidence: tool registration, privacy review, approval record
  5. On denial:
     a. Log denial reason and privacy concerns
     b. Notify requesting teacher
```

---

## Regulatory Constraints

The education vertical operates under significant regulatory requirements for child data protection. Portarium implements these as **configurable compliance profiles** (ADR-053), not hard-coded rules, enabling multi-jurisdiction deployments.

### Compliance Profiles

| Regulation                                        | Jurisdiction   | Key Requirements                                                                                   | Portarium Compliance Profile |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| UK Children's Code (Age Appropriate Design Code)  | United Kingdom | Data minimisation for under-18s, default high privacy settings, no profiling, transparency         | `edu.uk-childrens-code`      |
| GDPR Article 8 (Child Consent)                    | European Union | Parental consent for under-16 (or lower per member state), right to erasure, data portability      | `edu.gdpr-child-consent`     |
| FERPA (Family Educational Rights and Privacy Act) | United States  | Parental consent for disclosure, directory information exceptions, legitimate educational interest | `edu.ferpa`                  |
| Australian Privacy Principles (APPs)              | Australia      | Collection limitation, use/disclosure restrictions, data quality, access/correction rights         | `edu.au-privacy-principles`  |

### Implementation Approach

- **Consent management**: The `edu.consent_record` entity and excursion/consent workflows provide auditable consent capture and tracking.
- **Data minimisation**: Schema extensions declare purpose and retention for each field; the core retention engine (ADR-028) enforces lifecycle rules.
- **Age-appropriate defaults**: Default policy configurations for education tenants enforce high-privacy settings; relaxation requires explicit human approval.
- **Audit trail**: All data access, sharing, and consent decisions are recorded in the tamper-evident evidence log.
- **Data subject rights**: Workflows for access requests, correction, and erasure are provided as pack templates configurable per jurisdiction.

---

## Sample UI Template

The following ASCII mockup illustrates a schema-driven student enrolment change form generated from the `edu.enrolment_change_request` UI template. The form references `edu.*` schema fields and includes evidence upload and approval chain display.

```
+------------------------------------------------------------------------+
|  Portarium > Education > Enrolment Change Request                      |
+------------------------------------------------------------------------+
|                                                                        |
|  Student:  [  Search student by name or ID...        ] [v]             |
|                                                                        |
|  Current Enrolment                                                     |
|  +------------------------------------------------------------------+  |
|  | School:        Westfield Primary School                          |  |
|  | Year Level:    Year 6                                            |  |
|  | Class:         6B - Ms Thompson                                  |  |
|  | Status:        Active | Enrolled: 2024-01-29                     |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  Change Type:  ( ) Transfer   ( ) Withdrawal   ( ) Year Level Change   |
|                ( ) Class Change   ( ) Status Update                     |
|                                                                        |
|  Effective Date:  [ 2026-04-01    ] [calendar]                         |
|                                                                        |
|  +--- Transfer Details (shown if Transfer selected) ----------------+  |
|  | Destination School:  [  Search or enter school...  ] [v]         |  |
|  | Destination Year:    [  Year 7                     ] [v]         |  |
|  | Transfer Reason:     [  Family relocation          ] [v]         |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  Supporting Evidence                                                   |
|  +------------------------------------------------------------------+  |
|  | [+ Upload Document]  Accepted: PDF, JPG, PNG (max 10 MB)        |  |
|  |                                                                  |  |
|  |  [ ] transfer_letter_signed.pdf    (uploaded 2026-02-15)         |  |
|  |  [ ] parent_consent_form.pdf       (uploaded 2026-02-15)         |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  Notes:  +----------------------------------------------------------+  |
|          | Family relocating to northern suburbs. Student has been  |  |
|          | offered a place at Northgate High School starting Term 2.|  |
|          +----------------------------------------------------------+  |
|                                                                        |
|  Approval Chain                                                        |
|  +------------------------------------------------------------------+  |
|  |  Step 1: Year Level Coordinator    [ ] Pending                   |  |
|  |  Step 2: School Administration     [ ] Pending                   |  |
|  |  Step 3: Receiving School Confirm   [ ] Pending                  |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
|  [ Cancel ]                                      [ Submit for Review ] |
|                                                                        |
+------------------------------------------------------------------------+
```

**Template notes**:

- The student search field resolves against `edu.student_profile` entities.
- The change type radio group is driven by the `edu.enrolment.change_type` descriptor.
- Transfer details are conditionally displayed based on change type selection.
- The evidence upload section stores files as immutable evidence artefacts linked to the workflow instance.
- The approval chain is rendered from the workflow definition's approval gate configuration and updates in realtime as approvals are granted.
- Field visibility is controlled by role-based layout rules: administrative staff see all fields; teachers see a read-only summary after submission.

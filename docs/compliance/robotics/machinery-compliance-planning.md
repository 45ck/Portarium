# Robotics Machinery Compliance Planning (Signposting)

> Scope note: this document is operational planning guidance for Portarium teams and is **not legal advice**.

## Purpose and Boundary

This plan defines how Portarium delivery teams track machinery-related compliance work for robotics integrations.

- Portarium control plane boundary: policy, approval, evidence, audit, and integration orchestration.
- Edge safety boundary: machine-safe control loops, emergency stop hardware paths, and certified runtime safety functions.
- Reference decision: safety-critical execution remains outside Portarium's automation core; Portarium governs approvals and evidence around those actions.

## Standards Work Plan

### ISO 12100 (risk assessment and risk reduction)

Apply a repeatable cycle per robot class, site profile, and mission template:

1. Define intended use and reasonably foreseeable misuse.
2. Identify hazards across lifecycle stages (setup, operation, maintenance, decommissioning).
3. Estimate and evaluate risk (severity, frequency/exposure, possibility of avoidance).
4. Apply three-step method:
   - inherently safe design measures,
   - safeguarding and protective measures,
   - information for use (procedures, warnings, training).
5. Record residual risk acceptance and required organizational controls.

Required outputs:

- Hazard log with risk ratings and control mapping.
- Residual risk register with owner and due date.
- Traceability from hazard controls to workflow policy tiers and approval gates.

### ISO 10218-1 / ISO 10218-2 checklist

- Robot/system design controls mapped to safety requirements.
- Guarding, stop functions, restart behavior, and mode selection documented.
- Installation/integration validation plan completed for each deployment topology.
- Verification evidence package defined (test protocol, pass/fail criteria, records).

### ISO/TS 15066 (collaborative operations) checklist

- Collaborative operation mode identified and justified.
- Separation monitoring assumptions documented.
- Speed/force/contact assumptions captured with test method references.
- Human-robot shared-space constraints linked to policy tiering and approvals.

### ISO 13849-1 (SRP/CS scope) checklist

- Safety-related control functions inventory created.
- Required PLr assigned per function.
- Architecture/category assumptions documented.
- Diagnostic coverage/common-cause assumptions captured.
- Validation evidence owners assigned for implementation-side teams.

## Jurisdiction Signposting Timeline

### European Union

- Regulation: EU Machinery Regulation (EU) 2023/1230.
- Planning milestone: ensure conformity package and technical documentation are updated before applicability.
- Applicability date: **January 20, 2027**.

### United Kingdom

- Baseline framework: Supply of Machinery (Safety) Regulations 2008 (as retained/amended).
- Planning milestone: maintain UKCA compliance mapping for applicable machine/system categories.

### United States

- Regulatory baseline: OSHA machinery/workplace safety obligations (federal and state where applicable).
- Consensus standard signpost: ANSI/RIA R15.06 for industrial robots and robot systems.
- Planning milestone: align deployment validation evidence with OSHA-facing inspection readiness.

## Delivery Milestones

1. Compliance inventory baseline (standards clauses, system scope, owners).
2. Hazard and control mapping complete (ISO 12100 + ISO 13849-1 function inventory).
3. Collaborative operation review complete where applicable (ISO/TS 15066).
4. Country package readiness check (EU/UK/US evidence bundle and gaps).
5. Pre-release compliance review gate for robotics-enabled workflows.

## RACI Matrix

Roles:

- Product: Product Owner
- Safety: Safety Engineer
- Controls: Controls/Robotics Engineer
- Governance: Compliance Lead
- Security: Security Lead
- Legal: Legal Counsel
- QA: QA Lead
- Ops: Site Operations Lead

| Work Item                                                   | Product | Safety | Controls | Governance | Security | Legal | QA  | Ops |
| ----------------------------------------------------------- | ------- | ------ | -------- | ---------- | -------- | ----- | --- | --- |
| ISO 12100 hazard identification and risk evaluation         | C       | A/R    | R        | C          | I        | C     | C   | C   |
| ISO 10218-1/-2 system checklist and evidence plan           | I       | A      | R        | C          | C        | I     | R   | C   |
| ISO/TS 15066 collaborative operation assessment             | I       | A/R    | R        | C          | C        | I     | C   | C   |
| ISO 13849-1 SRP/CS function mapping and validation plan     | I       | A      | R        | C          | C        | I     | C   | C   |
| EU/UK/US jurisdiction compliance signposting updates        | I       | C      | I        | A/R        | I        | C     | I   | I   |
| Policy-tier and approval-gate mapping for hazardous actions | C       | A      | R        | R          | C        | I     | C   | C   |
| Evidence package and audit-readiness review                 | I       | C      | C        | A          | C        | C     | R   | C   |
| Final release compliance gate decision                      | A       | C      | C        | R          | C        | C     | C   | C   |

## Evidence Package Minimum

Each robotics deployment slice should produce:

- Standards clause mapping matrix.
- Hazard log and residual risk register.
- Validation protocol and signed test records.
- Policy-tier mapping for hazardous operations.
- Approval/evidence trace samples demonstrating governance controls.

## Review Cadence

- Monthly compliance working session for open gaps.
- Release-gate review for any robotics capability entering production scope.
- Triggered review on material changes to robot class, site risk profile, or applicable regulation.

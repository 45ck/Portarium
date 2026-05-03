# Run Charter v1

## Purpose

A Run Charter is the versioned delegated-authority contract attached to a
governed Run. It lets normal work proceed without redundant Approval Gates only
when the active charter, Policy, and budget controls all permit the Action.

## Schema

`RunCharterV1` contains:

- `schemaVersion`: `1`
- `charterId`: stable identifier for the immutable charter version
- `version`: monotonically increasing charter version for the Run
- `goal`: intended Run outcome
- `successCondition`: measurable condition for completion
- `scopeBoundary`: plain-language boundary for what is in and out of scope
- `allowedActionClasses`: Action classes the Run may consider
- `blockedActionClasses`: Action classes the Run must not execute locally
- `budgetCaps`: hard caps for model spend, tool calls, outbound Actions, and
  Approval requests
- `timeWindow`: start and end timestamps for delegated authority
- `evidenceDepth`: `minimal`, `standard`, `deep`, or `forensic`
- `escalationTriggers`: typed exception triggers and next-step options
- `decisionBoundary`: explicit split between local decisions, Approval Gates,
  and Run interventions
- `sourceLayers`: platform, Tenant, Workspace, role/queue, and Run Charter
  layers used to expand the effective charter
- `expandedAtIso`: expansion timestamp
- `expansionEvidenceHashSha256?`: optional hash of immutable expansion evidence

## Authority Boundary

The charter must distinguish:

- `localDecisionActionClasses`: allowed Action classes that may proceed without
  an Approval Gate when Policy and budgets also allow them
- `approvalGateActionClasses`: Action classes that must create or reuse an
  Approval Gate
- `interventionActionClasses`: Action classes that require operator
  intervention before continuing

Allowed but unclassified Action classes fail closed to an Approval Gate.
Blocked or intervention-scoped Action classes require Run intervention.

## Expansion Rules

Charters are expanded from:

`PlatformBaseline -> Tenant -> Workspace -> RoleOrQueue -> RunCharter`

Lower layers may tighten authority. They must not silently weaken higher
constraints. The expansion records blocked weakening attempts for:

- adding allowed Action classes outside a higher layer
- removing blocked Action classes
- raising budget caps
- widening time windows
- reducing evidence depth
- moving Approval Gate or intervention classes into local decisions

## Evidence

Every expansion produces append-only evidence containing the charter hash,
source layers, field-level diffs, blocked weakening attempts, and a
Cockpit-readable summary. Charter expansion or override creates a new charter
version; it must not mutate historical charter evidence.

## Traceability

- [Run v1](./run-v1.md)
- [Delegated Autonomy Hierarchy v1](./delegated-autonomy-hierarchy-v1.md)
- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- Implementation: `src/domain/runs/run-charter-v1.ts`

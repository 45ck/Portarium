# ADR-0038: Work Items as Universal Binding Object

## Status

Accepted

## Context

Real business operations span multiple tools: a support ticket triggers a code change, which requires an approval, generates a PR, runs CI, and produces evidence. Currently, VAOP links Runs to evidence and approvals, but there is no cross-tool binding object that connects all the SoR artefacts involved in a single business case.

## Decision

Add a minimal **Work Item** entity that serves as the universal binding object (case) for cross-system operations. A Work Item binds:

- SoR links (ExternalObjectRefs to Jira tickets, Zendesk cases, CRM records, PRs, CI runs)
- VAOP Runs
- Approvals
- Evidence entries
- SLA metadata
- Owner assignment

Work Items are lightweight -- they do not replicate Jira/Zendesk functionality. Projects remain a lightweight container for grouping Work Items, Runs, and Artifacts. Work Items use branded ID `WorkItemId`.

## Consequences

- Provides a single object to query "everything related to this business case."
- Avoids building a full PM/ticketing system (Work Items are thin binding objects).
- Adds one more entity to the domain model.
- Enables cross-SoR traceability for auditors and operators.

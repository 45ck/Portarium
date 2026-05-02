# Agent Observability Data Lifecycle v1

## Purpose

Define the lifecycle policy for agent transcripts, tool traces, screenshots,
timelines, and Evidence Artifacts surfaced through Cockpit observability. The
policy lets operators inspect deep trace detail during experiments without
turning pilot or production observability into uncontrolled data sprawl.

## Contract

The executable contract is
`src/domain/evidence/agent-observability-lifecycle-policy-v1.ts` with regression
coverage in
`src/domain/evidence/agent-observability-lifecycle-policy-v1.contract.test.ts`.

The contract covers:

- telemetry surface coverage: `AgentTranscript`, `ToolTrace`, `Screenshot`,
  `Timeline`, `EvidenceArtifact`
- environment trace-depth caps: `experiment`, `pilot`, `production`
- trace-depth values: `metadata`, `standard`, `deep`, `forensic`
- payload treatments: no payload, redacted payload, restricted payload, or
  evidence payload
- role, Workspace, and tenant visibility checks
- retention class, retention duration, disposition action, and legal-hold
  eligibility

## Default Policy

| Surface          | Retention       | Payload treatment | Operator visibility | Roles                              | Max trace depth |
| ---------------- | --------------- | ----------------- | ------------------- | ---------------------------------- | --------------- |
| AgentTranscript  | Operational 14d | RedactedPayload   | Redacted            | admin, operator, auditor           | deep            |
| ToolTrace        | Operational 30d | RedactedPayload   | Redacted            | admin, operator, auditor           | deep            |
| Screenshot       | Operational 7d  | RestrictedPayload | Redacted            | admin, operator, auditor           | standard        |
| Timeline         | Operational 90d | NoPayload         | MetadataOnly        | admin, operator, approver, auditor | standard        |
| EvidenceArtifact | Compliance 365d | EvidencePayload   | MetadataOnly        | admin, auditor                     | forensic        |

## Environment Mapping

Trace depth is clamped by environment before Cockpit renders observability
detail:

| Environment | Default cap |
| ----------- | ----------- |
| experiment  | deep        |
| pilot       | standard    |
| production  | metadata    |

Production policies must not configure a cap above `standard`. The default
production cap is `metadata`; any deeper production view requires a reviewed
policy change and must still respect per-surface caps.

## Privacy Boundaries

- Transcripts and screenshots must never use full operator visibility.
- Operator-visible transcript and tool-trace payloads must be redacted before
  they are shown.
- Screenshot payloads are restricted because they can contain secrets,
  personal data, customer data, and third-party source text.
- Evidence Artifact payloads remain evidence-managed; Cockpit observability may
  show metadata by default, while payload access is reserved for admin/auditor
  workflows with the existing Evidence Log and WORM controls.
- Timeline rows use opaque identifiers only and must not embed raw transcript,
  screenshot, credential, or tool-parameter payloads.

## Retention And Legal Hold

- Legal hold blocks disposition for any eligible surface, even after retention
  has expired.
- Retention expiry alone is not sufficient for evidence payload disposal when a
  legal hold is active.
- Evidence Artifact rules must use Compliance or Forensic retention and must be
  legal-hold eligible.
- Disposition of redacted operational telemetry should prefer de-identification
  unless a reviewed Workspace policy explicitly permits destruction.

## Cockpit Observability Path

Cockpit observability query models must evaluate this lifecycle policy before
returning deep trace payloads. They may render summaries, counts, and timeline
metadata for allowed Workspace users, but payload detail is gated by:

1. matching tenant identity,
2. matching Workspace identity,
3. an allowed Workspace role for the telemetry surface,
4. the environment trace-depth cap,
5. the surface-specific trace-depth cap, and
6. legal-hold and retention state for disposition actions.

This applies to production Cockpit observability surfaces, not only experiment
folders or local fixture viewers.

# Outbound Communication Compliance v1

Governed outbound Actions that send, post, or publish communications may carry an
`outboundCompliance` fixture in Action parameters. The fixture is deterministic
test input for pilots and local Growth Studio or micro-saas workflows, and it
models the compliance state a production integration would resolve from consent,
suppression, workspace policy, and jurisdiction sources.

## Fixture Contract

- `schemaVersion`: `1`
- `channel`: `email`, `sms`, `push`, `phone`, `in_app`, `postal`, `social`, or
  `web`
- `purpose`: non-empty business purpose such as `growth-outreach`
- `workspaceTimezone`: IANA timezone used when a recipient does not have one
- `nowIso`: deterministic evaluation instant
- `recipients`: non-empty array with `recipientId`, optional `timezone`,
  optional `jurisdiction`, and optional `consent`
- `rules`: optional quiet hours, business window, and jurisdiction rules

## Decisions

- `Allow`: all recipients are allowed now.
- `Defer`: quiet-hours or business-window rules prevent sending now; evidence
  records the deterministic `deferredUntilIso`.
- `HumanApprove`: unknown, pending, or jurisdiction-sensitive state requires an
  Approval Gate.
- `ManualOnly`: channel or jurisdiction rules require a human to perform the
  communication outside automation.
- `Block`: opted-out, revoked, suppressed, or prohibited recipients cannot be
  sent to.

## Evidence

Agent Action proposal evidence must record the outbound compliance decision and
rationale codes for allowed, deferred, escalated, manual-only, and blocked
outcomes. Summaries must not include direct personal identifiers such as email
addresses.

## Enforcement

The Agent Action proposal path evaluates outbound compliance only for governed
send/post/publish Actions carrying the fixture. `HumanApprove` escalates the
proposal to `NeedsApproval`; `Defer` returns a conflict with the next allowed
time; `ManualOnly` and `Block` reject the proposal before dispatch.

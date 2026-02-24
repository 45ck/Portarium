# Open Decisions Backlog (next to lock)

## Existing (carried forward)

- Canonical object set finalization (v2 locked at 14; schema versioning rules still open)
- Machine interface contract (HTTP vs gRPC, artifact storage, auth, streaming)
- Eventing model (webhooks vs queue/event bus; how workflows consume events)
- Credential vault approach (implementation choice + rotation workflows)
- Approval UX baseline (diffing/versioning model, assignment policies, SLA semantics)
- Multi-tenant storage model (DB-per-tenant vs shared with isolation controls)
- Temporal vs alternatives confirmation only if constraints appear (otherwise keep locked)

## New (from ADR addendum)

- Plan/preview contract per port; diff classification (planned/verified/predicted) -- see ADR-027
- Evidence retention/disposition/PII minimisation/legal holds -- see ADR-028
- SoD/multi-actor policy primitives -- see ADR-031
- Quota-aware execution baseline and capability matrix representation -- see ADR-030
- Event + telemetry standards (CloudEvents + OpenTelemetry) -- see ADR-032, ADR-033
- Adapter/machine sandboxing and fixture redaction requirements -- see ADR-034
- Work Item schema and thin PM boundary -- see ADR-038
- Git-vs-runtime truth boundary and sync mechanism -- see ADR-037

## Proposal Completeness Gate

Any new proposal must declare:

- Manual-only lane behaviour (task handoff or explicit exclusion)
- Plan + Verified Effects semantics
- Evidence retention/disposition + integrity
- SoD/multi-actor policy constraints
- Quota-aware execution posture
- Event + telemetry standards
- Untrusted execution containment
- Deployment mode (local vs team) and Git vs runtime truth split
- Work Item / Projects usage (thin PM boundary)

# Presentation Layer Reference Cockpit v1 (Specification)

## Purpose

Define the expected behaviour for the first public-facing Portarium presentation reference client (web cockpit).  
The cockpit remains a read/write client of the Control Plane and must preserve contract fidelity.

## Scope

- Contract-driven data acquisition and command orchestration for `Workspace`, `Work Item`, `Plan`, `Run`, `Approval`, and `Evidence Log`.
- Persona-aware default navigation.
- Trust UI for Planned / Predicted / Verified effects.
- Explicit system-state representation for:
  - empty
  - misconfigured
  - policy blocked
  - RBAC limited
  - degraded realtime
- Error and command handling using Problem Details.

## Out of scope

- Changing policy execution engine behaviour.
- Introducing domain rules that belong to application or infrastructure layers.
- Authoritative state mutation outside Control Plane commands.

## Required domain vocabulary

The specification uses vocabulary from `docs/glossary.md` without synonyms.

- Workspace / Tenant
- Work Item
- Run
- Plan
- Approval Gate
- Evidence Log

## API contract obligations

1. All query/mutation calls must target `/v1/workspaces/{workspaceId}/...`.
2. List responses for mutable collections use cursor pagination.
3. Command failures must surface Problem Details fields (`type`, `title`, `status`, `detail`, `instance`).
4. Mutations must support optional idempotency keys where appropriate.

## Behaviour requirements

### R1 Contract-first data layer

The presentation layer must have one typed entrypoint for HTTP interactions with:
- request helpers
- cursor pagination helpers
- response error conversion to Problem Details error shape

### R2 Shell and persona defaults

- Shell must include Workspace context and a system-state region.
- Persona-driven defaults are route-level and non-hidden:
  - Operator default surface: actionable queue.
  - Approver default surface: pending `Approval Gate` queue.
  - Auditor default surface: `Evidence Log`-first views.

### R3 Trust UI

- Effects rendering always follows Planned -> Predicted -> Verified order.
- Copy must distinguish intent and certainty:
  - Planned = "intended"
  - Predicted = "best-effort"
  - Verified = "observed"

### R4 Approval decision workflow

- Approval action requires rationale when decision is deny or request-changes.
- Decision errors must include actionable information and retain the operation `instance`.
- The UI must show policy context alongside effect summaries before submission.

### R5 System states

For each primary screen, show dedicated state components for:
- empty
- misconfigured
- policy blocked
- RBAC limited
- degraded realtime

### R6 Realtime and stale data

- Realtime updates are preferred when event stream is healthy.
- On degraded stream, automatic polling fallback is allowed.
- The UI must show data freshness and staleness reason.

### R7 Interaction quality

- Keyboard access for primary rows, drawers, modals, and decision forms.
- Focus visibility and recovery when closing overlays.
- No critical state represented by color alone.

## Acceptance signals

- Screen rendering remains stable with partial API failures.
- Run detail and approval surfaces tolerate missing optional fields.
- Mutations remain resilient to duplicates when idempotency keys are reused.
- Audit path (`Evidence Log`, decision details, instance IDs) is visible without internal backend navigation.

## Traceability links

- `docs/ui/presentation-layer-comprehensive-plan.md`
- `docs/ui/presentation-layer-work-backlog.md`
- `.github` and CI quality gates already define final repository completion criteria.

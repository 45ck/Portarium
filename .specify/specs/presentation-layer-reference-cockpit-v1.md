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
- Workforce Member
- Workforce Queue
- Human Task

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
- Decision submission controls must be role-gated to approvers; non-approver personas see read-only approval context.

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
- Master-detail screens must keep detail content synchronized with the selected row/card across all visible tabs.

### R8 Location map operations (prototype scope)

- Cockpit Robots surface must provide an overview-first location map with synchronized non-map list.
- Operators must be able to filter by site/floor/status and search by asset/robot identifier.
- Details-on-demand panel must show selected robot state, location quality, frame context, and mission link.
- Spatial alert triage must support jump-to-location and acknowledgment actions.
- Uncertainty overlays, clustering, and short-window trail visibility must be user-toggleable.
- Timeline controls must support live mode and replay mode with incident bookmarks.
- Degraded realtime state must show explicit stale-data messaging on the map surface.

### R9 Workflow builder interaction model (prototype scope)

- Workflow Builder must expose multiple concrete blueprint examples across domains (finance, robotics, machine/OT, hybrid, and at least one non-robot operational domain).
- Node selection must be graph-scoped and must not clear selections in unrelated workflow diagrams on the same screen.
- Palette step types must support low-fidelity draft-step insertion into the active graph.
- Condition branch labels and connector paths must support explicit low-fidelity editing interactions.
- A run-readiness panel must show blocking vs non-blocking validation checks and gate `Run workflow` when blocking checks exist.
- Keyboard flow must support active-graph step navigation and config focus without conflicting with global list navigation shortcuts.

### R10 Workforce and Human Task cockpit surfaces

- Workforce list/profile surfaces must use the control-plane workforce contracts without introducing extra domain semantics in UI.
- Workforce availability mutation controls must be role-gated; edit controls are admin-only, and non-admin personas are read-only.
- Inbox must support Human Task visibility and actions using contract routes (`list`, `complete`, `escalate`) and preserve persona defaults.

### R11 Multi-level map support and view mode fallback

- Robots map must expose explicit floor switching and preserve selected robot context when the active floor changes.
- When selected robot is off the currently viewed floor, UI must show a cross-floor context callout with one-click floor switch.
- 2D rendering remains the default/fallback; optional 3D mode is additive and must not block 2D operation.
- Map surface must display a visible performance budget note for desktop/mobile rendering expectations.

## Acceptance signals

- Screen rendering remains stable with partial API failures.
- Run detail and approval surfaces tolerate missing optional fields.
- Mutations remain resilient to duplicates when idempotency keys are reused.
- Audit path (`Evidence Log`, decision details, instance IDs) is visible without internal backend navigation.

## Traceability links

- `docs/ui/presentation-layer-comprehensive-plan.md`
- `docs/ui/presentation-layer-work-backlog.md`
- `.github` and CI quality gates already define final repository completion criteria.

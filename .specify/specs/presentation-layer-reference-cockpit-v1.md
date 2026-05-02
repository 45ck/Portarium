# Presentation Layer Reference Cockpit v1 (Specification)

## Purpose

Define the expected behaviour for the first public-facing Portarium presentation reference client (web cockpit).  
The cockpit remains a read/write client of the Control Plane and must preserve contract fidelity.

The primary product job is anywhere approval and supervision: a user can leave an agent running, understand what it is capable of, and approve, reject, or inspect decisions that require human judgement from a phone-sized web UI.

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
5. Live web Cockpit authentication must use the server-mediated `/auth/session`, `/auth/oidc/callback`, and `/auth/logout` path with an HttpOnly `SameSite=Strict` session cookie. Unsafe cookie-authenticated mutations must include `X-Portarium-Request`, and live web must not rely on browser-seeded bearer tokens in env, `localStorage`, or `sessionStorage`.
6. Production Cockpit should use same-origin `/auth/*` and `/v1/*` routes behind one reverse proxy. Deliberate cross-origin deployments must configure exact allowed origins on the control plane; wildcard CORS or browser-side bearer-token storage is not an acceptable live topology.

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
- Phone-sized views must keep approve, deny, request-changes, and rationale controls reachable without horizontal scrolling.
- Approval notifications and deep links should land on the focused approval card when an approval ID is available.

### R4a Agent supervision workflow

- Cockpit must expose what an agent or machine is allowed to do before the user approves an action.
- Running-agent views must connect capability, current run state, pending approvals, and evidence so a user can decide whether to let the agent continue.
- Mobile views must prioritize pending human decisions over broad monitoring or showcase surfaces.
- Intervention controls must show the governance function and authority source the user is exercising.
- Steering, approval, audit annotation, and Policy change controls must remain visually and semantically distinct.
- Run intervention controls must expose pause, resume, reroute, handoff, escalate, request-more-evidence, freeze, sandbox, emergency-disable, and annotate as distinct actions with distinct consequence copy.
- Non-routine containment or break-glass actions must require explicit acknowledgement before submission and must not be presented as ordinary pause/cancel actions.
- Handoff, reroute, and escalation controls must require a target Workforce Member or Workforce Queue before submission.
- The Run detail surface must show the derived control posture: waiting, blocked, degraded, frozen, or operator-owned where available.

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
- Until Cockpit maps `LocationEvent` and `MapLayer` into the robot UI contract, robotics routes are demo-only and must be hidden or disabled in live tenant-data runtimes.
- Direct live visits to robotics routes must show an unsupported state and must not call `/v1/workspaces/{workspaceId}/robotics/*`.
- Operators must be able to filter by site/floor/status and search by asset/robot identifier.
- Details-on-demand panel must show selected robot state, location quality, frame context, and mission link.
- Spatial alert triage must support jump-to-location and acknowledgment actions.
- Uncertainty overlays, clustering, and short-window trail visibility must be user-toggleable.
- Timeline controls must support live mode and replay mode with incident bookmarks.
- Degraded realtime state must show explicit stale-data messaging on the map surface.
- Stale or degraded telemetry must disable unsafe robot mission, E-Stop, and safety-constraint controls and explain the reason.

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

### R12 Robotics analytics overlays and window semantics

- Robots map must expose independent toggles for analytics overlays: coverage heatmap, dwell hotspots, and utilisation summary by zone.
- Analytics surfaces must always display the active time window in title/legend copy.
- Analytics surfaces must render explicit sampling caveats and query-limit constraints to avoid over-interpretation.
- Default prototype query/performance constraints:
  - 15m window: max 25k points, target overlay refresh <= 350ms
  - 1h window: max 100k points, target overlay refresh <= 650ms
  - 4h window: max 300k points, target overlay refresh <= 1.2s
  - 24h window: max 1M points, target overlay refresh <= 2.5s

### R13 Local tenant-data retention

- Live web must not retain tenant API payloads in `localStorage`, `sessionStorage`, IndexedDB, React Query persistence, or Cache Storage unless an explicit offline-retention policy enables it.
- Logout, workspace switch, and auth failure must purge Run, Approval Gate, Work Item, Evidence Log, Workspace, and User payloads from browser storage.
- Live service-worker API caching must be disabled by default; the worker may retain only shell/static assets unless a deployment explicitly enables tenant API caching.

### R14 Cockpit extension activation

- Installed Cockpit extensions remain hidden unless the control plane reports every required workspace pack activation and guard input for the current Workspace.
- Core Cockpit navigation, routes, command palette actions, and shortcuts must remain usable when zero external extensions are enabled.
- Unknown activation pack IDs or partially satisfied pack requirements must fail closed and must not partially surface extension routes, navigation items, commands, or shortcuts.
- Extension resolution must expose installed, enabled, disabled, and invalid states so tests and UI can distinguish inactive workspace grants from invalid manifests.

### R14a Host-owned extension guard pipeline

- The host must resolve extension visibility from server-issued Workspace context before surfacing extension routes, sidebar links, mobile navigation items, command palette actions, or shortcuts.
- Extension route code must not be imported until pack activation, quarantine state, route-module availability, persona, capability, API-scope, and privacy-class checks pass.
- Cockpit v1 extension executable code must be installed at compile time through host-reviewed packages or workspace links; manifests must not trigger runtime remote JavaScript loading or manifest-driven imports.
- Missing, unknown, stale, or partial guard inputs must fail closed and prevent route, navigation, command, shortcut, and mobile surfaces from becoming reachable.
- The same resolved route guard decision must drive `/external/` direct navigation, sidebar links, mobile navigation, command palette actions, and keyboard shortcuts.
- Sidebar, mobile navigation, command palette entries, and keyboard shortcuts must be projected only from the resolved Cockpit extension registry; shell code must not read raw manifest arrays or maintain separate extension navigation or command allowlists.
- Guard denials must expose audit-ready decision metadata for the host while user-facing forbidden and not-found fallbacks avoid leaking sensitive extension route metadata.
- Extension UI may request governed actions only through Portarium Control Plane APIs; extension surfaces must not perform direct authoritative side effects outside those APIs.

### R14b Cockpit extension browser egress

- Cockpit Extension Browser Egress is host-owned, deny-by-default, and limited to approved Host/API Origins.
- Approved extension Browser Egress is limited to same-origin `/v1/*` and `/auth/*` Portarium paths plus exact configured Portarium API origins used for mediated backend-for-frontend APIs.
- Extension manifests, workspace activation grants, and package metadata must not declare or expand allowed browser origins, remote entry URLs, API base URLs, `connect-src`, or provider endpoints.
- Direct extension use of unmanaged browser egress primitives such as `fetch`, XHR, WebSocket, EventSource, beacon, worker creation, external links/forms, or non-relative dynamic imports must fail deterministic build or test checks.
- Missing, empty, stale, or indeterminate Browser Egress policy must fail closed before network dispatch.
- Denied Browser Egress must expose deterministic audit-ready metadata including policy ID/version, decision, reason, extension ID, route or command ID when known, Workspace, principal, correlation ID, request kind, method, attempted origin, redacted attempted path, and configured Host/API Origins.
- Browser Egress policy and tests must remain generic and must not encode tenant, customer, vertical, system-of-record, provider, vault, gateway, or runtime daemon endpoints.

### R14c Cockpit extension backend host contract

- The control plane must issue a typed `hostContract` inside the workspace-scoped Cockpit extension context.
- `hostContract.dataQueries` must list only configured, authorized, effectively scoped Portarium query surfaces. Extension packages must treat absence from this list as a deny decision, not as permission to synthesize a direct browser call.
- `hostContract.governedCommandRequests` must list only configured, authorized, effectively scoped command-request surfaces that preserve Portarium policy, Approval Gate, SoD, evidence, tenancy, and audit semantics.
- Governed command requests must not execute authoritative side effects in the browser. They may only submit requests to control-plane endpoints that evaluate policy, create or reuse required approvals, and append evidence before returning an allow, deny, or needs-approval result.
- Missing command governance dependencies, missing API scopes, missing capabilities, workspace mismatch, activation-source failure, or malformed activation state must fail closed by omitting the surface or returning Problem Details before any extension route receives a partial permission context.
- The backend host contract must not expose credentials, system-of-record endpoints, vault paths, provider APIs, gateway management APIs, runtime daemon endpoints, tenant-specific endpoints, or manifest-defined egress grants.

## Acceptance signals

- Screen rendering remains stable with partial API failures.
- Run detail and approval surfaces tolerate missing optional fields.
- Mutations remain resilient to duplicates when idempotency keys are reused.
- Audit path (`Evidence Log`, decision details, instance IDs) is visible without internal backend navigation.
- A phone-sized approver can review a pending agent decision, understand capability and risk context, approve or reject it, and see the decision reflected without switching to desktop.

## Traceability links

- `docs/internal/ui/presentation-layer-comprehensive-plan.md`
- `docs/internal/ui/presentation-layer-work-backlog.md`
- `.github` and CI quality gates already define final repository completion criteria.

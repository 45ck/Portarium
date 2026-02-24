# Cockpit Approvals V2 Swipe-Triage v1 (Specification)

## Purpose

Define the v2 approval experience in Cockpit as a card-first triage flow with swipe and keyboard decision controls, plus explicit release quality bars.

## Scope

- Approvals route interaction model for triage-mode review and decision submission.
- Decision semantics for `approve`, `deny`, and `request-changes`.
- Accessibility, responsiveness, and motion constraints for swipe interactions.
- Mock-data readiness and acceptance evidence needed before production API wiring.

## Out of scope

- Control-plane decision policy semantics.
- Backend approval/routing contract changes.
- Non-approval Cockpit pages.

## Required domain vocabulary

- Approval Gate
- Plan
- Run
- Evidence Log
- Policy
- Workspace / Tenant

## Behaviour requirements

### R1 Triage-mode interaction

- Approvals screen must expose a dedicated triage mode with one active card.
- Active card must provide summary context: plan intent, policy context, requester metadata, and risk indicators.
- Card navigation must support pointer swipe and keyboard commands with equivalent outcomes.

### R2 Decision actions and rationale rules

- `approve` may submit without rationale.
- `deny` must require rationale before submission.
- `request-changes` must require rationale before submission.
- Validation errors must preserve user-entered rationale text until corrected or cancelled.

### R3 Gesture and animation quality

- Swipe threshold and velocity must prevent accidental commits from minor drag movement.
- Commit animation must provide clear directional intent (approve right, deny left).
- Reduced-motion preference must disable non-essential transitions while preserving function.
- Gesture handling must not block keyboard-only decision flow.

### R4 Queue and completion UX

- Queue progress must be visible in triage mode (current index and total pending count).
- Empty queue state must show completion summary and a clear next action.
- If no pending approvals exist at initial load, screen must render completion state immediately.

### R5 Accessibility and usability quality bar

- All decision actions must be reachable by keyboard without pointer input.
- Focus order must remain deterministic across card changes and rationale modal/panel state.
- Decision controls must include accessible labels and not rely on color alone.
- Mobile viewport must keep core decision controls visible without horizontal scrolling.

## Acceptance criteria

1. Triage mode can process approvals end-to-end using pointer swipe or keyboard-only controls.
2. `deny` and `request-changes` cannot submit without rationale; `approve` can submit without rationale.
3. Reduced-motion setting removes swipe/transition animations while preserving decision behaviour.
4. Queue progress and empty/completion state render correctly from fixture data.
5. Review evidence includes UX quality checks and implementation traceability for the triage surface.

## Traceability links

- `apps/cockpit/src/routes/approvals/index.tsx`
- `apps/cockpit/src/components/cockpit/approval-triage-card.tsx`
- `apps/cockpit/src/components/cockpit/approval-triage-deck.tsx`
- `apps/cockpit/src/components/cockpit/triage-complete-state.tsx`
- `apps/cockpit/src/index.css`
- `docs/internal/adr/0077-framer-motion-gesture-animation-layer.md`

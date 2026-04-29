# Spec: Cockpit Mobile Responsive Shell and Core Flow Usability (v1)

## Context

Cockpit mobile delivery requires phone-width usability without relying on desktop sidebar controls.

The critical mobile path is approval supervision: when an agent needs human judgement, the user should be able to understand the request and approve or reject it from a phone-sized web view.

## Requirements

1. On phone viewports, the cockpit shell must hide the desktop sidebar and provide mobile navigation.
2. Mobile users must be able to switch persona and workspace without desktop-only controls.
3. Core flows (`Approvals`, `Work Items`, `Runs`, `Workflow detail`, `Agents`, `Machines`) must remain usable on phone widths without horizontal page scrolling.
4. Header and filter controls must wrap/adapt on narrow widths so primary actions stay reachable.
5. Add responsive verification tests for mobile shell behavior and core-flow route rendering.
6. Capture visual QA evidence at mobile and desktop breakpoints for the key cockpit flow screens.
7. Mobile navigation must expose the fastest path to pending approvals and enough agent/machine context to understand what is running.
8. Pending approval count should be visible in the mobile navigation or inbox affordance.

## Acceptance

- Mobile shell exposes navigation plus persona/workspace context controls.
- Core flow routes render at phone widths with no horizontal page scrolling at the shell level.
- Responsive test coverage is present and passing.
- Breakpoint screenshots and metadata are committed as QA evidence.
- Phone-sized approval review is treated as a release-critical path, not a showcase-only demo.

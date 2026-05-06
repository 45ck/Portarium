# ADR-0151: Observation-Only Extension Mode

**Status:** Proposed
**Date:** 2026-05-06

## Context

Portarium Cockpit extensions can contribute host-native routes, navigation,
data descriptors, suggestions, and governed proposal metadata. Some extension
deployments need a stronger safety posture than ordinary approval governance:
the extension should be unable to mutate an external system at all.

Human approval remains important, but approval alone is not enough when the
desired operating mode is "observe and advise only." In that mode, the platform
must make external mutation impossible unless a later architecture decision
deliberately introduces a scoped execution adapter.

## Decision

Add a generic observation-only extension mode.

When an installed extension, workspace, or route is marked observation-only:

- extension data scopes must be read-only;
- extension route payloads must be projection-shaped and data-only;
- browser egress remains denied except for host-owned API paths;
- extension code receives no external credentials;
- suggestion descriptors may be rendered but cannot execute;
- proposal drafts may be created as review material only;
- execution adapters for that extension remain absent or disabled;
- Cockpit must visibly label the surface as observation-only where an operator
  could otherwise expect an action.

Observation-only mode is stronger than "requires approval." A human can approve
a finding, next check, or manual work plan, but that approval does not unlock
automatic execution unless a separate action capability has been introduced and
enabled outside this mode.

## Contract

Observation-only extensions may provide:

- navigation entries;
- host-native read-only routes;
- read-only data scopes;
- redacted projections;
- opaque target and evidence refs;
- freshness, provenance, privacy, and confidence labels;
- advisory suggestions;
- non-executable proposal draft metadata.

Observation-only extensions must not provide:

- source-system credentials;
- source-system browser sessions;
- executable callbacks;
- arbitrary remote code;
- direct source-system egress;
- mutation-capable commands;
- action adapters;
- hidden background execution;
- proposal descriptors that imply automatic execution is available.

## Required Validation

The extension registry, SDK conformance checks, or route loader tests should
reject observation-only extensions when:

- a data scope declares write access;
- route data includes executable functions or callback references;
- manifest fields declare browser egress or remote executable code;
- suggestion descriptors include executable action payloads;
- governed proposal drafts omit an explicit non-executable or disabled execution
  state;
- permission grants imply command execution rather than read-only query or
  review-only governance.

## User Experience

Cockpit should avoid fake affordances.

Observation-only routes should show read-only state near the page title or
action area. Disabled actions should explain that the extension is installed for
observation and recommendation, not source-system control. Proposal review links
should open approval or review context only; they should not imply that clicking
approve will mutate an external system.

## Consequences

Positive:

- Extensions can be useful for situational awareness without creating hidden
  operational risk.
- Approval UX stays honest because approval can be separated from execution.
- Tenant-specific systems can be integrated through safe projections before any
  write-capable connector exists.
- The same model works for sensitive, regulated, or high-blast-radius domains.

Negative:

- Some workflows require manual execution outside Portarium until a scoped
  connector is approved.
- Users may initially expect action buttons where the platform intentionally
  provides only evidence and suggestions.
- Proposal schemas need to distinguish review-only drafts from executable
  governed actions.

## Implementation Notes

1. Add an `observationOnly` or equivalent policy flag to extension activation or
   route governance metadata.
2. Extend conformance checks to enforce read-only scopes and reject executable
   suggestion/proposal fields for observation-only extensions.
3. Add host UI labels for observation-only surfaces and disabled execution
   affordances.
4. Keep proposal drafts review-only until an explicit action capability is
   installed, policy-covered, and tested.
5. Preserve tenant-specific examples outside this repository.

## Related Artifacts

- [ADR-0149: Host-Native Cockpit Extension Surfaces](ADR-0149-host-native-extension-surfaces.md)
- [ADR-0150: Host-Native Extension Suggestions And Governed Proposals](ADR-0150-host-native-extension-suggestions-and-governed-proposals.md)

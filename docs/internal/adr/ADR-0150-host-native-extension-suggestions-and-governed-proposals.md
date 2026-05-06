# ADR-0150: Host-Native Extension Suggestions And Governed Proposals

**Status:** Accepted
**Date:** 2026-05-06

## Context

ADR-0149 defines host-native extension surfaces for data explorer, ticket inbox,
and map workbench routes. Those surfaces let an installed extension contribute
data descriptors while Cockpit owns the visual system and host boundary.

The next reusable requirement is advisory intelligence. Extensions may want to
surface suggested next checks, likely causes, draft actions, or proposed
workflow steps. If every extension invents its own suggestion UI and action
handoff, Cockpit will lose consistency and the control plane will lose a clear
approval boundary.

The platform needs a generic rule for suggestions:

- suggestions are advisory evidence, not execution authority,
- proposed actions must enter Portarium's existing proposal, policy, approval,
  execution, and evidence lifecycle,
- Cockpit should render suggestion and proposal review material with host-owned
  components.

## Decision

Add a host-native pattern for extension suggestions and governed proposals.

Extensions may return suggestion descriptors from host-native route loaders.
Each suggestion must be data-only and must include enough context for a human to
evaluate it:

- claim or recommendation,
- evidence references,
- target references,
- confidence and reasoning,
- freshness and source posture,
- missing evidence,
- risk/blast-radius notes,
- optional proposal draft metadata.

Suggestions cannot execute tools, call source systems, mutate external state, or
hold credentials. If a user chooses to act on a suggestion, Cockpit must create
or open a governed proposal through Portarium's control plane. Proposal review
uses Portarium approval and evidence surfaces, not tenant-owned action UI.

This keeps the reusable split:

```text
extension context -> host-rendered suggestion -> governed proposal
-> policy evaluation -> human approval -> controlled execution -> evidence
```

## Host Contract

The host contract for suggestion-capable extensions is:

- browser egress remains host/API-only and fail-closed,
- credential access remains `none`,
- route payloads must be projection-shaped rather than raw source payloads,
- evidence refs and target refs are opaque to the extension host,
- proposal creation uses the same control-plane action governance lifecycle as
  other agent/tool work,
- approval packets should be used when proposal review needs primary artifacts,
  requested capabilities, plan scope, or supporting review docs.

Suggested generic descriptor shape:

```ts
interface NativeSuggestionV1 {
  id: string;
  title: string;
  claim: string;
  evidenceRefs: readonly string[];
  targetRefs: readonly string[];
  confidence: "low" | "medium" | "high";
  freshnessLabel?: string;
  sourcePosture?: readonly string[];
  missingEvidence?: readonly string[];
  riskNotes?: readonly string[];
  nextChecks?: readonly string[];
  proposalDraft?: {
    capabilityId: string;
    actionKind: string;
    rationale: string;
    minimumExecutionTier: "Assisted" | "HumanApprove" | "ManualOnly";
  };
}
```

This shape is intentionally descriptive. It is not an execution request. The
actual proposal request remains owned by Portarium application commands and
policy evaluation.

## Approval Rules

Default policy:

- read-only summaries and suggestions may be displayed without approval,
- any agent-originated proposed action must be policy evaluated,
- mutations and unknown actions require human approval at minimum,
- dangerous or host-level actions remain manual-only or denied,
- maker-checker separation applies to approval decisions,
- execution must be idempotent and evidence-backed.

An extension may recommend a lower tier for a read-only check, but the control
plane remains authoritative. Workspace policy may always raise the tier or deny
the proposal.

## Consequences

Positive:

- Extensions get useful advisory UX without owning action execution.
- Cockpit can present suggestions, evidence, and proposals consistently.
- Portarium's approval and evidence model remains the single action path.
- Host-native surfaces stay compatible with strict egress and credential
  boundaries.

Negative:

- Suggestion schemas need compatibility discipline before public SDK graduation.
- Extension authors must prepare evidence refs and target refs rather than
  passing arbitrary payloads.
- Some rich review experiences will require new host-native proposal review
  components.

## Implementation Notes

1. Cockpit now accepts internal `automationProposals` descriptors on
   host-native route surfaces and renders them with host-owned components.
2. Proposal submission uses `ControlPlaneClient.proposeAgentAction()` against
   `/v1/workspaces/:workspaceId/agent-actions:propose`; extensions do not
   receive execution authority.
3. The mutation invalidates approval and evidence queries so the proposal can
   flow into the existing operator review surfaces.
4. MSW mirrors the same endpoint for demo/dev mode while the live client path
   remains API-backed.
5. Keep the initial descriptor shape internal to Cockpit host-native surfaces
   until the schema stabilizes.
6. Add conformance checks before exposing the shape in the public extension SDK.
7. Keep tenant-specific examples outside the Portarium repo. The committed
   reference extension should remain neutral.

## Related Artifacts

- [ADR-0149: Host-Native Cockpit Extension Surfaces](ADR-0149-host-native-extension-surfaces.md)
- [Agent Action Governance Lifecycle v1](../../../.specify/specs/agent-action-governance-lifecycle-v1.md)
- [Approval Packet v1](../../../.specify/specs/approval-packet-v1.md)

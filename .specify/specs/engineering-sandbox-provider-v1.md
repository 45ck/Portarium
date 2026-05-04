# Engineering Sandbox Provider v1

## Purpose

Define a provider-neutral contract for bead-scoped engineering sandboxes.
Portarium uses this contract to run coding agents inside worktree, container,
VM, or remote environments while preserving policy enforcement, approval gates,
and evidence.

## Scope

This spec governs engineering tasks linked to Work Items and Beads. It does not
replace the general agent action governance contract. It adds an execution
environment lifecycle around engineering work.

## Definitions

- **Execution Mode:** `worktree`, `container`, `vm`, or `remote`.
- **Sandbox Provider:** Adapter that provisions an execution environment for a
  bead.
- **Sandbox Handle:** Stable reference to one provisioned environment.
- **Git Workspace:** Branch/worktree/commit context attached to the sandbox.
- **Preview Endpoint:** A controlled URL or browser session for reviewing the
  running application.
- **Sandbox Evidence:** Evidence entries proving how the environment was
  created, used, reviewed, and cleaned up.

## Required lifecycle

The canonical sandbox lifecycle names are shared with ADR-0146,
`vm-sandbox-execution-plan`, and `system-architecture`:

```text
Requested
  -> ModeResolved
  -> Provisioning
  -> Ready
  -> AgentRunning
  -> ReviewPending
  -> Approved | ChangesRequested | Denied
  -> Merging
  -> Completed
  -> Archived | Destroyed
```

Failure states:

- `PolicyBlocked`
- `ProvisionFailed`
- `AgentFailed`
- `PreviewFailed`
- `ChecksFailed`
- `CleanupFailed`

Failures must append evidence and keep enough context for operator review.

## Mode resolution

Portarium must resolve execution mode before provisioning.

Inputs:

- workspace policy
- bead risk class
- repository trust level
- requested agent runtime
- requested tool capabilities
- credential and network requirements
- operator override request

Resolution outcomes:

- `allow`: provider can provision immediately
- `needs_approval`: approval required before provisioning
- `deny`: no provider is allowed for this request
- `fallback_approved`: selected mode is unavailable; use an explicit
  policy-approved fallback with an approval record when the fallback is weaker

VM mode is the required default for autonomous coding tasks. Worktree mode is
allowed only for low-risk trusted tasks when workspace policy explicitly allows
it. A fallback from `vm` to a weaker mode cannot be inferred from provider
unavailability alone and always requires operator approval plus evidence.
Replacing `vm` with `remote` is not an automatic downgrade or upgrade: hosted
providers require workspace-level approval, provider allowlisting, and
source/secrets policy evidence unless the workspace has pre-approved that
provider as an equivalent isolation class.

## Port boundaries

- `GitWorkspacePort` owns git branch, worktree, diff, PR, merge, and workspace
  cleanup operations. Workflow code must not shell directly to git or `bd`.
- `SandboxProviderPort` owns environment provisioning, lifecycle, status,
  provider events, workspace attachment, attestation, and cleanup evidence.
  It does not launch agents, decide policy, merge code, or expose previews.
- `AgentRuntimePort` owns launching and stopping the selected agent inside a
  ready sandbox, ensuring the Portarium hook is loaded, sending prompts, and
  streaming transcripts.
- `PreviewPort` owns controlled dev-server discovery, browser session opening,
  endpoint exposure through Portarium controls, and preview snapshot evidence.
- `MachineInvokerPort` remains the general machine/agent invocation boundary
  for tool calls and requests. It must not become the sandbox lifecycle,
  preview, git workspace, or merge interface.

## Provider contract

All providers must support:

- create sandbox with resource limits
- start/stop/destroy lifecycle
- archive sandbox for retention and review
- status query
- event stream
- workspace attachment
- environment log stream
- evidence metadata export

VM and remote providers must additionally report:

- image/template identifier
- guest OS family
- network policy summary
- filesystem mount policy
- credential grant references
- cleanup confirmation

## Data model

`EngineeringSandboxV1` minimum fields:

- `sandboxId`
- `workspaceId`
- `workItemId`
- `beadId`
- `runId`
- `planId`
- `providerId`
- `requestedMode`
- `selectedMode`
- `state`
- `gitWorkspaceId`
- `baseCommit`
- `branchName`
- `createdBy`
- `createdAt`
- `expiresAt`
- `resourceLimits`
- `networkPolicyRef`
- `credentialGrantRefs`
- `evidenceRefs`
- `failureCode`
- `failureMessage`

`SandboxProviderCapability` minimum fields:

- `providerId`
- `supportedModes`
- `supportsBrowser`
- `supportsDocker`
- `supportsSnapshots`
- `supportsPauseResume`
- `supportsOfflineMode`
- `maxConcurrentSandboxes`
- `defaultResourceLimits`
- `hostRequirements`
- `productionEligibility`
- `isolationClass`
- `hostProvenance`

`EngineeringRuntimePolicyV1` minimum fields:

- `workspaceId`
- `defaultMode` (must resolve to `vm` for autonomous coding unless a stricter
  workspace policy denies autonomous execution)
- `allowedModes`
- `providerAllowlist`
- `modeApprovalRules`
- `fallbackRules`
- `networkPolicyDefaults`
- `credentialGrantDefaults`
- `retentionPolicy`

## Control-plane API

The first implementation may keep these behind internal handlers, but the
contract should be stable.

Policy:

```text
GET   /v1/workspaces/:workspaceId/engineering/runtime-policy
PATCH /v1/workspaces/:workspaceId/engineering/runtime-policy
GET   /v1/workspaces/:workspaceId/sandbox-providers/capabilities
```

Sandbox runs:

```text
POST /v1/workspaces/:workspaceId/beads/:beadId/engineering-sandboxes
GET  /v1/workspaces/:workspaceId/beads/:beadId/engineering-sandboxes
GET  /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId
POST /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/retry
POST /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/cancel
POST /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/archive
POST /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/destroy
GET  /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/events
GET  /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/evidence
GET  /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/artifact
GET  /v1/workspaces/:workspaceId/engineering-sandboxes/:sandboxId/previews
```

All mutation endpoints require authenticated workspace scope and must fail
closed when policy, evidence, or provider dependencies are not configured.

Minimal create request:

```json
{
  "requestedMode": "vm",
  "fallbackApprovalId": "apr_123",
  "failureRetention": "archive",
  "baseRef": "main",
  "imageRef": "portarium-dev-v1"
}
```

Successful create response:

- `202 Accepted`
- includes `sandboxId`, `runId`, `state`, `requestedMode`, and
  `selectedMode` when available
- includes `approvalId` when provisioning or downgrade requires approval

Provider errors use RFC 9457 `application/problem+json` with stable codes:

- `sandbox_provider_unavailable`
- `sandbox_policy_denied`
- `sandbox_backend_not_allowed`
- `sandbox_state_conflict`
- `sandbox_approval_required`
- `sandbox_evidence_failure`

## Evidence rules

The following events are mandatory:

- `SandboxModeResolved`
- `SandboxProvisionRequested`
- `SandboxProvisioned`
- `SandboxAttested`
- `SandboxAgentStarted`
- `SandboxPreviewDiscovered`
- `SandboxChecksCompleted`
- `SandboxReviewRequested`
- `SandboxMergeApproved`
- `SandboxMergeCompleted`
- `SandboxArchived`
- `SandboxDestroyed`

Failure equivalents must exist for provisioning, agent execution, preview,
checks, merge, and cleanup.

Each evidence entry must include:

- workspace, bead, run, sandbox, provider, and correlation identifiers
- execution mode
- actor or agent identity
- policy decision path
- timestamp
- artifact references where applicable

## Cockpit requirements

Cockpit must show:

- execution mode on bead cards and bead detail
- sandbox state and provider health
- preview/browser availability
- branch/base commit
- resource and TTL summary
- latest evidence checkpoint
- mode change/rebuild action when allowed
- policy reason when a mode is unavailable

Diff approval must show which sandbox produced the diff and whether the preview
and checks came from the same sandbox.

## Acceptance criteria

1. Mode resolution returns `allow`, `needs_approval`, `deny`, or
   `fallback_approved` with a stable policy rationale.
2. Autonomous coding resolves to `vm` by default unless workspace policy denies
   autonomous execution.
3. A bead can provision a `worktree` sandbox through the provider contract
   without direct workflow shell calls.
4. A bead can provision a `container` or `vm` provider behind a feature flag with
   the same control-plane lifecycle.
5. All lifecycle transitions append evidence with workspace, bead, run, sandbox,
   provider, and correlation identifiers.
6. Cockpit can render provider capabilities and sandbox state from API/MSW
   fixtures before live backend integration.
7. Diff approval is blocked when required sandbox evidence is missing.
8. Mode changes require rebuild and generate new evidence.
9. Provider failure returns RFC 9457 problem details and never silently falls
   back to a weaker mode.
10. Any weaker fallback from `vm` requires operator approval and evidence.
11. Provider capability reporting distinguishes production-eligible providers
    from development-only Windows/WSL providers.
12. Credential grants are scoped to sandbox and expire at or before sandbox TTL.
13. Cleanup failure leaves the bead in a reviewable `CleanupFailed` state.

## Out of scope

- Building a full IDE.
- Replacing Beads or Work Items.
- Supporting arbitrary long-lived developer desktops.
- Allowing agents direct repository credentials outside Portarium control.
- Production support for every provider in v1.

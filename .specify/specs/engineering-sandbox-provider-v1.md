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
  policy-approved fallback

VM mode is the recommended default for autonomous coding tasks. Worktree mode is
allowed only for low-risk trusted tasks unless workspace policy says otherwise.
A fallback from `vm` to a weaker mode cannot be inferred from provider
unavailability alone.

## Provider contract

All providers must support:

- create sandbox with resource limits
- start/stop/destroy lifecycle
- status query
- event stream
- workspace attachment
- agent command launch
- log stream
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

`EngineeringRuntimePolicyV1` minimum fields:

- `workspaceId`
- `defaultMode`
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
POST /v1/workspaces/:workspaceId/beads/:beadId/sandbox-runs
GET  /v1/workspaces/:workspaceId/beads/:beadId/sandbox-runs
GET  /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId
POST /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/retry
POST /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/cancel
POST /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/preserve
POST /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/destroy
GET  /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/events
GET  /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/evidence
GET  /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/artifact
GET  /v1/workspaces/:workspaceId/sandbox-runs/:sandboxRunId/previews
```

All mutation endpoints require authenticated workspace scope and must fail
closed when policy, evidence, or provider dependencies are not configured.

Minimal create request:

```json
{
  "requestedMode": "vm",
  "fallbackAllowed": true,
  "preserveOnFailure": true,
  "baseRef": "main",
  "imageRef": "portarium-dev-v1"
}
```

Successful create response:

- `202 Accepted`
- includes `sandboxRunId`, `runId`, `state`, `requestedMode`, and
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
2. A bead can provision a `worktree` sandbox through the provider contract
   without direct workflow shell calls.
3. A bead can provision a `container` or `vm` provider behind a feature flag with
   the same control-plane lifecycle.
4. All lifecycle transitions append evidence with workspace, bead, run, sandbox,
   provider, and correlation identifiers.
5. Cockpit can render provider capabilities and sandbox state from API/MSW
   fixtures before live backend integration.
6. Diff approval is blocked when required sandbox evidence is missing.
7. Mode changes require rebuild and generate new evidence.
8. Provider failure returns RFC 9457 problem details and never silently falls
   back to a weaker mode.
9. Credential grants are scoped to sandbox and expire at or before sandbox TTL.
10. Cleanup failure leaves the bead in a reviewable `CleanupFailed` state.

## Out of scope

- Building a full IDE.
- Replacing Beads or Work Items.
- Supporting arbitrary long-lived developer desktops.
- Allowing agents direct repository credentials outside Portarium control.
- Production support for every provider in v1.

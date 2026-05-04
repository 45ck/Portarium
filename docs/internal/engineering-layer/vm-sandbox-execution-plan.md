# VM Sandbox Execution Plan

## Summary

The governed engineering layer should become task-native execution, not just
worktree automation. Each engineering bead gets a disposable development
universe with its own branch, runtime, preview, logs, browser state, evidence,
and approval path.

The default execution mode should be `vm`, with `container` and `worktree`
available as explicit policy-controlled alternatives. This keeps the product
honest: Portarium can run cheap local tasks when risk is low, but the primary
governance story is isolated agent work that cannot casually touch the host.

## Product shape

Canonical sandbox lifecycle states:

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

Operational flow:

```text
Work item or bead selected
  -> policy resolves allowed execution modes
  -> operator confirms plan and execution mode
  -> Portarium creates branch/worktree handle
  -> SandboxProvider provisions environment
  -> agent runs inside sandbox with Portarium hook loaded
  -> preview, browser, terminal, logs, and evidence stream into Cockpit
  -> ArtifactCollector creates diff and run artifact
  -> DiffApprovalSurface gates merge
  -> MergeExecutor merges or archives sandbox for changes
  -> sandbox is destroyed or archived by retention policy
```

## Execution modes

| Mode        | Purpose                    | Isolation                | Default use                                                                          |
| ----------- | -------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `worktree`  | Fast local edit loop       | Git/index isolation only | Read-only exploration, docs, tiny trusted edits                                      |
| `container` | Repeatable dev environment | Shared host kernel       | Normal low/medium risk tasks and CI-like checks                                      |
| `vm`        | Governed agent development | Guest kernel boundary    | Default for autonomous coding, browser automation, package installs, untrusted repos |
| `remote`    | Hosted sandbox provider    | Provider boundary        | Burst capacity, pilot demos, or machines without local virtualization                |

The UI should not present this as a casual toggle. It is an `Execution Mode`
decision. Changing mode after provisioning requires `Rebuild Sandbox`, and the
new mode must produce new evidence so reviewers know which environment produced
the current diff and preview.

## New ports

### `SandboxProviderPort`

Creates and manages a bead-scoped execution environment. It owns provisioning,
start/stop/destroy, provider status, provider events, workspace attachment, and
cleanup evidence. It does not launch agents, collect previews, merge code, or
make policy decisions.

```ts
interface SandboxProviderPort {
  create(request: SandboxCreateRequest): Promise<SandboxHandle>;
  start(handle: SandboxHandle): Promise<SandboxRuntimeState>;
  stop(handle: SandboxHandle, reason: StopReason): Promise<void>;
  archive(handle: SandboxHandle, reason: ArchiveReason): Promise<void>;
  destroy(handle: SandboxHandle, reason: DestroyReason): Promise<void>;
  getStatus(handle: SandboxHandle): Promise<SandboxRuntimeState>;
  streamEvents(handle: SandboxHandle): AsyncIterable<SandboxEvent>;
}
```

### `GitWorkspacePort`

Owns branch, worktree, diff, and PR/merge operations. It replaces direct shell
calls to git or `bd` from workflow code.

```ts
interface GitWorkspacePort {
  createWorkspace(request: GitWorkspaceCreateRequest): Promise<GitWorkspaceHandle>;
  getDiff(handle: GitWorkspaceHandle): Promise<DiffHunk[]>;
  runChecks(handle: GitWorkspaceHandle, command: string): Promise<CheckRunResult>;
  createPullRequest(handle: GitWorkspaceHandle): Promise<PullRequestHandle>;
  merge(handle: GitWorkspaceHandle, approvalId: string): Promise<MergeResult>;
  cleanup(handle: GitWorkspaceHandle, policy: CleanupPolicy): Promise<void>;
}
```

### `AgentRuntimePort`

Starts the selected agent inside the sandbox and enforces that the Portarium
plugin/hook is loaded before agent work begins.

This is the bridge to an interactive agent session inside a ready sandbox, not
sandbox lifecycle. Existing `MachineInvokerPort`-style machine/agent invocation
remains responsible for external machine actions, agent tasks, and tool
invocation; `SandboxProviderPort` only owns the environment boundary.

```ts
interface AgentRuntimePort {
  launch(request: AgentLaunchRequest): Promise<AgentSessionHandle>;
  sendPrompt(handle: AgentSessionHandle, prompt: string): Promise<void>;
  stop(handle: AgentSessionHandle, reason: StopReason): Promise<void>;
  streamTranscript(handle: AgentSessionHandle): AsyncIterable<AgentTranscriptEvent>;
}
```

### `PreviewPort`

Exposes development servers and browser sessions without leaking uncontrolled
host ports.

```ts
interface PreviewPort {
  discover(handle: SandboxHandle): Promise<PreviewEndpoint[]>;
  openBrowser(handle: SandboxHandle, endpointId: string): Promise<BrowserSessionHandle>;
  captureSnapshot(handle: SandboxHandle, endpointId: string): Promise<EvidenceArtifactRef>;
}
```

### `MachineInvokerPort`

Keeps the general machine/agent invocation boundary for tool calls, model
requests, and machine actions. It is intentionally not a sandbox lifecycle,
preview, git workspace, or merge port.

## Provider strategy

Use a provider registry, not hard-coded runtime decisions.

| Provider              | Local dev          | Production    | Notes                                                     |
| --------------------- | ------------------ | ------------- | --------------------------------------------------------- |
| `local-worktree`      | Yes                | No by default | Baseline for existing build plan and fast docs work       |
| `docker-devcontainer` | Yes                | Limited       | Uses existing `.devcontainer` shape for repeatable builds |
| `docker-sandbox`      | Yes, if installed  | Candidate     | Strong next provider for VM-like local autonomy           |
| `atelier-kata`        | No on Windows host | Yes           | Self-hosted VM isolation on Linux/KVM/Kubernetes          |
| `remote-devbox`       | Optional           | Optional      | E2B, Runloop, Codespaces, or other hosted backends        |

Requested provider choice is policy input, not authority. A workspace can
say: "all autonomous coding defaults to `vm`; docs-only may use `worktree`;
external repos require `vm`; non-VM mode requires approval."

Policy may raise isolation automatically. It must never silently lower
isolation. Downgrade from `vm` to `container` or `worktree` requires explicit
operator approval and a separate evidence entry. Replacing `vm` with `remote`
requires workspace-level approval and provider allowlisting unless the remote
provider has already been approved as an equivalent isolation class.

## Temporal workflow update

```text
BeadLifecycleWorkflow
  -> startRunActivity
  -> resolveExecutionModeActivity
  -> gitWorkspaceCreateActivity
  -> sandboxProvisionActivity
  -> agentExecutionActivity
  -> previewCollectActivity
  -> artifactCollectActivity
  -> waitForApprovalSignal
  -> mergeActivity
  -> sandboxCleanupActivity
  -> completeRunActivity
```

Mode resolution happens before provisioning. If the requested mode is not
allowed, the workflow creates an approval or fails closed with evidence,
depending on policy. The workflow may preflight provider capabilities before
creating the Git Workspace, but the `GitWorkspacePort` handle is created before
`SandboxProviderPort.create()` so provider requests and evidence have a stable
branch and base commit reference.

## Evidence obligations

Every bead sandbox must emit evidence for:

- mode requested and mode selected
- provider, image/template, resource limits, and policy decision
- branch/worktree handle and base commit
- agent identity and plugin version
- command transcript checksums
- preview endpoints and browser snapshots
- network policy and credential grants
- diff hunks and test/check results
- approval decisions and merge result
- cleanup, archive, or retention action

No merge can proceed if provisioning, agent execution, diff collection, approval,
or cleanup evidence is missing or unverifiable.

## Cockpit experience

Cockpit should make the bead the control surface:

- board cards show mode chip, sandbox health, preview status, and review state
- bead detail shows work item, thread, active sandbox, branch, evidence, and
  approval state
- sandbox route exposes tabs for Preview, Browser, Dev Server, Logs, Files, and
  Diff
- review route combines diff, preview snapshot, test results, policy checks, and
  approval history
- Mission Control shows fleet-level sandbox state, stuck provisioning, quota,
  sleepers, failures, and pending reviews

Mobile should support monitoring, snapshots, thread updates, and approvals.
Full live development remains desktop-first.

## Implementation phases

1. Add domain/spec contracts for `EngineeringSandboxV1`,
   `EngineeringRuntimePolicyV1`, `ExecutionMode`, provider registry, and
   sandbox lifecycle evidence.
2. Split the existing worktree execution plan into `GitWorkspacePort`,
   `SandboxProviderPort`, `AgentRuntimePort`, and `PreviewPort`.
3. Implement `local-worktree` provider as the compatibility baseline.
4. Add `docker-devcontainer` provider using the repo `.devcontainer` contract.
5. Add VM provider spike behind a feature flag. Start with Docker Sandboxes for
   local machines where available; use Atelier/Kata for Linux/KVM self-hosting.
6. Add Cockpit mode picker, sandbox route, and Mission Control fleet table using
   MSW fixtures before backend integration.
7. Require evidence completeness before diff approval and merge.

## Local Windows and WSL boundary

Local Windows/WSL development is useful for proving the UX and provider
contract, but it is not production-equivalent isolation. Firecracker, gVisor,
and Kata assumptions are Linux-first. A Windows-hosted provider should be marked
development-only unless execution happens inside a dedicated Linux VM provider
with clear provenance.

Local runs must not mount host user profiles, `.ssh`, cloud credentials, browser
profiles, or Docker daemon sockets into governed sandboxes.

## Security gates

The existing prerequisites in `README.md` still block autonomous release:

- fail-closed control-plane dependencies
- registered `before_tool_call` hook
- audit evidence when execution dependencies are missing
- LLM output sanitization at the MCP boundary
- session-bound `workspaceId`

Additional gates for VM sandboxes:

- credential grants are scoped to bead, provider, and TTL
- network egress is denied by default and opened only by policy
- workspace mounts are never broad host mounts
- provider images/templates are pinned and attestable
- mode changes require rebuild and create new evidence
- sandbox cleanup failure blocks bead closure until acknowledged

## Resolved decisions

1. `vm` is the default for autonomous coding and unattended agent-authored work,
   and for any task needing package installs, browser automation, Docker,
   external repositories, broad shell execution, or untrusted project code.
   `worktree` remains available for docs-only, read-only exploration, and tiny
   trusted edits when workspace policy explicitly allows it.
2. Hosted providers must not receive source code by default. They require
   explicit workspace-level approval, provider allowlisting, source/secrets
   policy acknowledgement, and evidence recording.
3. Preview URLs exposed to users must go through Portarium-controlled routing or
   reverse proxy controls. Provider-native URLs may be used only as internal
   upstream endpoints and must not become the review URL of record.
4. Failed sandboxes are archived by default until required evidence is
   captured and reviewed. Destruction after failure is allowed only by retention
   policy or explicit operator acknowledgement, and cleanup evidence remains
   mandatory.
5. Branch/worktree creation happens before sandbox provisioning. Creating the
   `GitWorkspacePort` handle first gives every provider request, evidence entry,
   artifact, and approval a stable bead/branch/base-commit reference.

Deferred detail is tracked outside this architecture reconciliation:

- `bead-1158` covers provider rollout strategy, feature flags, host
  prerequisites, and the first VM spike success criteria.
- `bead-1159` covers threat modeling for host mounts, Docker sockets,
  credentials, egress, provider compromise, evidence tampering, no-silent
  downgrade validation, and cleanup/archive failure closure rules.
- `bead-1160` covers the validation matrix for fixtures, port contract tests,
  evidence completeness, E2E rehearsals, and reviewer questions.

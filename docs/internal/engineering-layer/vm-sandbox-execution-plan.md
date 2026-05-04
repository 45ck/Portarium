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
  -> MergeExecutor merges or preserves sandbox for changes
  -> sandbox is destroyed, archived, or parked by retention policy
```

## Execution modes

| Mode | Purpose | Isolation | Default use |
| --- | --- | --- | --- |
| `worktree` | Fast local edit loop | Git/index isolation only | Read-only exploration, docs, tiny trusted edits |
| `container` | Repeatable dev environment | Shared host kernel | Normal low/medium risk tasks and CI-like checks |
| `vm` | Governed agent development | Guest kernel boundary | Default for autonomous coding, browser automation, package installs, untrusted repos |
| `remote` | Hosted sandbox provider | Provider boundary | Burst capacity, pilot demos, or machines without local virtualization |

The UI should not present this as a casual toggle. It is an `Execution Mode`
decision. Changing mode after provisioning requires `Rebuild Sandbox`, and the
new mode must produce new evidence so reviewers know which environment produced
the current diff and preview.

## New ports

### `SandboxProviderPort`

Creates and manages a bead-scoped execution environment.

```ts
interface SandboxProviderPort {
  create(request: SandboxCreateRequest): Promise<SandboxHandle>;
  start(handle: SandboxHandle): Promise<SandboxRuntimeState>;
  stop(handle: SandboxHandle, reason: StopReason): Promise<void>;
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

This is the bridge to agent execution, not sandbox lifecycle. Existing
`MachineInvokerPort`-style machine/agent invocation remains responsible for
agent requests and tool invocation; `SandboxProviderPort` only owns the
environment boundary.

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

## Provider strategy

Use a provider registry, not hard-coded runtime decisions.

| Provider | Local dev | Production | Notes |
| --- | --- | --- | --- |
| `local-worktree` | Yes | No by default | Baseline for existing build plan and fast docs work |
| `docker-devcontainer` | Yes | Limited | Uses existing `.devcontainer` shape for repeatable builds |
| `docker-sandbox` | Yes, if installed | Candidate | Strong next provider for VM-like local autonomy |
| `atelier-kata` | No on Windows host | Yes | Self-hosted VM isolation on Linux/KVM/Kubernetes |
| `remote-devbox` | Optional | Optional | E2B, Runloop, Codespaces, or other hosted backends |

Requested provider choice is policy input, not authority. A workspace can
say: "all autonomous coding defaults to `vm`; docs-only may use `worktree`;
external repos require `vm`; non-VM mode requires approval."

Policy may raise isolation automatically. It must never silently lower
isolation. Downgrade from `vm` to `container` or `worktree` requires explicit
approval and a separate evidence entry.

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
depending on policy.

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

## Open decisions

1. Should `vm` be the default for all agent-authored code, or only for
   autonomous/unattended sessions?
2. Should hosted providers be allowed to receive source code by default, or only
   after explicit workspace-level approval?
3. Should previews be exposed through Portarium-controlled reverse proxy only,
   or can providers expose their own URLs?
4. Should failed sandboxes be archived by default for review, or destroyed after
   evidence capture?
5. Should branch creation happen before or after sandbox provisioning? Creating
   first improves traceability; provisioning first can fail faster.

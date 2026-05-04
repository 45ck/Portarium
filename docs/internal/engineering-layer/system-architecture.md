# System Architecture: Governed Engineering Pipeline

## Pipeline overview

```
Any actor (human / ops / agent)
  ↓
[IntentRouter]          application/
  Normalises trigger into ProjectIntent value object
  Issues CreateProject command
  ↓
[BeadPlanner]           application/
  Decomposes intent into PlanV1
  Produces BeadProposal[] — one per planned task
  Requires human confirmation before worktrees created
  Enforces maxBeadsPerIntent: 20
  ↓
[SandboxExecutor]       infrastructure/ ← Temporal workflow
  bd issue start → .trees/<id>/ worktree
  Resolves execution mode and provisions sandbox
  VM is the default; container/worktree are policy-controlled alternatives
  portarium plugin loaded before agent work begins
  Streams stdout to RunV1 evidence chain
  │
  └─ Every tool call → portarium plugin before_tool_call hook (priority 1000)
       → @portarium/engine.validate() → ValidationDecision
       → AUTO: execute immediately
       → ASSISTED: execute + notify cockpit
       → HUMAN-APPROVE: suspend → emit approval request → poll
       → BLOCKED: deny + log to evidence chain
  ↓
[ArtifactCollector]     domain/ + infrastructure/
  git diff main..HEAD → DiffHunk[]
  npm run ci:pr must pass (non-zero = ArtifactFailed, worktree preserved)
  Produces markdown Run Artifact
  Attaches ArtifactV1 to evidence chain, signs provenance (ADR-0113)
  ↓
[DiffApprovalSurface]   presentation/ + application/
  Cockpit renders diff + policy rationale + blast radius
  Issues ProposalV1 through ADR-0118 pipeline
  Temporal workflow waits on signal (durable, survives restart)
  ↓
[MergeExecutor]         application/
  bd issue finish (conditional on CI — worktree preserved on failure)
  Emits BeadMerged CloudEvent
  Deploy = downstream consumer of that event
```

---

## Component placement

| Component                           | Layer                          | Status                                                            |
| ----------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `IntentRouter`                      | `src/application/`             | New                                                               |
| `ProjectIntent` value object        | `src/domain/`                  | New                                                               |
| `BeadPlanner`                       | `src/application/`             | New — PlanV1 exists                                               |
| `BeadProposal/v1` domain event      | `src/domain/`                  | New — versioned                                                   |
| `SandboxExecutor` Temporal activity | `src/infrastructure/temporal/` | New — wraps worktree/container/VM providers                       |
| `WorktreePort` interface            | `src/infrastructure/`          | New — thin adapter over `bd` CLI                                  |
| `SandboxProviderPort` interface     | `src/application/ports/`       | New — provider-neutral sandbox lifecycle                          |
| `AgentRuntimePort` interface        | `src/application/ports/`       | New — launch Codex/OpenCode/etc with Portarium hook               |
| `MachineInvokerPort`                | `src/application/ports/`       | Existing direction — agent/tool invocation, not sandbox lifecycle |
| `PreviewPort` interface             | `src/application/ports/`       | New — dev server, browser, and snapshot evidence                  |
| portarium plugin sandbox            | `packages/portarium/`          | Extend (beads 0959/0960)                                          |
| `@portarium/engine`                 | `packages/engine/`             | Stable                                                            |
| `ArtifactCollector`                 | `src/infrastructure/`          | New                                                               |
| `DiffApprovalSurface` API endpoint  | `src/presentation/`            | New                                                               |
| `MergeExecutor` Temporal activity   | `src/infrastructure/temporal/` | New                                                               |

---

## Temporal workflow

```
BeadLifecycleWorkflow
  ├─ startRunActivity         (exists)
  ├─ resolveExecutionMode     (new — policy decides vm/container/worktree/remote)
  ├─ worktreeStartActivity    (new — bd issue start via WorktreePort)
  ├─ sandboxProvisionActivity (new — SandboxProviderPort)
  ├─ agentExecutionActivity   (new — heartbeat 60s, loop detection)
  │    scheduleToCloseTimeout: per-bead config
  ├─ previewCollectActivity   (new — PreviewPort snapshot/endpoints)
  ├─ artifactCollectActivity  (new — runs ci:pr, builds ArtifactV1)
  ├─ waitForApprovalSignal    (existing pattern — durable, no timeout)
  │    signal: 'approvalDecided' { decision, rationale, decidedBy }
  ├─ mergeActivity            (new — bd issue finish via WorktreePort)
  ├─ sandboxCleanupActivity   (new — archive/destroy by retention policy)
  └─ completeRunActivity      (exists)
```

Temporal is NOT used for BeadPlanner (synchronous) or IntentRouter (HTTP handler).

---

## portarium plugin placement

Plugin lives inside the **agent execution sandbox** (the worktree). Not at the intent layer.

```
SandboxExecutor spins up agent → loads portarium plugin
→ plugin registers before_tool_call hook (priority 1000)
→ every tool call → hook POSTs to /v1/workspaces/:id/agent-actions:propose
→ @portarium/engine evaluates ValidationDecision
→ plugin: allow / deny / poll-for-approval
→ approvalTimeoutMs: Infinity (default)
→ failClosed: true (hook crash = tool call blocked)
```

## Sandbox provider placement

The sandbox provider is outside the agent runtime and below the control-plane
workflow. It must not make policy decisions itself. It receives a resolved
execution mode and a scoped provisioning request from Portarium, then reports
state and evidence back to the workflow.

```text
BeadLifecycleWorkflow
  -> resolveExecutionMode(policy)
  -> GitWorkspacePort.createWorkspace()
  -> SandboxProviderPort.create()
  -> SandboxProviderPort.start()
  -> AgentRuntimePort.launch()
  -> PreviewPort.discover()
```

Provider adapters can be local worktree, Docker/devcontainer, VM-backed local
sandbox, self-hosted Kata/Atelier, or hosted devbox. The workflow contract stays
the same across providers.

Do not overload `MachineInvokerPort` with sandbox lifecycle behavior. It remains
the invocation boundary for machine/agent tasks; sandbox creation, attestation,
preview discovery, retention, and cleanup live behind `SandboxProviderPort` and
the workflow activities above.

---

## Failure modes

| Failure                       | Detection                                       | Response                                                                    |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| Agent execution loop          | `callLimits` in engine + Temporal heartbeat 60s | Workflow → `NeedsReview`, creates approval request                          |
| Malformed artifact (CI fails) | `ArtifactCollector` non-zero exit               | `ArtifactFailed`, worktree preserved, bd finish does NOT run                |
| Sandbox provisioning fails    | Provider state/error event                      | `ProvisionFailed`, bead preserved, evidence appended, retry/choose provider |
| Silent mode downgrade         | Mode evidence does not match policy             | Block approval/merge; require explicit operator approval                    |
| Cleanup fails                 | Provider cleanup result missing or failed       | `CleanupFailed`, bead cannot close until acknowledged or retried            |
| Approval queue backup         | >5 pending Class A items                        | Stop accepting new HUMAN-APPROVE, new requests → BLOCKED                    |
| Temporal signal loss          | CloudEvent retry with backoff                   | Escalation chain fires if no signal within N hours                          |
| BeadPlanner overdecomposition | Output validation                               | Proposal gate + maxBeadsPerIntent:20, each bead needs spec reference        |

---

## New domain types needed

| Type                         | Why                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `ProjectIntent`              | Branded value object for trigger input                                                       |
| `BeadProposal/v1`            | Versioned domain event from BeadPlanner — must be versioned before autonomous production     |
| `AutonomyPolicy`             | Per-workspace tier matrix                                                                    |
| `PolicyTierAssignment`       | Explicit PolicyRuleV1 → resolved ExecutionTier                                               |
| `WorktreeHandle`             | Bead ID + worktree path + branch name                                                        |
| `ExecutionMode`              | `worktree`, `container`, `vm`, or `remote`                                                   |
| `EngineeringRuntimePolicyV1` | Workspace policy for default mode, allowed fallbacks, provider allowlist, and approval rules |
| `EngineeringSandboxV1`       | Provider, sandbox ID, mode, state, TTL, resource limits, and evidence refs                   |
| `SandboxProviderCapability`  | Provider support matrix for modes, browser, Docker, snapshots, and offline mode              |

---

## What NOT to build custom

| Concern                       | Use instead                                   |
| ----------------------------- | --------------------------------------------- |
| Durable lifecycle             | Temporal (already in stack)                   |
| Git worktree lifecycle        | `bd` CLI via thin `WorktreePort` adapter      |
| Sandbox provider lock-in      | `SandboxProviderPort` registry                |
| Diff rendering                | `git diff` output + `ScrollArea`              |
| Fine-grained approval routing | OpenFGA (already in stack)                    |
| SBOM / provenance             | OpenSSF Scorecard + SLSA (ADR-0110, ADR-0113) |

---

## Security non-negotiables (before ship)

1. LLM output sanitization at MCP boundary — normalize paths/commands before policy evaluation
2. `workspaceId` session-bound — `expectedWorkspaceId` check non-optional for mutation-tier ops
3. Fail-closed hooks — hook crash blocks the tool call
4. Auth startup hard-fail on missing secrets
5. Dependency manifest scan at PR gate — before `createPullRequest`/`mergePullRequest` approval
6. Mode downgrade must be explicit — never silently fall back from VM to container/worktree
7. Credential grants must be sandbox-scoped and TTL-bound
8. Sandbox cleanup evidence is required before bead closure

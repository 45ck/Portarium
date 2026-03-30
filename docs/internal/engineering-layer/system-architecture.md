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
[WorktreeExecutor]      infrastructure/ ← Temporal workflow
  bd issue start → .trees/<id>/ worktree
  Provisions sandbox (openclaw-plugin loaded, junction links)
  Streams stdout to RunV1 evidence chain
  │
  └─ Every tool call → openclaw-plugin before_tool_call hook (priority 1000)
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

| Component | Layer | Status |
|---|---|---|
| `IntentRouter` | `src/application/` | New |
| `ProjectIntent` value object | `src/domain/` | New |
| `BeadPlanner` | `src/application/` | New — PlanV1 exists |
| `BeadProposal/v1` domain event | `src/domain/` | New — versioned |
| `WorktreeExecutor` Temporal activity | `src/infrastructure/temporal/` | New |
| `WorktreePort` interface | `src/infrastructure/` | New — thin adapter over `bd` CLI |
| openclaw-plugin sandbox | `packages/openclaw-plugin/` | Extend (beads 0959/0960) |
| `@portarium/engine` | `packages/engine/` | Stable |
| `ArtifactCollector` | `src/infrastructure/` | New |
| `DiffApprovalSurface` API endpoint | `src/presentation/` | New |
| `MergeExecutor` Temporal activity | `src/infrastructure/temporal/` | New |

---

## Temporal workflow

```
BeadLifecycleWorkflow
  ├─ startRunActivity         (exists)
  ├─ worktreeStartActivity    (new — bd issue start via WorktreePort)
  ├─ agentExecutionActivity   (new — heartbeat 60s, loop detection)
  │    scheduleToCloseTimeout: per-bead config
  ├─ artifactCollectActivity  (new — runs ci:pr, builds ArtifactV1)
  ├─ waitForApprovalSignal    (existing pattern — durable, no timeout)
  │    signal: 'approvalDecided' { decision, rationale, decidedBy }
  ├─ mergeActivity            (new — bd issue finish via WorktreePort)
  └─ completeRunActivity      (exists)
```

Temporal is NOT used for BeadPlanner (synchronous) or IntentRouter (HTTP handler).

---

## openclaw-plugin placement

Plugin lives inside the **agent execution sandbox** (the worktree). Not at the intent layer.

```
WorktreeExecutor spins up agent → loads openclaw-plugin
→ plugin registers before_tool_call hook (priority 1000)
→ every tool call → hook POSTs to /v1/workspaces/:id/agent-actions:propose
→ @portarium/engine evaluates ValidationDecision
→ plugin: allow / deny / poll-for-approval
→ approvalTimeoutMs: Infinity (default)
→ failClosed: true (hook crash = tool call blocked)
```

---

## Failure modes

| Failure | Detection | Response |
|---|---|---|
| Agent execution loop | `callLimits` in engine + Temporal heartbeat 60s | Workflow → `NeedsReview`, creates approval request |
| Malformed artifact (CI fails) | `ArtifactCollector` non-zero exit | `ArtifactFailed`, worktree preserved, bd finish does NOT run |
| Approval queue backup | >5 pending Class A items | Stop accepting new HUMAN-APPROVE, new requests → BLOCKED |
| Temporal signal loss | CloudEvent retry with backoff | Escalation chain fires if no signal within N hours |
| BeadPlanner overdecomposition | Output validation | Proposal gate + maxBeadsPerIntent:20, each bead needs spec reference |

---

## New domain types needed

| Type | Why |
|---|---|
| `ProjectIntent` | Branded value object for trigger input |
| `BeadProposal/v1` | Versioned domain event from BeadPlanner — must be versioned before autonomous production |
| `AutonomyPolicy` | Per-workspace tier matrix |
| `PolicyTierAssignment` | Explicit PolicyRuleV1 → resolved ExecutionTier |
| `WorktreeHandle` | Bead ID + worktree path + branch name |

---

## What NOT to build custom

| Concern | Use instead |
|---|---|
| Durable lifecycle | Temporal (already in stack) |
| Git worktree lifecycle | `bd` CLI via thin `WorktreePort` adapter |
| Diff rendering | `git diff` output + `ScrollArea` |
| Fine-grained approval routing | OpenFGA (already in stack) |
| SBOM / provenance | OpenSSF Scorecard + SLSA (ADR-0110, ADR-0113) |

---

## Security non-negotiables (before ship)

1. LLM output sanitization at MCP boundary — normalize paths/commands before policy evaluation
2. `workspaceId` session-bound — `expectedWorkspaceId` check non-optional for mutation-tier ops
3. Fail-closed hooks — hook crash blocks the tool call
4. Auth startup hard-fail on missing secrets
5. Dependency manifest scan at PR gate — before `createPullRequest`/`mergePullRequest` approval

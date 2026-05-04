# Inspiration and Validation Plan

## Purpose

Portarium should learn from existing coding-agent tools without becoming a
clone of any of them. The product goal is governed engineering: task-native
agent work where every branch, sandbox, terminal, preview, diff, approval, and
merge is policy-backed and evidence-producing.

The reference products are useful because they prove pieces of the workflow:

- T3 Code proves a minimal multi-agent GUI can make CLI coding agents usable.
- Vibe Kanban proves kanban/task planning plus agent workspaces is the right
  operator shape.
- OpenCode proves provider-agnostic agent execution, plan/build modes, TUI
  ergonomics, and client/server separation matter.

Portarium's differentiator is governance. The copied pattern is not visual
style; it is the workflow primitive: work item -> isolated execution -> review
-> approved merge, with policy and evidence throughout.

## Source roles

| Source      | Use as inspiration for                                                                         | Do not copy                                                            |
| ----------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| T3 Code     | Minimal project/session shell, quick agent launch, desktop-like flow, provider auth preflight  | Branding, exact layout, release packaging assumptions                  |
| Vibe Kanban | Board-first planning, branch/workspace per task, terminal/dev server/diff/browser review loop  | Unsafe local execution defaults, hosted/commercial assumptions         |
| OpenCode    | Agent runtime UX, plan/build agent modes, provider-agnostic configuration, client/server model | Agent implementation internals unless explicitly vendored and licensed |

If source code is imported from any repo, it must be treated as a dependency or
vendored component with license review, attribution, update ownership, and a
security review. The default approach is to copy concepts, not files.

## Portarium product synthesis

```text
Work Item
  -> BeadPlanner creates Beads
  -> operator approves plan and requested execution mode
  -> EngineeringRuntimePolicyV1 resolves mode/provider
  -> SandboxProviderPort provisions sandbox
  -> AgentRuntimePort starts Codex/OpenCode/Claude/etc
  -> PreviewPort exposes browser/dev server safely
  -> ArtifactCollector captures diff, checks, logs, snapshots
  -> DiffApprovalSurface blocks merge until evidence is complete
  -> MergeExecutor merges or preserves sandbox for rework
  -> SandboxProviderPort archives/destroys environment
```

The default execution mode is `vm`. `container`, `worktree`, and `remote` are
available only when policy allows them. A UI choice is a request, not authority;
policy may raise isolation but must not silently lower it.

## UX plan

The Cockpit engineering surface should be bead-centric:

- Engineering Board: Vibe Kanban-style task columns, but cards show mode,
  provider, policy state, evidence health, preview state, and review status.
- Bead Detail: T3 Code-style focused session shell with prompt/thread,
  terminal, agent transcript, branch, plan, and current sandbox.
- Sandbox Route: Preview, Browser, Dev Server, Logs, Files, Diff, and Evidence
  tabs for one sandbox run.
- Review Route: Diff, preview snapshot, test results, policy decision path, and
  approval history in one surface.
- Mission Control: Provider health, quota, stuck provisioning, sleepers,
  cleanup failures, and pending high-risk approvals.
- Agent Runtime Panel: OpenCode-inspired plan/build mode visibility and
  provider-agnostic runtime config.

Mobile supports monitoring, snapshots, thread replies, and approvals. Live
development remains desktop-first.

## Validation ladder

1. Documentation/spec validation
   - ADR, spec, build plan, and UX docs agree on the same lifecycle names.
   - `EngineeringSandboxV1` and `EngineeringRuntimePolicyV1` are the canonical
     records.

2. Fixture validation
   - MSW/API fixtures cover `worktree`, `container`, `vm`, `remote`.
   - Fixtures include happy path, policy block, provider unavailable, approval
     required, cleanup failure, and no-silent-downgrade cases.

3. Contract tests
   - Every `SandboxProviderPort` adapter passes create/start/status/events/
     preserve/destroy tests.
   - `AgentRuntimePort` proves the Portarium hook is loaded before work begins.
   - `PreviewPort` proves previews are exposed through controlled URLs only.

4. Policy and evidence tests
   - Mode resolution emits `SandboxModeResolved`.
   - VM downgrade requires explicit policy allowance and evidence.
   - Missing provisioning, agent, preview, checks, approval, or cleanup evidence
     blocks merge.
   - Credential grants are scoped to sandbox and expire before sandbox TTL.

5. Provider progression
   - First provider: `local-worktree`, for compatibility and docs work.
   - Second provider: `docker-devcontainer`, for repeatable local development.
   - Third provider: VM-backed sandbox behind a feature flag.
   - Hosted providers require explicit source-code and secrets approval.

6. End-to-end tests
   - Create bead -> provision sandbox -> run agent -> collect preview/diff ->
     approve -> merge -> cleanup.
   - Repeat with checks failed, preview failed, agent failed, provider failed,
     approval denied, and cleanup failed.

7. Manual UX review
   - A reviewer can answer: what changed, who/what changed it, where it ran,
     what evidence exists, what policy allowed it, and what happens if I deny.
   - The UI never hides whether work came from worktree, container, VM, or
     remote execution.

## Build order

1. Lock the docs/spec/API names.
2. Build Cockpit fixtures and UI states before live providers.
3. Implement `local-worktree` through `SandboxProviderPort`.
4. Add provider contract tests and evidence completeness gates.
5. Add `docker-devcontainer`.
6. Add VM provider spike.
7. Add provider health and cleanup monitoring to Mission Control.

This keeps the product testable before VM infrastructure is perfect.

## Planning beads

These beads must stay in planning/design mode until their acceptance criteria
are satisfied. They are not implementation authorization by themselves.

| Bead        | Focus                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `bead-1156` | Validate VM-first sandbox architecture and naming before implementation |
| `bead-1157` | Refine Cockpit engineering sandbox UX from reference products           |
| `bead-1158` | Select provider rollout strategy across worktree/container/VM/remote    |
| `bead-1159` | Threat-model governed engineering sandbox modes                         |
| `bead-1160` | Define the validation matrix and merge-blocking evidence gates          |
| `bead-1161` | Review reference products and reuse/license boundaries                  |

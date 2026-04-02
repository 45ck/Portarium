# Governed Engineering Layer

Portarium governs what agents do in production. This layer extends that to **what agents build** — letting any actor (human, ops, another agent) trigger software work, have agents execute it autonomously in isolated worktrees, and route every consequential action through Portarium's existing policy engine before it lands anywhere permanent.

This is not a new product. It is Portarium eating its own dog food: the same approval loop, policy tiers, and WORM evidence trail that govern a "send email" action now govern a "merge this branch" action.

---

## What this is

```
Any actor
  → describes intent ("add webhook endpoint for payments")
  → Portarium decomposes into beads
  → agent executes each bead in an isolated git worktree
  → every tool call routes through @portarium/engine
  → consequential actions (git push, deploy, migration) block for human approval
  → human reviews the diff — approves or denies
  → decision is signed into the WORM evidence chain
  → bead merges, worktree cleaned up
```

The agent never acts unilaterally on anything irreversible. The human never has to manage the boring parts.

---

## What this is NOT

- An IDE (Antigravity, Cursor do this — they win there, don't compete)
- A project tracker (Linear does this — they win there, don't compete)
- A code generation quality layer (the model handles that)
- A new approval mechanism (reuses the existing ADR-0118 Propose/Approve/Execute pipeline)

Portarium's wedge: **policy evaluation at the action boundary, not the commit boundary**. Antigravity and Linear govern after the diff is written. Portarium governs before the tool call executes.

---

## Document map

| Document                                           | What it covers                                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [ux-layout.md](./ux-layout.md)                     | The cockpit UI — T3 Code base layout + Mission Control operational awareness                                                        |
| [cockpit-integration.md](./cockpit-integration.md) | Exact routes, new components, what to reuse from existing cockpit                                                                   |
| [system-architecture.md](./system-architecture.md) | Full pipeline: IntentRouter → BeadPlanner → WorktreeExecutor → ArtifactCollector → DiffApprovalSurface → MergeExecutor              |
| [hci-principles.md](./hci-principles.md)           | HCI/HAI grounding — levels of automation, trust calibration, operator state machine, "I can sleep" checklist, ironies of automation |
| [artifacts.md](./artifacts.md)                     | Artifact system — Run/Plan/Approval/Demo/Digest artifacts, demo-machine integration, markdown-first with embedded mp4/gif           |
| [build-plan.md](./build-plan.md)                   | What to build in what order, with bead assignments                                                                                  |

---

## Prerequisites before any of this ships

The governance core has known theater gaps that must close first:

1. **Noop stubs must fail-closed** — `ControlPlaneDeps` optional fields (policyStore, evidenceLog, actionRunner) currently silently noop. Must throw at startup or return 503 with an explicit "not configured" message. → bead-0972
2. **openclaw-plugin `before_tool_call` hook must actually register** — beads 0958/0959/0960 are P0 and unimplemented. The plugin exists but intercepts nothing.
3. **`actionRunner` absence must be audit-logged** — currently returns 503 with no evidence entry. Governance bypass must be visible in the chain. → bead-0972
4. **LLM output sanitization at the MCP boundary** — tool call arguments are passed unsanitized into policy evaluation. → bead-0973
5. **`workspaceId` must be session-bound** — currently environment-variable-scoped, allowing cross-workspace escalation. → bead-0973

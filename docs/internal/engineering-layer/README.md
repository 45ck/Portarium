# Governed Engineering Layer

Portarium governs what agents do in production. This layer extends that to **what agents build** — letting any actor (human, ops, another agent) trigger software work, have agents execute it autonomously in isolated engineering sandboxes, and route every consequential action through Portarium's existing policy engine before it lands anywhere permanent.

This is not a new product. It is Portarium eating its own dog food: the same approval loop, policy tiers, and WORM evidence trail that govern a "send email" action now govern a "merge this branch" action.

---

## What this is

```
Any actor
  → describes intent ("add webhook endpoint for payments")
  → Portarium decomposes into beads
  → policy selects an execution mode (VM by default, container/worktree by exception)
  → agent executes each bead in an isolated sandbox
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

| Document                                                                                                                                                     | What it covers                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [ux-layout.md](./ux-layout.md)                                                                                                                               | The cockpit UI — T3 Code base layout + Mission Control operational awareness                                                        |
| [cockpit-integration.md](./cockpit-integration.md)                                                                                                           | Exact routes, new components, what to reuse from existing cockpit                                                                   |
| [system-architecture.md](./system-architecture.md)                                                                                                           | Full pipeline: IntentRouter → BeadPlanner → SandboxExecutor → ArtifactCollector → DiffApprovalSurface → MergeExecutor               |
| [symphony-pl-local-routing.md](./symphony-pl-local-routing.md)                                                                                               | R&D direction for OpenAI Symphony-style scheduling, prompt-language contracts, local/frontier model routing, and evidence manifests |
| [gslr-1-governed-hybrid-routing.md](./gslr-1-governed-hybrid-routing.md)                                                                                     | First claim-shaped micro-experiment handoff: MC projection fixture, four routing arms, evidence package, and Cockpit card fields    |
| [gslr-research-synthesis-2026-05-12.md](./gslr-research-synthesis-2026-05-12.md)                                                                             | Research synthesis and product decision after the GSLR-1 scaffold; blocks runtime ingestion until live four-arm evidence exists     |
| [gslr-1-live-result-2026-05-12.md](./gslr-1-live-result-2026-05-12.md)                                                                                       | Live GSLR-1 result, Portarium product boundary, and post-run manifest verdict/telemetry hardening                                   |
| [gslr-post-symphony-decision-2026-05-12.md](./gslr-post-symphony-decision-2026-05-12.md)                                                                     | Post-Symphony research decision: board orchestration is prior art; Portarium waits for positive GSLR-2 evidence                     |
| [gslr-2-fixture-scaffold-2026-05-12.md](./gslr-2-fixture-scaffold-2026-05-12.md)                                                                             | GSLR-2 policy-schema fixture scaffold; product card and ingestion remain blocked until positive live model evidence                 |
| [gslr-2-live-result-2026-05-12.md](./gslr-2-live-result-2026-05-12.md)                                                                                       | GSLR-2 live result: local-only passed; hybrid passed but was not cost-effective for the tiny schema task                            |
| [gslr-route-policy-after-live-2026-05-12.md](./gslr-route-policy-after-live-2026-05-12.md)                                                                   | Post-live route-policy decision: tiny policy/schema task becomes local-screen only; product ingestion remains blocked               |
| [gslr-next-research-conclusions-2026-05-12.md](./gslr-next-research-conclusions-2026-05-12.md)                                                               | Next research conclusion: run GSLR3-5 before static evidence-card schema or runtime ingestion                                       |
| [gslr-3-fixture-scaffold-2026-05-12.md](./gslr-3-fixture-scaffold-2026-05-12.md)                                                                             | GSLR-3 deterministic scaffold for static evidence-card input transform; product ingestion remains blocked                           |
| [gslr-post-gslr3-research-decision-2026-05-12.md](./gslr-post-gslr3-research-decision-2026-05-12.md)                                                         | Post-GSLR-3 decision: blocked evidence must still become a blocked card; next run is live local-first before product work           |
| [gslr-3-live-result-2026-05-12.md](./gslr-3-live-result-2026-05-12.md)                                                                                       | GSLR-3 live result: local/advisor failed; frontier-only passed; evidence-card transform stays frontier-baseline                     |
| [static-evidence-card-schema-2026-05-12.md](./static-evidence-card-schema-2026-05-12.md)                                                                     | Docs/test-only static engineering evidence-card input schema; no runtime ingestion or live Cockpit card yet                         |
| [gslr-4-fixture-scaffold-2026-05-12.md](./gslr-4-fixture-scaffold-2026-05-12.md)                                                                             | GSLR-4 two-file validator scaffold; live hypothesis is advisor-only; product ingestion remains blocked                              |
| [gslr-4-live-result-2026-05-12.md](./gslr-4-live-result-2026-05-12.md)                                                                                       | GSLR-4 live result: advisor passed but cost more than frontier; two-file validator stays frontier-baseline                          |
| [gslr-5-live-result-2026-05-12.md](./gslr-5-live-result-2026-05-12.md)                                                                                       | GSLR-5 live result: frontier passed; local failed safe refs; raw-payload sanitizer stays frontier-baseline                          |
| [gslr-5-local-repair-2026-05-12.md](./gslr-5-local-repair-2026-05-12.md)                                                                                     | GSLR-5 local repair result: repaired local prompt passed once; route still waits for repeat evidence                                |
| [gslr-5r-local-repeat-2026-05-12.md](./gslr-5r-local-repeat-2026-05-12.md)                                                                                   | GSLR-5R repeat result: repaired local lane failed all three repeats; sanitizer remains frontier-baseline                            |
| [gslr-6-scaffolded-sanitizer-decision-2026-05-12.md](./gslr-6-scaffolded-sanitizer-decision-2026-05-12.md)                                                   | GSLR-6 result: scaffolded sanitizer passed three local repeats; exact R&D local-screen only, not product ingestion                  |
| [gslr-7-route-record-result-2026-05-13.md](./gslr-7-route-record-result-2026-05-13.md)                                                                       | GSLR-7 result: scaffolded route-record local attempts failed; route records remain frontier-baseline                                |
| [gslr-8-route-record-compiler-result-2026-05-13.md](./gslr-8-route-record-compiler-result-2026-05-13.md)                                                     | GSLR-8 result: PL-owned route-record compiler passed three local repeats; static projection candidate only                          |
| [gslr-9-static-card-projection-2026-05-13.md](./gslr-9-static-card-projection-2026-05-13.md)                                                                 | GSLR-9 result: static GSLR route evidence now projects into docs/test-only engineering evidence cards                               |
| [gslr-10-static-cockpit-card-export-2026-05-13.md](./gslr-10-static-cockpit-card-export-2026-05-13.md)                                                       | GSLR-10 result: static engineering evidence cards now export to frozen Cockpit view models; runtime cards remain blocked            |
| [gslr-11-static-cockpit-fixture-view-2026-05-13.md](./gslr-11-static-cockpit-fixture-view-2026-05-13.md)                                                     | GSLR-11 result: Cockpit now renders static GSLR evidence fixtures; no live ingestion or action controls                             |
| [gslr-12-signed-evidence-bundle-proof-2026-05-13.md](./gslr-12-signed-evidence-bundle-proof-2026-05-13.md)                                                   | GSLR-12 result: static GSLR evidence bundles now verify before projection; runtime import remains blocked                           |
| [gslr-13-manual-cockpit-bundle-preview-2026-05-13.md](./gslr-13-manual-cockpit-bundle-preview-2026-05-13.md)                                                 | GSLR-13 result: Cockpit manually previews verified static GSLR bundles; live ingestion remains blocked                              |
| [gslr-14-adversarial-static-bundle-corpus-2026-05-13.md](./gslr-14-adversarial-static-bundle-corpus-2026-05-13.md)                                           | GSLR-14 result: adversarial static bundles reject clearly in the manual preview; import remains blocked                             |
| [gslr-15-static-import-readiness-design-2026-05-13.md](./gslr-15-static-import-readiness-design-2026-05-13.md)                                               | GSLR-15 result: static import readiness gate for trust, artifact bytes, storage, review states, and structured rejection contracts  |
| [gslr-16-structured-rejection-codes-portable-corpus-2026-05-13.md](./gslr-16-structured-rejection-codes-portable-corpus-2026-05-13.md)                       | GSLR-16 result: verifier errors expose structured rejection codes and the adversarial corpus is portable bundle JSON                |
| [gslr-17-persistent-static-imported-record-design-2026-05-13.md](./gslr-17-persistent-static-imported-record-design-2026-05-13.md)                           | GSLR-17 result: static imported-record contract for verified and rejected bundles, with no persistence                              |
| [gslr-18-static-imported-record-repository-design-2026-05-13.md](./gslr-18-static-imported-record-repository-design-2026-05-13.md)                           | GSLR-18 result: append-only static imported-record repository contract, with no production persistence                              |
| [gslr-19-static-imported-record-importer-planning-2026-05-13.md](./gslr-19-static-imported-record-importer-planning-2026-05-13.md)                           | GSLR-19 result: manual static importer append planning, with no importer runtime                                                    |
| [gslr-20-static-importer-dry-run-fixture-2026-05-13.md](./gslr-20-static-importer-dry-run-fixture-2026-05-13.md)                                             | GSLR-20 result: route-independent static importer dry-run fixture for the future workbench                                          |
| [gslr-progress-checkpoint-2026-05-13.md](./gslr-progress-checkpoint-2026-05-13.md)                                                                           | Checkpoint: what the local/frontier/PL/Cockpit split now proves and what remains blocked                                            |
| [gslr-current-progress-2026-05-13.md](./gslr-current-progress-2026-05-13.md)                                                                                 | Current progress update: what is now built, what it proves, what remains blocked, and why static importer dry-run fixtures are next |
| [static-evidence-review-workbench-plan-2026-05-13.md](./static-evidence-review-workbench-plan-2026-05-13.md)                                                 | Engineering plan: stop broad GSLR research, make GSLR-20 the acceptance fixture, and build the static evidence review workbench     |
| [static-evidence-review-workbench-route-2026-05-13.md](./static-evidence-review-workbench-route-2026-05-13.md)                                               | Workbench result: internal Cockpit route over the GSLR-20 dry-run contract, with no runtime authority                               |
| [static-evidence-operator-report-export-2026-05-13.md](./static-evidence-operator-report-export-2026-05-13.md)                                               | Workbench report export: versioned static operator packet for bead/review attachment, with no runtime authority                     |
| [static-evidence-review-note-workflow-2026-05-13.md](./static-evidence-review-note-workflow-2026-05-13.md)                                                   | Workbench review-note workflow: constrained static decision labels and copyable bead/review Markdown                                |
| [gslr-21-static-verification-design-split-2026-05-13.md](./gslr-21-static-verification-design-split-2026-05-13.md)                                           | GSLR-21 result: production keyring and artifact-byte verification design split, with no live integration                            |
| [gslr-22-persistent-static-storage-design-2026-05-13.md](./gslr-22-persistent-static-storage-design-2026-05-13.md)                                           | GSLR-22 result: persistent static imported-record storage design gate, with no production database implementation                   |
| [gslr-23-persistent-static-repository-implementation-readiness-2026-05-13.md](./gslr-23-persistent-static-repository-implementation-readiness-2026-05-13.md) | GSLR-23 result: implementation-readiness checklist for future persistent static repository work                                     |
| [gslr-24-persistent-static-repository-stop-review-checkpoint-2026-05-13.md](./gslr-24-persistent-static-repository-stop-review-checkpoint-2026-05-13.md)     | GSLR-24 result: stop-review checkpoint before persistent static repository implementation                                           |
| [gslr-25-persistent-static-repository-review-packet-2026-05-13.md](./gslr-25-persistent-static-repository-review-packet-2026-05-13.md)                       | GSLR-25 result: operator/product static-only review packet before implementation                                                    |
| [vm-sandbox-execution-plan.md](./vm-sandbox-execution-plan.md)                                                                                               | VM-first sandbox execution plane, provider ports, execution modes, and rollout path                                                 |
| [inspiration-validation-plan.md](./inspiration-validation-plan.md)                                                                                           | How Portarium takes inspiration from T3 Code, Vibe Kanban, and OpenCode, plus validation gates                                      |
| [hci-principles.md](./hci-principles.md)                                                                                                                     | HCI/HAI grounding — levels of automation, trust calibration, operator state machine, "I can sleep" checklist, ironies of automation |
| [artifacts.md](./artifacts.md)                                                                                                                               | Artifact system — Run/Plan/Approval/Demo/Digest artifacts, demo-machine integration, markdown-first with embedded mp4/gif           |
| [build-plan.md](./build-plan.md)                                                                                                                             | What to build in what order, with bead assignments                                                                                  |

---

## Prerequisites before any of this ships

The governance core has known theater gaps that must close first:

1. **Noop stubs must fail-closed** — `ControlPlaneDeps` optional fields (policyStore, evidenceLog, actionRunner) currently silently noop. Must throw at startup or return 503 with an explicit "not configured" message. → bead-0972
2. **portarium plugin `before_tool_call` hook must actually register** — beads 0958/0959/0960 are P0 and unimplemented. The plugin exists but intercepts nothing.
3. **`actionRunner` absence must be audit-logged** — currently returns 503 with no evidence entry. Governance bypass must be visible in the chain. → bead-0972
4. **LLM output sanitization at the MCP boundary** — tool call arguments are passed unsanitized into policy evaluation. → bead-0973
5. **`workspaceId` must be session-bound** — currently environment-variable-scoped, allowing cross-workspace escalation. → bead-0973

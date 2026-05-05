# T3 Code — Inspiration Review

## Summary

T3 Code (`pingdotgg/t3code`) is a minimal multi-agent GUI from T3 Tools Inc. (Theo Browne et al.) for driving CLI coding agents — Codex, Claude Code, OpenCode — from a single React/Electron shell. Architecturally it is a Node.js WebSocket server that wraps `codex app-server` (JSON-RPC over stdio), serves a Vite/React app, and orchestrates per-thread sessions via a clean event-sourced domain model (commands → decider → events → projector → read model) backed by Effect/Schema contracts. Each thread is a turn-based conversation that can run in its own git worktree with hidden git refs ("checkpoints") captured per turn so the diff is the primary review surface; one-click commit/push/PR is built in.

Top three takeaways for Portarium:

1. The right-panel "diff-as-review-surface" plus per-thread git worktree model maps almost 1:1 onto Portarium's bead-per-worktree workflow — the `ux-layout.md` mapping is correct.
2. The orchestration layer (decider/projector/reactor + `RuntimeReceiptBus`) is a textbook event-sourced pattern that Portarium can mirror to make sandbox lifecycle deterministic and testable.
3. T3's two-mode runtime switch (`Full access` vs `Supervised` with `approvalPolicy: on-request`, `sandboxMode: workspace-write`) is exactly the kind of UI-level choice that Portarium must reframe as a _request_ under policy, never an authority — and Portarium must surface VM/container/worktree mode plus PolicyTier and BlastRadius badges where T3 only shows a runtime mode toggle.

## Repo identity

- URL: https://github.com/pingdotgg/t3code
- Commit SHA at clone: `92e340d80cff793bdb06ed9d6761dfb1bde35c52`
- License: **MIT** (Copyright (c) 2026 T3 Tools Inc.). Permissive; reuse of source files allowed with copyright + license retention. Trademark / brand name "T3" is not granted by MIT and must not be reused.
- Last commit date: 2026-05-03 (`feat(web): collapse mobile composer by default (#1263)`)
- Stars: not fetched (cloned via `git clone --depth 1` only — no GitHub UI scrape).
- Primary languages: TypeScript (React/Vite frontend, Node.js/Effect backend), with Electron desktop shell. Build/runtime stack: Bun + Turborepo, oxlint/oxfmt, Vitest, Effect 4 beta + `@effect/atom-react`, TanStack Router/Query, shadcn-style `ui/` primitives over base-ui/react, Tailwind, Lucide icons, dnd-kit, `@pierre/diffs` for diff rendering.
- Current public verification: 2026-05-06 GitHub page still shows the repository as public, MIT-licensed, with 1,408 commits, Codex/Claude/OpenCode support in the README, and latest release `T3 Code v0.0.21` dated 2026-04-23.

## Architecture

**Entry points**

- `apps/server/src/bin.ts` / `cli.ts` / `server.ts` — Node CLI; `npx t3` launches an HTTP+WebSocket server on `:3773` and opens the browser.
- `apps/web/src/main.tsx` + `routeTree.gen.ts` — TanStack Router file-based routes under `apps/web/src/routes/`.
- `apps/desktop/` — Electron shell that spawns a desktop-scoped `t3` backend process and loads the same web app (`bun run dev:desktop`).
- `apps/marketing/` — separate Astro/marketing site (not relevant).

**Top-level workspaces**

- `apps/server` — Node WebSocket server. Owns orchestration, providers, terminals, git, filesystem, persistence, source-control providers, telemetry.
- `apps/web` — React/Vite SPA. Owns session UX, conversation/event rendering, client transport state machine.
- `apps/desktop` — Electron shell.
- `packages/contracts` — Effect/Schema schemas; the cross-cut type contract (provider events, WS protocol, orchestration aggregates).
- `packages/shared` — runtime utilities, explicit subpath exports (`@t3tools/shared/git`, `@t3tools/shared/DrainableWorker`).
- `packages/client-runtime`, `packages/effect-acp`, `packages/effect-codex-app-server` — typed clients for ACP and the Codex app-server JSON-RPC API.

**Server-side orchestration model** (`.docs/architecture.md`, `.docs/encyclopedia.md`)

The server is event-sourced and Effect-based. The model maps directly onto Portarium's existing application/domain split:

- **Aggregates**: `project`, `thread`. Workspace root + optional `worktreePath` per thread.
- **Commands** (`apps/server/src/orchestration/decider.ts`, `commandInvariants.ts`): `thread.create`, `thread.turn.start`, `thread.checkpoint.revert`, etc. Validated → produce events.
- **Events** (`projector.ts`): `thread.created`, `thread.message-sent`, `thread.turn-diff-completed`, etc. Source of truth.
- **Projector / Read model** (`ProjectionPipeline.ts`, `ProjectionSnapshotQuery.ts`): materialised view consumed by the WS push channel `orchestration.domainEvent`.
- **Reactors** — queue-backed `DrainableWorker` services for ordered side-effects:
  - `ProviderRuntimeIngestion` — consumes provider runtime events from `codex app-server`, normalises them to orchestration commands.
  - `ProviderCommandReactor` — dispatches provider calls in response to orchestration intents.
  - `CheckpointReactor` — captures git checkpoints (hidden refs) on turn start/complete and publishes receipts.
  - `ThreadDeletionReactor`, `OrchestrationReactor`.
- **`RuntimeReceiptBus`** — typed signals for async milestones (`checkpoint.baseline.captured`, `checkpoint.diff.finalized`, `turn.processing.quiesced`). Tests await receipts instead of polling, eliminating timing flakes.

**IPC / transport** (`packages/contracts/src/ws.ts`, `apps/web/src/wsTransport.ts`)

- Single WebSocket on `:3773`, JSON-RPC-style: `{id, method, params}` ↔ `{id, result|error}` plus typed _push_ envelopes with `{channel, sequence, data}`.
- Push channels: `server.welcome`, `server.configUpdated`, `terminal.event`, `orchestration.domainEvent`.
- Client transport is a state machine: `connecting → open → reconnecting → closed → disposed`. Outbound queues during disconnect, flushes on reconnect. Inbound is schema-validated at the boundary; decode failures become structured `WsDecodeDiagnostic`.
- `ServerReadiness` gates client welcome until startup barriers are complete; `ServerPushBus` enforces ordered delivery.
- Methods mirror `NativeApi` from contracts: `providers.startSession`, `providers.sendTurn`, `providers.interruptTurn`, `providers.respondToRequest`, `providers.stopSession`, `shell.openInEditor`, `server.getConfig`.

**Provider integration** (`apps/server/src/provider/`, `.docs/provider-architecture.md`)

- `ProviderService` brokers session lifecycle; `ProviderAdapter` is the port. Implemented adapters: `CodexAdapter` (full); `claudeCode` and `opencode` reserved in contracts and via separate "drivers" (`provider/Drivers/`, `acp/`, `opencodeRuntime.ts`).
- For Codex, the server spawns `codex app-server` per provider session and brokers JSON-RPC over stdio (`packages/effect-codex-app-server`).
- ACP (Agent Client Protocol) support sits in `packages/effect-acp` for non-Codex agents.

**Persistence**

- SQLite via `@effect/sql-sqlite-bun`. Projections + checkpoint metadata persisted; checkpoints themselves are hidden git refs (no extra blob store).

**Git / worktree integration** (`apps/server/src/git/`, `apps/server/src/vcs/`, `apps/server/src/sourceControl/`)

- `GitWorkflowService` exposes Effect-typed operations: `status`, `localStatus`, `remoteStatus`, `pullCurrentBranch`, `runStackedAction` (chained commit/push), `resolvePullRequest`, `preparePullRequestThread`, `listRefs`, `createWorktree`, `removeWorktree`, `createRef`, `switchRef`, `renameBranch`.
- Worktree-per-thread is opt-in: `Thread.worktreePath` in the orchestration contract. `worktreeCleanup.ts` on the web side detects orphaned worktrees on thread deletion.
- Source-control providers are pluggable: `GitHubSourceControlProvider`, `GitLabSourceControlProvider` discovered via `SourceControlProviderRegistry`; both use the `gh` / `glab` CLIs.

**Runtime modes** (`.docs/runtime-modes.md`)

Only two modes, set per session via the chat toolbar:

- `Full access` (default) — `approvalPolicy: never`, `sandboxMode: danger-full-access`.
- `Supervised` — `approvalPolicy: on-request`, `sandboxMode: workspace-write`. Triggers in-app `ComposerPendingApprovalPanel` for command/file approvals.

There is **no VM mode, no container mode, and no policy engine**. Sandbox isolation relies entirely on Codex's own sandbox flag and the worktree boundary.

## UX surfaces

The shell is a three-region React app under `apps/web/src/`:

- **Routes** (`apps/web/src/routes/`):
  - `__root.tsx` — top-level layout, auth gate.
  - `_chat.tsx` — authenticated chat region; binds keybindings (`chat.new`, `chat.newLocal`).
  - `_chat.index.tsx` — empty state.
  - `_chat.$environmentId.$threadId.tsx` — the actual three-panel session view; mounts `ChatView` + lazy `DiffPanel` inside a resizable inline sidebar (`@tanstack/react-router`, `RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY` switches to a sheet on narrow viewports).
  - `_chat.draft.$draftId.tsx` — draft thread (no provider yet).
  - `pair.tsx` — remote pairing (token + QR).
  - `settings.*.tsx` — Connections / General / Source control / Archived.

- **Layout primitives** (`apps/web/src/components/`):
  - `AppSidebarLayout.tsx` — left `SidebarProvider` with resizable rail (`THREAD_SIDEBAR_MIN_WIDTH = 13rem`, persisted to `chat_thread_sidebar_width`).
  - `Sidebar.tsx` — left projects+threads list, dnd-kit reordering, `ProjectFavicon`, `ThreadStatusIndicators` (PR status, terminal-running, change-request status).
  - `ChatView.tsx` — centre conversation: messages timeline, composer, branch toolbar, model picker, plan card, pending-approval panel.
  - `RightPanelSheet.tsx` + `DiffPanelShell.tsx` + `DiffPanel.tsx` — the right "diff as review surface", virtualised via `@pierre/diffs/react`, `Columns2Icon`/`Rows3Icon` toggle for split vs stacked.
  - `BranchToolbar*.tsx` — branch + environment + env-mode pickers above the composer.
  - `GitActionsControl.tsx` — commit / push / publish / open-PR menu; uses TanStack Query mutations, GitHub/GitLab CLI, includes default-branch confirmation dialogs and stacked-action progress toasts.
  - `PlanSidebar.tsx` — proposed plan with stepwise status icons (`completed` / `inProgress` / pending) and markdown export.
  - `CommandPalette.tsx` (`Ctrl/Cmd-K`) and `KEYBINDINGS.md` — first-class shortcuts (`chat.new`, `chat.newLocal`, terminal toggle, etc).
  - `ThreadTerminalDrawer.tsx` — bottom drawer with a real PTY (`node-pty`) for the thread's worktree.

- **Chat sub-components** (`apps/web/src/components/chat/`):
  - `MessagesTimeline.tsx` — virtualised timeline (`@legendapp/list/react`).
  - `ComposerPendingApprovalPanel.tsx` / `ComposerPendingApprovalActions.tsx` — Supervised-mode approval UI; renders `Command approval requested`, `File-read approval requested`, `File-change approval requested`.
  - `ProposedPlanCard.tsx`, `ContextWindowMeter.tsx`, `ProviderModelPicker.tsx`, `ChangedFilesTree.tsx`, `DiffStatLabel.tsx`, `ThreadErrorBanner.tsx`, `ProviderStatusBanner.tsx`.
  - `ComposerCommandMenu.tsx` + slash-command search.

- **Notable interaction patterns**:
  - One thread = one turn-based conversation = one optional git worktree.
  - Diff panel is route-state-driven (`diffRouteSearch.ts`) — diff selection is a deep-linkable URL search param, so reviewers can paste a link to a specific turn diff.
  - Checkpoints are turn boundaries; "revert to checkpoint" is a thread command (`thread.checkpoint.revert`) that restores the worktree.
  - "Quiesced" turns — UI knows when a turn is fully settled (not just text-streamed) by waiting on `RuntimeReceiptBus` `turn.processing.quiesced` — drives "Awaiting Approval"-like UI states without polling.
  - PR creation is one click via `GitActionsControl` → `gh pr create` / `glab mr create`.

## What to COPY OUTRIGHT

The MIT licence permits source reuse with attribution, but copying production code from a competitor product carries brand/optics risk and a maintenance liability. Recommend **concept reuse, not file vendoring**, with two narrow exceptions worth considering:

- **`apps/web/src/worktreeCleanup.ts`** — 46 lines of pure logic for detecting orphaned worktrees on thread deletion; trivial to re-derive but the test cases (`worktreeCleanup.test.ts`) are useful as fixtures. License-gate: MIT + attribution acceptable.
- **`packages/contracts` orchestration command/event vocabulary** — not the file, but the _naming convention_ (`thread.created`, `thread.turn-diff-completed`, `checkpoint.baseline.captured`). Portarium can adopt the same naming discipline (past-tense events, dotted aggregate prefix) for sandbox/run events.

For everything else the recommendation is: take the pattern, write our own implementation. Copying T3's React components into Cockpit would create a brand collision and tangle dependency footprints (`@pierre/diffs`, `@effect/atom-react`, `@base-ui/react`).

## What to TAKE INSPIRATION FROM

- **Three-panel shell + worktree-per-thread**. Validates the `ux-layout.md` mapping. The left projects/threads list, centre conversation, right diff-as-review surface is the right shape for bead-centric work.
- **Diff route as deep link** (`diffRouteSearch.ts`). Portarium's approval surface should support `/engineering/bead/<id>/diff?turn=…&file=…` so reviewers can paste links to specific evidence.
- **Checkpoint-as-hidden-git-ref**. T3 captures a baseline ref before each turn and a result ref after; the diff is computed between refs. This is an inexpensive way for Portarium's sandbox to produce per-turn evidence without a separate blob store, and it interoperates with `git push`.
- **`RuntimeReceiptBus` for async milestones**. Replaces "wait for state to look right" polling with explicit signals (`turn.processing.quiesced`). Portarium should mint receipts like `sandbox.provisioned`, `agent.turn.quiesced`, `evidence.bundle.finalized`, `policy.decision.recorded` and drive UI + tests off them.
- **Drainable workers + `drain()` for tests**. Every reactor in T3 implements `drain()` so tests can deterministically wait for queued work to finish. Portarium's reactor layer should adopt this — it eliminates a class of CI flake.
- **`ServerReadiness` startup gate**. The server refuses WS clients until startup barriers complete. Portarium's control plane should similarly refuse Cockpit traffic until policy engine, evidence chain, and provider registry are healthy.
- **Stacked git actions** (`runStackedAction`, `GitActionsControl`). One UI affordance triggers a chained "commit → push → open PR" flow with per-stage progress and per-stage rollback. Portarium's "approve → sign evidence → merge" should use the same staged-progress affordance with a rollback at each stage.
- **`ProposedPlanCard`** with stepwise status icons. Maps onto Portarium's "what the agent says it will do" preview that operators can scrutinise before granting `HUMAN-APPROVE`.
- **Pairing-token UX for remote** (`REMOTE.md`, `pair.tsx`, QR codes). Useful pattern for Portarium's mobile approval app.
- **Two visible runtime modes in the toolbar** — even though Portarium's modes are richer (worktree/container/vm/remote), the _visibility_ lesson is correct: never hide the execution mode from the operator.
- **Effect/Schema contract package as a single source of truth**. `packages/contracts` has zero runtime; it is consumed by both server and web. Aligns with Portarium's `src/domain/primitives/` discipline.

## What to MODIFY for governance

T3 has the right shell but no governance. Portarium's deltas:

- **Add `PolicyTierBadge` and `BlastRadiusBadge` to every thread/bead card**, every approval panel, every commit action. T3's `ThreadStatusIndicators.tsx` is the right insertion point — add a tier+radius row alongside PR-status/terminal-running indicators.
- **Replace the runtime-mode toggle with a _requested mode_ picker plus a _resolved mode_ badge**. T3 lets the user pick `Full access`. Portarium must show: "you requested `worktree`; policy resolved `vm`; resolution recorded as `SandboxModeResolved`." Never silently downgrade.
- **Recast `ComposerPendingApprovalPanel` as a policy-driven approval gate**. T3 only knows `command` / `file-read` / `file-change`. Portarium's gate must show: policy ID, blast-radius, SoD status (was the requestor you?), evidence summary, scroll-to-unlock, rationale text input (min 10 chars), Approve/Deny/Request-changes — per `ux-layout.md`.
- **Wrap `GitWorkflowService.runStackedAction` in a policy-checked variant**. The same chained commit→push→PR flow, but each step records evidence and requires the previous step's policy decision to have been recorded.
- **Replace T3's "Full access" default with policy-default `vm`**. The default sandbox mode is VM, never silent downgrade — this is a single-line change in mode resolution but must be enforced in tests.
- **Insert evidence emission into every reactor**. T3's `CheckpointReactor` already publishes a "checkpoint captured" receipt. Portarium needs the receipt _and_ a hash-chained evidence entry so the WORM verifier can prove the snapshot.
- **Add a Mission Control / Topbar layer above T3's three-panel shell** for cross-bead operational signals (3 awaiting, 7 running, chain ✓). T3 has no equivalent.
- **Plug ACP / Codex app-server adapters behind `AgentRuntimePort`**. The Portarium hook (auth boundary, evidence emitter) must be loaded before the agent process accepts work — verified via a contract test, per the validation plan.
- **Source-control providers**: T3's `SourceControlProviderRegistry` shells out to `gh` / `glab` directly. Portarium needs to route those calls through the policy engine (e.g. `gh pr create` is `deploy:source-control`, may be `HUMAN-APPROVE`).

## What to AVOID

- **`approvalPolicy: never` + `sandboxMode: danger-full-access` as the default**. Directly contradicts Portarium's "default mode is `vm`, never silent downgrade" rule. Must be inverted in any borrowed code paths.
- **No policy engine at all**. T3's "Supervised" mode is a per-action interactive prompt with no policy persistence, no evidence, no SoD, no rationale, no blast-radius. Useful UI shape; do not copy the lack of governance underneath.
- **No evidence chain**. Checkpoints are unilateral git refs with no hash chaining or attestation. Portarium must add WORM evidence even where it borrows the checkpoint mechanism.
- **Single-environment Project model**. T3 binds `Project` to one environment; same git repo on local + remote becomes two projects loosely correlated by `RepositoryIdentity`. Portarium needs sandboxes to be first-class regardless of provider, with a single bead spanning provisioning across providers.
- **Bun + Effect 4 _beta_** as the runtime stack. Heavy lock-in to a still-moving ecosystem; Portarium's Node + workspace stack is more conservative and should stay that way.
- **Trademark/branding**. MIT does not grant the "T3" or "T3 Code" name. Do not reuse marks.
- **`@pierre/diffs`** as a hard dependency for diff rendering — vendor risk on a niche package; Portarium should evaluate `react-diff-view` or `@git-diff-view/react` and decide explicitly.
- **`CONTRIBUTING.md` posture** ("we are not accepting contributions") — fine for them, not a fit for Portarium's governed-engineering positioning.
- **Built-in CLI to spawn `codex app-server` directly** without verifying provider auth posture or scope. Portarium must verify auth scope before agent process start, per `AgentRuntimePort` contract.

## Concrete artifacts referenced

| Artifact path (relative to `C:/tmp/portarium-inspiration/t3-code/`)       | What it is                                                                       | Relevance to Portarium                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `LICENSE`                                                                 | MIT licence, T3 Tools Inc. 2026                                                  | License gate for any borrowed snippets                          |
| `README.md`                                                               | Top-level product description                                                    | Confirms scope: minimal multi-agent GUI, BYO-key                |
| `AGENTS.md`                                                               | Agent guidance + package roles                                                   | Describes server/web/contracts/shared split                     |
| `.docs/architecture.md`                                                   | Server architecture + lifecycle Mermaid diagrams                                 | Reference for Portarium control-plane diagrams                  |
| `.docs/encyclopedia.md`                                                   | Glossary of orchestration terms                                                  | Validates Portarium's ubiquitous-language pattern               |
| `.docs/provider-architecture.md`                                          | WS protocol + reactor pipeline                                                   | Direct analogue to Portarium provider layer                     |
| `.docs/runtime-modes.md`                                                  | Two runtime modes (`Full access`, `Supervised`)                                  | Anti-pattern reference for Portarium's policy modes             |
| `.docs/remote-architecture.md`                                            | Remote env model: `ExecutionEnvironment` / `KnownEnvironment` / `AccessEndpoint` | Mirrors Portarium provider abstraction                          |
| `REMOTE.md`                                                               | Pairing-token + QR remote-access UX                                              | Pattern for mobile approval pairing                             |
| `apps/server/src/orchestration/decider.ts`                                | Pure command→event decider                                                       | Pattern for Portarium application layer                         |
| `apps/server/src/orchestration/projector.ts`                              | Event→read-model projector                                                       | Same pattern                                                    |
| `apps/server/src/orchestration/Layers/CheckpointReactor.ts`               | Captures git checkpoints per turn                                                | Inspiration for sandbox checkpoint evidence                     |
| `apps/server/src/orchestration/Layers/RuntimeReceiptBus.ts` (`Services/`) | Typed async-milestone signals                                                    | Adopt for sandbox lifecycle signals                             |
| `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`        | Normalises provider events to orchestration commands                             | Pattern for `AgentRuntimePort`                                  |
| `apps/server/src/git/GitWorkflowService.ts`                               | Effect-typed git ops incl. `runStackedAction`                                    | Direct inspiration for Portarium's commit→push→PR pipeline      |
| `apps/server/src/sourceControl/GitHubSourceControlProvider.ts` (+ GitLab) | `gh`/`glab` shell-out PR creation                                                | Wrap in policy decision before reuse                            |
| `apps/server/src/checkpointing/Services/CheckpointStore.ts`               | Hidden-git-ref checkpoint storage                                                | Cheap evidence-snapshot mechanism                               |
| `apps/server/src/wsServer.ts` + `wsServer/readiness.ts` + `pushBus.ts`    | WS server + startup gate + ordered push bus                                      | Pattern for control-plane readiness/push                        |
| `packages/contracts/src/orchestration.ts`                                 | Aggregates, commands, events as Effect/Schema                                    | Naming convention reference                                     |
| `packages/contracts/src/ws.ts`                                            | Push channels + decode diagnostics                                               | Pattern for Portarium WS contracts                              |
| `packages/shared/src/DrainableWorker.ts`                                  | Queue-backed worker with `drain()` for tests                                     | Adopt for deterministic reactor tests                           |
| `apps/web/src/components/AppSidebarLayout.tsx`                            | Resizable left rail (3-panel host)                                               | Three-panel shell scaffold                                      |
| `apps/web/src/components/Sidebar.tsx`                                     | Projects+threads list with dnd-kit                                               | Bead/thread list pattern                                        |
| `apps/web/src/components/ChatView.tsx`                                    | Centre conversation panel                                                        | Bead-thread centre panel pattern                                |
| `apps/web/src/components/DiffPanel.tsx` + `DiffPanelShell.tsx`            | Right-panel diff viewer (virtualised)                                            | Diff-as-review-surface pattern                                  |
| `apps/web/src/components/RightPanelSheet.tsx`                             | Inline sidebar / sheet responsive switch                                         | Layout pattern for mobile                                       |
| `apps/web/src/diffRouteSearch.ts`                                         | URL-state for diff selection                                                     | Deep-linkable evidence pattern                                  |
| `apps/web/src/components/GitActionsControl.tsx`                           | Commit/push/publish/open-PR menu with default-branch dialogs                     | Approval action pattern; wrap in policy                         |
| `apps/web/src/components/BranchToolbar.tsx` (+ pickers)                   | Branch + environment + env-mode pickers                                          | Mode-selection UI pattern                                       |
| `apps/web/src/components/PlanSidebar.tsx`                                 | Proposed-plan card with stepwise status                                          | Plan-preview-before-approve pattern                             |
| `apps/web/src/components/CommandPalette.tsx` + `KEYBINDINGS.md`           | `Ctrl/Cmd-K` palette + first-class shortcuts                                     | Adopt for Cockpit                                               |
| `apps/web/src/components/chat/ComposerPendingApprovalPanel.tsx`           | In-app approval prompt UI                                                        | Recast as policy gate (per `ux-layout.md`)                      |
| `apps/web/src/worktreeCleanup.ts` (+ test)                                | Orphan-worktree detection on thread deletion                                     | Trivially portable — possible direct copy                       |
| `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`                  | Three-panel route definition                                                     | Reference for Cockpit bead route layout                         |
| `apps/desktop/`                                                           | Electron shell + auto-update                                                     | Optional reference for desktop packaging if Portarium ships one |

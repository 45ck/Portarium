# Vibe Kanban — Inspiration Review

## Summary

Vibe Kanban (BloopAI) is a board-first, multi-agent orchestration UI: kanban issues
on the left, "workspaces" on the right where a coding agent (Claude Code, Codex,
Gemini CLI, Copilot, Cursor, Amp, OpenCode, Droid, CCR, Qwen, ACP) gets a git
worktree, a branch, a terminal, a dev server, a diff/comment pane, and a built-in
preview browser with devtools. It is heavily aligned to the same shape Portarium is
building — but it runs every agent as a host child process inside the worktree with
no host-level isolation, and it has an explicit hosted "Cloud" tier with PostHog
analytics and Sentry baked into the build. Top three takeaways: (1) the
worktree-per-task workspace lifecycle is essentially what Portarium already does,
done for the same reason; (2) the in-process per-tool approval model with a
WebSocket-streamed approval queue is a strong reference for the "Awaiting Approval"
column; (3) we must not inherit its host-execution defaults or its cloud/telemetry
coupling.

## Repo identity

- URL: https://github.com/BloopAI/vibe-kanban
- Commit SHA at clone: `4deb7eca8f381f7cbc1f9d15515a9ab8f8009053` (chore: bump version to 0.1.44)
- License: Apache-2.0 (permissive; redistribution + modification allowed; must keep
  notices, no commercial restriction)
- Last commit date: 2026-04-24 (project is publicly **sunsetting** — README banner
  links to a shutdown announcement; mirror/fork before relying on it long-term)
- Stars: ~25.8k observed via WebFetch
- Primary languages: Rust ~50%, TypeScript ~46%, JavaScript ~1.5%
- Hosted/commercial coupling: **yes** — separate "Vibe Kanban Cloud" tier (sign-in
  with GitHub/Google, organisations, real-time sync via ElectricSQL); Dockerfile and
  build pipeline accept `POSTHOG_API_KEY`, `POSTHOG_API_ENDPOINT`, `SENTRY_DSN`,
  `VK_SHARED_API_BASE` build args; runtime envs for tunnel mode (`VK_TUNNEL`,
  `VK_SHARED_RELAY_API_BASE`); the server has a `track_if_analytics_allowed` call on
  the approval response endpoint; many backend crates exist solely for the cloud
  path (`relay-*`, `remote`, `host-relay`, `webrtc`, `embedded-ssh`,
  `trusted-key-auth`, `desktop-bridge`, `tauri-app`).
- Current public verification: 2026-05-06 GitHub page still shows the repository as
  public, Apache-2.0 licensed, sunsetting, and carrying the board/workspace/diff/
  preview/agent-switching feature set. The same page shows 2,070 commits and the
  README runtime/build environment variables that need stripping or policy review
  before any Portarium shipment.

## Architecture

**Backend**: Rust workspace under `crates/`. Server is `crates/server` (Axum), with
deployment swapped via the `Deployment` trait — `crates/local-deployment` for the
`npx vibe-kanban` mode, `crates/remote` for the cloud tier. Persistence is SQLite
via SQLx in `crates/db` (a blank seed DB ships in `dev_assets_seed/`). Cross-cutting
services live in `crates/services` (config, container, approvals, diff stream,
notifications, queued messages, analytics, file). Agent execution lives in
`crates/executors` with one module per agent (`claude`, `codex`, `gemini`, `amp`,
`copilot`, `cursor`, `opencode`, `droid`, `qwen`, plus an `acp` adapter and a
`qa_mock`). Worktrees are managed by `crates/worktree-manager` and
`crates/workspace-manager`. A separate preview proxy
(`crates/preview-proxy/src/lib.rs`) runs on its own port, routes
`{port}.localhost:{proxy}/path` to `localhost:{port}/path` so the iframe is on a
different origin from the cockpit ("isolates preview content from the main
application for security").

**Frontend**: pnpm workspace. `packages/local-web` and `packages/remote-web` are
thin Vite shells around `packages/web-core`, which holds the React feature code
(`features/kanban`, `features/workspace`, `features/workspace-chat`,
`features/create-mode`, `features/onboarding`, `features/export`, plus
`pages/kanban` and `pages/workspaces`). `packages/ui` is the shared component
library. TypeScript types are generated from Rust via `ts-rs` into `shared/types.ts`
and `shared/remote-types.ts` — never edited by hand.

**Agent execution model**: `LocalContainerService` in
`crates/local-deployment/src/container.rs` is the heart. It holds, per workspace, a
map of `Uuid -> Arc<RwLock<AsyncGroupChild>>` — i.e. the agent runs as a **direct
child process group of the server process**. There is no container, VM, namespace,
seccomp filter, or filesystem jail. The only "sandbox" mentions in the codebase are
inside the `codex` executor module, which forwards Codex's own `--sandbox` flag to
the spawned Codex CLI; that is the agent's internal sandbox, not a host-imposed
boundary. Cancellation is via `CancellationToken` and killing the process group.
Logs are streamed into an in-memory `MsgStore` and into the DB on a background task.
A 30-minute background loop in `spawn_workspace_cleanup` removes expired worktrees
unless `DISABLE_WORKTREE_CLEANUP` is set.

**Branch / workspace lifecycle**:

1. User creates a workspace from the kanban issue panel.
2. `WorktreeManager::create_worktree` (`crates/worktree-manager/src/worktree_manager.rs`)
   creates a new branch off the target branch (default `vk/<short-uuid>-<slug>`)
   via `GitService::create_branch`, then `git worktree add`s it under
   `~/.vibe-kanban-workspaces/` (configurable). A global `WORKTREE_CREATION_LOCKS`
   map prevents concurrent creation races on the same path.
3. Workspaces can attach **multiple repos** — each gets its own worktree branch and
   its own `RepoWorkspaceInput` row.
4. Setup scripts (e.g. `npm install`) run after creation if configured per repo.
5. Agent session starts inside the worktree. Conversations are stored as
   `Session`s, with `CodingAgentTurn`s, `ExecutionProcess`es, and `Scratch` drafts.
6. PR flow lives at `crates/server/src/routes/workspaces/pr.rs` plus `git.rs` —
   open a PR with an AI-generated description and merge from inside the cockpit.
7. `Workspace::mark_worktree_deleted` runs when a workspace expires; the directory
   is `tokio::fs::remove_dir_all`'d.

**Persistence**: SQLite single-file DB. Models include `Workspace`, `WorkspaceRepo`,
`Repo`, `Session`, `CodingAgentTurn`, `ExecutionProcess`,
`ExecutionProcessRepoState`, `Scratch`, plus the issue/kanban side. Cloud variant
uses Postgres via the `remote` crate and ElectricSQL for client-side sync.

**Approval model**: `crates/executors/src/approvals.rs` defines a small
`ExecutorApprovalService` trait — `create_tool_approval`,
`create_question_approval`, `wait_tool_approval`, `wait_question_answer`. Each
returns / awaits an `approval_id`. `wait_*` blocks the executor until the user
responds or the cancel token fires. The server side
(`crates/server/src/routes/approvals.rs`) exposes a POST to respond to an approval
plus a `stream_approvals_ws` WebSocket that pushes JSON-patch updates of the live
approval set; the cockpit stays in sync without polling. There is also a
`NoopExecutorApprovalService` that auto-approves everything (used in tests / when
approvals are off entirely — a foot-gun Portarium must not replicate as a default).

## UX surfaces

- **Kanban board** — `packages/web-core/src/pages/kanban/ProjectKanban.tsx` and
  `LocalProjectKanban.tsx`. Page composes `KanbanContainer.tsx`
  (`features/kanban/ui/`) with bulk-action bar, an issue panel, sub-issues panel,
  relationships panel, comments panel, and a workspaces panel for the selected
  issue.
- **Card schema** — Cloud issues carry: short id (`TASK-123`), title, description,
  status (column), priority, multiple assignees, tags, comments, sub-issues,
  relationships, attachments. Local issues are a slimmer subset stored in SQLite.
- **Task / issue detail panel** — opens to the right of the board
  (`KanbanIssuePanelContainer.tsx`), shows the issue body and the list of
  workspaces attached to that issue (`IssueWorkspacesSectionContainer.tsx`).
- **Workspace shell** — `packages/web-core/src/pages/workspaces/Workspaces.tsx`
  renders a three-pane layout: sidebar (`WorkspacesSidebarContainer`), main area
  (`WorkspacesMainContainer`), right sidebar (`RightSidebar.tsx`). The main area
  swaps between the chat/log stream, a file tree, the changes/diff panel, the
  preview browser, and a process list.
- **Terminal pane** — backed by `crates/local-deployment/src/pty.rs` and the server
  route `crates/server/src/routes/terminal.rs`; PTY streams over WebSocket.
- **Logs / chat pane** — `LogsContentContainer.tsx`. Each `ExecutionProcess`
  produces a `MsgStore`; the cockpit subscribes to the JSON-patch stream and
  renders normalized entries.
- **Diff pane** — `ChangesPanelContainer.tsx` with `CommentWidgetLine.tsx` for
  inline comments that get posted back to the agent as follow-up messages
  (`CodingAgentFollowUpRequest` in `crates/executors/src/actions/`).
- **Preview / browser pane** — `PreviewBrowserContainer.tsx` +
  `PreviewControlsContainer.tsx`; iframe is served by the separate preview proxy
  on a different origin, with bundled devtools (`bippy_bundle.js`,
  `click_to_component_script.js`, `devtools_script.js`, `eruda_init.js`) injected
  for inspect-mode and component clicking.
- **Approval / merge flow** — approvals stream over the dedicated WS endpoint and
  show as inline prompts in the chat/logs view; merge/PR controls live in the git
  panel (`GitPanelContainer.tsx`), with the backend route at
  `crates/server/src/routes/workspaces/pr.rs`.
- **Notifications** — desktop notifications via OS-specific paths in
  `crates/tauri-app/src/{linux,macos,windows}_notifications.rs`, plus an in-app
  notification bell.

## What to COPY OUTRIGHT

Nothing copied verbatim. License (Apache-2.0) permits copying with notice
preservation, but Portarium's stack (TanStack Router + shadcn + Hono/Node, no Rust
backend, no SQLx, no ElectricSQL, no Tauri, no PostHog) makes file-level reuse low
value. Empty list is the right call here.

## What to TAKE INSPIRATION FROM

- **Worktree-per-task lifecycle**, including: auto-generated branch slug
  (`vk/<short-uuid>-<task>`), creation lock keyed on path, configurable workspace
  root directory, periodic cleanup loop with an env-var kill-switch
  (`DISABLE_WORKTREE_CLEANUP`), `mark_worktree_deleted` rather than hard delete.
  Portarium already does worktree-per-bead — adopt the cleanup loop and the kill
  switch.
- **Approval service trait shape**: `create_tool_approval` →
  `wait_tool_approval(id, cancel_token)` returning a typed `ApprovalStatus`. The
  long-poll-with-cancel-token pattern is exactly the indefinite approval-wait loop
  Portarium needs (per CLAUDE.md memory note about overnight approval blocks).
- **Live approval queue over WebSocket** with JSON-patch deltas from a server-held
  patch stream — perfect fit for the cockpit's "Awaiting Approval" column.
- **Multi-repo workspace** — single workspace can contain multiple repos, each
  with its own worktree and target branch. Useful when a Portarium bead spans
  multiple service repos.
- **Per-workspace preview proxy on a distinct origin** — origin isolation between
  preview content and cockpit is a credible security pattern even before the
  sandbox VM lands.
- **`ts-rs` style codegen** of cross-language types — Portarium already does this
  with OpenAPI-driven SDKs, but the discipline of "never edit generated files" is
  worth re-stating in our own contract docs.
- **Workspace card / chat / changes / preview / processes / files tab grouping**
  inside one workspace shell — clean mental model.
- **Per-tool approval at the executor boundary** rather than per-prompt — matches
  Portarium's tool-call-mediated governance model.
- **Issue card schema** for the kanban: short id, title, status column, priority,
  multiple assignees, tags, comments, sub-issues, relationships, attachments. We
  already have an "Awaiting Approval" column planned in `ux-layout.md`; their
  card schema is a fine baseline.

## What to MODIFY for governance

- **Sandbox boundary is non-negotiable**: where Vibe Kanban does
  `AsyncGroupChild` directly into the host worktree, Portarium routes every spawn
  through the Sandbox Execution Plane (default VM, optionally container, never
  bare host unless policy explicitly grants `unsandboxed`). The
  `LocalContainerService` shape is fine; replace the spawn primitive with our
  sandbox provider boundary.
- **Cockpit-side mode choice is a request, not authority**: their UI lets you
  pick a coding agent and just runs it. Our cockpit collects the request and
  hands it to a policy decision point that can raise isolation but never silently
  lower it.
- **Replace `NoopExecutorApprovalService`** with a `RequiredApprovalService` that
  fails closed for any tool above its `BlastRadiusBadge` threshold. Auto-approve
  must be impossible to enable globally.
- **Add `PolicyTierBadge` and `BlastRadiusBadge`** on issue cards, on the workspace
  shell header, and on every approval prompt. Their approval prompt currently
  shows only `tool_name` + `execution_process_id`; add tier, blast radius,
  affected resources, justification, and required approver tier.
- **Evidence pane**: Vibe Kanban has a per-process log stream and a diff pane;
  Portarium adds an evidence pane that captures the full chain (prompt, tool
  calls, approvals, sandbox provider attestation, diff hash, PR URL, merge SHA)
  as a signed bundle.
- **Replace AI-generated PR descriptions with policy-aware ones** — keep the
  template, but inject blast-radius summary, evidence-bundle id, and approver
  list.
- **Strip the `track_if_analytics_allowed` calls** — Portarium evidence is local
  and audited; analytics, if present at all, must be opt-in and not on the
  approval path.
- **Drop the cloud relay/tunnel stack entirely** (`relay-*`, `remote`,
  `host-relay`, `webrtc`, `trusted-key-auth`, `embedded-ssh`, `desktop-bridge`).
  Portarium is single-tenant by design.

## What to AVOID

- **Spawning agents as host child processes by default** — biggest single risk
  to copy. Their architecture has zero filesystem, network, or process isolation
  from the host running the server. A malicious or runaway agent has the
  permissions of the user running `npx vibe-kanban`.
- **`NoopExecutorApprovalService`** as a default / test path that can be
  reachable in production builds.
- **PostHog + Sentry build-args bound into the binary** (`POSTHOG_API_KEY`,
  `POSTHOG_API_ENDPOINT`, `SENTRY_DSN` in `Dockerfile`). Build pipelines should
  not be able to inject telemetry endpoints.
- **Cloud account assumptions** — `useAuth`, `useUserOrganizations`,
  `useOrganizationStore` are core to `ProjectKanban.tsx`; their kanban page does
  not render without an org. Portarium's kanban must work fully offline / single
  tenant with no auth coupling at the page layer.
- **Tunnel mode** (`VK_TUNNEL`, relay APIs) — opens a path from a third-party
  relay into the developer's host. Not appropriate for a governed-execution
  product.
- **AI-generated PR descriptions with no policy context** — fine for a vibes
  product, not fine for governed engineering.
- **Mintlify-style hosted docs** as the only source of truth — their `docs/`
  builds for `vibekanban.com`; the README points there for almost everything.
  Portarium docs stay in-repo.
- **Sunsetting risk** — the project itself is winding down; do not depend on
  upstream fixes. If we want long-term reference, mirror the SHA we cloned.

## Concrete artifacts referenced

| Artifact path (in cloned repo)                                                                                                                                                                                                              | What it is                                                                                                      | Relevance to Portarium                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `crates/local-deployment/src/container.rs`                                                                                                                                                                                                  | `LocalContainerService` — spawns and tracks all agent processes                                                 | Reference for our sandbox-mediated container service; shows the **anti-pattern** of `AsyncGroupChild` directly on host |
| `crates/worktree-manager/src/worktree_manager.rs`                                                                                                                                                                                           | Worktree creation/cleanup with global creation lock                                                             | Adopt the lock + cleanup-loop pattern for our `.trees/<bead>/` flow                                                    |
| `crates/workspace-manager/src/workspace_manager.rs`                                                                                                                                                                                         | Multi-repo workspace orchestration                                                                              | Reference for spanning a bead across multiple repos                                                                    |
| `crates/executors/src/executors/mod.rs`                                                                                                                                                                                                     | `BaseAgentCapability` enum + per-agent module split                                                             | Reference for Portarium's pluggable coding-agent registry                                                              |
| `crates/executors/src/executors/codex.rs`                                                                                                                                                                                                   | Only place that wires an agent-internal `--sandbox` flag                                                        | Shows that even VK relies on the agent's own sandbox, not the host's                                                   |
| `crates/executors/src/approvals.rs`                                                                                                                                                                                                         | `ExecutorApprovalService` trait                                                                                 | Direct shape reference for our approval-wait API; replace `Noop` impl with `RequiredApproval`                          |
| `crates/executors/src/actions/coding_agent_initial.rs` + `coding_agent_follow_up.rs`                                                                                                                                                        | Initial vs follow-up tool actions                                                                               | Pattern for separating first-turn from subsequent-turn governance checks                                               |
| `crates/executors/src/command.rs`                                                                                                                                                                                                           | `CommandBuilder` / `CmdOverrides`                                                                               | Reference for declarative agent command construction with env overrides                                                |
| `crates/server/src/routes/mod.rs`                                                                                                                                                                                                           | Full HTTP surface, two-layer router (relay-signed inner, validated outer)                                       | Reference for separating policy-checked routes from raw handlers                                                       |
| `crates/server/src/routes/approvals.rs`                                                                                                                                                                                                     | POST respond + WS stream of JSON-patch approval deltas                                                          | Model for the cockpit's "Awaiting Approval" column live feed                                                           |
| `crates/server/src/routes/workspaces/` (`create.rs`, `execution.rs`, `pr.rs`, `git.rs`, `streams.rs`, `repos.rs`, `gh_cli_setup.rs`, `codex_setup.rs`, `cursor_setup.rs`)                                                                   | Workspace lifecycle endpoints                                                                                   | Direct map for Portarium's bead-workspace endpoints                                                                    |
| `crates/server/src/routes/preview.rs` + `crates/preview-proxy/src/lib.rs`                                                                                                                                                                   | Separate preview proxy on its own port and origin                                                               | Origin-isolation pattern for preview iframes                                                                           |
| `crates/server/src/routes/terminal.rs` + `crates/local-deployment/src/pty.rs`                                                                                                                                                               | PTY-over-WebSocket                                                                                              | Reference if we expose a terminal pane in the cockpit (must run inside sandbox, not host)                              |
| `packages/web-core/src/pages/kanban/ProjectKanban.tsx`, `LocalProjectKanban.tsx`, `KanbanIssuePanelContainer.tsx`                                                                                                                           | Kanban page composition                                                                                         | Layout reference for our kanban with `Awaiting Approval` column                                                        |
| `packages/web-core/src/features/kanban/ui/KanbanContainer.tsx`, `BulkActionBarContainer.tsx`                                                                                                                                                | Board container + bulk action bar                                                                               | Reference for board interactions                                                                                       |
| `packages/web-core/src/pages/workspaces/Workspaces.tsx`, `WorkspacesLayout.tsx`, `WorkspacesMainContainer.tsx`, `RightSidebar.tsx`                                                                                                          | Workspace shell layout                                                                                          | Three-pane workspace shell reference                                                                                   |
| `packages/web-core/src/pages/workspaces/{ChangesPanelContainer,PreviewBrowserContainer,PreviewControlsContainer,LogsContentContainer,FileTreeContainer,ProcessListContainer,GitPanelContainer,CommentWidgetLine,ReviewCommentRenderer}.tsx` | Diff / preview / logs / files / processes / git / inline comments                                               | Direct UX references for the workspace tabs Portarium needs                                                            |
| `crates/preview-proxy/src/{bippy_bundle,click_to_component_script,devtools_script,eruda_init}.js`                                                                                                                                           | Devtools injected into preview iframe                                                                           | Reference for cockpit "inspect mode" — but loading bundled JS into untrusted preview origins needs governance review   |
| `shared/types.ts`, `shared/remote-types.ts`, `crates/server/src/bin/generate_types.rs`                                                                                                                                                      | `ts-rs` cross-language type generation                                                                          | Pattern reference (Portarium uses OpenAPI-driven SDKs instead)                                                         |
| `Dockerfile`                                                                                                                                                                                                                                | Build with `POSTHOG_API_KEY`, `POSTHOG_API_ENDPOINT`, `SENTRY_DSN`, `VK_SHARED_API_BASE` baked in at build time | **Anti-pattern** for Portarium — telemetry endpoints must not be build-args                                            |
| `docs/cloud/index.mdx`                                                                                                                                                                                                                      | Documents the SaaS tier (sign-in, organisations, real-time sync)                                                | Confirms hosted-coupling verdict; outline of what we are NOT building                                                  |
| `docs/workspaces/creating-workspaces.mdx`                                                                                                                                                                                                   | Plain-English description of the worktree-per-task lifecycle                                                    | Useful reference wording for our own user-facing docs                                                                  |
| `LICENSE`                                                                                                                                                                                                                                   | Apache-2.0                                                                                                      | Permissive; we may borrow with attribution but should prefer clean reimplementation                                    |
| `README.md` (sunsetting banner)                                                                                                                                                                                                             | Project end-of-life notice                                                                                      | Reason to mirror the SHA we cloned and not depend on upstream                                                          |

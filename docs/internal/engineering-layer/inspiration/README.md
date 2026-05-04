# Inspiration Synthesis — T3 Code, Vibe Kanban, OpenCode

This is the cross-product synthesis of the three reference reviews:

- [`t3-code.md`](./t3-code.md) — `pingdotgg/t3code`, MIT, active.
- [`vibe-kanban.md`](./vibe-kanban.md) — `BloopAI/vibe-kanban`, Apache-2.0, **sunsetting**.
- [`opencode.md`](./opencode.md) — `sst/opencode`, MIT, active.

Each product was cloned read-only to `C:/tmp/portarium-inspiration/<name>/`, inspected from source/README/design docs (no execution), and a structured findings doc written to this directory.

This README turns those three reports into concrete recommendations that feed the planning beads:

- `bead-1157` — Cockpit engineering sandbox UX.
- `bead-1161` — Reference reuse and license boundaries.
- `bead-1156` — VM-first sandbox architecture (architectural cross-checks).
- `bead-1158` — Provider rollout strategy (cross-references to OpenCode's workspace adapter).

---

## TL;DR

1. **The three-panel shell + worktree-per-task primitive is right.** All three products converge on it, Portarium already does it. Adopt T3 Code's `ux-layout.md` mapping verbatim, layer Vibe Kanban's tab grouping inside the bead detail, top with a Mission Control topbar that none of them have.
2. **None of the three has governance.** Default approval is auto-approve in all three. Default sandbox is host-child-process in all three. This is the Portarium gap — and it is the entire reason Portarium exists.
3. **One file actually worth vendoring**: OpenCode's `permission/evaluate.ts` (~15 LOC, MIT). Two more worth selective vendoring with attribution: OpenCode's `permission/index.ts` schema (~50 LOC) and keybind catalogue. T3 Code's `worktreeCleanup.ts` (~46 LOC) is borderline. Everything else is concept reuse.
4. **The Vercel AI SDK is the right inner contract for `AgentRuntimePort`.** OpenCode proved it; don't reinvent. Plug `LanguageModelV3` from `@ai-sdk/provider` and let runtimes register themselves.
5. **OpenCode's `plan_exit` is Portarium's canonical approval seam.** Replace the inline `Question.Service` dialog with `DiffApprovalSurface`, persist the request id so overnight waits resolve, and the plan→build handoff becomes governed for free.
6. **OpenCode's `Hooks` contract** (`packages/plugin/src/index.ts`) is the most important single file across all three repos. Mirror its named hooks (`permission.ask`, `tool.execute.before/after`, `chat.params`, `shell.env`, `experimental_workspace.register`) and any OpenCode plugin ports to Portarium with a thin adapter.

---

## Per-product snapshot

| Product | Repo | License | Activity | Stack | Sandbox? | Hosted coupling | Direct vendor candidate? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T3 Code | `pingdotgg/t3code` | MIT | Active (HEAD 2026-05-03) | TS / React / Effect / Bun / Electron | No (worktree only) | No | One small file (`worktreeCleanup.ts`) |
| Vibe Kanban | `BloopAI/vibe-kanban` | Apache-2.0 | **Sunsetting** | Rust / Axum / SQLx / TS / Tauri | No (host child process) | **Yes** (PostHog/Sentry/Cloud tier) | None (stack divergence + EOL) |
| OpenCode | `sst/opencode` | MIT | Active (HEAD 2026-05-03) | TS / Bun / Hono / Effect / Solid+OpenTUI | No (host worktree) | Console/paid-tier surfaces | **Yes** (3 small artifacts, attribution-gated) |

---

## Convergent patterns across the three

These are the patterns where two or three of the products independently agreed. High confidence that Portarium should adopt these.

### 1. Worktree-per-task is the unit of isolation
T3 Code (`Thread.worktreePath`), Vibe Kanban (`WorktreeManager` + `vk/<short-uuid>-<slug>` branches), OpenCode (`worktree/index.ts` per session/branch). All three. Portarium's `.trees/<bead>/` flow is the same idea.

**Action**: harden Portarium's worktree lifecycle by adopting Vibe Kanban's pattern: global creation lock keyed on path, configurable workspace root, periodic cleanup loop with env-var kill-switch (`DISABLE_WORKTREE_CLEANUP`-equivalent), `mark_worktree_deleted` rather than hard delete.

### 2. Diff-as-review-surface, virtualised, route-state-driven
T3 Code's `DiffPanel` + `diffRouteSearch.ts` + `@pierre/diffs` is the cleanest implementation; Vibe Kanban has the equivalent in `ChangesPanelContainer.tsx` with inline-comment-as-follow-up-message.

**Action**: Portarium's `DiffApprovalSurface` adopts URL-state for diff selection so approval evidence is **deep-linkable** (`/engineering/bead/<id>/diff?turn=…&file=…`). Evaluate `react-diff-view` or `@git-diff-view/react` over `@pierre/diffs` to avoid niche dependency.

### 3. Per-tool approval with deferred/long-poll await
Vibe Kanban: `ExecutorApprovalService` trait — `create_tool_approval` / `wait_tool_approval(id, cancel_token)`. OpenCode: `Permission.ask` creates a `Deferred`, publishes `permission.asked` bus event, parks the agent until reply (`once` / `always` / `reject`).

**Action**: this is the canonical shape for Portarium's overnight approval-wait loop (already captured in `MEMORY.md` as a hard requirement). Adopt the deferred-with-cancel-token pattern; persist the request id durably so cockpit/proxy restart doesn't drop it. Replace any default `Noop` impl with a fail-closed `RequiredApprovalService`.

### 4. Live approval queue over WebSocket
Vibe Kanban streams JSON-patch deltas of the live approval set on a dedicated WS endpoint. T3 Code has typed push channels (`orchestration.domainEvent`) on a single WebSocket; OpenCode has its `Bus` service publishing typed events the TUI subscribes to.

**Action**: Cockpit's "Awaiting Approval" column subscribes to a `permission.asked` / `permission.replied` stream over WS — JSON-patch deltas (Vibe Kanban) or typed event envelopes (T3 Code). Both work; pick the one that aligns with our existing TanStack Query caching.

### 5. Tab-grouped workspace inside the task surface
Vibe Kanban's workspace shell: chat / log stream / file tree / changes (diff) / preview browser / process list. T3 Code: chat + diff + terminal drawer. OpenCode (TUI): transcript + dialogs.

**Action**: bead detail Sandbox Route has tabs per `ux-layout.md` already (Preview, Browser, Dev Server, Logs, Files, Diff, Evidence). Vibe Kanban's tab list is the closest practical reference; add **Evidence** as Portarium-specific.

### 6. Origin-isolated preview proxy
Vibe Kanban runs `crates/preview-proxy` on a separate port and serves the iframe at `{port}.localhost:{proxy}/path` so the preview origin is distinct from the cockpit origin. Quoted: "isolates preview content from the main application for security."

**Action**: Portarium's `PreviewPort` should follow this. Even before VM-backed sandboxes land, a distinct-origin iframe is a credible defense-in-depth boundary.

### 7. Pluggable provider/agent registry
T3 Code: `ProviderAdapter` + `ProviderService`. Vibe Kanban: per-agent module under `crates/executors/`. OpenCode: `BUNDLED_PROVIDERS` (lazy-imported AI-SDK packages) + `provider` plugin hook.

**Action**: `AgentRuntimePort` mirrors OpenCode's pattern most closely — consume `LanguageModelV3` from `@ai-sdk/provider`, lazy-load adapters, allow plugin extension.

### 8. Event-sourced orchestration with deterministic test drains
T3 Code's `decider → projector → reactor` model with `DrainableWorker.drain()` for tests is the clearest. Vibe Kanban uses straight Axum routes + tokio tasks; OpenCode uses Effect runtime layers.

**Action**: Portarium's application layer should adopt T3 Code's pattern — pure decider, projector for read model, queue-backed reactors for side effects, all with `drain()` for tests. This eliminates a class of CI flake.

### 9. ServerReadiness startup gate
T3 Code refuses WS clients until startup barriers complete. OpenCode's `serve` warns but starts even with no password.

**Action**: Portarium control plane refuses cockpit traffic until policy engine, evidence chain, and provider registry are healthy (T3 Code pattern). Make `OPENCODE_SERVER_PASSWORD`-equivalent **mandatory** at boot, never optional (correcting OpenCode's posture).

---

## Cockpit UX recommendations (feeds bead-1157)

Concrete additions/refinements to `docs/internal/engineering-layer/ux-layout.md`. The base three-panel shell mapping is **validated** by the T3 Code review.

### Layout
- **Topbar** (Mission Control compressed): workspace selector · global search · `[N pending]` approval badge · chain-verified indicator · bell. *None of the three reference products has this; it is Portarium-specific.*
- **Left panel**: bead list, filterable by status / policy tier / actor. (T3 Code Sidebar pattern + Portarium tier filter.)
- **Center panel**: bead kanban with `Ready → Running → Awaiting Approval → Done` columns. (Vibe Kanban shape + Portarium-specific column.)
- **Right panel**: selected bead detail — tool call feed + diff + approval gate + evidence entries. (T3 Code DiffPanel pattern + Portarium evidence.)
- **Status bar**: `7 running · 3 awaiting approval · chain verified`.

### Bead detail tabs (Sandbox Route)
Adopt Vibe Kanban's tab grouping, extend with Portarium-specific tabs:

| Tab | Source pattern | Portarium addition |
| --- | --- | --- |
| Chat / Thread | T3 Code `ChatView` | Tool-call feed annotated with PolicyTier + BlastRadius |
| Diff | T3 Code `DiffPanel` + `diffRouteSearch.ts` | URL-state deep-link for evidence |
| Files | Vibe Kanban `FileTreeContainer` | Read-only outside sandbox |
| Preview | Vibe Kanban `PreviewBrowserContainer` + origin isolation | `PreviewPort`-issued URL only |
| Dev Server / Logs | Vibe Kanban `LogsContentContainer` | Streamed from inside sandbox |
| Processes | Vibe Kanban `ProcessListContainer` | Sandbox-scoped only |
| Terminal | T3 Code `ThreadTerminalDrawer` (PTY over WS) | PTY runs **inside** sandbox, never on host |
| **Evidence** | *(Portarium-specific)* | Hash-chained bundle: prompts, tool calls, approvals, sandbox attestation, diff hash, PR URL, merge SHA |

### Card schema
Borrow Vibe Kanban's issue card baseline (short id, title, status, priority, assignees, tags, comments, sub-issues, relationships, attachments) and add **on every card**:

- `PolicyTierBadge` (`AUTO` / `ASSISTED` / `HUMAN-APPROVE` / `BLOCKED`).
- `BlastRadiusBadge` (`low` / `medium` / `high` / `critical`).
- **Requested mode** vs **Resolved mode** (e.g. "requested: `worktree`; resolved: `vm`"), referencing `SandboxModeResolved`.
- Evidence completeness indicator (icon: provisioning / agent / preview / checks / approval / cleanup).

### Approval gate
Recast T3 Code's `ComposerPendingApprovalPanel` (or Vibe Kanban's per-tool approval) as the Portarium policy gate, showing:

- Policy ID + decision path.
- BlastRadiusBadge.
- SoD status (was the requestor you?).
- Evidence summary preview (collapsible).
- Scroll-to-unlock on `HUMAN-APPROVE` for `critical` blast radius.
- Rationale text input (min 10 chars).
- `Approve` / `Deny` / `Request changes`.

### Plan→build approval seam
**Adopt OpenCode's `plan_exit` as the canonical mechanic.** The plan agent halts via a `plan_exit` tool that, in Portarium, triggers a `DiffApprovalSurface` with: plan diff, policy decision, who approved. The synthesized "execute the plan" message is stamped with the approval id and sent to the build agent only after evidence is recorded.

### Stacked actions
T3 Code's `runStackedAction` (commit → push → publish → open PR) is the right affordance. Portarium's "approve → sign evidence → merge" should use the same staged-progress UI with per-stage rollback.

### Mobile scope
Mobile = monitoring + snapshots + thread replies + approvals (per existing plan). Live development stays desktop-first. Adopt T3 Code's pairing-token + QR pattern (`pair.tsx`, `REMOTE.md`) as the model for mobile auth.

### Keybinds
Adopt OpenCode's `config/keybinds.ts` schema (~150 named keybinds, `tui.json` per-keybind override). Notable for Cockpit: `agent_cycle = tab`, `agent_list = <leader>a`, `command_list = ctrl+p`, `session_interrupt = escape`, plus T3 Code's `Ctrl/Cmd-K` command palette.

---

## Architecture port decisions (feeds bead-1156, bead-1158)

| Portarium port | Reference shape | Source | Portarium delta |
| --- | --- | --- | --- |
| `AgentRuntimePort` | `LanguageModelV3` from `@ai-sdk/provider`, lazy-loaded `BUNDLED_PROVIDERS` map, `provider` plugin hook | OpenCode `provider/provider.ts` | Pre-flight policy hook before model registration; auth scope verified before agent process start; ACP v1 wire protocol with permission surfacing fixed |
| `SandboxProviderPort` | `experimental_workspace.register(type, adapter)` with `configure / create / remove / target` (`local{directory}` \| `remote{url, headers}`) | OpenCode `packages/plugin/src/index.ts` | **Widen `target` to include `vm` / `container` / `worktree`**; require `evidence` and `ttl` on result; default = `vm`, never silent downgrade |
| `PreviewPort` | Origin-isolated proxy on distinct port (`{port}.localhost:{proxy}/path`) | Vibe Kanban `crates/preview-proxy` | URLs minted per-sandbox per-TTL, signed; revoked on sandbox destroy |
| `MachineInvokerPort` | OpenCode's `Auth.Service` shape, but with sandbox-scoped TTL-bounded credentials | OpenCode `auth/` (rejected as-is; pattern only) | Issues credentials *into* the sandbox; expires before sandbox TTL; mandatory boot password |
| Approval system | `ExecutorApprovalService` trait + WS JSON-patch stream | Vibe Kanban `executors/src/approvals.rs` + `routes/approvals.rs` | Replace `Noop` impl with fail-closed `RequiredApprovalService`; durable persistence so overnight waits survive restart |
| Permission ruleset | `Action = allow\|deny\|ask`, wildcard rule eval | OpenCode `permission/index.ts` + `evaluate.ts` | Layer `EngineeringRuntimePolicyV1` *above* user config; may upgrade `allow → ask`, never silently downgrade |
| Plan→build seam | `plan_exit` tool with `Question.Service.ask` halt + synthesized resumption message | OpenCode `tool/plan.ts` | Halt routes through `DiffApprovalSurface`; resumption message stamped with approval id |
| Plugin hooks | `permission.ask`, `tool.execute.before/after`, `chat.params`, `shell.env`, `experimental_workspace.register` | OpenCode `packages/plugin/src/index.ts` | Mirror named hook surface; allow OpenCode plugins to port via thin adapter; `shell.env` allow-listed only |
| Reactor framework | Decider → projector → reactor, `DrainableWorker.drain()` | T3 Code `apps/server/src/orchestration/` | Adopt verbatim shape; mint Portarium receipts on `RuntimeReceiptBus` (`sandbox.provisioned`, `agent.turn.quiesced`, `evidence.bundle.finalized`, `policy.decision.recorded`) |
| Checkpoint/evidence | Hidden git refs per turn, baseline + result | T3 Code `CheckpointStore` | Adopt mechanism; **add hash-chained WORM evidence entry** alongside each ref so the verifier can prove the snapshot |
| Server readiness gate | Refuse WS clients until startup barriers complete | T3 Code `wsServer/readiness.ts` | Gate on policy engine + evidence chain + provider registry health |
| Worktree manager | Global creation lock, configurable root, periodic cleanup, kill-switch env | Vibe Kanban `WorktreeManager` | Adopt; `mark_worktree_deleted` rather than hard delete |
| Cross-language types | Generated from a single contract | T3 Code `packages/contracts` (Effect/Schema), Vibe Kanban `ts-rs`, OpenCode OpenAPI + `@hey-api/openapi-ts` | Stay with Portarium's existing OpenAPI-driven SDK pipeline |

---

## Reuse boundary tiers (feeds bead-1161)

Default rule: **concept reuse, not file vendoring.** Vendoring is a narrow exception, gated by the rules below.

### Tier 1 — Vendor with attribution

These are small, self-contained, non-load-bearing. License-compatible. Vendoring saves more effort than re-derivation.

| File | Source | License | LOC | Notes |
| --- | --- | --- | --- | --- |
| `permission/evaluate.ts` | OpenCode | MIT | ~15 | Wildcard rule evaluator; almost no Portarium-specific cost to re-derive, but stable enough to vendor |
| `permission/index.ts` (schemas only) | OpenCode | MIT | ~50 | `Action` / `Rule` / `Ruleset` / `RejectedError` / `CorrectedError`. Rename to Portarium branded primitives. |
| `config/keybinds.ts` (schema) | OpenCode | MIT | ~200 | Default keymap users carry across products; vendoring gives muscle-memory parity |
| `worktreeCleanup.ts` + tests | T3 Code | MIT | ~46 + tests | **Borderline.** Trivial to re-derive; the tests are the value. Decide at implementation time. |

**Vendoring rule for all of the above**:
- Prepend `// Portions adapted from <repo>@<sha> (<license>, Copyright ...)` at the top of the vendored file.
- Add the upstream LICENSE notice to a new `THIRD_PARTY_NOTICES.md` at the repo root.
- Record the upstream SHA the snippet was taken from so we can re-pull updates.

### Tier 2 — Concept reuse with named credit

Take the pattern, write our own implementation, credit the source in the relevant doc/ADR. No code travels across the boundary.

- T3 Code: three-panel shell mapping (already in `ux-layout.md`); `runStackedAction` flow; `RuntimeReceiptBus` async-milestone signals; `DrainableWorker.drain()` test pattern; checkpoint-as-hidden-git-ref evidence; `ServerReadiness` startup gate; pairing-token + QR for remote.
- Vibe Kanban: kanban card schema; multi-repo workspace; per-tool approval WS pattern; `LocalContainerService` shape (with Portarium spawn primitive); origin-isolated preview proxy; worktree creation-lock + cleanup loop with kill-switch.
- OpenCode: AI SDK provider abstraction; agent profile = name + ruleset + model + prompt; `plan_exit` approval seam; `Hooks` plugin contract; `WorkspaceAdapter` shape (widen for VM); bash arity parsing for fine-grained permissions; ACP v1 wire protocol.

Credit format: a `## Inspiration` section in the relevant ADR or design doc citing repo + SHA + file path.

### Tier 3 — Anti-patterns. Do NOT copy

These are explicit non-goals. Any reviewer should reject a PR that drifts toward them.

- **Default approval = `Noop` / auto-approve / `approvalPolicy: never`** (all three products). Portarium default is fail-closed.
- **Default sandbox = host child process** (Vibe Kanban) / `danger-full-access` (T3 Code) / direct host filesystem (OpenCode). Portarium default is `vm`.
- **Telemetry baked into build** (`POSTHOG_API_KEY`, `SENTRY_DSN` as Docker build args — Vibe Kanban). Portarium build is telemetry-free.
- **Optional auth on agent server** (`OPENCODE_SERVER_PASSWORD` — OpenCode). Portarium agent server requires auth at boot.
- **Paid-tier upsell dialogs** (`dialog-go-upsell.tsx` — OpenCode). Strip before any vendoring.
- **mDNS publication on by default** (OpenCode). Portarium opts in per policy.
- **Plugin auto-install from npm at runtime** (OpenCode `plugin/loader.ts` `Npm` helper). Portarium plugins are pre-baked into the sandbox image.
- **`shell.env` plugin hook taking arbitrary env** (OpenCode). Allow-listed plugins only.
- **One-server-many-workspaces switched by untrusted header** (`x-opencode-directory` — OpenCode). One agent server per sandbox per process.
- **Cloud relay/tunnel stack** (Vibe Kanban `relay-*`, `host-relay`, `webrtc`, `embedded-ssh`, `trusted-key-auth`, `desktop-bridge`). Portarium is single-tenant by design.
- **AI-generated PR descriptions with no policy context** (Vibe Kanban). Portarium PR descriptions inject blast-radius summary, evidence-bundle id, approver list.
- **Trademark reuse**. MIT/Apache-2.0 do **not** grant the "T3", "Vibe Kanban", or "OpenCode" name.

---

## Open questions to resolve before implementation

These should land as new beads or as decisions on existing planning beads before we start building.

1. **Diff renderer choice.** T3 Code uses `@pierre/diffs` (niche). Evaluate `react-diff-view` vs `@git-diff-view/react` vs build-our-own. (bead-1157 follow-up.)
2. **Approval transport choice.** Vibe Kanban's JSON-patch deltas vs T3 Code's typed push envelopes. Pick one and apply consistently across cockpit. (bead-1156 / bead-1157.)
3. **Cross-language contract pipeline.** Stay with OpenAPI + generated SDK (current Portarium), or add Effect/Schema-style runtime contracts (T3 Code)? Recommend stay with OpenAPI; revisit in 6 months. (bead-1156.)
4. **ACP server timeline.** Speaking ACP v1 (with permission surfacing + tool-call streaming fixed) makes Zed and any future ACP-aware editor governed-by-Portarium for free. Is this a phase-1 priority or phase-2? (bead-1158.)
5. **Vibe Kanban sunset risk.** Should we mirror the SHA we cloned (`4deb7eca…`) into a Portarium-controlled git mirror so the reference doesn't disappear? Low cost, removes a future research blocker. (bead-1161.)
6. **Effect runtime adoption.** Both T3 Code (Effect 4 beta) and OpenCode (Effect HttpApi mid-migration) are heavy on Effect. Portarium's stack is Hono/TanStack, no Effect. Stay course (recommended) or evaluate? (bead-1156.)
7. **Mid-migration risk in OpenCode.** OpenCode is mid-migration between Hono and Effect HttpApi. Pin our reference to the OpenAPI surface and `Hooks` contract only — do not depend on either runtime backend. (bead-1161.)

---

## Bead update checklist

After review of this synthesis, update:

- **bead-1157** — append "UX direction confirmed" note pointing to this README and to per-product Cockpit UX recommendations above. Acceptance criteria around card schema, mode badges, approval gate are now concrete.
- **bead-1161** — append "reuse boundaries decided" note pointing to the Tier 1/2/3 framework above. Tier 1 vendoring requires the attribution + `THIRD_PARTY_NOTICES.md` workflow.
- **bead-1156** — cross-reference the architecture port decisions table; specifically the `SandboxProviderPort` widening of OpenCode's `WorkspaceAdapter`.
- **bead-1158** — cross-reference the architecture port decisions for `AgentRuntimePort` (Vercel AI SDK) and the ACP server timeline open question.

None of these bead updates authorize implementation. They convert "we should look at the references" into "we know what to copy/inspire/avoid" so design and acceptance criteria can be tightened.

# ADR-0148 — Cockpit Engineering Surface derives from Vibe Kanban

- Status: **Proposed** (pending validation spike — see `bead-spike-vk-marriage`)
- Date: 2026-05-04
- Deciders: ajax@aquinus.net
- Related: ADR-0146 (vm-first-governed-engineering-sandboxes), ADR-0145 (generic-cockpit-plugin-host-control-plane), ADR-0117 (approval-wait-loop-mechanism), ADR-0118 (agent-action-governance), ADR-0070 (hybrid orchestration + CloudEvents)
- Supersedes: portion of `docs/internal/engineering-layer/inspiration/README.md` (strategic shift from "concept reuse" to "hybrid integration"); strategy section in `inspiration-validation-plan.md` (updated to reference this ADR)

## Context

Portarium is building a Cockpit engineering surface: kanban board, per-task workspaces backed by git worktrees, agent runtime, diff/preview/terminal panes, approval workflow, evidence chain. The existing `apps/cockpit/` provides operational dashboards (robotics, users, demo) but does not have an engineering surface.

We evaluated three reference products (T3 Code, Vibe Kanban, OpenCode) in detail (see `docs/internal/engineering-layer/inspiration/`). The reviews surfaced that:

1. **None of the three has governance.** Default approval is auto-approve in all three. Default sandbox is host-child-process in all three. Governance is the entire reason Portarium exists.
2. **All three converge on the same workflow primitive**: kanban + worktree-per-task + agent + diff-as-review-surface + approval gate + merge.
3. **Vibe Kanban (BloopAI/vibe-kanban, Apache-2.0, sunsetting)** has the most complete operator surface: workspace shell with chat/log/diff/preview/file-tree/process-list tabs, multi-repo workspace, executor adapters for 11+ coding agents, per-tool approval system with WS streaming, origin-isolated preview proxy, PTY-over-WS, AI-generated PR descriptions. This represents ~18 months of work that aligns closely with what Portarium needs.
4. **Vibe Kanban's sunset is business-model failure, not technical failure** (see `vibekanban.com/blog/shutdown`). The team had thousands of daily users; they could not monetize free→paid. The technical product works.

Portarium's value proposition over Vibe Kanban is exactly the governance + sandbox + evidence plane. This is the gap a paying enterprise needs filled.

## Decision

**The Cockpit engineering surface will derive from Vibe Kanban via a hybrid integration**:

1. Vibe Kanban's Rust backend is **kept unmodified** (vendored at SHA `4deb7eca8f381f7cbc1f9d15515a9ab8f8009053`), runs as a sidecar service in Portarium's deployment topology.
2. Vibe Kanban's React/TypeScript frontend (`packages/web-core`) is **transplanted** into `apps/cockpit/src/routes/engineering/`, restyled to Portarium's shadcn design tokens, modified to add governance overlays (PolicyTierBadge, BlastRadiusBadge, evidence panel, requested-vs-resolved sandbox mode).
3. Governance is bolted onto the unmodified Vibe Kanban backend via small **Rust glue crates** (`src/infrastructure/cockpit-backend-glue/`, target <1k LOC; final size confirmed post-spike) that implement Vibe Kanban's existing `ExecutorApprovalService` and container-spawn traits, proxying every call to Portarium's Node control plane over HTTP.
4. T3 Code's three-panel "deep task" UX is **inspiration only** — Portarium builds a Focus Mode view inside the Cockpit using T3 Code's layout shape, not vendored T3 Code code.

The cloud-tier crates Vibe Kanban shipped for its commercial offering (`relay-*`, `host-relay`, `webrtc`, `embedded-ssh`, `trusted-key-auth`, `desktop-bridge`, `tauri-app`) are **deleted from the workspace**. PostHog/Sentry build args are removed. The `useUserOrganizations` / `useOrganizationStore` org concept is replaced with single-tenant stubs in the transplanted frontend.

## Alternatives considered

### A — Hard fork (whole product, modified)

Take the entire Vibe Kanban repo, modify in place, ship as Portarium Cockpit. Adopts Rust as the Cockpit stack end-to-end. ~7 weeks.

**Rejected because**: forking the source means our diff against upstream grows unboundedly; pulling future patches (if any community fork emerges) becomes a merge-conflict exercise. The hybrid achieves the same speed without forking — we delete leaf crates and add new crates, but we don't modify the crates we keep. Vendor SHA stays clean and auditable.

### B — Whole-frontend transplant + Node backend rewrite

Take the React frontend, rewrite the backend in Node. ~6–9 weeks. Pure Node stack.

**Rejected because**: rewriting the backend means re-deriving 18 months of executor edge-case handling, approval timing fixes, PTY plumbing quirks, preview proxy origin tricks. That re-derivation is where bugs come from. Hybrid skips it.

### C — Cherry-pick components into from-scratch shell

Build the Cockpit engineering shell ourselves in our existing app. Drop in individual Vibe Kanban components (KanbanContainer, ChangesPanel, PreviewBrowser, etc.) one at a time. ~8–9 weeks.

**Rejected because**: each cherry-picked component requires writing matching backend routes from scratch. We'd be rewriting the backend incrementally instead of in one chunk — same cost, more integration friction. Hybrid wins by treating the backend as a black box. **Note**: this is the spike fall-back. Earlier discussion notes referred to it as "Alternative D"; it is now formally Alternative C in this ADR.

### D — Build entire Cockpit engineering surface from scratch

No vendoring. Pure Portarium code. ~6 months.

**Rejected because**: 4-month delay vs hybrid for outcomes that are not architecturally superior. The from-scratch path's only real benefit is avoiding vendor commitment, which the hybrid mitigates by keeping the vendor at filesystem boundary (`vendor/vibe-kanban/`) and bridging via HTTP only.

### E — Iframe-embed Vibe Kanban

Run Vibe Kanban as a separate process; embed via `<iframe>`.

**Rejected because**: cannot add governance overlays to cards inside the iframe (sealed React tree); two backends + auth/cookie coupling is operationally messy; visually two products glued together; defeats every benefit of integration.

## Architectural rules (non-negotiable)

These rules are what keep the hybrid clean over time. Violating any of them is grounds for PR rejection.

### Rule 1 — Vendor is filesystem-isolated

- All Vibe Kanban source lives under `vendor/vibe-kanban/`, pinned to SHA `4deb7eca` via git submodule (or snapshot directory with `VENDOR.md` documenting source SHA).
- **Nothing in `src/` or `apps/cockpit/src/` may import from `vendor/`.** Add to dependency-cruiser as a hard rule. Communication is HTTP only.
- `vendor/vibe-kanban/VENDOR.md` documents: source URL, SHA, license, every crate we deleted (with reason), every file we patched (target: zero, only security CVEs).

### Rule 2 — Glue crate is the only Portarium-Rust code that touches vendor

- `src/infrastructure/cockpit-backend-glue/` is a Rust workspace member. It implements Vibe Kanban's traits (`ExecutorApprovalService`, sandbox spawn, etc.) and proxies to Portarium's Node control plane over HTTP.
- The glue crate may import from `vendor/vibe-kanban/crates/` (it has to implement their traits).
- **No other Portarium code imports the glue crate.** It is wired only at the Vibe Kanban backend's startup, swapping their default trait impls.

### Rule 3 — Hexagonal layers are preserved

- Vibe Kanban backend = an external infrastructure adapter from Portarium's perspective. Same architectural status as Postgres or S3.
- Domain (`src/domain/`) and application (`src/application/`) layers have **zero knowledge** of Vibe Kanban's existence.
- Infrastructure (`src/infrastructure/`) hosts the glue crate and an HTTP client for the Vibe Kanban backend.
- Presentation (`apps/cockpit/`) hosts the transplanted frontend, talking to our HTTP routes (which talk to either our application layer or the Vibe Kanban backend).

### Rule 4 — Vendor SHA is sacred

Default rule: **never patch vendored crates.** If you need behavior change, write a glue crate that wraps or implements their trait. The trait-based architecture in Vibe Kanban is precisely what enables this.

Two ADR-required exceptions:
- **Security CVE in a vendored dep that upstream isn't fixing.** Apply the minimal patch. Document in `VENDOR.md` with source CVE.
- **Trait shape needs widening to plug in our governance.** Submit upstream first (even into the void); apply locally with `VENDOR.md` note.

### Rule 5 — Sidecar service, not embedded

- Vibe Kanban backend deploys as its own service (own container, own logs, own health check, own version).
- Not bundled into the Node app. Not transitively required.
- Local dev: `npm run dev` orchestrates Node control plane + Cockpit Vite + `cargo run` in vendor.
- Container: one Dockerfile per service. docker-compose for local. Same shape in production.

### Rule 6 — Contract tests are load-bearing

The glue boundary is the highest-leverage failure surface. Two test categories run in CI:

- **Glue crate tests** (Rust, in `cockpit-backend-glue`): given a mock trait input, the glue crate makes the right HTTP call and resolves the trait correctly.
- **End-to-end governance contract tests** (Playwright + real services): a workflow with a `HUMAN-APPROVE` policy decision is *actually* blocked at the Cockpit until approved. This catches regressions in the integration that unit tests miss.

If these tests fail, the integration is broken regardless of UI appearance.

## Five door-open decisions for agent-driven backlog (phase 3+)

The Cockpit being usable by autonomous agents (filing beads, claiming work, executing under policy) is part of Portarium's longer-term thesis (see `docs/internal/engineering-layer/agent-driven-backlog-vision.md`). v1 must not foreclose on it. Five shape decisions to bake into the v1 hybrid:

### D1. Beads API is canonical, CLI is a thin client
The HTTP route to create/update beads is the source of truth. The `bd` CLI becomes a thin client over the API. Agents and humans hit the same surface — no special-casing.

### D2. Actor identity is a first-class field on every bead/approval/evidence entry
Not strings. Cryptographic identity: `human:ajax@aquinus.net` or `agent:triage-v1@portarium`. Without this, separation-of-duties enforcement in phase 3 is impossible.

### D3. Policy tier resolution accepts actor type as input
Same action, different tier depending on whether the actor is human or agent. The policy engine signature accepts actor type from day one. Retrofitting later means re-running every historical decision.

### D4. RateLimitPort and ReputationPort interfaces exist (with stub impls)
v1 stub impls return unlimited / 100% reputation. Real impls plug in for phase 3 without restructuring policy. The interface surface must be there from day one.

### D5. Evidence schema includes `triggeringObservation` field
When an agent files a bead, what did it observe? Canonical shape: `triggeringObservation: { kind: 'log' | 'ticket' | 'metric' | 'human' | 'other'; ref: string; summary: string } | null`. Empty/null for human-filed beads. This is what makes agent-filed beads reviewable rather than mysterious.

These cost almost nothing in v1 if known up-front. They cost a rewrite to add later. The integration build plan (`integration-build-plan.md`) sequences them into the relevant weeks.

## Consequences

### Positive

- **~4× speedup** vs from-scratch (8 weeks vs 6 months) for a fully governed engineering Cockpit.
- **18 months of someone else's edge-case fixes** are inherited, not re-derived.
- **Their data model and trait architecture** are proven by thousands of daily users.
- **Governance bolts cleanly** because Vibe Kanban's boundaries are at the right places (executor traits, container service traits).
- **Single bright-line boundary** between vendor and Portarium code (filesystem + HTTP).
- **Architectural layering preserved** — Vibe Kanban backend is just another infrastructure adapter.
- **License is permissive** — Apache-2.0 with NOTICE preservation requirement.
- **Vendor sunsetting eliminates upstream race** — we are the maintained continuation.

### Negative

- **Polyglot Cockpit** — Rust backend + TS frontend + glue crates. Daily work is TS; Rust expertise needed only for occasional glue crate changes.
- **We own the vendored backend's bugs forever.** Their team is gone. Mitigation: small, well-factored codebase; we touch it only for security patches and dep updates.
- **Two backends in our deployment topology** — Vibe Kanban Rust + Portarium Node. Mitigation: standard sidecar pattern; HTTP between them.
- **Their data model becomes our data model.** Schema migrations are coupled to our roadmap. Mitigation: their schema is good (iterated with thousands of users); incremental extension is feasible.
- **Brand attribution required.** NOTICE preservation + honest doc line: "Portarium Cockpit derives from Vibe Kanban (BloopAI, Apache-2.0); Portarium adds the governance, sandbox, and evidence plane."

### Neutral

- **First-class Rust** in Portarium repo. Either positive (broader skill base) or negative (hiring constraint) depending on team direction. The Rust here is straightforward (Axum + SQLx + tokio), not advanced async lifetimes.

## Exit strategy

If at any future point we want to retire the Vibe Kanban backend and bring everything to Node:

1. Implement matching HTTP routes in our Node control plane (mirror Vibe Kanban's contract).
2. Point the transplanted frontend at our routes (one-line config swap, since it's HTTP).
3. Migrate the SQLite schema to Postgres (data-level migration, scripted).
4. Retire the Vibe Kanban service from deployment.
5. Delete `vendor/vibe-kanban/` and `src/infrastructure/cockpit-backend-glue/`.

Time estimate for full migration: ~3 months. The frontend transplant work is *not* lost — it is the bulk of the engineering Cockpit and stays usable throughout.

This exit door means the hybrid is not a one-way trap. We can always reverse course if the polyglot tax becomes intolerable, the vendor backend develops unfixable issues, or business conditions change.

## Open questions

1. **Git submodule vs snapshot directory** for the vendor: submodule has cleaner update semantics (when needed) but adds a clone-time step. Decide in spike week (`bead-1168`).
2. **SQLite vs Postgres** for Vibe Kanban backend: keep their SQLite for local-only state, use Portarium's Postgres for evidence; or migrate all to Postgres. Default: keep SQLite to minimize patches; revisit if it complicates backup/HA.
3. **PR creation flow**: keep their AI-generated descriptions, or replace with policy-aware Portarium descriptions? Resolved by `bead-1188` (`bead-pr-policy`): keep theirs as a starting point, append policy summary block.

## Resolved decisions (previously open questions)

- **Tauri desktop wrapper** — RESOLVED: delete. Per `bead-1173` (`bead-cloud-rip`), `crates/tauri-app` is in the deletion list. Vendor architecture doc repo layout marks it `(DELETED)`. Revisit only if a customer asks.
- **Vibe Kanban SHA mirror to Portarium-controlled remote** — RESOLVED: yes. Filed as `bead-1169` (`bead-vk-sha-mirror`, P2, parallel to spike). Cost is negligible; insurance against upstream disappearing.

## Validation gate

This ADR is **Proposed**, not **Accepted**, until the spike (`bead-spike-vk-marriage` / `bead-1168`) passes. The spike's exit criterion has four conjuncts (all required):

1. Vibe Kanban backend builds and runs locally.
2. Vibe Kanban frontend transplanted to `apps/cockpit/src/routes/engineering/`.
3. Single-tenant rip-out (`useUserOrganizations` / `useOrganizationStore` removed at minimum for the kanban page) complete.
4. Kanban page renders against the Rust backend inside our Cockpit shell.

If the spike completes within 5 working days with all four conjuncts met, this ADR moves to **Accepted** (`bead-1171` finalizes) and the rest of the build plan executes. If the spike reveals deeper coupling than expected (org concept threads through workspace shell, contracts don't fit cleanly, etc.), this ADR moves to **Rejected** and we drop to Alternative C (cherry-pick components — see alternatives section).

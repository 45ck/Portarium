# Cockpit Vendor Architecture — How the Hybrid Integration Works

This is the operational/architectural companion to [ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md). The ADR is the *what* and the *why*. This doc is the *how*.

## High-level topology

```
┌────────────────── apps/cockpit (our React app) ─────────────────────────────┐
│                                                                              │
│   /robotics    /users    /demo    ... existing routes (unchanged)            │
│                                                                              │
│   /engineering (NEW — transplanted from Vibe Kanban)                         │
│     ├── /board                  → KanbanContainer                            │
│     ├── /workspace/:id          → WorkspacesLayout                           │
│     │     ├── chat/logs         → LogsContentContainer                       │
│     │     ├── changes (diff)    → ChangesPanelContainer                      │
│     │     ├── files             → FileTreeContainer                          │
│     │     ├── preview           → PreviewBrowserContainer                    │
│     │     ├── processes         → ProcessListContainer                       │
│     │     ├── git (PR)          → GitPanelContainer                          │
│     │     └── focus mode (NEW)  → T3-Code-style three-panel view             │
│     └── /approvals              → live approval queue                        │
│                                                                              │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ HTTP (over our existing reverse proxy)
                             │
       ┌─────────────────────┴──────────────────────┐
       │                                            │
       ▼                                            ▼
┌──── Portarium control plane (Node, ours) ──┐ ┌── Vibe Kanban backend ──────┐
│                                              │ │  (Rust, vendored sidecar)   │
│  - Policy engine                              │ │                             │
│  - Evidence chain (WORM, hash-chained)        │ │  - Workspace manager        │
│  - Durable approval store (Postgres)          │ │  - Executor pool (11 agents)│
│  - SandboxProviderPort (worktree/container/vm)│ │  - Approval system          │
│  - Beads API (canonical, agent-callable)      │ │  - Preview proxy            │
│  - AgentRuntimePort                            │ │  - PTY-over-WS              │
│                                                │ │  - SQLite (local state)    │
└──────────────────┬─────────────────────────────┘ └──────────┬──────────────────┘
                   │                                            │
                   │ HTTP (only direction:                      │
                   │  glue calls Portarium, never reverse)     │
                   │                                            │
                   └────────────────┬───────────────────────────┘
                                    │
                                    ▼
            ┌─────────── cockpit-backend-glue (Rust crate) ──────────┐
            │  - Implements Vibe Kanban's ExecutorApprovalService    │
            │  - Implements sandbox-spawn delegation                  │
            │  - Wired at Vibe Kanban startup, swaps default impls    │
            │  - ~500 LOC; lives in src/infrastructure/               │
            └─────────────────────────────────────────────────────────┘
```

## Repo layout

```
portarium/
├── apps/cockpit/                              # React app, mostly unchanged
│   └── src/
│       ├── routes/
│       │   ├── robotics/         (existing)
│       │   ├── users/            (existing)
│       │   ├── demo/             (existing)
│       │   └── engineering/      (NEW — transplanted from VK)
│       │       ├── board.tsx
│       │       ├── workspace.$id.tsx
│       │       ├── approvals.tsx
│       │       └── focus-mode.tsx  (NEW — T3-Code-style)
│       ├── components/
│       │   ├── cockpit/          (existing — our shadcn primitives)
│       │   └── engineering/      (NEW — VK components, restyled)
│       │       ├── KanbanContainer.tsx        // Portions adapted from BloopAI/vibe-kanban@4deb7eca (Apache-2.0)
│       │       ├── ChangesPanelContainer.tsx  // (same header)
│       │       ├── PreviewBrowserContainer.tsx
│       │       ├── LogsContentContainer.tsx
│       │       ├── FileTreeContainer.tsx
│       │       ├── ProcessListContainer.tsx
│       │       ├── GitPanelContainer.tsx
│       │       ├── CommentWidgetLine.tsx
│       │       └── badges/                    (NEW — Portarium governance)
│       │           ├── PolicyTierBadge.tsx
│       │           ├── BlastRadiusBadge.tsx
│       │           └── EvidenceCompletenessIndicator.tsx
│       └── hooks/
│           └── engineering/      (NEW — adapted from VK, talks to VK backend)
├── src/                                       # our hex layers
│   ├── domain/                   (unchanged — zero VK knowledge)
│   ├── application/              (unchanged — zero VK knowledge)
│   ├── infrastructure/
│   │   ├── (existing adapters)
│   │   ├── cockpit-backend-glue/ (NEW — Rust crate)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   ├── approval_service.rs   (impls VK trait, calls Portarium HTTP)
│   │   │   │   ├── sandbox_service.rs    (impls spawn delegation)
│   │   │   │   └── http_client.rs        (Portarium control plane client)
│   │   │   └── tests/
│   │   └── vibe-kanban-client/   (NEW — Node HTTP client for VK backend)
│   │       ├── index.ts                  (typed client)
│   │       └── types/                    (mirrored from VK ts-rs output)
│   └── presentation/             (unchanged routes; new ones added for VK proxy)
│       └── routes/
│           └── engineering/      (NEW — proxy + governance interception)
├── vendor/                                    # NEW
│   └── vibe-kanban/                           # git submodule @ 4deb7eca
│       ├── VENDOR.md                          # source SHA, license, deletions
│       ├── crates/                            # their Rust workspace
│       │   ├── server/                        (kept)
│       │   ├── workspace-manager/             (kept)
│       │   ├── worktree-manager/              (kept)
│       │   ├── executors/                     (kept)
│       │   ├── local-deployment/              (kept; spawn impls swapped via glue)
│       │   ├── preview-proxy/                 (kept)
│       │   ├── db/                            (kept)
│       │   ├── services/                      (kept)
│       │   ├── relay-*/                       (DELETED — cloud tier)
│       │   ├── host-relay/                    (DELETED)
│       │   ├── webrtc/                        (DELETED)
│       │   ├── embedded-ssh/                  (DELETED)
│       │   ├── trusted-key-auth/              (DELETED)
│       │   ├── desktop-bridge/                (DELETED)
│       │   ├── tauri-app/                     (DELETED)
│       │   └── remote/                        (DELETED — cloud Postgres path)
│       ├── packages/
│       │   ├── web-core/                      (transplanted to apps/cockpit/src/)
│       │   ├── local-web/                     (DELETED)
│       │   ├── remote-web/                    (DELETED)
│       │   ├── ui/                            (selectively merged into our shadcn)
│       │   └── public/                        (assets — selectively kept)
│       ├── shared/types.ts                    (kept — referenced by VK frontend)
│       └── Dockerfile                         (kept; PostHog/Sentry args removed)
├── THIRD_PARTY_NOTICES.md                     # NEW — Apache-2.0 NOTICE preservation
├── docker-compose.yml                         # updated — adds vibe-kanban service
├── Cargo.toml                                 # NEW — workspace including glue crate
└── docs/internal/
    ├── adr/ADR-0148-cockpit-derives-from-vibe-kanban.md
    └── engineering-layer/
        ├── cockpit-vendor-architecture.md     (this file)
        ├── agent-driven-backlog-vision.md
        └── integration-build-plan.md
```

## Service topology and HTTP boundaries

### What runs where

| Service | Stack | Port (default) | Owner | Purpose |
| --- | --- | --- | --- | --- |
| Cockpit Vite dev | Node | 1355 | Portarium | UI |
| Portarium control plane | Node + Hono | 3000 | Portarium | Policy, evidence, beads, sandbox provider, AgentRuntimePort |
| Vibe Kanban backend | Rust + Axum | 8080 | Vendored | Workspace manager, executors, approval system, PTY, preview proxy |
| Vibe Kanban preview proxy | Rust | 8081 | Vendored | Origin-isolated preview iframes |
| Postgres | — | 5432 | Portarium | Evidence chain, policy, durable approvals |
| SQLite (VK local state) | — | (file) | Vendored | Workspace state, scratch, PTY logs |

### Direction of HTTP calls

**Cockpit → Portarium control plane**: all governance/policy/evidence/beads operations.
**Cockpit → Vibe Kanban backend**: workspace operations (kanban CRUD, executor logs, diffs, preview, terminal).
**Portarium control plane → Vibe Kanban backend**: never. Portarium does not reach into VK directly.
**Vibe Kanban backend → Portarium control plane**: only via the glue crate. Approval requests, sandbox spawn requests, evidence emissions.

This direction discipline is critical: it means VK doesn't need to know Portarium exists at the source level. The glue crate is the only Rust code that imports from both worlds.

### How a typical "agent runs a tool" flow works

```
1. Agent in sandbox: "I want to run `rm -rf /tmp/foo`"
2. Agent's permission service (provided by us via the AgentRuntimePort hooks)
   forwards to VK backend's ExecutorApprovalService trait
3. VK's default trait impl WOULD auto-approve (Noop). We've swapped it.
4. Our cockpit-backend-glue impl receives the trait call.
5. Glue makes HTTP POST to Portarium control plane: POST /policy/decide
   with { actor, action: "shell", pattern: "rm -rf /tmp/foo", session, blast_radius }
6. Portarium policy engine resolves: policy tier = HUMAN-APPROVE.
7. Portarium control plane creates a durable approval record (Postgres).
8. Portarium returns: { decision: "ask", approval_id: "appr_123" }
9. Glue receives "ask"; calls VK's existing approval flow with approval_id.
10. VK publishes "approval requested" via WS to Cockpit frontend.
11. Cockpit shows the DiffApprovalSurface with PolicyTier + BlastRadius badges.
12. Human approves with rationale.
13. Cockpit POSTs approval reply to Portarium control plane.
14. Portarium control plane records evidence (hash-chained).
15. Portarium notifies the glue (long-poll or SSE) that approval resolved.
16. Glue completes the trait call back to VK; VK lets the agent execute.
```

The glue crate is what makes step 4–9 a single trait method call from VK's perspective. From the *agent's* perspective inside the sandbox, nothing about how it requests permission has changed.

## Glue crate design

`src/infrastructure/cockpit-backend-glue/` is a small Rust crate, ~500 LOC.

```rust
// src/infrastructure/cockpit-backend-glue/src/approval_service.rs

use vibe_kanban_executors::approvals::{ExecutorApprovalService, ApprovalStatus, ApprovalRequest};
use crate::http_client::PortariumClient;

pub struct PortariumApprovalService {
    client: PortariumClient,
}

#[async_trait]
impl ExecutorApprovalService for PortariumApprovalService {
    async fn create_tool_approval(&self, req: ApprovalRequest) -> Result<Uuid, ApprovalError> {
        let portarium_decision = self.client.decide_policy(&req).await?;
        match portarium_decision.action {
            PolicyAction::Allow => Ok(req.id), // immediate
            PolicyAction::Deny => Err(ApprovalError::Denied(portarium_decision.reason)),
            PolicyAction::Ask => {
                self.client.create_pending_approval(&req).await?;
                Ok(req.id)
            }
        }
    }

    async fn wait_tool_approval(&self, id: Uuid, cancel: CancellationToken) -> Result<ApprovalStatus, ApprovalError> {
        // Long-poll Portarium until approval resolves OR cancel fires.
        // Survives Vibe Kanban backend restart because the durable record lives in Portarium.
        self.client.wait_approval(id, cancel).await
    }
}
```

The wiring in VK's `main.rs` (this is the only file we patch in the vendor):

```rust
// vendor/vibe-kanban/crates/server/src/main.rs (PATCHED — documented in VENDOR.md)

#[tokio::main]
async fn main() {
    let portarium_client = portarium_glue::PortariumClient::from_env();

    let approval_service: Arc<dyn ExecutorApprovalService> =
        Arc::new(portarium_glue::PortariumApprovalService::new(portarium_client.clone()));

    let container_service: Arc<dyn ContainerService> =
        Arc::new(portarium_glue::PortariumSandboxContainerService::new(portarium_client.clone()));

    // Existing VK startup, with these two impls injected
    server::run(approval_service, container_service).await;
}
```

The patch in `main.rs` is roughly 5 lines and is the only file we modify in the vendor. It is documented in `vendor/vibe-kanban/VENDOR.md`.

## Frontend transplant approach

### What we copy

From `vendor/vibe-kanban/packages/web-core/src/`:
- `pages/kanban/` → `apps/cockpit/src/routes/engineering/board.tsx`
- `pages/workspaces/` → `apps/cockpit/src/routes/engineering/workspace.$id.tsx`
- `features/kanban/`, `features/workspace/`, `features/workspace-chat/` → `apps/cockpit/src/components/engineering/`
- `features/create-mode/`, `features/onboarding/`, `features/export/` → selectively, as needed

From `vendor/vibe-kanban/packages/ui/src/`:
- Components that don't duplicate our shadcn primitives → merge
- Components that duplicate our shadcn → discard, use ours

### What we add

- `apps/cockpit/src/components/engineering/badges/` — PolicyTierBadge, BlastRadiusBadge, EvidenceCompletenessIndicator
- `apps/cockpit/src/components/engineering/EvidencePanel.tsx` — new tab in the workspace shell
- `apps/cockpit/src/routes/engineering/focus-mode.tsx` — T3-Code-style three-panel view

### What we strip

- All `useUserOrganizations`, `useOrganizationStore`, `useAuth`-as-org call sites — replace with single-tenant stubs
- All references to PostHog/Sentry telemetry
- All "Vibe Kanban Cloud" upsell UI
- "Vibe Kanban" branding (per Apache-2.0 notice rules — preserve copyright/license, don't preserve marketing)

### How we restyle

shadcn primitives substitute their UI primitives 1:1 in most cases (both use Tailwind, both follow similar component shapes). The main work:
- Tailwind class swaps to our color tokens (`bg-card`, `text-foreground`, etc.)
- Icon swaps from their icons to ours (lucide-react in both)
- Spacing/sizing alignment to our design system

Per-component restyle estimate: 2–4 hours. Done as the component is dropped in.

### License headers

Every transplanted file gets a header comment:

```tsx
// Portions adapted from BloopAI/vibe-kanban@4deb7eca (Apache-2.0)
// Original: vendor/vibe-kanban/packages/web-core/src/pages/kanban/ProjectKanban.tsx
```

`THIRD_PARTY_NOTICES.md` at the repo root contains the Apache-2.0 NOTICE block.

## Build and deploy

### Local dev

`npm run dev` orchestrates (via concurrently or similar):
1. Portarium control plane on :3000 (`tsx src/index.ts`)
2. Cockpit Vite dev on :1355 (`vite`)
3. Vibe Kanban backend on :8080 (`cargo run -p server` in `vendor/vibe-kanban/`)
4. Vibe Kanban preview proxy on :8081

Postgres + Redis assumed running (existing setup).

### CI

- Existing `npm run ci:pr` continues to run for the Node/TS layers.
- New: `cargo test --workspace` runs in CI, covers both the glue crate and the vendor (sanity check).
- New: `cargo build --release --workspace` validates the vendor still builds with deletions applied.

### Production deploy

- One container per service: `portarium-control-plane`, `portarium-cockpit`, `vibe-kanban-backend`, `vibe-kanban-preview-proxy`.
- Reverse proxy (existing nginx/Caddy) routes `/api/portarium/*` to control plane, `/api/vk/*` to vibe-kanban-backend.
- Cockpit static bundle served from any CDN/static host.

## Debugging across the boundary

The hardest debugging case: "approval flow doesn't complete." Symptom: human clicks Approve, nothing happens.

Diagnosis steps:
1. Cockpit Network tab: did `POST /api/portarium/approvals/:id/reply` succeed?
2. Portarium logs: did the approval get persisted? Did the wake-up signal fire?
3. Glue crate logs: did the long-poll on `wait_approval` see the resolution?
4. VK backend logs: did the trait method return? Did the agent receive permission?

To make this tractable, every approval flows with a `correlation_id` set at request creation, propagated through every log line in every service. Standard distributed-tracing hygiene.

## Vendor SHA discipline (operational)

- **`vendor/vibe-kanban/` is a git submodule** pinned to SHA `4deb7eca8f381f7cbc1f9d15515a9ab8f8009053` of `git@github.com:BloopAI/vibe-kanban.git` (or our private mirror once filed — see `bead-mirror-vk-sha`).
- **Submodule updates** require an ADR amendment. Default: never update.
- **`VENDOR.md`** is the source of truth for what's deleted and what's patched. Reviewers check this on every PR that touches `vendor/`.
- **CI gate**: a job verifies that `vendor/vibe-kanban/` matches the pinned SHA + the documented deletions/patches. Catches accidental modifications.

## What this architecture explicitly does NOT do

- It does not run Vibe Kanban's hosted/cloud features. Those crates are deleted; their absence is a pre-build assertion.
- It does not allow Vibe Kanban backend to call the Portarium control plane *except* through the glue crate's well-defined interface.
- It does not let Portarium domain or application code know that Vibe Kanban exists.
- It does not promise upstream patch parity. We are the maintained continuation.

## Related documents

- [ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md) — the decision and architectural rules.
- [Integration build plan](./integration-build-plan.md) — 8-week sequenced execution.
- [Agent-driven backlog vision](./agent-driven-backlog-vision.md) — phase 3+ vision and the five door-open decisions.
- [Inspiration synthesis](./inspiration/README.md) — original three-product comparison.
- [Vibe Kanban report](./inspiration/vibe-kanban.md) — full architectural inspection of the vendor.

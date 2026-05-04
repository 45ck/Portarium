# Integration Build Plan — Hybrid Vibe Kanban Cockpit

This is the sequenced execution plan for delivering the v1 hybrid integration described in [ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md) and [cockpit-vendor-architecture.md](./cockpit-vendor-architecture.md).

**Total estimated duration**: 8 weeks.
**Total bead count**: 24 (see breakdown at end of doc and the alias→ID mapping below).

## Bead alias → ID mapping

The plan uses readable text aliases (e.g. `bead-spike-vk-marriage`) for clarity. The actually-filed beads have numeric IDs. Use this table to find the bead to claim.

| Alias | ID | Priority | Phase |
| --- | --- | --- | --- |
| `bead-spike-vk-marriage` | `bead-1168` | P0 | governance |
| `bead-vk-sha-mirror` | `bead-1169` | P2 | governance |
| `bead-third-party-notices` | `bead-1170` | P1 | governance |
| `bead-adr-148-finalize` | `bead-1171` | P0 | governance |
| `bead-vendor-setup` | `bead-1172` | P0 | infrastructure |
| `bead-cloud-rip` | `bead-1173` | P0 | infrastructure |
| `bead-glue-scaffolding` | `bead-1174` | P0 | infrastructure |
| `bead-glue-approval` (incl. contract tests) | `bead-1175` | P0 | infrastructure |
| `bead-glue-sandbox` | `bead-1176` | P0 | infrastructure |
| `bead-frontend-transplant` | `bead-1177` | P0 | presentation |
| `bead-auth-stub` | `bead-1178` | P0 | presentation |
| `bead-restyle` | `bead-1179` | P1 | presentation |
| `bead-governance-overlays` | `bead-1180` | P0 | presentation |
| `bead-beads-api-harden` (D1) | `bead-1181` | P0 | application |
| `bead-actor-identity` (D2) | `bead-1182` | P0 | domain |
| `bead-approval-live` | `bead-1183` | P0 | presentation |
| `bead-policy-actor-aware` (D3) | `bead-1184` | P0 | application |
| `bead-rate-reputation-stubs` (D4) | `bead-1185` | P0 | application |
| `bead-evidence-bus-bridge` | `bead-1186` | P0 | infrastructure |
| `bead-evidence-trigger-field` (D5) | `bead-1187` | P0 | domain |
| `bead-pr-policy` | `bead-1188` | P1 | presentation |
| `bead-focus-mode` | `bead-1189` | P1 | presentation |
| `bead-integration-cleanup` | `bead-1190` | P1 | cross-cutting |
| `bead-phase-3-vision-tracker` (DO NOT START in v1) | `bead-1191` | P3 | governance |

## Sequencing principles

1. **Spike first.** Nothing else starts until the marriage is validated.
2. **Door-open decisions are NOT a separate phase.** They are baked into the relevant weeks so they ship as part of the integration, not as bolt-on rework.
3. **Vendor + glue come before frontend transplant.** Backend integration must work before frontend has anything to talk to.
4. **Governance before deep features.** PolicyTier badges and approval interception ship before T3-Code-style focus mode.
5. **Each week has an exit criterion.** If a week's exit criterion is not met, the next week does not start.

## Bead dependency graph

This matches the actually-filed `BlockedBy` chain on beads 1168–1191.

```
[parallel, no deps — can start immediately]
  spike (1168, P0) ─────────────────────────────────────────┐
  vk-sha-mirror (1169, P2) [parallel]                       │
  third-party-notices (1170, P1) [parallel]                 │
                                                             │
[blocked on spike (1168)]                                    │
  ├─→ adr-148-finalize (1171, P0)                           │
  └─→ vendor-setup (1172, P0)                               │
        └─→ cloud-rip (1173, P0)                            │
              ├─→ glue-scaffolding (1174, P0)               │
              │     └─→ glue-approval (1175, P0)            │
              │           └─→ glue-sandbox (1176, P0)       │
              │                                              │
              └─→ frontend-transplant (1177, P0)            │
                    └─→ auth-stub (1178, P0)                │
                          └─→ restyle (1179, P1)            │
                                └─→ governance-overlays (1180, P0)
                                      ├─→ beads-api-harden (1181, P0, D1)
                                      │     └─→ actor-identity (1182, P0, D2)
                                      │           └─→ policy-actor-aware (1184, P0, D3)
                                      │                 └─→ rate-reputation-stubs (1185, P0, D4)
                                      │
                                      └─→ approval-live (1183, P0) ◄── also blocked by glue-approval (1175)
                                            └─→ evidence-bus-bridge (1186, P0)
                                                  ├─→ evidence-trigger-field (1187, P0, D5)
                                                  ├─→ pr-policy (1188, P1)
                                                  └─→ focus-mode (1189, P1)
                                                        │
                                                        ▼
                                            integration-cleanup (1190, P1)  ◄── blocked by 1185, 1187, 1188, 1189
                                                        │
                                                        ▼
                                            phase-3-vision-tracker (1191, P3, DO NOT START in v1)
```

Key shape callouts:
- The five **door-open decisions** (D1 → D2 → D3 → D4) form a chain after `governance-overlays`, then D5 (`evidence-trigger-field`) lands after `evidence-bus-bridge`. All five complete before `integration-cleanup` (1190).
- `approval-live` (1183) has TWO blockers: `governance-overlays` (1180) and `glue-approval` (1175). It is the "marriage point" where frontend governance overlays meet backend trait interception.
- `integration-cleanup` (1190) has FOUR blockers: focus-mode, pr-policy, rate-reputation-stubs, evidence-trigger-field. It cannot start until all 8-week scope completes.


## Week-by-week

### Week 0 (parallel to spike) — Documentation infrastructure

**Beads**:
- `bead-spike-vk-marriage` (1 week, P0): the validation spike. See exit criterion below.
- `bead-adr-148-finalize` (~2 days, P0): finalize ADR-0148 from Proposed → Accepted (after spike passes) or Rejected (after spike fails). Captures spike findings as ADR amendments.
- `bead-third-party-notices` (~half day, P1, parallel): create `THIRD_PARTY_NOTICES.md` at repo root with Apache-2.0 NOTICE preservation block for Vibe Kanban. Templated for additions per transplanted component.
- `bead-vk-sha-mirror` (~half day, P2, parallel): mirror BloopAI/vibe-kanban@`4deb7eca` to `portarium/cockpit-vendor-mirror` private remote. Insurance against upstream disappearing.

**Exit criterion** (all four conjuncts required, matching ADR-0148):
1. Vibe Kanban backend builds and runs locally.
2. Vibe Kanban frontend transplanted to `apps/cockpit/src/routes/engineering/`.
3. Single-tenant rip-out (`useUserOrganizations` / `useOrganizationStore` removed at minimum for the kanban page) complete.
4. Kanban page renders against the Rust backend inside our Cockpit shell.

ADR-0148 moves to Accepted. NOTICES file exists. SHA mirrored.

**If exit fails**: drop to Alternative C (cherry-pick components — see ADR-0148 alternatives section). Re-plan from there.

### Week 1 — Vendor setup + cloud rip

**Beads**:
- `bead-vendor-setup` (~2 days, P0, depends on spike): set up `vendor/vibe-kanban/` as git submodule pinned to `4deb7eca`. Create `vendor/vibe-kanban/VENDOR.md`. Add CI gate that verifies the SHA hasn't drifted.
- `bead-cloud-rip` (~3 days, P0, depends on vendor-setup): delete the cloud-tier crates (`relay-*`, `host-relay`, `webrtc`, `embedded-ssh`, `trusted-key-auth`, `desktop-bridge`, `tauri-app`, `remote`). Strip PostHog/Sentry build args from `Dockerfile`. Verify `cargo build --release --workspace` still passes. Document deletions in `VENDOR.md`.

**Exit criterion**: VK backend builds + runs locally without cloud tier; passes its own (Vibe Kanban's) test suite minus the deleted crates.

### Week 2 — Glue crate scaffolding + first glue impl

**Beads**:
- `bead-glue-scaffolding` (~1 day, P0, depends on cloud-rip): create `src/infrastructure/cockpit-backend-glue/` Rust crate. `Cargo.toml` workspace member. Empty trait impls + HTTP client skeleton.
- `bead-glue-approval` (~3 days, P0, depends on glue-scaffolding): implement `PortariumApprovalService` per [cockpit-vendor-architecture.md § Glue crate design](./cockpit-vendor-architecture.md#glue-crate-design). Long-poll `wait_approval`. Survives VK backend restart. Patches `vendor/vibe-kanban/crates/server/src/main.rs` to inject the glue (5 LOC patch, documented in `VENDOR.md`). **Acceptance includes contract tests at the trait boundary** (mock VK trait input → verify correct HTTP call to Portarium → verify trait completion); not split into a separate bead.

**Exit criterion**: an integration test fires a tool call inside VK, the glue intercepts, calls Portarium, blocks until approval is recorded in Portarium's durable approval store, then resumes.

### Week 3 — Sandbox glue + frontend transplant start

**Beads**:
- `bead-glue-sandbox` (~3 days, P0, depends on glue-approval): implement `PortariumSandboxContainerService`. Delegates VK's container spawn to Portarium's `SandboxProviderPort`. Initially backed by `local-worktree` provider only (per build-order rule from earlier analysis: local-worktree first, container/VM later).
- `bead-frontend-transplant` (~2 days, P0, depends on cloud-rip): copy `vendor/vibe-kanban/packages/web-core/src/` into `apps/cockpit/src/routes/engineering/` and `apps/cockpit/src/components/engineering/`. Add per-file license headers. **No restyle yet, no auth changes yet — just get it building in our Vite config.**

**Exit criterion**: VK frontend code lives in our Cockpit. `npm run cockpit:dev` starts. Pages render (probably broken visually) against the VK backend. Browser dev tools show no import errors.

### Week 4 — Auth stub + restyle

**Beads**:
- `bead-auth-stub` (~2 days, P0, depends on frontend-transplant): replace `useUserOrganizations`, `useOrganizationStore`, `useAuth`-as-org calls with single-tenant stubs. Wire to our existing Cockpit auth (whatever it is). Verify `ProjectKanban.tsx` renders without an org context.
- `bead-restyle` (~3 days, P1, depends on auth-stub): restyle transplanted components to our shadcn tokens. Tailwind class swaps. Icon swaps. Spacing/sizing alignment. **Visual goal**: the engineering surface is recognizably Portarium, not Vibe Kanban-with-our-logo.

**Exit criterion**: kanban page + workspace shell render correctly with our design system. A reviewer who hasn't seen Vibe Kanban can't tell which components were transplanted.

### Week 5 — Governance overlays + door-open D1, D2

**Beads**:
- `bead-governance-overlays` (~3 days, P0, depends on restyle): implement `PolicyTierBadge`, `BlastRadiusBadge`, `EvidenceCompletenessIndicator` components. Drop them onto issue cards, workspace headers, approval prompts. Initially **display-only** — driven by mock data, not real policy.
- `bead-beads-api-harden` (~2 days, P0, depends on governance-overlays — door-open **D1**): audit existing Beads API. Ensure every `bd` subcommand has an HTTP equivalent. Document in OpenAPI. Add `actor` field to all create/update endpoints (preparation for D2). CLI becomes a thin client over the API.
- `bead-actor-identity` (~2 days, P0, depends on beads-api-harden — door-open **D2**): introduce `Actor = { kind: 'human' | 'agent', id: string, ... }` schema. Add `actor` field to bead, approval, evidence entries. Cryptographic identity (signed tokens). All v1 actors are humans, but the field exists.

**Exit criterion**: badges render with mock data on every card. Beads API is canonical. Every entity has an `actor` field, populated for new entities, optional for legacy ones.

### Week 6 — Approval interception live + door-open D3, D4

**Beads**:
- `bead-approval-live` (~3 days, P0, depends on governance-overlays + glue-approval): wire the badges to *real* policy decisions. When a tool call hits the glue, the approval prompt that surfaces in the Cockpit shows the actual PolicyTier and BlastRadius, the SoD status, the evidence summary, and requires rationale text. Approval reply persists into Portarium's durable store. Survives VK backend restart.
- `bead-policy-actor-aware` (~2 days, P0, depends on actor-identity — door-open **D3**): policy engine signature changed to `decide(action, actor, context) -> Decision`. v1 rules mostly ignore actor type, but the parameter exists everywhere. Tests verify the signature.
- `bead-rate-reputation-stubs` (~1 day, P0, depends on policy-actor-aware — door-open **D4**): define `RateLimitPort` and `ReputationPort` interfaces in `src/application/governance/`. Default impls return unlimited / 100% reputation. Hook them into the policy engine as decorators (no-op in v1, plug-in points for phase 3).

**Exit criterion**: end-to-end approval flow works. A `HUMAN-APPROVE` tool call in a sandbox blocks until a human approves it in the Cockpit, with full evidence. Restart the VK backend mid-approval — flow resumes correctly. Policy engine accepts actor type. Rate-limit and reputation interfaces exist with stubs.

### Week 7 — Evidence wiring + door-open D5

**Beads**:
- `bead-evidence-bus-bridge` (~3 days, P0, depends on approval-live): subscribe to VK's bus events (`session.created`, `permission.asked`, `permission.replied`, `worktree.ready`, `execution_process.started/finished`) via the glue. Hash-chain each event into Portarium's WORM evidence chain. Cockpit Evidence panel displays the chain for the active workspace.
- `bead-evidence-trigger-field` (~1 day, P0, depends on evidence-bus-bridge — door-open **D5**): add `triggeringObservation: { kind, ref, summary } | null` to evidence schema. Optional in v1 (humans don't always have one). Documented as required for phase-3 agent-filed beads. Cockpit displays the field when present.
- `bead-pr-policy-summary` (~1 day, P1, depends on evidence-bus-bridge): when the agent creates a PR via VK's existing `gh pr create` flow, append a Portarium policy summary block (blast-radius, evidence-bundle id, approver list). Replaces VK's "AI-generated description" with policy-aware version.

**Exit criterion**: every action that flows through the Cockpit produces a hash-chained evidence entry. Evidence panel shows the full chain for any workspace. PRs are policy-tagged. The `triggeringObservation` field exists in schema and is displayable.

### Week 8 — Focus mode + cleanup + phase-3 vision tracker

**Beads**:
- `bead-focus-mode` (~3 days, P1, depends on evidence-bus-bridge): implement T3-Code-style three-panel deep-task view at `/engineering/workspace/:id?mode=focus`. Left = bead context, center = chat/transcript, right = diff + approval gate + evidence. Reuses VK's existing components (LogsContent, ChangesPanel, etc.) inside the new layout. Pure additive — VK's tab-grouped workspace shell stays as the default; focus mode is a toggle.
- `bead-integration-cleanup` (~2 days, P1, all earlier beads complete): final cleanup pass. Delete unused code paths from VK frontend (e.g. anything still referencing the cloud tier). Verify CI gates pass end-to-end. Update `apps/cockpit/README.md` and `docs/internal/index.md` to point to the new engineering surface.
- `bead-phase-3-vision-tracker` (`bead-1191`, P3, **DO NOT START in v1** — title is prefixed `[DO-NOT-CLAIM v1]`): placeholder bead that points to [agent-driven-backlog-vision.md](./agent-driven-backlog-vision.md). Tracks the phase-3 work as future scope. Contains the five door-open decisions for verification — confirms they all landed in v1. The P3 priority means `bd issue next` will only return it when no P0/P1/P2 work remains; the title prefix is the secondary guard for autonomous loops.

**Exit criterion**: full engineering Cockpit ships. Kanban + workspace shell + focus mode + governance overlays + evidence chain + approval-wait-loop + sandbox-isolated execution. PR gets created with policy summary. v1 is in production.

## Per-bead seed (acceptance criteria templates)

Each bead is filed with:
- **What**: one-line summary.
- **Context**: 2–3 sentences linking to ADR-0148 and the relevant architecture doc section.
- **Acceptance**: 4–6 bullet points with concrete, testable criteria.
- **Out of scope**: explicit list of what this bead does *not* do.
- **Blocked by**: predecessors in the dependency graph.

The 24 beads were filed as `bead-1168` through `bead-1191` (see alias→ID mapping at top of doc). All are in **open/planning state** — none should be claimed for implementation until the spike (`bead-1168`) passes and ADR-0148 moves from Proposed to Accepted via `bead-1171`.

## Risk tracking

Each weekly exit criterion is a checkpoint. Risks to watch:

| Week | Risk | Signal | Response |
| --- | --- | --- | --- |
| 0 (spike) | VK frontend cloud-coupling deeper than expected | spike not done in 5 days | drop to Alternative C (cherry-pick — see ADR-0148 alternatives) |
| 1 | Cloud crate deletion breaks core build | `cargo build` fails in `crates/server` | partial deletion + ADR amendment |
| 2 | VK trait shapes don't fit Portarium boundaries | glue impl needs to call back into VK internals | ADR amendment widening trait OR fork |
| 3 | Sandbox spawn delegation breaks PTY | terminal pane shows nothing | implement PTY forwarding through SandboxProviderPort |
| 4 | shadcn ↔ VK component visual mismatch | restyled components look broken | use VK's UI primitives wrapped in our tokens, not full substitution |
| 5 | PolicyTier/BlastRadius props don't fit existing card schema | TypeScript errors at integration | extend card schema; bead it |
| 6 | Real approval flow has timing bugs | approvals get stuck | add observability (correlation IDs); fix per case |
| 7 | Evidence chain ordering bugs | hash-chain verification fails | tighten event ordering at glue layer |
| 8 | Focus mode degrades performance | kanban + focus open simultaneously slow | lazy-mount focus mode; bead it |

## Total commitment

If we land week 0 (spike) successfully and proceed:
- **Calendar weeks**: 8.
- **Implementation beads filed**: 14 (vendor-setup, cloud-rip, glue-scaffolding, glue-approval, glue-sandbox, frontend-transplant, auth-stub, restyle, governance-overlays, approval-live, evidence-bus-bridge, pr-policy, focus-mode, integration-cleanup).
- **Door-open decision beads filed**: 5 (D1 beads-api-harden, D2 actor-identity, D3 policy-actor-aware, D4 rate-reputation-stubs, D5 evidence-trigger-field).
- **Spike + ADR-finalize + parallel infra beads**: 4 (spike, adr-148-finalize, vk-sha-mirror, third-party-notices).
- **Vision tracker bead**: 1 (phase-3-vision-tracker, never started).
- **Total beads**: 14 + 5 + 4 + 1 = 24.

Spike is the only bead that is committed to a specific calendar period (this week if approved). The rest are sequenced but flexible — pick up after spike based on capacity.

## Related documents

- [ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md) — the decision.
- [Cockpit vendor architecture](./cockpit-vendor-architecture.md) — the how.
- [Agent-driven backlog vision](./agent-driven-backlog-vision.md) — the why-it-matters-long-term.
- [Inspiration synthesis](./inspiration/README.md) — the comparative analysis that motivated the strategy.

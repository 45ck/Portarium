# Cockpit MVP Plan: Milestones and Decision Gates

> **Bead:** bead-0757
> **Date:** 2026-02-23
> **Status:** Active
> **Owner:** agent-local-dx

## 1. MVP definition

The Cockpit MVP is the minimum viable surface that demonstrates Portarium's governance-first value proposition end-to-end: a human reviews what an agent/workflow proposes, decides, and the decision is recorded with a full audit trail.

**MVP persona:** Approver (single persona, single workspace).

**MVP flow:** Login -> Dashboard -> Pending approvals -> Triage/Review -> Decide -> Evidence audit trail.

## 2. What exists today

### Routes implemented (53 route files)

| Area       | Routes                                      | Data binding       | Status     |
| ---------- | ------------------------------------------- | ------------------ | ---------- |
| Dashboard  | `/`                                         | Mock fixtures      | Scaffold   |
| Approvals  | `/approvals`, `/approvals/:id`              | Mock + triage deck | Functional |
| Runs       | `/runs`, `/runs/:id`                        | Mock fixtures      | Scaffold   |
| Work items | `/work-items`, `/work-items/:id`            | Mock fixtures      | Scaffold   |
| Evidence   | `/evidence`                                 | Mock fixtures      | Scaffold   |
| Workflows  | `/workflows`, `/workflows/:id`, builder     | Mock fixtures      | Scaffold   |
| Robotics   | `/robotics`, map, robots, missions, safety  | Mock fixtures      | Scaffold   |
| Config     | settings, adapters, agents, machines, users | Mock fixtures      | Scaffold   |
| Search     | `/search`                                   | Mock fixtures      | Scaffold   |
| Inbox      | `/inbox`                                    | Mock fixtures      | Scaffold   |
| Workforce  | `/workforce`, queues                        | Mock fixtures      | Scaffold   |
| Auth       | `/auth/login`                               | Mock OIDC          | Scaffold   |

### Components completed

- Approval triage card (decomposed, tested, accessible — bead-9ewt, bead-0epc)
- Triage deck with swipe/keyboard/drag UX
- 12 triage view modes (traffic signals, briefing, risk radar, blast map, etc.)
- SoD evaluation banner
- Policy rule panels
- Provenance journey
- Error boundaries and loading states (bead-uyjg)
- Skip-to-content link, ARIA labels, colour-independent badges (bead-0epc)
- Mobile bottom nav
- Command palette

### Key gaps (from plan-alignment-audit.md)

- All data is mock fixtures — no live API binding
- WorkItem.sla/dueAtIso not shown
- Run.correlationId not surfaced
- Approval.assigneeUserId has no assign-to-user UI
- Workflow.version and Workflow.active not shown
- No credential revoke UI
- No absolute timestamps (only relative)

## 3. Milestones

### M0: Foundation (DONE)

**What:** Scaffold all routes, implement core triage UX, establish design system.

**Exit criteria:**

- [x] All IA-baseline routes exist as scaffolds
- [x] Triage card functional with keyboard/swipe/drag
- [x] Design system: badges, entity icons, page headers
- [x] Mobile-responsive layout with bottom nav
- [x] Accessibility baseline (skip-nav, ARIA, colour-independent)
- [x] Error boundaries on async routes
- [x] Component architecture: TriageCard decomposed, tested

### M1: API binding — Approvals path (next)

**What:** Connect the approval flow to the real control-plane API. This is the critical path for demonstrating real value.

**Scope:**

1. Wire `/v1/workspaces/:wsId/approvals` endpoint to approvals list page
2. Wire approval detail page to real approval data
3. Wire triage deck to real pending approvals queue
4. Wire decision submission (approve/deny/request-changes) to real mutation endpoint
5. Wire evidence entries for the approval to real evidence API
6. Wire run summary and workflow summary lookups
7. Implement optimistic updates for triage actions
8. Add real loading states (skeleton screens) during data fetching
9. Add error recovery (retry, stale-while-revalidate)

**Decision gate DG-1:** After M1, demo the approval flow with a real Temporal workflow producing a real approval. If the approver can decide and the evidence is recorded, proceed to M2. If not, iterate on M1 until the flow is solid.

**Exit criteria:**

- [ ] Approvals list shows real pending approvals from API
- [ ] Triage deck processes real approvals
- [ ] Decisions persist and evidence is recorded
- [ ] No mock data in the approval path
- [ ] Loading and error states work correctly
- [ ] ci:pr passes

### M2: API binding — Dashboard + Runs

**What:** Connect dashboard KPIs and run pages to real data.

**Scope:**

1. Dashboard: real counts for pending approvals, active runs, failed runs
2. Run list: real run data with status, timing, workflow link
3. Run detail: real effects, evidence, approval gates
4. Activity feed: real recent events

**Decision gate DG-2:** Dashboard shows accurate operational state. If counts match actual system state, proceed. If drift is > 5 seconds stale, add real-time subscription (WebSocket/SSE).

**Exit criteria:**

- [ ] Dashboard shows real KPI counts
- [ ] Runs list and detail show real data
- [ ] Run detail shows linked approvals and evidence
- [ ] No mock data in dashboard or runs path

### M3: API binding — Work items + Evidence

**What:** Connect remaining core pages.

**Scope:**

1. Work items list and detail with real data
2. Evidence explorer with real chain data
3. Cross-entity navigation (work item -> runs -> approvals -> evidence)
4. Evidence chain integrity verification display

**Decision gate DG-3:** Full end-to-end traceability: pick any work item, see its runs, see approvals on those runs, see evidence chain. If the audit story is coherent, proceed to M4.

**Exit criteria:**

- [ ] Work items show real data with correct status
- [ ] Evidence explorer shows real evidence chains
- [ ] Cross-entity links navigate correctly
- [ ] Chain integrity banner shows real verification status

### M4: Auth + RBAC

**What:** Real authentication and role-based access.

**Scope:**

1. OIDC PKCE login flow against real identity provider
2. JWT claim extraction for workspace/role context
3. Role-based route guards (approver sees approvals, admin sees config)
4. SoD enforcement uses real identity (not mock user)
5. Session management (token refresh, logout)

**Decision gate DG-4:** A real user can log in, see only their workspace's approvals, and SoD correctly blocks self-approval. If RBAC works, proceed to M5.

**Exit criteria:**

- [ ] Real OIDC login works
- [ ] Routes are guarded by role
- [ ] SoD uses real identity
- [ ] Token refresh works silently

### M5: Mobile + PWA

**What:** Installable progressive web app with push notifications.

**Scope:**

1. Web app manifest with correct icons, theme, display mode
2. Service worker for offline shell caching
3. Push notification pipeline (device registration -> approval notification)
4. Deep links from notifications to specific approvals
5. Capacitor wrapper for iOS/Android (stretch)

**Decision gate DG-5:** Approver receives push notification for new approval, taps it, lands on triage card, decides. If the mobile flow works end-to-end on a phone browser, ship PWA. Capacitor native wrapper is a separate decision based on App Store requirements.

**Exit criteria:**

- [ ] App installable from browser (A2HS prompt)
- [ ] Push notification received for new approval
- [ ] Deep link opens correct approval
- [ ] Offline shell loads (online data still required)

### M6: Config + Admin

**What:** Admin pages with real data.

**Scope:**

1. Users/RBAC management page with real data
2. Adapters/providers status from real registry
3. Settings page with workspace config
4. Workflow builder connected to real workflow definitions

**Decision gate DG-6:** Admin can manage users and see real adapter health. Workflow builder is complex enough to warrant its own evaluation (see bead-0753 for n8n Embed vs native).

## 4. Risk register

| Risk                                                       | Mitigation                               | Owner   |
| ---------------------------------------------------------- | ---------------------------------------- | ------- |
| API contract drift between cockpit types and control plane | bead-0752 API drift CI check             | infra   |
| TanStack Router type errors accumulate                     | Fix route types before M1 API binding    | cockpit |
| Mobile PWA push requires backend infrastructure            | Defer to M5, evaluate VAPID vs FCM       | infra   |
| Workflow builder scope creep                               | Isolate as separate decision (bead-0753) | product |
| Performance on large approval queues                       | Virtualise lists in M2, paginate API     | cockpit |

## 5. Non-goals for MVP

- Workflow builder (complex, separate evaluation — bead-0753)
- Robotics real-time map (requires WebSocket infra, separate milestone)
- Multi-workspace switching
- Batch approval operations
- Custom approval renderers (block-based DSL — bead-yd14)
- Embedded/streaming approval API (bead-4emp)
- AI summary integration (bead-9p77)

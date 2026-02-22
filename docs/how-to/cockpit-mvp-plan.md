# Cockpit MVP Plan: Milestone Estimates and Decision Gates

> **Audience**: Engineering leads, product owner, and release manager.
>
> **Goal**: Define the minimum viable Cockpit — the set of features, milestones, and
> decision gates required to ship a usable governance cockpit to the first wave of
> technical adopters.

---

## 1. MVP scope definition

The Cockpit MVP ships when a workspace operator can:

1. **See** all work items, their active runs, and pending approvals in one place.
2. **Act** on pending approvals (approve/reject with a comment).
3. **Verify** the evidence chain for any completed run.
4. **Onboard** a new integration adapter in < 30 minutes using the MIS v0.1 interface.

Everything else (analytics dashboards, workflow editor, mobile app, AI-assisted
summaries) is post-MVP.

---

## 2. Milestone breakdown

### M0 — Foundation (complete before M1 starts)

**Gate**: Control-plane API endpoints for work items, runs, approvals, and evidence
return real data (not mocks). See `bead-0166` (Integration complete phase gate).

Deliverables:

- [ ] `GET /v1/workspaces/:wsId/work-items` returns live data
- [ ] `GET /v1/workspaces/:wsId/runs` returns live data
- [ ] `GET /v1/workspaces/:wsId/approvals?status=pending` returns live data
- [ ] `GET /v1/workspaces/:wsId/runs/:id/evidence` returns live data
- [ ] `npm run seed:local` + smoke tests green

---

### M1 — Read-only Cockpit (≈ 1–2 weeks after M0)

**Goal**: Cockpit can display live data. No write operations yet.

| View                                      | Status  |
| ----------------------------------------- | ------- |
| Dashboard (counts, activity feed)         | Pending |
| Work-Item Hub (table, filters)            | Pending |
| Work-Item Detail (read-only)              | Pending |
| Run Hub (table, filters)                  | Pending |
| Run Detail (step timeline, evidence feed) | Pending |
| Evidence Explorer (search, chain viewer)  | Pending |

**Decision gate M1**: Does the chain viewer correctly render tampered/incomplete chains?
(Manual QA with `src/sdk/evidence-chain-verifier.ts` test vectors.)

---

### M2 — Approval Actions (≈ 1 week after M1)

**Goal**: Workspace operator can approve/reject from the Cockpit.

| Feature                                    | Notes                                          |
| ------------------------------------------ | ---------------------------------------------- |
| Approval queue view (`/approvals/pending`) | List with inline Approve/Reject                |
| Approval Detail view                       | Full context + decision form                   |
| Optimistic UI update after decision        | Show "Pending server confirmation" then update |
| 409 conflict handling                      | "Approval already decided — refresh" prompt    |

**Decision gate M2**: Can the SecOps persona complete the approval flow without
leaving the Cockpit? (Manual walkthrough against `npm run seed:local`.)

---

### M3 — Write Operations + Polish (≈ 1 week after M2)

**Goal**: Full CRUD for work items. Onboarding friction reduced to < 30 min.

| Feature                           | Notes                                      |
| --------------------------------- | ------------------------------------------ |
| Create Work Item form             | Title, description, workflow selector      |
| Edit Work Item                    | Inline edit for title/description/assignee |
| Start Run action                  | Confirm dialog + run starts                |
| Cancel Run action                 | Confirm dialog                             |
| Error toasts (403, 429, 500)      | With correlationId for support             |
| Responsive layout (375 px mobile) | Key views only                             |

**Decision gate M3**: Run the Hello Governed Workflow tutorial end-to-end using only
the Cockpit (no direct API calls). Time should be ≤ 30 minutes for a new user.

---

### M4 — Hardening + Launch (≈ 1 week after M3)

**Goal**: Production-ready Cockpit. First external adopters invited.

| Task                                          | Notes                                        |
| --------------------------------------------- | -------------------------------------------- |
| Lighthouse ≥ 90 (Performance + Accessibility) | `npm run cockpit:lighthouse`                 |
| ARIA labels on all interactive elements       | Screen-reader test                           |
| CSP headers configured                        | See `docs/how-to/supply-chain-guardrails.md` |
| License gate passed                           | See `docs/how-to/licensing-gate.md`          |
| Cockpit PWA manifest + service worker         | Installable on desktop/mobile                |
| Cockpit smoke tests in CI                     | `npm run ci:cockpit:smoke`                   |
| OIDC PKCE login flow validated                | bead-0721                                    |

**Decision gate M4**: All checklist items in `docs/how-to/technical-adopter-gtm.md`
section 2 are ✅.

---

## 3. Dependency graph

```
bead-0166 (Integration complete)
    │
    ▼
M0 (API live)
    │
    ▼
M1 (Read-only Cockpit)
    │
    ├── bead-0721 (OIDC PKCE auth)
    │
    ▼
M2 (Approval actions)
    │
    ▼
M3 (Write operations)
    │
    ├── bead-0750 (Licensing gate)
    ├── bead-0755 (Supply-chain guardrails)
    │
    ▼
M4 (Hardening + Launch)
    │
    └── bead-0740 (GTM readiness)
```

---

## 4. Decision gates summary

| Gate | Question                              | Pass criteria                                        |
| ---- | ------------------------------------- | ---------------------------------------------------- |
| M0   | Is the API ready?                     | All seed data accessible via REST, smoke tests green |
| M1   | Is chain viewer correct?              | Tampered chain shows 🔴, verified shows 🟢           |
| M2   | Can SecOps complete approval flow?    | Walkthrough < 5 min, no API calls needed             |
| M3   | Can a new user complete the tutorial? | Tutorial completion ≤ 30 min                         |
| M4   | Is the Cockpit production-ready?      | All checklist items in GTM doc ✅                    |

---

## 5. Out of scope for MVP

- Workflow visual editor (drag-and-drop BPMN/flow) — post-MVP (bead-0753)
- Mobile app (Capacitor iOS/Android) — post-MVP (bead-0720)
- AI-assisted approval summaries — post-MVP (requires inference endpoint)
- Multi-tenant admin view — post-MVP
- Analytics / metrics dashboards — post-MVP (bead-0745)
- Dark mode — post-MVP

---

## 6. Related documents

| Document                                             | Purpose                               |
| ---------------------------------------------------- | ------------------------------------- |
| `docs/ui/cockpit/ia-baseline.md`                     | View inventory and data relationships |
| `docs/integration/cockpit-api-contract-alignment.md` | API contract                          |
| `docs/onboarding/dev-track.md`                       | Developer onboarding                  |
| `docs/tutorials/hello-governed-workflow.md`          | MVP tutorial                          |
| `docs/how-to/technical-adopter-gtm.md`               | GTM readiness checklist               |

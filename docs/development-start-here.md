# Development Start Here

A developer entry point for the Portarium (VAOP) codebase.

## How to use this guide

0. If you are new to the repo, start with `docs/getting-started/contributor-onboarding.md`.
1. Read the **Critical path** below — this is the minimum dependency chain to get from zero to a working system.
2. Use `bd` to find what is ready to pick up right now:
   ```
   node scripts/beads/bd.mjs issue next --priority P0
   node scripts/beads/bd.mjs issue next --priority P0 --phase devenv
   node scripts/beads/bd.mjs issue view <id>     # full AC + blockedBy
   node scripts/beads/bd.mjs issue claim <id> --by "<owner>"
   ```
3. Work in **phase order** within each priority tier (devenv → domain → application → infrastructure → presentation).
4. Every bead you implement needs a corresponding **review bead** to close — see the governance phase for review bead IDs.

## Workflow (from CLAUDE.md)

```
Spec → Tasks (bd) → Implement → Tests → Quality gates → Review → QA → Merge
```

Run `npm run ci:pr` before claiming any bead done.

---

## Critical path

### Phase 0 — Dev environment (do first, everything depends on these)

| Bead      | Priority | Status | Title                                                             |
| --------- | -------- | ------ | ----------------------------------------------------------------- |
| bead-0400 | P0       | open   | **URGENT** Migrate Temporal compose image to `temporalio/server`  |
| bead-0385 | P0       | open   | Docker Compose local dev stack (DB, Temporal, Vault, MinIO, OTel) |
| bead-0386 | P0       | open   | OCI images for API server + worker (multi-stage Dockerfiles)      |

Start with **bead-0400** (standalone, no deps). Then **bead-0385** (everything else flows from here).

### Phase 1 — Domain model (unblocked, work in parallel)

| Bead      | Priority | Blocks           | Title                                                          |
| --------- | -------- | ---------------- | -------------------------------------------------------------- |
| bead-0302 | P0       | 0338, 0303, 0337 | Domain parsing/validation toolkit consolidation                |
| bead-0304 | P0       | 0306, 0305, 0307 | Tenancy identity unification (TenantId/WorkspaceId)            |
| bead-0035 | P0       | 0437, 0450       | ADR-029: tamper-evident hash chain on EvidenceEntry            |
| bead-0338 | P0       | —                | Harden ErrorFactory with nested path support                   |
| bead-0303 | P0       | —                | Temporal invariants (issued/revoked, started/ended ordering)   |
| bead-0306 | P0       | 0041             | Domain events correlation (tenantId/correlationId required)    |
| bead-0337 | P0       | 0314, 0425       | Run lifecycle state machine (Pending→Running→Succeeded/Failed) |

### Phase 2 — OpenAPI contract (unblocked, prerequisite for all handlers)

| Bead      | Priority | Blocks           | Title                                                                           |
| --------- | -------- | ---------------- | ------------------------------------------------------------------------------- |
| bead-0447 | P0       | 0415, 0438, 0439 | OpenAPI alignment: AdapterRegistration capabilityMatrix + schema reconciliation |

### Phase 3 — Infrastructure foundations (needs devenv)

| Bead      | Priority | BlockedBy  | Title                                                          |
| --------- | -------- | ---------- | -------------------------------------------------------------- |
| bead-0391 | P0       | 0385       | DB schema migration framework                                  |
| bead-0335 | P0       | 0385, 0391 | Wire infra adapters (PostgreSQL, event publisher, ID gen)      |
| bead-0402 | P0       | 0385, 0400 | Install Temporal TypeScript SDK + WorkflowOrchestrator adapter |
| bead-0389 | P0       | 0385       | Evidence WORM storage (S3 Object Lock, retention, legal holds) |

### Phase 4 — Application layer (needs infra + domain)

| Bead      | Priority | BlockedBy        | Title                                                                |
| --------- | -------- | ---------------- | -------------------------------------------------------------------- |
| bead-0016 | P0       | —                | IAM MVP: workspace users + RBAC roles                                |
| bead-0041 | P0       | 0306             | ADR-032: CloudEvents envelope on all event emission points           |
| bead-0316 | P0       | 0335             | Outbox + event dispatcher (exactly-once-ish publish)                 |
| bead-0319 | P0       | 0335             | Missing command/query handlers (list/read/search CRUD)               |
| bead-0340 | P0       | 0335, 0319       | Complete remaining application use-cases                             |
| bead-0417 | P0       | 0016             | JWT validation + principal extraction                                |
| bead-0418 | P0       | 0417             | Wire AuthorizationPort (Keycloak OIDC + OpenFGA)                     |
| bead-0314 | P0       | 0402, 0337       | Durable workflow adapter integration (start activity, await signals) |
| bead-0419 | P0       | 0314             | Close submit-approval RequestChanges gap                             |
| bead-0426 | P0       | 0316, 0402       | Idempotent workflow start (same idempotency key → same runId)        |
| bead-0425 | P0       | 0314, 0316, 0337 | Temporal worker execution loop (plan → execute → diff → evidence)    |

### Phase 5 — Infrastructure: control plane server (needs phases 3+4)

| Bead      | Priority | BlockedBy        | Title                                                         |
| --------- | -------- | ---------------- | ------------------------------------------------------------- |
| bead-0415 | P0       | 0447, 0335, 0418 | HTTP server handlers for all OpenAPI v1 routes                |
| bead-0416 | P0       | 0386             | Replace bootstrap.sh with production API + worker entrypoints |

### Phase 6 — Cockpit MVP (needs phase 5)

| Bead      | Priority | BlockedBy  | Title                                                           |
| --------- | -------- | ---------- | --------------------------------------------------------------- |
| bead-0427 | P0       | 0415, 0418 | Cockpit UI MVP (approver queue, run list, evidence, work items) |

---

## Review and doc-review beads (trigger after implementation closes)

Every P0 implementation bead has a corresponding review bead. After implementation closes, open the review bead and work through its AC.

| Review bead | Reviews                                       |
| ----------- | --------------------------------------------- |
| bead-0480   | Domain parsing toolkit (bead-0302)            |
| bead-0481   | Tenancy identity unification (bead-0304)      |
| bead-0482   | Run lifecycle state machine (bead-0337)       |
| bead-0483   | OpenAPI contract alignment (bead-0447)        |
| bead-0484   | Infrastructure adapters wiring (bead-0335)    |
| bead-0485   | Temporal SDK integration (bead-0402)          |
| bead-0486   | Outbox + event dispatcher (bead-0316)         |
| bead-0487   | IAM MVP + JWT + AuthZ (bead-0016, 0417, 0418) |
| bead-0488   | Temporal worker execution loop (bead-0425)    |
| bead-0489   | Evidence hash chain (bead-0035)               |
| bead-0490   | CloudEvents envelope (bead-0041)              |
| bead-0491   | Control plane HTTP handlers (bead-0415)       |

**Doc review beads (after groups of beads close):**

| Doc review bead | Triggers after                                                           |
| --------------- | ------------------------------------------------------------------------ |
| bead-0492       | Domain model docs — after bead-0302, 0304, 0337 close                    |
| bead-0493       | OpenAPI spec and backlog docs — after bead-0447, 0415 close              |
| bead-0494       | Application layer backlog docs — after bead-0316, 0319, 0340, 0425 close |
| bead-0495       | .specify/specs/ alignment — after bead-0340, 0425 close                  |

---

## P1 beads ready after P0 (sample — run `bd issue next --priority P1`)

Key P1 clusters to plan for after P0 stabilises:

- **SoD / policy engine**: bead-0039 (SoD model), bead-0448 (policy rule language)
- **OpenClaw agents**: bead-0430 → 0431 → 0432 → 0433 → 0435 → 0436 → 0437 → 0438/0439 → 0440
- **Activepieces/Langflow**: bead-0401 (ADR) → 0403/0404/0407 → 0405/0408
- **OTel propagation**: bead-0043
- **Evidence JCS canonicalization**: bead-0450
- **Hybrid arch ADR**: bead-0452

---

## Phase gates (blocking for release)

| Gate bead | What it requires        |
| --------- | ----------------------- |
| bead-0161 | Foundation complete     |
| bead-0162 | Domain complete         |
| bead-0163 | Application complete    |
| bead-0164 | Infrastructure complete |
| bead-0165 | Presentation complete   |
| bead-0166 | Integration complete    |
| bead-0167 | Security complete       |
| bead-0168 | Release complete        |

Each gate has a corresponding closeout review bead (bead-0260 through bead-0264).

---

## Quick reference commands

```bash
# What can I start right now?
node scripts/beads/bd.mjs issue list --status open

# Start work (claims bead + creates worktree)
node scripts/beads/bd.mjs issue start bead-XXXX --by "<owner>"

# See full AC for a bead
node scripts/beads/bd.mjs issue view bead-0302

# Mark done
node scripts/beads/bd.mjs issue finish bead-XXXX
```

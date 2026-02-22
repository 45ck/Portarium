# Workflow System V&V Campaign: Cross-Layer Verification

> **Audience**: Engineering leads, QA, and release managers.
>
> **Goal**: Establish a systematic Verification & Validation (V&V) campaign that traces
> confidence from domain invariants all the way through to Cockpit end-to-end behaviour.

---

## 1. Campaign structure

The V&V campaign is organised into four layers matching the architecture:

| Layer              | Bead      | Scope                                                       |
| ------------------ | --------- | ----------------------------------------------------------- |
| **Domain**         | bead-0759 | State-machine invariants, property tests, mutation tests    |
| **Application**    | bead-0760 | Command/query conformance matrix, authorization coverage    |
| **Infrastructure** | bead-0761 | Durability, outbox ordering, failure injection              |
| **Presentation**   | bead-0762 | E2E Cockpit flows across roles and tenant scopes            |
| **Governance**     | bead-0763 | Traceability matrix: spec → tests → evidence → release gate |

---

## 2. Verification objectives

### 2.1 Correctness

> Every workflow run that completes successfully produces an unbroken, tamper-evident
> evidence chain that accurately reflects the execution path.

Test coverage required:

- All domain state-machine transitions (happy path + rejection + cancellation)
- All approval tiers: Auto, Assisted, HumanApprove, ManualOnly
- Evidence hash correctness and chain linkage
- Idempotency: re-processing the same command produces the same state

### 2.2 Safety

> A workflow cannot reach a `succeeded` terminal state without satisfying all
> configured approval constraints.

Test coverage required:

- Approval bypass attempts (missing approval, wrong approver, expired approval)
- Policy-tier escalation (step tries to downgrade approval requirement)
- Tenant isolation (workspace A cannot see or modify workspace B's runs)

### 2.3 Liveness

> A workflow in a valid intermediate state eventually progresses to a terminal state
> (given no external failures).

Test coverage required:

- All blocking states have a corresponding unblocking event
- Timeout/expiry paths for pending approvals
- Retry semantics for transient adapter failures

### 2.4 Observability

> Every state transition produces an observable event in the evidence chain that
> enables post-hoc reconstruction of the execution history.

Test coverage required:

- No silent state transitions (every change emits evidence)
- Evidence entries contain sufficient context to recreate the run state
- Chain verification CLI (`evidence-chain-verifier.ts`) confirms integrity

---

## 3. Test coverage matrix

| Invariant                                 | Domain test | App test | Infra test | E2E test |
| ----------------------------------------- | ----------- | -------- | ---------- | -------- |
| Work item created → run startable         | ✅          | ✅       | –          | ✅       |
| Run started → evidence chain initiated    | ✅          | ✅       | ✅         | ✅       |
| HumanApprove step → run paused            | ✅          | ✅       | –          | ✅       |
| Approval granted → run resumes            | ✅          | ✅       | ✅         | ✅       |
| Approval rejected → run failed            | ✅          | ✅       | –          | ✅       |
| Run succeeded → terminal + chain verified | ✅          | ✅       | ✅         | ✅       |
| Tenant isolation (cross-workspace read)   | –           | ✅       | ✅         | ✅       |
| Evidence hash chain integrity             | ✅          | –        | ✅         | ✅       |
| Outbox ordering under crash               | –           | –        | ✅         | –        |
| Idempotent command replay                 | –           | ✅       | ✅         | –        |

Legend: ✅ covered · – not applicable at this layer

---

## 4. Campaign execution order

1. **bead-0759** (Domain V&V) — must complete before Application V&V starts
2. **bead-0760** (Application V&V) — depends on domain invariants being stable
3. **bead-0761** (Infrastructure V&V) — can run in parallel with bead-0760
4. **bead-0762** (Presentation V&V) — depends on Application V&V (needs stable API)
5. **bead-0763** (Governance V&V) — runs after all others; produces traceability matrix

---

## 5. Exit criteria for the V&V campaign

The campaign is complete when:

- [ ] All cells in the coverage matrix are ✅ or `–`
- [ ] Property test suite runs in CI without flakiness (3 consecutive green runs)
- [ ] Failure injection suite produces predictable recovery behaviour
- [ ] E2E Cockpit suite covers all 5 user personas (Dev, SRE, SecOps, Approver, Observer)
- [ ] Traceability matrix (bead-0763) maps every spec requirement to ≥ 1 test
- [ ] `npm run ci:nightly` green

---

## 6. Related beads

| Bead      | Title                                              |
| --------- | -------------------------------------------------- |
| bead-0759 | Domain V&V: state-machine invariants               |
| bead-0760 | Application V&V: command/query conformance         |
| bead-0761 | Infrastructure V&V: durability + failure injection |
| bead-0762 | Presentation V&V: Cockpit E2E                      |
| bead-0763 | Governance V&V: traceability matrix                |

---

## 7. Related documents

| Document                                     | Purpose                    |
| -------------------------------------------- | -------------------------- |
| `docs/how-to/run-quality-gates.md`           | Quality gate reference     |
| `docs/how-to/runnable-state-mvp-campaign.md` | Integration-complete gate  |
| `src/sdk/evidence-chain-verifier.ts`         | Chain verification utility |
| `docs/spec/`                                 | Specification artefacts    |

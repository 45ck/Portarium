# Agent-Driven Backlog — Vision Doc (Phase 3+)

This is a **vision document**, not a v1 plan. It describes the long-term shape of Portarium's engineering layer: a system where coding agents are first-class actors in the kanban — they file beads, pick work, plan, execute, and review under policy, with humans curating intent and verifying outcomes.

The hybrid Vibe Kanban integration ([ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md)) is **v1**. This vision is **v3+**. v1 must not foreclose on this future. The five "door-open decisions" in the ADR are the non-negotiable architectural moves required in v1 to keep this vision reachable.

## The product thesis

> **Humans become curators of intent and verifiers of outcome; agents handle the doing — under end-to-end governance.**

This is the natural endpoint of:
- Beads as a programmatic backlog (already true in Portarium).
- Worktrees per task (already true).
- Sandbox-isolated execution (v1).
- Policy + evidence chain (existing + extended in v1).
- Plan/build mode separation as the canonical approval seam (v1, from OpenCode pattern).
- Per-tool approval with deferred long-poll (v1, from Vibe Kanban + OpenCode patterns).
- Vibe Kanban-shaped operator surface (v1).

When all of those are in place, autonomous backlog operation is mostly a matter of letting agents *also* be actors on the same surface humans use — same Beads API, same approval gates, same evidence chain, same Cockpit. No new architecture; new actor types.

## Phase shape

These phases are sequential but not strictly time-ordered. Each is a "the system can do this safely" milestone, gated on the previous.

### Phase 3a — Triage agents

**What**: agents watch logs, error trackers, GitHub issues, Slack reports, customer feedback channels. They observe patterns (recurring stack traces, repeated user complaints, perf regressions). They file beads with: title, body, evidence summary (`triggeringObservation` field), proposed priority, proposed blast-radius.

**Human role**: review the agent's filed beads. Approve, reject (with reason — feeds reputation), or modify. Bulk operations: "approve all from `triage-v1` for the past 24h that match `bug + low-blast` filter."

**What this delivers**: backlog grooming becomes a 10-minute morning review instead of a constant attention drain. Customer-reported issues are converted into beads within minutes of being reported, deduplicated against existing beads, ranked by frequency.

### Phase 3b — Planning agents

**What**: given a high-level goal ("ship the engineering layer," "reduce p99 latency on /api/orders by 30%"), an agent decomposes into a tree of beads with dependencies, owners (human or agent), estimates, and suggested sequencing. Output is a draft plan that materializes as a set of beads in `Pending Approval` state.

**Human role**: review the plan as a tree (Cockpit visualizes it). Approve, modify, or reject the whole plan. Once approved, the plan beads become the backlog.

**What this delivers**: the "translate goal into actionable backlog" step — historically a senior engineer's job — becomes a draft + review job. Senior engineers spend their time on what matters (was the plan right?) rather than on what doesn't (typing out 20 ticket descriptions).

### Phase 3c — Worker agents (governed extension of AGENT_LOOP.md)

**What**: agent claims a ready bead, plans its implementation (creates a `plan_exit`-shaped halt point), requests approval of the plan, executes in sandbox, requests approval of the merge. AGENT_LOOP.md today is a primitive form of this; v3c adds:
- Sandbox-isolated execution (already in v1).
- Plan-approval gate before the agent touches files.
- Multiple agents working different beads in parallel without coordination because each is in its own sandbox.

**Human role**: approve plans, approve merges, set the policy that decides which agent class can claim which bead class.

**What this delivers**: throughput decoupling. 10 agents can work 10 beads in parallel; humans review 10 plans + 10 merges instead of typing 10 implementations.

### Phase 3d — Review agents

**What**: agent reviews another agent's PR. Reports findings as comments on the diff (using Vibe Kanban's `CommentWidgetLine` flow that posts comments back as follow-up messages). Findings include: correctness concerns, security smells, test coverage gaps, style violations, performance risks.

**Human role**: review the agent's review. Decide whether the findings warrant rework or are noise. Forms a learning loop: the review agent gets reputation signals based on whether its findings led to real fixes.

**What this delivers**: every PR gets a thorough first-pass review automatically, before a human spends time on it. Humans see PRs that have already been triaged for the obvious issues. Quality floor rises.

### Phase 4 — Closed loop with policy-bounded autonomy

**What**: triage → plan → work → review → merge done by agents under policy. Humans:
- Approve plans and merges (the gates that matter most).
- Set policy (what classes of work which agent classes can do unsupervised vs which require approval).
- Curate strategy (high-level goals, priorities, what's out of scope).
- Audit randomly (5% sampling on `AUTO`-tier actions; full review on `HUMAN-APPROVE`-tier).

Engineering throughput becomes a function of policy permissiveness, not headcount. Humans become *more* leveraged, not redundant — a human-with-Portarium does the work of a small team; a small team-with-Portarium does the work of a department.

## The four risks (and architectural mitigations)

### R1. Backlog explosion — agents fire 1000 beads a day, backlog becomes useless

**Mitigations**:
- Per-agent daily quota in policy (`RateLimitPort` from door-open decision D4).
- Per-agent reputation tracking (`ReputationPort` from D4): if rejection rate exceeds threshold (e.g. 40%), agent is throttled or demoted.
- Auto-close of agent-filed beads with no human engagement after N days.
- Required deduplication step: agent must search existing beads before filing; tooling enforces it.
- Cockpit "agent-filed beads needing triage" queue shows aggregated counts per agent — humans can spot-check noisy producers.

### R2. Approval rubber-stamping — humans tune out, click approve without reading

**Mitigations**:
- Rationale text input is *required* on every approval (min 10 chars — already in `ux-layout.md`).
- Scroll-to-unlock on `critical` blast radius approvals — forces visual engagement with the diff.
- Random sampling: 5% of `AUTO`-tier actions get a forced human review even though policy doesn't require it. Keeps humans in the loop on what's flowing through unsupervised.
- Approval latency tracking: if a human approves in <5 seconds for a high-blast action, log it as a "fast approval" — not blocked, but flagged for retrospective review.
- Cockpit shows "5 pending high-blast approvals — these need ≥30s of attention each" as a visible nudge.

### R3. Loop dynamics — agents optimizing for what looks good to other agents

If the triage agent files beads that look good to the planning agent that makes plans that look good to the worker agent that makes diffs that look good to the review agent — and humans are downstream of a quality drift they can't see.

**Mitigations**:
- **SoD (separation of duties) enforced at policy level** (door-open decisions D2 + D3): agent X cannot work beads agent X filed. Agent X cannot review PRs agent X authored. Same policy engine, actor-aware.
- **Different model providers per role where possible** (e.g. triage uses Claude, planning uses GPT, worker uses Codex). Reduces shared blind spots.
- **Outcome-based reputation** (D4 ReputationPort): did the merged change actually fix the user-reported issue? Did support tickets reopen? Reputation feeds back from real-world signals, not just intermediate approval rates.
- **`triggeringObservation` field on every agent-filed bead** (D5): agents must show their work — what observation drove this bead? Without that field, the bead is rejected. Forces the agent to be auditable.

### R4. Context loss — humans don't write code, lose mental model needed to review well

This is the most insidious risk and the architecture can only partially solve it.

**Architectural mitigations**:
- Approval surfaces show the *full* plan and *full* diff, never summaries. Humans see exactly what they're approving.
- The cockpit forces engagement at the gates that matter (rationale required, scroll-to-unlock for critical changes).
- Evidence panel makes it trivial to see the chain: "this bead → this plan → these approvals → this diff → this merge."

**Organizational mitigation (out of architectural scope)**:
- Teams must keep some humans hands-on. Portarium's product position should encourage this — "supervised autonomy" not "autonomous engineering."
- Onboarding for new humans includes hands-on coding work before approval rights are granted. Don't put a new human on `HUMAN-APPROVE` for `critical` blast radius actions.

## The five door-open decisions (recap from ADR-0148)

These are not features. They are *shape decisions* that cost almost nothing in v1 if known up-front, and cost a structural rewrite to add later. v1 must include all five.

### D1. Beads API is canonical, CLI is a thin client

**Why for phase 3**: agents call the Beads API to file/claim/update beads. They don't shell out to `bd`. The API is the contract.

**v1 implementation**: ensure every `bd` subcommand has an equivalent HTTP route. Auth + actor identity (D2) is required on every call. Document the API in the OpenAPI spec.

### D2. Actor identity is first-class on every entity

**Why for phase 3**: SoD requires distinguishing `human:ajax@aquinus.net` from `agent:triage-v1@portarium`. Reputation tracking requires distinguishing one agent from another. Policy decisions vary by actor type.

**v1 implementation**: every bead, approval, evidence entry, and policy decision has an `actor: Actor` field where `Actor = { kind: 'human' | 'agent', id: string, ... }`. Cryptographic identity (signed tokens, not strings) so spoofing is impossible. Add to schema in v1, even though all v1 actors are humans.

### D3. Policy tier resolution accepts actor type as input

**Why for phase 3**: the same action ("merge a PR") might be `ASSISTED` for a senior human and `HUMAN-APPROVE` for an agent. Policy must take actor type into account.

**v1 implementation**: policy engine signature is `decide(action, actor, context) -> Decision`. Even if v1 policy ignores `actor` in most rules, the parameter must be there. Adding it later means re-evaluating every historical decision.

### D4. RateLimitPort and ReputationPort interfaces exist (with stub impls)

**Why for phase 3**: agent-filed beads need rate-limiting; agent reputation needs to feed back into policy decisions. Both require dedicated infrastructure.

**v1 implementation**: define both interfaces in `src/application/governance/`. Default impls return unlimited / 100% reputation. Hook them into the policy engine as decorators. Phase 3 swaps in real impls without restructuring policy.

### D5. Evidence schema includes `triggeringObservation` field

**Why for phase 3**: agent-filed beads must be auditable. "Why did you file this?" is the question the schema answers.

**v1 implementation**: add `triggeringObservation: { kind: 'log' | 'ticket' | 'metric' | 'human' | ...; ref: string; summary: string }` to evidence entries. Optional in v1 (humans don't always have one); required for agent-filed beads in phase 3.

## What is explicitly NOT in v1

- No actual triage agent.
- No actual planning agent.
- No actual review agent.
- No reputation tracking implementation (interface only).
- No rate limiting implementation (interface only).
- No agent-class-specific policy rules.
- No agent identity issuance flow.
- No agent-to-agent communication via beads.

v1 ships with humans as the only actors in the Cockpit. Phase 3 adds agent actors when the surrounding architecture is solid enough to govern them. The point of v1 is to *not preclude* phase 3, not to ship phase 3.

## The pitch this enables

> **Portarium v1**: humans drive, agents assist, governance is end-to-end. Vibe Kanban-shaped operator surface, sandbox-isolated execution, policy and evidence on every action.
>
> **Portarium v3**: agents drive within policy, humans curate intent and verify outcomes. Same surface, same governance, more leverage.

This is the story enterprise buyers understand because it's where their AI strategy is already heading. Most shops are figuring out how to use coding agents safely. Portarium is the substrate that lets them get to v3 without rebuilding when they get there.

## When does v3 start?

Realistically, after:
1. v1 is in production for ~6 months and the governance + sandbox + evidence layers are battle-tested.
2. At least one customer has expressed concrete interest in agent-driven backlog (likely several, based on industry trajectory).
3. The team has accumulated enough evidence-chain data to design the reputation/rate-limit policies non-arbitrarily.

Probably mid-to-late 2027 by current trajectory. Not soon. But the door must be open from v1, or it never opens.

## Related documents

- [ADR-0148](../adr/ADR-0148-cockpit-derives-from-vibe-kanban.md) — the v1 decision and the five door-open decisions.
- [Cockpit vendor architecture](./cockpit-vendor-architecture.md) — the v1 integration architecture.
- [Integration build plan](./integration-build-plan.md) — sequenced v1 execution.
- [Inspiration synthesis](./inspiration/README.md) — three-product comparison that motivated v1 strategy.

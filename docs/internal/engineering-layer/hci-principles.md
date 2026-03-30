# HCI Principles: Autonomy with Ease of Mind

The goal of Portarium's engineering layer is not "governance" as compliance overhead. It is **autonomy with ease of mind** — agents do the work, humans sleep soundly.

---

## The right mental model for operators

**Not air traffic control. The experienced surgical team.**

The surgeon doesn't re-verify every instrument hand or every anesthetic adjustment. They maintain ambient awareness of the room, are surfaced exceptions proactively with enough context to act, and are consulted only for decisions that require their specific judgment. Ease of mind comes from:

- The team is competent and has a track record
- Exceptions surface themselves — they don't need to poll for problems
- When an exception occurs, there is enough context to make a good decision fast
- The outcome is recorded and reviewable

---

## Levels of automation (Parasuraman, Sheridan, Wickens 2000)

LOA should vary by action class and reversibility — not be set system-wide.

| Action function | Appropriate LOA | Portarium tier |
|---|---|---|
| Read-only (code analysis, test runs) | Level 9 — computer acts, informs only on anomaly | AUTO |
| Reversible writes (branches, commits) | Level 6-7 — computer acts, ambient visibility | AUTO + ASSISTED |
| Semi-reversible (PR creation, CI trigger) | Level 5 — computer proposes, human skims | ASSISTED |
| Irreversible (production deploy, external API, billing) | Level 3-4 — explicit human approval required | HUMAN-APPROVE |

---

## Trust calibration (Lee & See 2004)

| Mode | Behavior | Consequence |
|---|---|---|
| **Automation bias** (over-trust) | Human approves without reading | Malicious or wrong actions slip through |
| **Disuse** (under-trust) | Human rejects correct agent actions | Throughput benefit lost |
| **Appropriate reliance** (target) | Human delegates when reliable, intervenes when not | The surgical team model |

Calibration requires **per-action-class reliability history**, not a global score. "This agent has proposed 23 git commits to production branches; 22 approved without modification; 1 rejected."

---

## The operator state machine

```
CALM ──(FYI batch)──► INFORMED ──(should-review item)──► ATTENTIVE
  ▲                                                            │
  │                                               (must-act-now item)
  │                                                            ▼
RESOLVED ◄──(decision recorded)──── ACTIVE ◄──(engages)── ALERT
```

| State | Cockpit signal | Notification |
|---|---|---|
| CALM | Green status bar, digest available | None |
| INFORMED | Digest badge, no urgency | None |
| ATTENTIVE | Soft amber badge, SLA countdown | In-app only |
| ALERT | Red badge, pending queue opens | Push notification |
| ACTIVE | Full context packet, decision form | Acknowledged |
| RESOLVED | WORM receipt confirmed, agent unblocked | None |

**Design rule:** Normal operation must produce no notifications and require no attention. Exceptions surface calmly — "your attention is needed," not "something is wrong."

---

## The interruption taxonomy

| Class | Label | Trigger | Portarium tier |
|---|---|---|---|
| A | MUST-ACT-NOW | Agent blocked + irreversible action pending | HUMAN-APPROVE |
| B | SHOULD-REVIEW | ASSISTED action with anomaly, or unexpected BLOCKED | ASSISTED + anomaly flag |
| C | FYI-ONLY | Routine ASSISTED completed, AUTO digest ready | ASSISTED / AUTO digest |
| D | SILENT | All AUTO within policy, no anomalies | AUTO / BLOCKED (expected) |

**Design target: fewer than 5 Class A interruptions per operator per day.** Above this, rubber-stamping sets in.

**Queue overflow:** >5 pending Class A → system stops accepting new HUMAN-APPROVE → new requests return BLOCKED with logged reason. Agents must distinguish "waiting for human" (HUMAN-APPROVE) from "denied by policy" (BLOCKED).

---

## The "I can sleep" checklist

1. No HUMAN-APPROVE action executes without a human decision — durable store, survives proxy restart
2. Every BLOCKED action is logged with reason — operator can query "what did agents try while I slept"
3. Class A items trigger out-of-band notification within 60 seconds — push/email, not just in-app
4. WORM chain is continuous — any gap is itself an alert, tamper detection runs on schedule
5. SLA countdown fires before breach — default 2h lead time
6. Agents fail-closed on unknown action classes — no policy rule match = BLOCKED, not AUTO
7. Confidence digest is never stale — broken pipeline shows staleness warning, not stale green

---

## The autonomy confidence loop

```
OBSERVE → SUMMARIZE → SURFACE → CALIBRATE → OBSERVE ...

Every AUTO decision → WORM trail
Weekly digest aggregated by action class + agent
Cockpit shows: "47 AUTO this week, 0 anomalies, 0 reversals"
Operator can promote/demote action class from digest in one click
```

This is how AUTO coverage expands safely over time — confidence earned, not assumed.

---

## The ironies of automation (Bainbridge 1983) — agentic engineering edition

**1. Long-horizon action chain problem**
Coding agents execute 47-step plans. A human reviewing step 31 cannot evaluate it in isolation. BeadPlanner output requires human confirmation before worktrees are created — this is the plan-level gate.

**2. Context accumulation risk**
The longer an agent runs without human engagement, the harder it is to intervene constructively. The exception context packet must reconstruct narrative, not just log entries.

**3. Track record asymmetry**
1000 successful AUTO actions builds trust. When the first HUMAN-APPROVE arrives, operators may apply that track record inappropriately. The cockpit must distinguish "this is why this is different."

**4. Multi-agent provenance opacity**
When Agent A's output becomes Agent B's input, reviewers of Agent B's actions may not know the input was itself an agent artifact. Provenance must surface: "this input was produced by Agent A at step 14, AUTO-tier, not human-reviewed."

---

## The exception context packet

When an agent is blocked, the system must provide:

| Field | Content |
|---|---|
| Declared goal | What the agent was trying to accomplish |
| Steps completed | Summary of what it has done so far |
| Blocking reason | Which policy rule fired and why |
| Proposed action | What it wants to do |
| Blast radius | What systems would be affected, reversibility |
| Next step | What the agent will do immediately after if approved |
| Evidence links | Last 3-5 WORM entries from this run |

The human should be able to make a decision without opening a second tab. **Each secondary source opened is a design failure.**

---

## What the cockpit must surface (priority order)

**P0 — without these, calibrated trust is not possible:**
- Active agents panel: agent ID, current action, tier, elapsed time, wait time
- Per-action reversibility label on every pending approval
- Policy rationale for tier classification
- Exception context packet on every blocked agent

**P1 — supports calibration:**
- Per-action-class reliability history (rolling 7/30/90 day)
- Next-step preview after approval
- WORM trail link from every approval
- Weekly digest requiring operator acknowledgment for AUTO activity

**Do not surface:**
- Real-time step-by-step agent reasoning during normal execution
- Generic score without action-class grounding
- Approval queues without reversibility/severity sorting

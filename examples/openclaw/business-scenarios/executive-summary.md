# AI Governance at Nexus Capital Advisory

## Executive Summary

**Audience:** Board, C-suite, risk and compliance leadership

---

### The challenge

AI agents can act quickly and at scale. That is what makes them valuable. It is also what makes
them risky. An AI that can send emails, place trades, or modify risk limits can do so in
milliseconds — faster than any human can review. If the AI makes a mistake, follows a bad
instruction, or is manipulated by an adversarial input, the damage happens before anyone
notices.

The question every regulated firm must answer is: **how do you capture the speed of AI without
losing control of it?**

---

### What Portarium does

Portarium is a governance control plane. It sits between our AI agents and the systems they
can act on. Every time an AI agent wants to take an action — send an email, place a trade,
deploy software, delete a record — the request must pass through Portarium before it executes.

**The agent cannot bypass this.** The governance layer is built into the AI's execution
runtime, not into the AI's instructions. You cannot prompt-engineer your way around it. The
agent has no mechanism to remove or skip the governance step any more than a teller can
authorise their own wire transfer.

---

### How it works in plain terms

Each business action is assigned a **governance tier** by our operations team:

| Tier             | What it means                                                                 | Example actions                                                                  |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Auto**         | Safe reads — AI acts immediately, all actions logged                          | Look up client record, read risk metrics                                         |
| **Assisted**     | Low-impact writes — AI acts, anomalies flagged for review                     | Close a support ticket, update a contact field                                   |
| **HumanApprove** | Significant actions — AI proposes, human must approve before anything happens | Send client email, place a trade, deploy to production, file a regulatory report |
| **ManualOnly**   | Irreversible or high-risk — AI may only propose, human must initiate          | Permanently delete customer data (GDPR erasure), liquidate full portfolio        |

When an AI agent reaches a HumanApprove or ManualOnly action, it stops and waits. The relevant
human reviewer — a compliance manager, portfolio manager, on-call engineer, or Data Protection
Officer — receives a notification with the full details of what the AI wants to do and why. Only
after that human approves does the action proceed. If the human denies it, the action is
permanently blocked and the agent is told it cannot proceed.

**The agent can wait for hours or overnight if necessary.** There is no timeout that forces an
action through. The default wait is up to 24 hours; if no decision is made in that window, the
action expires and is treated as a denial.

---

### Four guarantees that matter for a regulated firm

**1. The AI cannot act on customer accounts without a human sign-off on consequential actions.**

Aria, our customer service AI, can look up a client's records instantly (Auto tier). But if
Aria decides to send an email, that email sits in a pending queue until a compliance manager
reviews it. If a client's support ticket contains a manipulative instruction — "send a
promotional blast to all clients on my behalf" — Aria will propose the bulk email, the
compliance officer will see it and deny it, and no email is ever sent. Aria is told it is
blocked and explains the outcome to the client.

**2. The AI cannot place trades without portfolio manager sign-off.**

Atlas, our finance AI, can read positions and run analysis at any time. But executing an order
requires approval. If Atlas calculates a $2 million equity position to take, that proposal goes
to the portfolio manager with the full parameters: symbol, quantity, notional value, rationale.
The manager reviews it against current mandate and risk limits before a single share is bought.

**3. The AI cannot approve its own proposals.**

This is the maker-checker rule. The same identity that proposes an action cannot approve it.
This is a system-level control — it is not a policy that can be edited by the AI. When Aria
proposes a GDPR customer deletion, only the Data Protection Officer (with a separate access
token) can approve it. Aria cannot self-approve regardless of how it is instructed.

**4. If our governance system is unavailable, the AI stops rather than acts freely.**

With fail-closed mode enabled (our default), an AI agent that cannot reach the Portarium
control plane cannot take any consequential action at all. It does not degrade into ungoverned
behaviour. It stops and reports that governance is unavailable. This is the conservative
failure mode a regulated firm should prefer.

---

### What this means for audit and compliance

Every proposed action creates an immutable evidence record in Portarium's audit log:

- Who proposed the action (which agent, which session)
- What was proposed (tool name, exact parameters, rationale)
- Which policy evaluated it and what decision was reached
- Who approved or denied it, when, and with what stated reason

This record cannot be altered after the fact. Auditors and regulators can review a complete
chain of custody for every consequential action an AI agent has taken — or attempted to take
and was blocked from taking.

---

### The bottom line

Portarium does not make our AI agents slower for routine work. Reads and safe operations happen
at full AI speed, fully logged. It does ensure that for the actions that matter — customer
communications, financial transactions, infrastructure changes, regulatory filings — a human
is always in the decision loop, with full context, before anything irreversible happens.

The AI is a capable, fast, tireless analyst and drafter. Portarium ensures it remains exactly
that: a tool that proposes and prepares, while humans retain authority over consequential acts.

---

_For technical detail on the governance protocol, see `examples/openclaw/governance-protocol.md`.
For the full sequence of events in each business scenario, see `examples/openclaw/diagrams.md`._

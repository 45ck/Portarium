# Explanation: Agent Traffic Controller Model

Portarium (VAOP) is the policy-and-approvals control plane for agent actions.
Agents do not execute tool calls directly against systems of record.
They submit intended actions to Portarium, which evaluates policy, routes
approval when needed, executes through connectors, and records evidence.

## Actors

- Agent runtime (for example OpenClaw): plans and proposes next actions
- Portarium control plane: policy gate, approvals, orchestration, evidence
- Connectors/SoR adapters: GitHub, Slack, Odoo, Google Workspace, and others

## Core Flow

1. Agent proposes an action (typed, bounded, justified).
2. Portarium evaluates policy (RBAC, risk, environment, scope, data sensitivity, cost).
3. Portarium returns `allow`, `deny`, or `needs_approval`.
4. If approved (automatically or by human), Portarium executes via connector.
5. Portarium records immutable evidence (inputs, outputs, diffs, logs, artifacts, traces).
6. Portarium returns structured result and timeline updates to the agent.

## Action Contract

Risk families:

- `read.*` (low risk)
- `write.*` (medium risk)
- `deploy.*`, `money.*`, `delete.*` (high risk)
- `admin.*` (restricted)

Request shape:

```json
{
  "capability_id": "github.create_pr",
  "principal": {
    "agent_id": "openclaw-agent-1",
    "delegated_user_id": "alice"
  },
  "inputs": {
    "repo": "45ck/Portarium",
    "title": "docs: refine discoverability"
  },
  "reasoning_summary": "Open a PR for approved docs changes.",
  "risk_hints": {
    "environment": "prod",
    "touches_pii": false,
    "estimated_cost_usd": 0
  },
  "idempotency_key": "4b9e5f53-b8e7-4d26-b920-4f4fb719f59b",
  "trace_id": "c1eb3a5b51dd46eeb96f0a0184cf5f65"
}
```

Response shape:

```json
{
  "decision": "needs_approval",
  "approval_url": "https://cockpit.example/approvals/appr_123",
  "action_run_id": "action_run_123",
  "evidence_refs": ["ev://runs/action_run_123/plan.json", "ev://runs/action_run_123/diff.json"]
}
```

## OpenClaw Integration Patterns

### Pattern A: Tool-call interceptor (default)

OpenClaw tool executor calls Portarium Action API instead of direct vendor APIs.

- Pros: strongest governance model, clean product story
- Tradeoff: requires capability registry and validated schemas

### Pattern B: Sidecar gateway

Agents call a local/shared tool gateway that forwards through Portarium policy
and execution boundaries.

- Pros: easy multi-runtime adoption
- Tradeoff: more moving parts

### Pattern C: Proxy credentials

Portarium mints scoped, short-lived credentials required by downstream tools.

- Pros: hard enforcement on direct tool access
- Tradeoff: highest connector/auth integration complexity

## MVP Delivery Slice

1. Capability registry (capability matrix mapped to executable endpoints)
2. Action API (`propose`/`execute`, idempotency, audit)
3. Policy engine (start with env, risk, scope rules)
4. Approval UI (approve/deny plus evidence panel)
5. One write-risk connector (GitHub PR/issues/comments)
6. End-to-end demo: propose -> approval -> execute -> evidence timeline

## Positioning Sentence

Portarium routes every agent action through a policy-and-approvals control
plane, so teams can gradually grant autonomy with full auditability and
evidence.

# Portarium OpenClaw Governance — Diagrams

## Diagram 1: Overall Architecture

```mermaid
graph TB
  subgraph OpenClaw["OpenClaw Runtime"]
    Agent["Agent (LLM)"]
    Hook["before_tool_call hook\n(priority 1000)"]
    Plugin["Portarium Plugin\n(@portarium/openclaw-plugin)"]
    Agent -->|"tool call attempt"| Hook
    Hook --- Plugin
  end

  subgraph Portarium["Portarium Control Plane"]
    PolicyEngine["Policy Engine\n(tier evaluation)"]
    ApprovalStore["Approval Store\n(pending / approved / denied / expired)"]
    EvidenceLog["Evidence Log\n(immutable audit trail)"]
    PolicyEngine --> ApprovalStore
    PolicyEngine --> EvidenceLog
  end

  Human["Human Operator\n(cockpit UI or API)"]

  Plugin -->|"POST /agent-actions:propose"| PolicyEngine
  PolicyEngine -->|"Allow / Denied / NeedsApproval"| Plugin
  ApprovalStore -->|"notification (out-of-band)"| Human
  Human -->|"POST /approvals/:id/decide"| ApprovalStore
  Plugin -->|"GET /approvals/:id (poll)"| ApprovalStore
  ApprovalStore -->|"Pending / Approved / Denied / Expired"| Plugin
  Plugin -->|"allow or block"| Hook
  Hook -->|"tool executes or is blocked"| Agent
```

## Diagram 2: Approval Flow Sequence

```mermaid
sequenceDiagram
  participant Agent as Agent (LLM)
  participant Hook as OpenClaw Hook
  participant CP as Portarium Control Plane
  participant Human as Human Operator

  Agent->>Hook: Attempt tool call (e.g. exec)
  Note over Hook: Intercepts at priority 1000

  Hook->>CP: POST /v1/workspaces/:wsId/agent-actions:propose<br/>{toolName, parameters, agentId, policyIds, executionTier}
  CP->>CP: Evaluate policy → NeedsApproval
  CP->>CP: Create approval record (status: Pending)<br/>Create evidence record (evidenceId)
  CP-->>Hook: 202 {decision: "NeedsApproval", approvalId, proposalId}

  Note over Hook: Enters polling loop (approvalTimeoutMs: 24h)
  Note over Agent: Agent is suspended — no tool execution

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Pending"}

  Note over Hook,CP: 3s poll interval (pollIntervalMs)

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Pending"}

  Note over Human: Operator reviews proposal via cockpit or API

  Human->>CP: POST /approvals/:approvalId/decide {decision: "Approved"}
  CP-->>Human: 200 {status: "Approved"}

  Note over Hook,CP: 3s poll interval

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Approved"}

  Note over Hook: result.approved = true → return void (allow)

  Hook->>Agent: Tool call proceeds
  Agent->>Agent: Tool executes, agent receives result
  Note over Agent: Agent continues normally
```

## Diagram 3: Denial Flow Sequence

```mermaid
sequenceDiagram
  participant Agent as Agent (LLM)
  participant Hook as OpenClaw Hook
  participant CP as Portarium Control Plane
  participant Human as Human Operator

  Agent->>Hook: Attempt tool call (e.g. delete_database)
  Note over Hook: Intercepts at priority 1000

  Hook->>CP: POST /v1/workspaces/:wsId/agent-actions:propose<br/>{toolName: "delete_database", parameters, ...}
  CP->>CP: Evaluate policy → NeedsApproval
  CP-->>Hook: 202 {decision: "NeedsApproval", approvalId, proposalId}

  Note over Hook: Enters polling loop

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Pending"}

  Note over Human: Operator reviews — decides to deny

  Human->>CP: POST /approvals/:approvalId/decide {decision: "Denied", reason: "Not authorised"}
  CP-->>Human: 200 {status: "Denied"}

  Note over Hook,CP: 3s poll interval

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Denied", reason: "Not authorised"}

  Note over Hook: result.approved = false<br/>return {block: true, blockReason: "..."}

  Hook-->>Agent: {block: true, blockReason: 'Portarium approval denied for tool "delete_database": Not authorised'}
  Note over Agent: Tool is blocked — agent receives blockReason as tool error
  Agent->>Agent: Explains to user why the action was blocked
```

## Diagram 4: Maker-Checker Enforcement

```mermaid
sequenceDiagram
  participant Agent as Agent (LLM)
  participant Hook as OpenClaw Hook
  participant CP as Portarium Control Plane
  participant Human as Human Operator

  Agent->>Hook: Attempt tool call
  Hook->>CP: POST /agent-actions:propose<br/>(Authorization: Bearer agent-token)
  CP-->>Hook: 202 {decision: "NeedsApproval", approvalId}

  Note over Hook: Enters polling loop

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Pending"}

  Note over Hook,CP: Maker-checker: proposer cannot approve own action.<br/>The agent's bearer token is the "maker" token.

  Hook->>CP: POST /approvals/:approvalId/decide<br/>(Authorization: Bearer agent-token)
  CP-->>Hook: 403 Forbidden<br/>"Maker-checker violation: the deciding user cannot<br/>be the same as the requesting user."

  Note over Hook: 403 maps to status: 'error' — polling continues

  Human->>CP: POST /approvals/:approvalId/decide<br/>(Authorization: Bearer operator-token)
  CP-->>Human: 200 {status: "Approved"}

  Note over Hook,CP: 3s poll interval

  Hook->>CP: GET /approvals/:approvalId
  CP-->>Hook: 200 {status: "Approved"}

  Hook->>Agent: Tool call proceeds
```

## Diagram 5: Fail-Closed vs Fail-Open

```mermaid
flowchart TD
  A["Tool call attempted by agent"] --> B["Hook intercepts\n(before_tool_call, priority 1000)"]
  B --> C{"Is tool in\nbypassToolNames?"}
  C -->|Yes| BYPASS["Return void — allow immediately\n(portarium introspection tools only)"]
  C -->|No| D["POST /agent-actions:propose\n(10s timeout)"]
  D --> E{"Portarium\nreachable?"}
  E -->|Yes| F{"decision"}
  F -->|Allow| ALLOW["Return void — tool executes"]
  F -->|Denied| DENY["Return {block:true, blockReason}\nTool is blocked permanently"]
  F -->|NeedsApproval| POLL["Enter polling loop\n(every 3s, up to 24h)"]
  POLL --> G{"Poll result"}
  G -->|Pending| WAIT["Wait pollIntervalMs (3s)\nthen poll again"]
  WAIT --> POLL
  G -->|Approved| ALLOW
  G -->|Denied| DENY
  G -->|Expired| EXPIRE["Return {block:true}\n'Approval expired before a decision was made'"]
  G -->|Timeout| TOUT["Return {block:true}\n'Approval timed out after 86400000ms'"]
  E -->|No - network error| H{"failClosed\n= true?"}
  H -->|Yes| CLOSED["Return {block:true, blockReason}\n'Portarium governance unavailable — failing closed'"]
  H -->|No| OPEN["Return void — allow with warning logged\n(fail-open mode)"]
```

## Diagram 6: Timing Diagram (State Timeline)

```mermaid
gantt
  title Governance Approval Timeline (typical human-approval scenario)
  dateFormat x
  axisFormat %Lms

  section Agent
  Generate response and attempt tool call :0, 500
  Suspended awaiting governance decision  :500, 9000
  Tool executes and agent continues       :9020, 9100

  section Plugin / Hook
  POST propose() call (< 10ms RTT)        :500, 510
  Polling loop active (3s intervals)      :510, 9000
  Poll detects Approved status            :9000, 9020

  section Control Plane
  Policy evaluation and approval created  :500, 510
  Approval record Pending                 :510, 8500
  Approval record Approved                :8500, 9100

  section Human Operator
  Receives notification                   :1000, 1500
  Reviews proposal details                :1500, 8000
  Submits decision (Approved)             :8000, 8500
```

_Note: The timeline above uses illustrative millisecond values. In real deployments,
the "Human Operator" section spans seconds to hours depending on how quickly the
operator responds. The plugin polling overhead is bounded by `pollIntervalMs` (3000ms
default) — detection latency after approval is at most one poll interval._

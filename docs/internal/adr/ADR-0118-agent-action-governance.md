# ADR-0118: Agent Action Governance Architecture (Propose / Approve / Execute)

**Status:** Accepted
**Date:** 2026-03-04
**Bead:** bead-0872
**Campaign:** agent-governance (bead-0861)

---

## Context

Portarium agents can invoke external tools through machine runtimes (OpenClaw gateway). Without governance, any agent can call any tool — including destructive operations like shell execution, file deletion, or financial transfers — with no human oversight. This violates enterprise compliance requirements and creates unacceptable blast-radius risk.

We need a governance pipeline that:

1. Classifies tool invocations by risk before execution.
2. Routes high-risk actions through human approval.
3. Enforces separation-of-duties between proposer and approver.
4. Records tamper-evident evidence for every decision.
5. Integrates with the existing approval subsystem (ADR-0117).

### Alternatives Considered

**A. Direct invocation with post-hoc audit** — Agent calls tools directly; events are recorded after the fact. Rejected: no prevention of harmful actions; audit is reactive only.

**B. Middleware-only gating** — Infrastructure-layer middleware blocks dangerous tools. Rejected: no approval workflow; binary allow/deny with no human-in-the-loop path.

**C. Propose/Approve/Execute pipeline** — Agent proposes; control plane evaluates policy; human approves if needed; only then does execution proceed. Selected: provides full governance with human oversight where needed while allowing autonomous execution for safe operations.

---

## Decision

Adopt a three-phase **Propose / Approve / Execute** pipeline with policy-driven routing.

### Why not direct invocation?

Direct invocation provides no pre-execution control. An agent calling `shell:execute` would succeed before any governance check could prevent it. The propose-first pattern ensures every action is evaluated before any side effect occurs.

### Why tool classification drives routing?

Tool names encode intent. A `read-file` tool has fundamentally different blast radius than `delete-database`. Pattern-based classification (ReadOnly, Mutation, Dangerous, Unknown) provides a first-pass risk assessment without requiring per-tool manual configuration. The classification maps to minimum execution tiers that determine whether human approval is required.

### Why SoD maker-checker is enforced unconditionally?

Enterprise compliance frameworks (SOC 2, ISO 27001) require separation of duties for privileged operations. The requesting agent's operator cannot also approve the action. This is enforced unconditionally — not as an optional policy constraint — because maker-checker is a foundational governance invariant, not a per-workspace preference.

### Why tamper-evident evidence?

The evidence chain provides cryptographic auditability. Every proposal, approval decision, and execution outcome is recorded as an immutable evidence entry with hash chaining. This satisfies regulatory audit requirements and enables forensic reconstruction of the full decision trail.

---

## Architecture

### Phase 1: Propose

```
Agent → ProposeAgentAction command
  → Validate input (workspaceId, agentId, toolName, etc.)
  → Authorize (agent-action:propose)
  → Classify tool blast radius
  → Evaluate workspace policies
  → Record evidence
  → Emit AgentActionProposed event
  → Return decision: Allow | NeedsApproval | Denied
```

### Phase 2: Approve (conditional)

```
Human → SubmitApproval command
  → Validate input
  → Authorize (approval:submit)
  → Enforce unconditional maker-checker
  → Evaluate SoD constraints
  → Persist decision
  → Record evidence
  → Emit ApprovalDecided event
```

### Phase 3: Execute

```
Agent/Operator → ExecuteApprovedAgentAction command
  → Validate input
  → Authorize (agent-action:execute)
  → Load and guard approval (must be Approved)
  → Guard workspace match
  → Dispatch via ActionRunnerPort
  → Record evidence
  → Emit AgentActionExecuted or AgentActionExecutionFailed event
```

### Component Map

| Component                           | Layer          | Responsibility                                  |
| ----------------------------------- | -------------- | ----------------------------------------------- |
| `AgentActionProposalV1`             | Domain         | Typed proposal aggregate with parser            |
| `ProposalId`                        | Domain         | Branded primitive for proposal identity         |
| `classifyOpenClawToolBlastRadiusV1` | Domain         | Tool risk classification by name patterns       |
| `proposeAgentAction`                | Application    | Proposal evaluation command                     |
| `submitApproval`                    | Application    | Approval decision with maker-checker            |
| `executeApprovedAgentAction`        | Application    | Post-approval dispatch command                  |
| `AgentActionProposalStore`          | Application    | Port for durable proposal persistence           |
| `MachineInvokerActionRunner`        | Infrastructure | ActionRunnerPort adapter via MachineInvokerPort |
| `InMemoryAgentActionProposalStore`  | Infrastructure | Test adapter for proposal store                 |
| Approval CRUD endpoints             | Presentation   | HTTP routes for listing/viewing/deciding        |

### RBAC Matrix

| Action                 | Admin | Operator | Approver | Auditor |
| ---------------------- | ----- | -------- | -------- | ------- |
| `agent-action:propose` | Yes   | Yes      | No       | No      |
| `approval:submit`      | Yes   | No       | Yes      | No      |
| `agent-action:execute` | Yes   | Yes      | No       | No      |
| `approval:read`        | Yes   | Yes      | Yes      | Yes     |

---

## Consequences

### Positive

- Every agent tool invocation is pre-evaluated against tool risk classification and workspace policies.
- High-risk actions require explicit human approval, preventing autonomous execution of destructive operations.
- Tamper-evident evidence chain satisfies SOC 2 / ISO 27001 audit requirements.
- The pipeline reuses the existing approval subsystem (no parallel approval mechanism).
- `ActionRunnerPort` abstraction allows pluggable dispatch (OpenClaw, Activepieces, Langflow, etc.).

### Negative

- Adds latency for `NeedsApproval` actions (human-in-the-loop delay; mitigated by ADR-0117 wait loop).
- Tool classification by name patterns may produce false positives for unconventional tool names (defaults to HumanApprove, erring on the side of safety).
- The `Allow` path still requires the propose round-trip even for safe ReadOnly tools (acceptable overhead for governance guarantees).

### Risks

- Pattern-based classification may not capture all dangerous tools; teams should review Unknown classifications and add patterns as needed.
- Idempotency deduplication (bead-0879) is not yet implemented; duplicate proposals may create duplicate approvals.

---

## References

- ADR-0117: Approval-Wait Loop Mechanism
- ADR-0070: Hybrid Architecture (orchestration + CloudEvents)
- Spec: `.specify/specs/agent-action-governance-lifecycle-v1.md`
- Implementation: bead-0864 (propose), bead-0866 (approve), bead-0867 (execute), bead-0874 (domain model), bead-0876 (store port), bead-0882 (gateway wiring)

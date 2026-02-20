# Agent Task Workflow Runner v1

## Purpose

Define control-plane runtime behavior for workflow actions of type `agent:task` executed through `MachineInvokerPort`.

## Semantics

- Agent task detection:
  - A `WorkflowActionV1` is treated as an Agent Task when `operation === "agent:task"`.
- Dispatch:
  - The runtime must call `MachineInvokerPort.runAgent(...)` with tenant/run/action correlation fields and propagated trace context (`traceparent`, `tracestate`) when present.
- Tier gating:
  - `Auto` and `Assisted` continue directly to execution.
  - `HumanApprove` creates an approval gate, transitions the run to `WaitingForApproval`, and resumes execution only after an `Approved` decision.
  - `ManualOnly` is paused before execution and can resume when approved by the workflow approval signal path.
- Run status transitions:
  - `Pending -> Running` at run start.
  - `Running -> WaitingForApproval` for `HumanApprove` gate.
  - `Running -> Paused` for `ManualOnly` gate.
  - `WaitingForApproval -> Running` or `Paused -> Running` on approved resume.
  - `Running -> Succeeded` after successful execution/diff completion.
  - `Running -> Failed` when an agent task invocation returns failure.
- Evidence:
  - On dispatch: append evidence containing `ActionDispatched`.
  - On success: append evidence containing `ActionCompleted`.
  - On failure: append evidence containing `ActionFailed` and failure details.
  - Run-level completion/failure evidence remains append-only and hash-chain verifiable.

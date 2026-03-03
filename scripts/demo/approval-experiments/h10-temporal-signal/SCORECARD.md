# H10: Temporal signal integration — Scorecard

| Criterion                | Score (1-5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 2           | Requires Temporal SDK knowledge; workflow concepts |
| Human UX                 | 4           | Temporal UI shows pending approvals as workflow state |
| Implementation simplicity| 1           | Requires Temporal server, worker, workflow definitions |
| Production suitability   | 5           | Durable, survives crashes, built-in audit log |
| Works without extra infra| 1           | Requires Temporal server (or Temporal Cloud) |
| TOTAL                    | 13/25       |       |

Verdict: NOT RECOMMENDED (for plugin; consider for core workflow engine)
Reason: Exceptional durability but massive infrastructure requirement. The approval-wait plugin must work standalone. Temporal is the right choice if approvals are embedded in longer-running Portarium workflows already using Temporal.

## How it works

1. Agent calls a CRITICAL tool
2. Proxy creates a Temporal workflow (`portariumRun`) that blocks on `condition(() => decision !== undefined)`
3. The workflow registers `setHandler(approvalDecisionSignal, ...)` and waits
4. Human sends signal via Temporal UI, CLI, or API: `handle.signal('approvalDecision', { decision: 'Approved' })`
5. Workflow resumes, agent proceeds

## Portarium-specific context

Portarium already uses Temporal for workflow orchestration (`src/infrastructure/temporal/workflows.ts`).
The `approvalDecisionSignal` and `condition()` pattern is already implemented for `HumanApprove` / `ManualOnly` execution tiers.

For the **plugin** use case (standalone tool that any agent framework can integrate), Temporal adds an infrastructure dependency that defeats the purpose. However, for approvals that are **part of a Portarium workflow run**, the signal pattern is already the correct implementation.

## References

- `src/infrastructure/temporal/workflows.ts` — existing signal wiring
- `@temporalio/client` — signal API: `handle.signal(signalName, payload)`
- `@temporalio/workflow` — `defineSignal`, `setHandler`, `condition`

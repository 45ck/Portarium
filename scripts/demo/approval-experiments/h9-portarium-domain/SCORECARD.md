# H9: full Portarium domain wiring — Scorecard

| Criterion                | Score (1–5) | Notes |
|--------------------------|-------------|-------|
| Developer experience     | 3           | Requires understanding domain model; high barrier to entry |
| Human UX                 | 4           | Portarium Cockpit can render approvals natively |
| Implementation simplicity| 2           | Requires CreateApproval command, DB, event routing |
| Production suitability   | 5           | The "right" long-term architecture |
| Works without extra infra| 1           | Requires running Portarium server + DB |
| TOTAL                    | 15/25       |       |

Verdict: VIABLE (long-term target, not for immediate plugin)
Reason: The correct architectural end-state but requires full Portarium stack to be running. Not suitable as a standalone plugin for external AI agents. Best as the production implementation after proving the concept with a simpler mechanism.

## Architecture notes

### Domain model used
- `ApprovalPendingV1` — immutable value object representing a pending approval request
- `ApprovalDecidedV1` — immutable value object after human decision (Approved/Denied/RequestChanges)
- `submitApproval` command — application-layer orchestration with authorization, SoD, persistence, CloudEvents

### Real integration path
1. **ActionGatedToolInvoker** evaluates blast-radius policy for the proposed tool action
2. If policy requires human approval, **CreateApproval** command creates a `Pending` approval
3. CloudEvent `ApprovalRequested` is emitted via outbox dispatcher
4. **Cockpit UI** surfaces the approval in the human-tasks queue
5. Human reviewer decides via Cockpit or API
6. **submitApproval** command persists decision + emits `ApprovalGranted`/`ApprovalDenied`
7. Workflow resumes (via Temporal signal, polling, or event subscription)

### Why polling is used in the demo
The demo plugin uses simple HTTP polling for maximum compatibility. In production, the wait mechanism would be one of:
- Temporal signal (H10) — if running inside a Temporal workflow
- SSE push (H3) — for real-time browser-based UX
- WebSocket (H4) — for bidirectional real-time communication
- Long-polling (H2) — for simpler server-push semantics

The H9 experiment proves the domain model shape; the transport mechanism is orthogonal.

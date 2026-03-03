# ADR-0117: Approval-Wait Loop Mechanism for Agent Tool Calls

**Status:** Accepted
**Date:** 2026-03-03
**Bead:** bead-0872 (implementation), bead-0871 (synthesis)
**Campaign:** 10-hypothesis discovery — `scripts/demo/approval-experiments/`

---

## Context

The Portarium proxy (`scripts/demo/portarium-tool-proxy.mjs`) gates agent tool calls through
`ActionGatedToolInvoker`. When a tool exceeds its allowed tier (e.g. blast-radius CRITICAL),
the invoker currently returns `{ proposed: false }` synchronously — the agent is blocked
without any mechanism to resume after a human decision.

The missing piece is a durable **approval-wait loop**: the agent pauses, a human approves or
denies via the Portarium system, and the agent resumes with the decision.

**Critical requirement from user:** Agents may be blocked for hours or overnight. Example: an
agent wants to send an email at 2 AM and must wait for a human to approve via the Portarium
system. The plugin must support indefinite waits (no hard 30-second timeout). The agent must
receive a clear `awaiting_approval` status — not an error — and resume cleanly on approval.

---

## Decision

**Winner: H7 — Companion Approval CLI** (score 21/25)

Built on a **REST approval store with long-polling** (H2 mechanism, score 20/25).

### How it works

1. Agent calls a CRITICAL tool through the proxy
2. Proxy creates an approval record (UUID, tool name, parameters, timestamp) → returns HTTP 202
   with `{ status: "awaiting_approval", approvalId, message: "..." }`
3. Agent plugin calls `waitForApproval(approvalId, proxyUrl, { timeout: Infinity })` — polls
   `GET /approvals/:id` every N seconds indefinitely
4. Human runs `npm run demo:approve` (companion CLI) in another terminal — or visits
   `GET /approvals/ui` in a browser — to see pending approvals and type `y`/`n`
5. Proxy records decision; plugin receives `{ approved: true/false }` on next poll; agent
   resumes execution with the original tool call

### Key design choices

| Decision                      | Rationale                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Long-polling (not SSE/WS)     | Simpler reconnect story; works with any HTTP client; operators can test with curl                      |
| Companion CLI as primary UX   | Maps directly to `npm run demo:approve`; operator can run it anywhere with network access to the proxy |
| HTML UI as secondary UX       | Same backend API; zero extra code in the proxy; best UX for non-technical operators                    |
| `timeout: Infinity` default   | Agent may wait overnight; 30s default was wrong for human-in-the-loop                                  |
| File-backed persistence       | In-memory store is lost on proxy restart; pending approvals must survive a restart                     |
| `status: "awaiting_approval"` | Explicit non-error state so agent frameworks can distinguish "blocked" from "failed"                   |

---

## Scorecard Summary

| #   | Hypothesis        | Score     | Works w/o infra | Verdict                      |
| --- | ----------------- | --------- | --------------- | ---------------------------- |
| H7  | Companion CLI     | **21/25** | 5/5             | ✓ **WINNER**                 |
| H2  | Long-polling REST | 20/25     | 5/5             | RECOMMENDED (base mechanism) |
| H5  | HTML approval UI  | 20/25     | 5/5             | RECOMMENDED (UX layer)       |
| H3  | SSE push          | 19/25     | 5/5             | RECOMMENDED                  |
| H8  | EventEmitter      | 18/25     | 5/5             | VIABLE (testing only)        |
| H1  | stdin prompt      | 17/25     | 5/5             | VIABLE (local dev only)      |
| H4  | WebSocket         | 16/25     | 4/5             | NOT RECOMMENDED              |
| H6  | Filesystem watch  | 16/25     | 5/5             | NOT RECOMMENDED              |
| H9  | Portarium domain  | 15/25     | 1/5             | VIABLE (long-term target)    |
| H10 | Temporal signal   | 13/25     | 1/5             | NOT RECOMMENDED (for plugin) |

**Winner by score:** H7 (21) wins outright. H2 and H5 tied at 20 — H2 chosen as the underlying
mechanism (production-suitability 4 vs 3 for H5), H5 kept as the human-facing UX layer on the
same API.

**Infra gate:** All top candidates score ≥ 3 on "works without extra infrastructure". H9 and
H10 are excluded from consideration as primary plugin mechanisms (scores 1/5).

---

## Implementation (bead-0872)

### Files to create / modify

```
scripts/demo/
  portarium-approval-plugin.mjs        # reusable plugin: waitForApproval(), etc.
  portarium-approval-store.mjs         # file-backed persistence layer
  portarium-approval-cli.mjs           # npm run demo:approve CLI
  portarium-approval-ui.mjs            # HTML UI served by proxy (optional)
  portarium-tool-proxy.mjs             # extend: add approval endpoints + awaiting_approval responses
  openai-agent-demo.mjs                # wire approval plugin
  claude-agent-demo.mjs                # wire approval plugin
  docker/openclaw-demo/agent.mjs       # wire approval plugin
package.json                           # add demo:approve script
```

### Plugin API (portarium-approval-plugin.mjs)

```js
// Wait for a human to approve/deny an approval request
export async function waitForApproval(approvalId, proxyUrl, opts = {}) {
  // opts.timeout: number (ms) — default Infinity
  // opts.pollInterval: number (ms) — default 2000
  // Returns: { approved: boolean, decidedAt: string }
}

// Called by agent frameworks after receiving awaiting_approval from proxy
export async function handleApprovalRequired(response, proxyUrl, opts) {
  if (response.status !== 'awaiting_approval') return response;
  console.log(`[approval] Waiting for human approval of "${response.toolName}"...`);
  console.log(`[approval] Run: npm run demo:approve  (or visit ${proxyUrl}/approvals/ui)`);
  const decision = await waitForApproval(response.approvalId, proxyUrl, opts);
  return decision;
}
```

### Agent integration pattern

```js
// In agent tool-call loop:
const result = await fetch(`${proxyUrl}/tools/invoke`, { ... });
const body = await result.json();

if (body.status === 'awaiting_approval') {
  // Not an error — blocked for human review
  const decision = await handleApprovalRequired(body, proxyUrl, { timeout: Infinity });
  if (!decision.approved) {
    console.log('Tool denied by operator');
    return;
  }
  // Re-invoke now approved
  const retryResult = await fetch(`${proxyUrl}/tools/invoke`, { ... });
}
```

### Persistence

Pending approvals stored in `os.tmpdir()/.portarium-approvals/pending.json` (JSON file, written
atomically). Survives proxy restarts. Cleared on decision.

---

## Long-term architecture (H9 path)

Once the full Portarium stack is deployed, the approval-wait loop should migrate to:

1. `ActionGatedToolInvoker` creates real `ApprovalPendingV1` domain event via `CreateApproval`
   command
2. CloudEvent `ApprovalRequested` is emitted via outbox dispatcher
3. **Portarium Cockpit** surfaces approval in the human-tasks queue — operator approves from the
   UI
4. `submitApproval` command persists decision + emits `ApprovalGranted`/`ApprovalDenied`
5. Plugin polls real Portarium API (`GET /api/approvals/:id`) instead of the demo proxy

The plugin API surface (`waitForApproval`, `handleApprovalRequired`) is stable across both the
demo implementation (H7) and the production implementation (H9) — only the `proxyUrl` parameter
changes.

---

## Consequences

**Positive:**

- Agent frameworks can integrate in ~10 lines (call invoke → check awaiting_approval → call
  waitForApproval)
- Operators can approve from any terminal or browser — no Portarium cockpit required for demos
- `timeout: Infinity` correctly models overnight waits
- File-backed persistence means the proxy can be restarted without losing pending approvals
- Clear upgrade path to H9 (full domain wiring) when the stack is ready

**Negative:**

- Polling adds 0–2s latency before agent resumes (acceptable for human-in-the-loop)
- In-process approval store is not shared across multiple proxy instances (single proxy only)
- No authentication on the approval API (demo-grade; production path requires auth)

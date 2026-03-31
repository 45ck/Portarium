# Governance Experiments — Methodology

## Scientific approach

These experiments follow the Portarium experiment framework (see `experiments/shared/experiment-runner.ts`).
Each experiment has:

- **Hypothesis** — a falsifiable claim about the system's behaviour
- **Setup** — preconditions
- **Execute** — the action being tested
- **Verify** — assertions that confirm or refute the hypothesis
- **Outcome** — `confirmed`, `refuted`, or `inconclusive`

### Non-determinism note

The live agent tests (Experiments 4 and 5) involve an LLM that produces non-deterministic output.
The same instruction can cause different tool calls to be chosen between runs. This means:

- **Live agent results are not strictly repeatable.** The same prompt may produce a different tool
  call on the next run.
- **The governance layer is deterministic.** Once a tool call is proposed, the policy evaluation,
  approval routing, and blocking are deterministic given the same policy and approval store state.
- **Conclusion:** The non-determinism is in the _agent_ (which tool it picks), not the
  _governance_ (whether the chosen tool is allowed). The experiments therefore provide
  **semi-proof** that the governance system works: they show the governance layer behaves
  correctly when a tool call reaches it, regardless of which call the LLM happens to make.

---

## Experiment 1: Normal approval lifecycle (automated)

**Hypothesis:** A tool call routed through the openclaw-plugin is blocked for human approval
and the agent is unblocked exactly when the operator approves it.

**Location:** `experiments/openclaw-governance/run.mjs`

**Assertions (7):**

1. `POST /agent-actions:propose` returns HTTP 200 or 202
2. `propose.decision` is `NeedsApproval`
3. `propose` response includes a non-empty `approvalId`
4. `GET /approvals/:id` returns HTTP 200 immediately after proposal
5. Initial approval status is `pending`
6. `POST /approvals/:id/decide` returns HTTP 200
7. `ApprovalPoller` resolves `approved=true` after the operator decision

**Run:**

```bash
PORTARIUM_URL=http://localhost:3000 PORTARIUM_WORKSPACE_ID=ws-experiment \
PORTARIUM_BEARER_TOKEN=dev-token PORTARIUM_OPERATOR_TOKEN=dev-token-operator \
PORTARIUM_TENANT_ID=default \
node node_modules/tsx/dist/cli.mjs experiments/openclaw-governance/run.mjs
```

---

## Experiment 2: Operator denial (automated)

**Hypothesis:** When an operator denies an approval, the final approval status is `Denied` and
the agent cannot proceed.

**Assertions (3):**

1. `POST /agent-actions:propose` returns `NeedsApproval`
2. `POST /approvals/:id/decide` with `Denied` returns HTTP 200 with `status: Denied`
3. `GET /approvals/:id` returns `status: Denied`

**Implementation:** See `results/exp-deny.json`

---

## Experiment 3: Maker-checker enforcement (automated)

**Hypothesis:** A user cannot approve their own proposal — the control plane rejects
self-approval with HTTP 403.

**Assertions (2):**

1. `POST /agent-actions:propose` returns `NeedsApproval`
2. Same user attempting `POST /approvals/:id/decide` returns HTTP 403 Forbidden

**Implementation:** See `results/exp-maker-checker.json`

---

## Experiment 4: Live agent governance (live, non-deterministic)

**Hypothesis:** A live OpenClaw agent running with the Portarium plugin will suspend at the
first tool call and resume only after a human operator approves the action.

**Observed behaviour:**

- Agent receives task → generates text → attempts `exec` tool call
- Plugin intercepts `exec` → POSTs proposal to `/agent-actions:propose`
- Control plane evaluates → returns `NeedsApproval` → approvalId issued
- Plugin suspends (`Awaiting approval for: exec`)
- Operator calls `/approvals/:id/decide` with `Approved`
- Plugin polls → detects `Approved` status
- Plugin resumes → tool call executes → agent completes task

**Non-determinism:** The specific tool name (e.g. `exec`, `read_file`) depends on the LLM.
The governance response is deterministic regardless.

---

## Experiment 5: Fail-closed behaviour (conceptual)

**Hypothesis:** When `failClosed=true` and Portarium is unreachable, the plugin blocks all
tool calls with a clear error rather than allowing them through.

**Implementation:** Not run as a live agent test (requires restarting the agent with
`failClosed=true` and Portarium intentionally offline). Validated at the network level:

- Plugin wraps fetch in try/catch
- Network errors surface as `status: 'error'` from `PortariumClient.proposeAction()`
- `before_tool_call` hook returns `{ block: true, blockReason: '...' }` when `failClosed=true`
- `before_tool_call` hook returns `undefined` (allow) when `failClosed=false`

The code path is covered by unit tests in `packages/openclaw-plugin/src/hooks/before-tool-call.test.ts`.

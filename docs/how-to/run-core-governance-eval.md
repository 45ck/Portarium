# Run The Core Governance Eval

This eval checks the core Portarium loop without live LLM API keys:

1. A simulated agent runs a safe tool and gets an immediate allow.
2. The same agent attempts a governed tool.
3. Policy opens an approval.
4. The live event stream emits the approval request.
5. A human approval is recorded.
6. The agent resumes with the approval id.
7. The approved action executes once.

Run it locally:

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-core-governance-eval.test.ts
```

This uses the demo policy proxy on a random local port and the control-plane-shaped
SSE endpoint at `/v1/workspaces/ws-proxy-demo/events:stream`. It is intended as
the fast OSS confidence check for the agent governance path; `npm run ci:pr`
remains the full release gate.

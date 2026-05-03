# Live Model Experiment Preflight v1

## Scope

Experiments that use real LLM inference must run a provider preflight before any
experiment setup or execution step. The shared live-model preflight boundary
covers OpenAI-compatible providers, Claude providers, and Gemini providers.

## Requirements

1. Live model calls are disabled by default.
2. The preflight is enabled only when `PORTARIUM_EXPERIMENT_LIVE_LLM=true` or
   `PORTARIUM_LIVE_MODEL_RUNS=true` is present.
3. Provider selection is explicit via `PORTARIUM_LIVE_MODEL_PROVIDER`, or
   auto-detected from credential env vars when no provider is forced.
4. Supported provider selectors are `openai`, `openrouter`, `codex`, `claude`,
   and `gemini`.
5. Credential values must never be written to logs or result bundles.
6. Result bundles must record provider, model, probe kind, HTTP status when
   available, and failure kind.
7. Missing credentials skip the experiment before setup/execute/verify and
   produce `outcome: "skipped"`.
8. When `codex` is forced and API-key env vars are absent, the preflight may use
   local Codex CLI auth through a read-only `codex exec` probe.
9. Claude preflight probes use the Anthropic Messages API shape and Gemini
   preflight probes use the Gemini `generateContent` API shape; both use the
   same skip/fail result semantics as OpenAI-compatible probes.
10. Obvious provider errors are detected before launch:

- `401` or `403` => `credential_rejected`
- `402` or `429` => `quota_or_rate_limit`
- `404` => `model_unavailable`
- network errors => `network_error`
- all other non-2xx provider responses => `unexpected_response`

11. A failed preflight produces `outcome: "inconclusive"` and does not execute
    the experiment body.
12. Live approval evaluations that use provider-backed proposal or planning
    behavior must follow `approval-evaluation-scenarios-v1`; deterministic
    approval evaluations remain the default release evidence.
13. Live approval lifecycle runs are disabled unless both
    `PORTARIUM_EXPERIMENT_LIVE_LLM=true` and
    `PORTARIUM_LIVE_APPROVAL_LIFECYCLE=true` are present.
14. Live approval lifecycle runs must also require an explicit
    `PORTARIUM_LIVE_APPROVAL_PROVIDER` value of `claude`, `openai`, or
    `gemini`; credentials alone must not trigger provider calls.
15. Claude-backed live approval lifecycle runs require a Claude credential,
    OpenAI-backed runs require an OpenAI-compatible credential, and
    Gemini-backed runs require a Gemini credential. Missing credentials must
    skip before provider calls, setup, execution, or verification.
16. CI remains deterministic and default-skipped: no live provider call may run
    in the default CI gate path without the explicit live model and live
    approval lifecycle opt-in env vars.
17. Result bundles for live approval evaluations must record redacted
    provider/model metadata only and must not store credential values,
    credential env var names, expected credential source lists, base URLs, CLI
    auth details, secret-bearing prompts, customer data, or proprietary source
    text.
18. Iteration 2 OpenClaw live reruns for
    `growth-studio-openclaw-live-v2` and `openclaw-concurrent-sessions` are
    disabled unless `PORTARIUM_LIVE_OPENCLAW_RERUNS=true` is present in
    addition to the live model opt-in from requirement 2.
19. Iteration 2 OpenClaw live reruns must require an explicit
    `PORTARIUM_LIVE_MODEL_PROVIDER`; credentials alone must not start a live
    rerun.
20. Iteration 2 OpenClaw live rerun bundles must record redacted
    provider/model/probe metadata, Approval IDs, queue metrics, Evidence
    Artifacts, exact-once resume results, and a comparison against the
    deterministic bundle attempt.
21. Model/provider variability for Iteration 2 OpenClaw live reruns must be
    classified separately from Portarium product defects.

## Result Bundle Shape

```json
{
  "outcome": "skipped",
  "liveModelPreflight": {
    "status": "skipped",
    "providerSelection": "forced",
    "provider": "openrouter",
    "failureKind": "missing_credentials"
  }
}
```

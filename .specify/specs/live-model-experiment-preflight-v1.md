# Live Model Experiment Preflight v1

## Scope

Experiments that use real LLM inference must run a provider preflight before any
experiment setup or execution step.

## Requirements

1. Live model calls are disabled by default.
2. The preflight is enabled only when `PORTARIUM_EXPERIMENT_LIVE_LLM=true` or
   `PORTARIUM_LIVE_MODEL_RUNS=true` is present.
3. Provider selection is explicit via `PORTARIUM_LIVE_MODEL_PROVIDER`, or
   auto-detected from credential env vars when no provider is forced.
4. Supported provider selectors are `openai`, `openrouter`, and `codex`.
5. Credential values must never be written to logs or result bundles.
6. Result bundles must record provider, model, probe kind, HTTP status when
   available, and failure kind.
7. Missing credentials skip the experiment before setup/execute/verify and
   produce `outcome: "skipped"`.
8. When `codex` is forced and API-key env vars are absent, the preflight may use
   local Codex CLI auth through a read-only `codex exec` probe.
9. Obvious provider errors are detected before launch:
   - `401` or `403` => `credential_rejected`
   - `402` or `429` => `quota_or_rate_limit`
   - `404` => `model_unavailable`
   - network errors => `network_error`
   - all other non-2xx provider responses => `unexpected_response`
10. A failed preflight produces `outcome: "inconclusive"` and does not execute
    the experiment body.
11. Live approval evaluations that use provider-backed proposal or planning
    behavior must follow `approval-evaluation-scenarios-v1`; deterministic
    approval evaluations remain the default release evidence.
12. Result bundles for live approval evaluations must record redacted
    provider/model metadata only and must not store credential values,
    credential env var names, expected credential source lists, base URLs, CLI
    auth details, secret-bearing prompts, customer data, or proprietary source
    text.

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

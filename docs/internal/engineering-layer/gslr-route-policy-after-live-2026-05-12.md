# GSLR Route Policy After Live Schema Evidence: 2026-05-12

Status: R&D governance boundary, not product integration  
Tracking bead: `bead-1233`  
Companion prompt-language bead: `prompt-language-gslr8`

## Decision

Prompt-language has codified the first post-live GSLR route policy:

```text
experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json
```

The policy routes the exact `gslr2-policy-schema` task to `local-screen`.

That means:

- local-only is allowed for the tiny one-file policy/schema validator when the
  public gate, private oracle, final verdict, and token-telemetry checks are all
  present;
- advisor-only is the first escalation after a local failure on a low-ambiguity
  task;
- frontier-baseline remains the right default for high ambiguity, weak gates,
  product mutation, privacy risk, or multi-file integration;
- hybrid review is justified only when governance independently requires a
  review step, not because the GSLR-2 live result proved hybrid cost savings.

## Why This Matters To Portarium

This is the first usable route-policy artifact for the governed-engineering
layer, but it is still R&D evidence. It can inform Cockpit vocabulary and future
evidence-card fields; it should not trigger runtime ingestion.

The important product lesson is that Portarium should show route decisions as
evidence-backed policy outcomes, not as model-brand claims. The local route won
on this tiny sanitized schema task because the task had strong deterministic
gates and no product side effects.

## Boundary

Do not build the Cockpit evidence card yet.

Do not connect prompt-language runner output to Portarium runtime ingestion yet.

Do not generalize `local-screen` to Portarium product work, MC connector work, or
unbounded agent execution.

The next acceptable Portarium-facing artifact is a static evidence-card shape
only after prompt-language runs the nearby fixture family and records whether the
same policy survives more than one task.

## Next Evidence Needed

Prompt-language should run the fixture family recorded in:

```text
experiments/harness-arena/GSLR-POLICY-SCHEMA-FAMILY-PLAN.md
```

Portarium should watch for:

- whether one-file schema tasks keep passing locally;
- whether two-file validator tasks require advisor or frontier escalation;
- whether adversarial raw-payload fixtures force stricter frontier review;
- whether the route policy can produce stable evidence-card fields without
  leaking raw payloads or hidden oracle content.

## Execution Record

2026-05-12:

- Created and claimed `bead-1233`.
- Recorded the prompt-language route-policy decision after the GSLR-2 live run.
- Kept Cockpit evidence-card and runtime ingestion work blocked.

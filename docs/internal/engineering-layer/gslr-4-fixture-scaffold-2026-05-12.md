# GSLR-4 Fixture Scaffold: 2026-05-12

Status: R&D scaffold only, not runtime ingestion  
Tracking bead: `bead-1239`  
Companion prompt-language bead: `prompt-language-gslr14`

## Decision

Prompt-language now has the next fixture-family rung:

```text
experiments/harness-arena/fixtures/gslr4-two-file-validator/
```

The fixture asks a model to implement a static Portarium evidence-card validator
across two files:

- `src/action-boundary-policy.mjs`
- `src/evidence-card-validator.mjs`

It has a public gate, private oracle, deterministic lane, runner coverage, and a
deterministic fake-live result. That proves harness plumbing only. It is not live
model evidence and does not promote Portarium ingestion.

## Why It Matters

GSLR-3 showed the evidence-card transform is currently `frontier-baseline`.
GSLR-4 changes the shape from transform to validation and adds a two-file
contract. The useful question is whether frontier advice can state the
cross-file policy boundary while a local model does the mechanical validator
work.

The live hypothesis is therefore `advisor-only`, not product integration.

## Product Boundary

Runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

The existing `EngineeringEvidenceCardInputV1` contract remains docs/test-only.

No Portarium service should consume prompt-language manifests, GSLR-4 cards, or
validator outputs yet. The GSLR-4 fixture only tests the static validation
contract around:

- prompt-language / harness-arena source metadata;
- work item and run identifiers;
- route arm and route decision;
- final verdict, private oracle, and review defects;
- aggregate frontier/local cost telemetry;
- action boundary consistency;
- artifact refs without query or fragment payloads;
- recursive rejection of raw payload, secret, credential, token, raw stdout,
  raw stderr, oracle command, or hidden oracle body keys.

## What Would Change This

Portarium can consider the next design step only after prompt-language produces
live GSLR-4 model evidence:

- `advisor-only` passes public gate, private oracle, and final verdict;
- `frontier-only` baseline is recorded if advisor passes;
- no raw or secret leakage appears in static card validation;
- the result remains compatible with the docs/test-only
  `EngineeringEvidenceCardInputV1` contract.

Even then, the next Portarium step would still be a static design/mock or parser
hardening step, not service ingestion.

## Sources

- Prompt-language GSLR-4 runbook:
  `experiments/harness-arena/GSLR-4-TWO-FILE-VALIDATOR-RUNBOOK.md`
- Prompt-language deterministic result:
  `experiments/harness-arena/results/gslr4-fake-live-2026-05-12/report.md`
- Portarium static card contract:
  `src/domain/evidence/engineering-evidence-card-v1.ts`

## Execution Record

2026-05-12:

- Recorded the GSLR-4 scaffold and Portarium boundary.
- Kept runtime ingestion and live Cockpit cards blocked.
- Recorded the live hypothesis as `advisor-only`, with `frontier-only` baseline
  after an advisor pass.

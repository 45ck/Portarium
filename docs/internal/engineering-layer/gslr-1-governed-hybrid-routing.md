# GSLR-1 Governed Hybrid Routing Micro-Experiment

Status: R&D handoff, not product integration
Date: 2026-05-12
Tracking bead: `bead-1226`
Companion prompt-language bead: `prompt-language-gslr1`

## Why This Exists

The governed-Symphony direction is now clear enough to test, but not clear
enough to build into Portarium runtime code. GSLR-1 is the smallest evidence
slice that can falsify or strengthen the idea before implementation work starts.

The question is narrow:

```text
Can one low-risk engineering bead be represented as a governed hybrid run with
local bulk work, frontier classification/review, deterministic gates, and a
complete evidence package?
```

This is not a claim that local models can autonomously engineer Portarium. It is
a claim-shaped experiment about route control, evidence, and cost discipline.

## Scenario

Use the MacquarieCollege reference vertical as a safe, no-mutation task:

```text
MC architecture note -> refs-only Portarium evidence envelope projection
```

The worker output is a documentation/projection artifact, not a source-system
action. It must not contain raw student, staff, ticket, device, room, connector,
or credential payloads.

The prompt-language fixture and runbook live in:

```text
prompt-language/experiments/harness-arena/GSLR-1-MC-PROJECTION-RUNBOOK.md
prompt-language/experiments/harness-arena/fixtures/gslr1-mc-doc-projection/
```

## Arms

| Arm             | Portarium Interpretation                                      |
| --------------- | ------------------------------------------------------------- |
| `local-only`    | Local worker owns the projection under public gates.          |
| `frontier-only` | Frontier worker owns the full projection and review.          |
| `advisor-only`  | Frontier advice/review exists, but local owns the edits.      |
| `hybrid-router` | Parent route policy chooses local work and frontier handoffs. |

The hybrid arm is the thesis arm. Advisor-only is a control because advice is
not governance unless the parent turns it into explicit gates, tasks, or stops.

## Evidence Package

For each arm, Portarium should be able to ingest or render:

- work item or bead ref;
- run id and arm;
- model, runner, provider class, and endpoint metadata;
- route decision and route trigger per step;
- risk and ambiguity level;
- budget cap and actual frontier-call count;
- public gate result;
- private oracle result, stored outside model-visible input;
- final projection artifact ref;
- final review defects;
- approval/refusal state;
- manifest completeness verdict.

The first Portarium artifact can be a static evidence packet. A live Cockpit card
comes later.

## Cockpit Card Fields

The minimum useful Cockpit view for this experiment is:

| Field                 | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| Bead / work item      | Connects the run to governed intent.                        |
| Arm                   | Shows whether this was local, frontier, advisor, or hybrid. |
| Lane timeline         | Shows local/frontier/deterministic/human steps in order.    |
| Model/provider        | Makes substitutions and local/frontier use visible.         |
| Gate state            | Shows pass/fail/timeout without trusting model claims.      |
| Review defects        | Shows whether final review found blocking concerns.         |
| Budget                | Shows frontier calls, USD cap, and local runtime if known.  |
| Evidence completeness | Shows whether the run can count as claim evidence.          |
| Approval state        | Shows whether a human accepted, rejected, or deferred it.   |

## Verdict Rules

GSLR-1 is positive evidence only if the `hybrid-router` arm:

- passes deterministic and private gates;
- has a complete manifest;
- uses fewer frontier calls than `frontier-only`;
- matches or beats `local-only` on correctness;
- has no unresolved blocking review defect;
- keeps MC-specific data as refs/summaries, not raw payloads.

It is negative evidence if hybrid success depends on hidden human repairs,
frontier leakage into local-only work, omitted route metadata, or unsafe raw
vertical data in the artifact.

## What To Do Next

Do not start Portarium runtime integration yet. The next step is a live
prompt-language run across all four arms using the same fixture and locked gates.

If that run produces a positive manifest, the next Portarium bead should create a
static Cockpit/evidence mock from the manifest. Only after the mock is useful
should Portarium implement runtime ingestion.

## Execution Record

2026-05-12:

- Created and claimed Portarium bead `bead-1226`.
- Added this Portarium-side GSLR-1 handoff note.
- Cross-referenced prompt-language bead `prompt-language-gslr1`.
- Kept the next step as a live four-arm experiment, not product integration.
- Closed `bead-1226` after the handoff docs and companion prompt-language
  fixture/runbook were in place.

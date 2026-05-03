# Software-First Proving Workflow Choice

Status: strategic decision for `bead-1098`.

This note chooses the first workflow Portarium should prove through self-use. It
narrows the software-first proving program from several plausible stories into
one primary workflow, one secondary showcase path, and a backlog evidence map.

## Decision

Primary self-use workflow: `source-to-micro-saas-builder`.

Portarium should first prove a governed source-to-micro-SaaS builder workflow:
trusted sources become a cited research dossier, the dossier becomes a product
brief and backlog, agents produce bounded software Artifacts, and Cockpit records
Plans, Approval Gates, Work Items, Runs, Evidence, and review outcomes.

Secondary showcase-only workflow: `source-to-content-studio`.

The content path should appear in public narrative and demo-machine work as a
second governed Project type, but it is not an equal proof target until the
micro-SaaS self-use alpha has produced real evidence.

## Comparison

| Candidate                                     | Strengths                                                                  | Weaknesses                                                                                            | Decision                                          |
| --------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Source-to-content studio                      | Fast Artifact production, easy public narrative, clear citation value.     | Content quality is taste-heavy, business impact is delayed, and demos can look like generic agents.   | Secondary showcase-only Project type.             |
| Source-to-micro-SaaS builder                  | Proves research, planning, coding, review, release evidence, and rollback. | Higher implementation cost and stronger need for structured briefs, acceptance loops, and QA gates.   | Primary self-use proving workflow.                |
| Software distribution or growth loop          | Connects proof to adoption and revenue metrics.                            | Outbound compliance, consent, channel risk, and measurement loops add too much surface for proof one. | Deferred until product Artifact quality is known. |
| Hybrid content plus product Artifact Projects | Best public story for Cockpit as a multi-Project control surface.          | Splits self-use attention if treated as proof instead of showcase.                                    | Demo narrative after the primary alpha starts.    |

## Public Narrative

The public story is: Portarium is the control plane a builder uses to turn
trusted sources into governed software output. Agents do the detailed work, but
Portarium keeps the work inside Projects, Policies, Approval Gates, Evidence
Logs, and recoverable Runs.

The content Project is useful in the story because it shows that the same
governance model can supervise media Artifacts. It should be labeled
`demo-only` until it has its own self-use evidence.

## Non-Goals And Deferred Tracks

- Do not prove Growth Studio, content automation, and micro-SaaS building as
  equal near-term priorities.
- Do not treat public demo polish as proof of usefulness.
- Do not run real outbound send, post, publish, or distribution Actions as part
  of the first proof. Keep those governed by outbound compliance and defer them
  until product Artifact quality is established.
- Do not reopen robotics or physical actuation scope for this proving choice.
- Do not introduce a new project management product surface; Cockpit remains the
  governed operator surface for Projects, Runs, Work Items, Plans, Approval
  Gates, Evidence, and Artifacts.
- Do not start prompt-language or coding-runtime integration work from narrative
  appeal alone; require evidence gates first.

## Evidence Requirements

The self-use alpha is credible only when the primary Project has evidence for:

- a Project brief with objective, audience, constraints, quality bar, taste
  notes, non-goals, and acceptance thresholds;
- trusted source ingestion with citations, freshness, confidence, and claim
  boundaries;
- a research dossier and opportunity brief linked to source evidence;
- product artifacts such as backlog items, specs, code changes, QA reports,
  release notes, or rollback notes linked to the dossier;
- Approval Gate decisions for scope, risky Actions, artifact acceptance, and
  changes-requested loops;
- Evidence Log entries for failures, manual fallback, stop-using-it moments,
  and rework rather than only successful runs;
- a usefulness scorecard covering operator minutes, approval latency, blocked
  duration, rework, duplicate-execution rate, policy escape rate, cost per useful
  outcome, and business KPI movement.

## Bead Map

Existing Beads that carry the primary path:

| Need                                | Bead        | Role                                                                                     |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Strategic choice                    | `bead-1098` | Chooses `source-to-micro-saas-builder` as primary and content studio as showcase-only.   |
| Trusted source loop                 | `bead-1099` | Defines ingestion, citation, freshness, and dossier evidence.                            |
| Project portfolio surface           | `bead-1100` | Lets Cockpit separate the primary Project from showcase Projects.                        |
| Brief and artifact acceptance       | `bead-1101` | Defines Project brief, taste signals, and artifact acceptance loop.                      |
| Self-use alpha                      | `bead-1102` | Runs the chosen workflow on real work with rollback and usefulness evidence.             |
| Cited source-to-artifact experiment | `bead-1103` | Supplies a reusable experiment path for content and micro-SaaS candidates.               |
| Multi-Project showcase              | `bead-1104` | Demonstrates the primary and secondary Project types without equal proof claims.         |
| Usefulness scorecard                | `bead-1057` | Defines success, concern, and failure thresholds across operator and business metrics.   |
| Outbound communication compliance   | `bead-1071` | Keeps real send/post/publish Actions out of proof one unless compliance evidence exists. |
| Growth Studio evidence gate         | `bead-1027` | Keeps prompt-language follow-up blocked until Growth Studio evidence is reviewed.        |

New Beads to create after this decision, if not already covered by the existing
implementation plan:

| Proposed Bead                                | Purpose                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Self-use micro-SaaS runbook and fixture pack | Define the recurring Project charter, source set, artifact list, and fixtures.                 |
| Micro-SaaS evidence digest                   | Produce the weekly evidence summary for usefulness, failures, rework, and rollback.            |
| Content Project showcase labeling            | Ensure the public demo labels content as `demo-only` until self-use evidence exists.           |
| Distribution deferment gate                  | Decide when product Artifact quality is sufficient to start distribution or growth-loop proof. |

## Success Criteria

The choice succeeds when:

- `bead-1102` runs a real source-to-micro-SaaS Project for self-use over days or
  weeks, not only a recording;
- at least one useful product Artifact is accepted or rejected with recorded
  rationale, source provenance, and recovery path;
- the usefulness scorecard from `bead-1057` can compare Portarium-assisted work
  against the builder's current manual workflow;
- `bead-1104` can show a content Project as a labeled secondary showcase without
  implying it has equal production proof;
- distribution, outbound growth loops, prompt-language work, and robotics remain
  gated by their own evidence instead of becoming implicit dependencies.

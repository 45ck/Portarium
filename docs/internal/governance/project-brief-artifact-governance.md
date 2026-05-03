# Project Brief and Artifact Governance

Status: governance note for `bead-1101`.

This note operationalizes
`.specify/specs/project-brief-artifact-acceptance-v1.md` for software-first
Projects. It keeps human taste useful without turning operators into manual
production workers or weakening Portarium governance.

## Operating Rule

Every content, landing-page, spec, prototype, or micro-SaaS Project should start
with a Project brief before Machines generate release-candidate Artifacts. The
brief gives agents enough direction to choose, draft, revise, and stop without
requiring the operator to supervise every intermediate step.

The brief is durable Project context. A review comment is not durable Project
context unless the operator explicitly accepts it as a preference update.

## Minimum Project Brief

| Field           | Required use                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| Objective       | The outcome the Project exists to create.                                     |
| Audience        | The users, readers, buyers, reviewers, or stakeholders being served.          |
| Constraints     | Hard limits the Run must respect.                                             |
| Style anchors   | Taste references, tone, density, pacing, or product-feel guidance.            |
| Quality bar     | Reviewable criteria for "good enough" before an Artifact can be accepted.     |
| Non-goals       | Explicit exclusions and directions the Project should not optimize for.       |
| Artifact class  | One of content, landing page, spec, prototype, micro-SaaS, derived, or other. |
| Readiness label | Self-use, demo-only, pilot-candidate, or production-ready where applicable.   |

Constraints and non-goals are stronger than style anchors. If a style anchor
conflicts with Policy, source rules, privacy controls, or an Approval Gate, the
governance path wins.

## Operator Inputs

Operators should use typed inputs:

| Input                | Use it when                                              | Durable by default |
| -------------------- | -------------------------------------------------------- | ------------------ |
| Idea                 | Adding an angle, opportunity, feature, or campaign hook. | No                 |
| Taste note           | Describing subjective feel, tone, polish, or avoidances. | No                 |
| Critique             | Explaining what failed or worked in a specific Artifact. | No                 |
| Acceptance threshold | Defining a blocking criterion for acceptance.            | Yes, if accepted   |
| Style anchor         | Adding a reusable reference or named direction.          | Proposed only      |
| Constraint           | Narrowing the allowed work.                              | Yes                |
| Non-goal             | Naming a forbidden optimization or direction.            | Yes                |

The UI or workflow should ask for one effect scope before submission:

- `current-run-effect`: revise this Run or Artifact only.
- `future-policy-effect`: propose reusable Project behaviour or Policy routing.
- `context-only`: preserve the note for audit or later interpretation.

## Review Signals

Artifact reviewers use the same four signals across Project types:

| Signal          | Operator meaning                                                                  |
| --------------- | --------------------------------------------------------------------------------- |
| Accept          | This satisfies the brief and review mode.                                         |
| Reject          | Do not use this Artifact; replace it or substantially rethink it.                 |
| Request changes | Direction is viable, but specific revisions are required.                         |
| Wrong direction | The Artifact is optimizing for the wrong goal, audience, taste, or product shape. |

Wrong direction should trigger a strategy change before another revision. It is
not a stronger way to say "make the copy better."

## Artifact-Class Review Focus

| Artifact class | What reviewers should judge                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| Content        | Audience fit, source faithfulness, editorial quality, voice, claim safety, conversion path. |
| Landing page   | Offer clarity, hierarchy, credibility, responsiveness, brand fit, call-to-action path.      |
| Spec           | Contract completeness, testability, vocabulary, boundaries, acceptance coverage.            |
| Prototype      | Workflow fit, interaction quality, accessibility, technical plausibility, evidence capture. |
| Micro-SaaS     | User value, scope discipline, test evidence, operational risk, supportability.              |
| Derived        | Provenance, source Policy, retention, redaction, retrieval utility, rebuildability.         |
| Other          | Criteria declared in the Project review policy.                                             |

## One-Off Critique vs Durable Preference

Default behaviour:

1. A critique applies to the reviewed Artifact and current Run.
2. The reviewer may propose a durable preference update.
3. A durable preference update must be accepted separately.
4. Future Runs use only accepted preferences, not every historical critique.

This protects creative exploration. A single rejected draft can explain what was
wrong without permanently banning a useful style, layout, technology, or product
direction.

## Evidence Expectations

The Evidence Log must allow an auditor or future agent to answer:

- Which brief version did the Machine use?
- Which Artifact was reviewed?
- Which criteria were applied?
- What signal was recorded?
- Was the signal current-run only, future-affecting, or context-only?
- Did any critique become an accepted Project preference?
- Did an Approval Gate also authorize release or external side effects?

Screenshots, source links, prompts, transcripts, rendered pages, test outputs,
and generated files should be Evidence Artifacts when they materially support an
acceptance decision.

## Guardrails

- Taste does not authorize an externally-effectful Action.
- Acceptance of an Artifact does not bypass required Approval Gates.
- Rejecting an Artifact does not automatically change Policy.
- A future preference update must cite its source critique or review decision.
- Project preferences must remain visible to later Runs and reviewers.
- Operators should not be asked to inspect every low-risk intermediate output
  when accepted thresholds and style anchors are enough.

## Spec Link

The normative contract is
`.specify/specs/project-brief-artifact-acceptance-v1.md`.

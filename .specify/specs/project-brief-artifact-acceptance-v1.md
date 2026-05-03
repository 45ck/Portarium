# Project Brief and Artifact Acceptance v1

**Status:** Proposed  
**Related Beads:** bead-1101, bead-1097, bead-1050, bead-1075  
**Extends:** [Operator Interaction Model v1](./operator-interaction-model-v1.md),
[Software-First Autonomous Venture Proving Ground v1](./software-first-autonomous-venture-proving-ground-v1.md),
[Approval v1](./approval-v1.md)

## Purpose

Define the Project-level contract that turns operator intent, taste, and review
signals into usable guidance for generated Artifacts. The contract is designed
for content, landing pages, specs, prototypes, micro-SaaS work, and other
Derived Artifacts produced by Machines or governed workflows.

This is not a generic approval wrapper. It separates creative/product judgment
from Approval Gate authorization, and it preserves reusable preference learning
without silently mutating Policy.

## Scope

In scope:

- typed Project brief fields for objective, audience, constraints, style
  anchors, quality bar, and non-goals
- operator inputs for ideas, taste notes, critique, and thresholds
- artifact review semantics for content, landing pages, specs, prototypes, and
  other Derived Artifacts
- reusable accept, reject, request-changes, and wrong-direction signals
- separation between one-off critique and durable Project-level preference
  updates
- evidence and routing rules for current-run, future-behaviour, and
  context-only effects

Out of scope:

- replacing Approval Gate, Plan, Run, Artifact, Evidence Log, or Policy schemas
- granting execution authority through taste or artifact review
- model fine-tuning, prompt provider configuration, or connector-specific
  implementation
- public marketing copy for Portarium

## Required Vocabulary

Use the canonical terms from [docs/glossary.md](../../docs/glossary.md):

- Project
- Machine
- Artifact
- Derived Artifact
- Run
- Plan
- Approval Gate
- Evidence Artifact
- Evidence Log
- Work Item
- Policy

## Contract Overview

Every creative or product-like Project that expects generated Artifacts SHOULD
declare a `ProjectArtifactContractV1`.

`ProjectArtifactContractV1` has four parts:

1. `brief`: durable Project-level direction.
2. `operatorInputs`: structured ideas, taste, critique, and thresholds.
3. `reviewPolicy`: artifact-class review semantics and release thresholds.
4. `preferenceLedger`: durable preference updates accepted for future work.

The contract attaches to the Project container. Individual Runs and Work Items
may reference it, but they must not fork hidden preferences that future Runs
cannot inspect.

## Schema

### ProjectArtifactContractV1

Fields:

- `schemaVersion`: `1`
- `projectId`: branded Project ID
- `workspaceId`: branded Workspace ID
- `contractId`: stable contract ID for the Project
- `brief`: `ProjectBriefV1`
- `operatorInputs`: array of `ProjectOperatorInputV1`
- `reviewPolicy`: `ArtifactReviewPolicyV1`
- `preferenceLedger`: array of `ProjectPreferenceUpdateV1`
- `createdAtIso`: ISO-8601/RFC3339 UTC timestamp
- `updatedAtIso`: ISO-8601/RFC3339 UTC timestamp

### ProjectBriefV1

Fields:

- `objective`: one to three sentences describing the outcome the Project is
  trying to create
- `audience`: target users, buyers, readers, reviewers, or internal stakeholders
- `constraints`: hard limits such as legal, brand, technical, budget, schedule,
  data, channel, or platform constraints
- `styleAnchors`: references or named directions that describe taste, tone,
  interaction style, visual density, pacing, or product feel
- `qualityBar`: measurable or reviewable quality criteria for "good enough"
- `nonGoals`: explicit exclusions, forbidden directions, and things the Project
  should not optimize for
- `artifactClasses`: non-empty list of artifact classes expected from this
  Project
- `sourcePolicyRef?`: optional Policy or source-governance reference
- `readinessLabel?`: `self-use`, `demo-only`, `pilot-candidate`, or
  `production-ready` when used by the software-first proving program

`constraints` are binding within the Project scope. `styleAnchors` and
`qualityBar` guide generation and review, but they do not weaken Policy,
Approval Gate requirements, or evidence requirements.

### ArtifactClass

Allowed values:

| Value          | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| `content`      | Article, post, email, digest, script, narrative, or editorial output |
| `landing-page` | Page copy, visual direction, page structure, or conversion surface   |
| `spec`         | Behavioural, product, technical, or governance specification         |
| `prototype`    | Clickable, coded, rendered, or simulated product experience          |
| `micro-saas`   | Small software product increment, backlog slice, or release package  |
| `derived`      | Derived Artifact such as summary, embedding input, index, or graph   |
| `other`        | Explicitly named output that does not fit the common classes         |

`other` requires a `classDescription` in the review policy.

### ProjectOperatorInputV1

Fields:

- `inputId`: stable ID
- `kind`: `idea`, `taste-note`, `critique`, `acceptance-threshold`,
  `style-anchor`, `constraint`, or `non-goal`
- `scope`: `project`, `artifact-class`, `artifact`, `run`, or `work-item`
- `effect`: `current-run-effect`, `future-policy-effect`, or `context-only`
- `target`: Project ID plus optional Run, Work Item, Artifact, Evidence, or
  artifact class references
- `rationale`: concise human explanation
- `payload`: typed payload matching `kind`
- `submittedByUserId`: branded User ID
- `submittedAtIso`: ISO-8601/RFC3339 UTC timestamp

Operator inputs should guide agents without requiring step-by-step
micromanagement. A taste note can say "avoid glossy enterprise hero copy"; it
should not require the operator to dictate every paragraph or component state.

### Operator Input Payloads

`idea` payload:

- `summary`: short opportunity, angle, or hypothesis
- `evidenceRefs`: optional Evidence Artifact IDs
- `priority`: `low`, `normal`, or `high`

`taste-note` payload:

- `preference`: the desired feel, pattern, tone, pacing, density, or product
  quality
- `avoid`: optional anti-preference
- `examples`: optional links, artifact refs, or named anchors
- `confidence`: `tentative`, `working`, or `strong`

`critique` payload:

- `finding`: what is wrong, missing, or promising
- `reason`: one of `wrong-goal`, `wrong-audience`, `wrong-style`,
  `wrong-evidence`, `wrong-risk-level`, `wrong-execution-plan`,
  `missing-context`, `policy-violation`, `insufficient-quality`,
  `domain-correctness-failure`, `conversion-risk`, or `technical-risk`
- `evidenceRefs`: Evidence Artifact IDs consulted or cited
- `recommendedNext`: `revise-current`, `try-alternative`, `narrow-scope`,
  `escalate`, `request-more-evidence`, or `stop-direction`

`acceptance-threshold` payload:

- `criteria`: named criteria the Artifact must satisfy
- `minimumSignal`: `operator-accept`, `domain-sme-accept`, `approval-gate`,
  `test-pass`, `source-cited`, `prototype-reviewed`, or `release-evidence`
- `blocking`: boolean

`style-anchor`, `constraint`, and `non-goal` payloads carry a human-readable
statement plus optional references and evidence refs.

## Artifact Review Semantics

Artifact review is a verification and quality loop. It may feed an Approval Gate
when release or external side effects require authorization, but it is not
itself an Approval Gate unless Policy says so.

### ArtifactReviewRequestV1

Fields:

- `reviewId`: stable ID
- `projectId`: Project ID
- `artifactId`: Artifact or Derived Artifact ID
- `artifactClass`: `ArtifactClass`
- `reviewMode`: `creative-fit`, `product-fit`, `technical-fit`,
  `release-readiness`, or `evidence-sufficiency`
- `briefSnapshotRef`: immutable reference to the Project brief version used
- `requiredCriteria`: criteria copied from the `qualityBar` and review policy
- `thresholds`: applicable acceptance thresholds
- `requestedBy`: user or Machine actor reference
- `requestedAtIso`: ISO-8601/RFC3339 UTC timestamp

### ArtifactReviewDecisionV1

Fields:

- `decisionId`: stable ID
- `reviewId`: review request ID
- `signal`: `accept`, `reject`, `request-changes`, or `wrong-direction`
- `reason`: structured reason, using the critique reason taxonomy above
- `effect`: `current-run-effect`, `future-policy-effect`, or `context-only`
- `rationale`: non-empty human explanation
- `criteriaResults`: per-criterion `pass`, `fail`, `partial`, or
  `not-applicable`
- `preferenceUpdateProposal?`: optional durable preference update proposal
- `evidenceRefs`: Evidence Artifact IDs consulted or cited
- `decidedByUserId`: branded User ID
- `decidedAtIso`: ISO-8601/RFC3339 UTC timestamp

The four review signals are reusable across artifact classes:

| Signal            | Semantics                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `accept`          | The Artifact satisfies the brief and threshold for the requested review mode.                  |
| `reject`          | The Artifact should not be used; replacement or substantial rethink is required.               |
| `request-changes` | The direction is viable, but specific revisions are required before acceptance.                |
| `wrong-direction` | The Artifact optimizes for the wrong goal, audience, taste, architecture, or product strategy. |

`wrong-direction` is stronger than `reject`. It tells the next Run to reconsider
the generation strategy, not only patch the current output.

## Artifact-Class Criteria

The shared signal set must not flatten every output into a generic approval.
Review criteria are class-specific:

| Artifact class | Review focus                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `content`      | audience fit, source faithfulness, editorial quality, voice, claim safety, call-to-action fit  |
| `landing-page` | offer clarity, visual hierarchy, page credibility, responsiveness, conversion path, brand fit  |
| `spec`         | contract completeness, testability, vocabulary, boundaries, acceptance coverage, traceability  |
| `prototype`    | workflow fit, interaction quality, accessibility, technical plausibility, evidence screenshots |
| `micro-saas`   | user value, scope discipline, release evidence, tests, operational risk, supportability        |
| `derived`      | provenance, source policy, retention, retrieval utility, redaction, rebuildability             |
| `other`        | explicitly declared criteria in `ArtifactReviewPolicyV1`                                       |

## Durable Preference Updates

One-off critique and durable preference changes are separate submissions.

### ProjectPreferenceUpdateV1

Fields:

- `updateId`: stable ID
- `sourceDecisionId?`: optional Artifact review decision
- `sourceInputId?`: optional operator input
- `scope`: `project`, `artifact-class`, or `workflow-definition`
- `preference`: durable preference statement
- `appliesTo`: artifact classes, Machines, workflow definitions, or Project
  phases affected
- `supersedesUpdateIds`: optional list of earlier preference updates replaced
- `status`: `proposed`, `accepted`, `rejected`, or `retired`
- `acceptedByUserId?`: required when `status` is `accepted`
- `acceptedAtIso?`: required when `status` is `accepted`
- `evidenceRefs`: Evidence Artifact IDs supporting the update

A `preferenceUpdateProposal` on an artifact review decision is inert until
accepted as `ProjectPreferenceUpdateV1.status = accepted`. This prevents a
single heated critique from silently changing future Project behaviour.

## Evidence and Routing

Every Project brief change, operator input, review request, review decision, and
preference update must be reconstructable from the Evidence Log.

Effect semantics:

| Effect                 | Meaning                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `current-run-effect`   | Changes only the active Run, Plan, review request, Artifact revision, or Work Item route.     |
| `future-policy-effect` | Changes reusable Project preferences, workflow definitions, prompt strategy, or Policy route. |
| `context-only`         | Records taste, insight, or audit context without changing execution or future behaviour.      |

`future-policy-effect` does not mean every preference is a Policy change. It
means the feedback can influence future behaviour. Actual Policy changes still
follow the Policy change workflow.

## Acceptance

This contract is satisfied when:

- a Project can declare a typed brief with objective, audience, constraints,
  style anchors, quality bar, non-goals, and artifact classes
- humans can submit ideas, taste, critique, and thresholds in structured form
  without micromanaging each generated step
- content, landing pages, specs, prototypes, micro-SaaS increments, and Derived
  Artifacts use class-specific review criteria
- accept, reject, request-changes, and wrong-direction are named signals with
  stable semantics
- one-off critique remains attached to the current Artifact or Run unless a
  separate durable preference update is accepted
- artifact review can feed Approval Gates where Policy requires authorization
  but does not collapse creative/product review into generic approval
- Evidence Log entries can reconstruct who supplied the brief, which brief
  version was used, what was reviewed, what decision was made, and whether the
  decision affects only the current Run or future Project behaviour

## Traceability Links

- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- [Approval v1](./approval-v1.md)
- [Evidence v1](./evidence-v1.md)
- [Plan v1](./plan-v1.md)
- [Software-First Autonomous Venture Proving Ground v1](./software-first-autonomous-venture-proving-ground-v1.md)
- [Project Brief Artifact Governance](../../docs/internal/governance/project-brief-artifact-governance.md)

# Software-First Autonomous Venture Proving Ground v1

## Scope

Portarium's near-term proving program is software-first. It uses governed agents,
Machines, Workflows, Projects, Work Items, Approval Gates, Plans, Policies, and
Evidence Logs to prove that Portarium can help one builder ship useful software
or media artifacts under human direction.

The program does not make robotics a current delivery target. Robotics remains a
later expansion path for `RoboticsActuation` once capital, hardware access,
site-specific safety controls, and physical safety testing exist.

## Chosen Proving Strategy

The first self-use proving workflow is `source-to-micro-saas-builder`.

This workflow turns trusted source material into a cited research dossier,
product brief, bounded software Artifacts, QA or release evidence, and review
outcomes inside one governed Project. It is the primary near-term proving target
because it exercises source provenance, planning, implementation, artifact
acceptance, rollback, and usefulness measurement in the same workflow the
builder can actually use.

The secondary public workflow is `source-to-content-studio`. It may appear in
Cockpit and demo-machine narratives as a second Project type, but its
`productionClaim` is `demo-only` until separate self-use evidence exists.

`software-distribution-growth-loop` is deferred until the primary workflow has
accepted product Artifact evidence and outbound compliance gates are ready for
real send, post, publish, or distribution Actions.

`hybrid-content-product-showcase` is allowed as a public narrative only when the
primary Project remains the proof target and the content Project is labeled as
showcase-only.

## Current Proving Workflows

The current backlog may include software proving workflows when they satisfy all
of these constraints:

1. The workflow produces a software, document, campaign, analytics, or media
   Artifact.
2. The workflow uses trusted sources, controlled Actions, and recorded Evidence.
3. A human supplies objective, taste, boundary conditions, and Approval Gate
   decisions where Policy requires them.
4. Cockpit can present the workflow as a governed Project with Runs, Work Items,
   Approvals, Plans, Evidence, and Artifacts.
5. At least one bounded workflow is used by the builder on real work before any
   broader public claim is made.
6. The workflow can be demonstrated as one of multiple governed Project types
   without claiming every Project type is production-ready.
7. Near-term implementation work is ordered around
   `source-to-micro-saas-builder` unless a later strategy bead changes this
   choice.

Examples in scope:

- Source-to-micro-SaaS research, backlog shaping, implementation planning,
  artifact review, QA evidence, release evidence, and rollback loops.
- Source-to-content Artifact generation governed by Plans and Evidence, when
  labeled as demo-only or separately proven.
- Growth Studio research, content, outbound draft, and measurement loops, after
  outbound communication compliance and distribution gates are satisfied.
- Operator-governance experiments that improve approval quality, recovery,
  context sufficiency, or policy calibration for software work.

## Project-Type Contract

Each proving workflow must declare a Project type with:

- `projectTypeId`: stable identifier such as `growth-studio`,
  `micro-saas-agent-stack`, or `content-artifact-loop`
- `owner`: builder or responsible human
- `primaryArtifacts`: expected Artifact kinds
- `trustedSources`: source classes the agents may read
- `controlledActions`: externally-effectful Actions and their Execution Tiers
- `approvalPolicy`: Approval Gate and maker-checker requirements
- `evidenceExpectations`: required Evidence Log entries and Artifact hashes
- `productionClaim`: `self-use`, `demo-only`, `pilot-candidate`, or
  `production-ready`

`productionClaim` must be truthful. Demo-only Projects can appear in public demos
only when labeled as demo-only or pilot-candidate.

## Robotics Expansion Boundary

Robotics work is out of scope for this proving program unless a later bead
explicitly reopens the boundary with all of the following:

1. A funded hardware or simulator budget.
2. Access to representative robotics hardware or a validated simulation harness.
3. A site-specific safety case and physical stop-path evidence.
4. Release-gate review against robotics compliance and safety specs.
5. Explicit owner approval that the work belongs to speculative expansion, not
   the software-first proving backlog.

Until those conditions are met:

- robotics routes, clips, and fixtures remain demo-only or speculative expansion;
- robotics backlog items must not block software proving workflows;
- `RoboticsActuation` may remain documented as a future Port Family capability;
- public proving demos must not imply physical autonomy is production-ready.

## Backlog Separation

Backlog items for this program must use one of these lanes:

| Lane                         | Meaning                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `software-proving-current`   | Required to use or demo current software-first governed Project flows.  |
| `software-proving-support`   | Improves evidence, tests, docs, or operator quality for current flows.  |
| `showcase-demo-only`         | Helps tell the story but is not production proof.                       |
| `speculative-robotics-later` | Robotics, physical actuation, fleet UI, or safety work for later scope. |

If a bead mixes current software proving work with speculative robotics, split
it or mark the robotics portion as explicitly deferred.

## Acceptance

The proving ground is credible when:

- the `source-to-micro-saas-builder` workflow has been used by the builder on
  real work;
- Cockpit can show multiple governed Project types with truthful readiness
  labels;
- Evidence Logs link objectives, Plans, Approval Gates, Actions, and Artifacts;
- the content studio path is labeled as showcase-only until it has its own
  self-use evidence;
- distribution, outbound growth loops, prompt-language work, and robotics remain
  gated by their own evidence;
- the backlog clearly separates current software proving work from deferred
  showcase, distribution, prompt-language, and speculative robotics expansion.

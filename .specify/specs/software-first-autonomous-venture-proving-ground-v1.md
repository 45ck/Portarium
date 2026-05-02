# Software-First Autonomous Venture Proving Ground v1

## Scope

Portarium's near-term proving program is software-first. It uses governed agents,
Machines, Workflows, Projects, Work Items, Approval Gates, Plans, Policies, and
Evidence Logs to prove that Portarium can help one builder ship useful software
or media artifacts under human direction.

The program does not make robotics a current delivery target. Robotics remains a
later expansion path for `RoboticsActuation` once capital, hardware access,
site-specific safety controls, and physical safety testing exist.

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

Examples in scope:

- Growth Studio research, content, outbound draft, and measurement loops.
- Micro-SaaS research, backlog shaping, implementation planning, and release
  evidence loops.
- Content and media Artifact generation governed by Plans and Evidence.
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

- one bounded software workflow has been used by the builder on real work;
- Cockpit can show multiple governed Project types with truthful readiness
  labels;
- Evidence Logs link objectives, Plans, Approval Gates, Actions, and Artifacts;
- the backlog clearly separates current software proving work from later
  speculative robotics expansion.

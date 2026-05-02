# Software-First Proving Program

Status: governance note for `bead-1097`.

This note turns the autonomous venture proving ground into backlog lanes. It
keeps Portarium's near-term proof focused on governed software work while
preserving robotics as a later expansion.

## Program Goal

Portarium should prove itself by helping the builder run a real, bounded
software workflow:

- agents read trusted sources and produce useful Artifacts;
- humans provide objective, taste, boundary conditions, and approvals;
- Cockpit shows each effort as a governed Project with Runs, Work Items,
  Approval Gates, Plans, Evidence, and Artifacts;
- self-use evidence exists before broader public claims;
- demos can show multiple Project types without claiming all of them are
  production-ready.

## Current Backlog Lanes

Use these lanes when triaging or splitting beads:

| Lane                         | Use for                                                                 | Examples                                                            |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `software-proving-current`   | Work needed to run a current software-first proving workflow.           | Growth Studio loop, micro-SaaS build loop, content Artifact loop.   |
| `software-proving-support`   | Tests, specs, evidence rules, or Cockpit contracts that support proof.  | Project readiness labels, evidence completeness, recovery metrics.  |
| `showcase-demo-only`         | Demo and media work that illustrates governance but is not proof alone. | Multi-Project demo script, rendered walkthrough, launch kit copy.   |
| `speculative-robotics-later` | Physical actuation, fleet operations, robotics UI, or safety expansion. | Robotics simulation CI, fleet map polish, physical stop-path tests. |

The first two lanes are the proving backlog. The third lane can support a public
demo but must not be described as production proof. The fourth lane is deferred
unless the robotics expansion gate is reopened.

## Near-Term Project Types

The current proving program can use these Project types:

- `growth-studio`: source research, content drafts, outbound compliance checks,
  campaign measurement, and evidence summaries.
- `micro-saas-agent-stack`: opportunity research, backlog shaping, coding-plan
  generation, release evidence, and governed handoff points.
- `content-artifact-loop`: article, image, video, digest, or demo Artifact
  production with source, approval, and redaction evidence.
- `operator-governance-experiment`: approval quality, recovery, policy
  calibration, and evidence sufficiency experiments for software workflows.

Each Project type needs a truthful readiness label:

- `self-use`: used by the builder for real work.
- `demo-only`: illustrative, fixture-backed, or not yet used on real work.
- `pilot-candidate`: ready for a controlled external pilot with explicit scope.
- `production-ready`: supported by production gates, tests, operations, and
  recovery evidence.

## Robotics Boundary

Robotics is not part of the current proving backlog. It stays in
`speculative-robotics-later` until a later planning bead provides:

- funded capital or budget for hardware and safety work;
- access to representative hardware or a validated simulation harness;
- site-specific safety case and physical stop-path evidence;
- compliance and release-gate review for robotics-enabled workflows;
- explicit owner approval that the work is expansion scope.

Existing robotics architecture docs and specs remain useful references. They do
not make robotics a release blocker for software-first proof.

## Triage Rule

When a bead mentions both software proving and robotics, split it. Keep the
software part in `software-proving-current` or `software-proving-support`; move
physical actuation, fleet operations, and safety validation to
`speculative-robotics-later`.

When a bead mentions only demo capture or public storytelling, classify it as
`showcase-demo-only` unless it adds self-use evidence, policy enforcement, or
repeatable verification for a current software workflow.

## Spec Link

The normative spec is
`.specify/specs/software-first-autonomous-venture-proving-ground-v1.md`.

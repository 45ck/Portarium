# Prompt-Language Exploration Sequence

Status: framing note for `bead-1032`.

This note keeps prompt-language exploration separate from current Growth Studio
work. It records the order of decisions required before any governed coding
workflow integration is considered. The machine-readable gate manifest is
`prompt-language-exploration-sequence.json`.

## Scope

This epic explores whether prompt-language should become a future layer for
governed coding workflows. It does not authorize runtime integration, Cockpit
surface work, prompt-language execution, or coupling to Growth Studio.

## Gate Sequence

| Order | Gate                      | Bead        | Must Be True Before The Next Gate Opens                                        |
| ----- | ------------------------- | ----------- | ------------------------------------------------------------------------------ |
| 1     | Growth Studio evidence    | `bead-1027` | Current Growth Studio experiment has evidence that it produces useful results. |
| 2     | Architecture fit          | `bead-1028` | Evidence exists before deciding whether prompt-language belongs in Portarium.  |
| 3     | Policy and audit model    | `bead-1029` | Policy, audit, Evidence Log, approval, and retention model are defined.        |
| 4     | Thin proof of concept     | `bead-1030` | Proof of concept is isolated to an experimental path.                          |
| 5     | Integration consideration | `bead-1031` | Only after the proof of concept may a production integration seam be assessed. |

## Checkable Constraints

- `architecture-fit` must not start before `growth-studio-evidence` closes.
- `policy-audit-model` must not start before `growth-studio-evidence` and
  `architecture-fit` close.
- `thin-poc` must not start before `policy-audit-model` closes.
- `integration-consideration` must not start before `thin-poc` closes.
- Prompt-language integration work must not start before the Growth Studio
  evidence gate is closed and the governance model is defined.

## Integration Boundary

Any future integration bead must cite the closed evidence, architecture, policy,
audit, and proof-of-concept beads. Until then, prompt-language work stays in
docs, specs, backlog framing, or experimental proof-of-concept assets only.

The exploration should reuse Portarium terms: Actions, Policy, Approval Gates,
Plans, Evidence Artifacts, Evidence Log, Runs, Work Items, and Workspaces. It
must not create a parallel governance vocabulary for coding workflows.

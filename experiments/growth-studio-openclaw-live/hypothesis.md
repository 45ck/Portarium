# Growth Studio OpenClaw Live

## Bead

- `bead-0999`

## Hypothesis

A live OpenClaw agent using an OpenRouter model and the Portarium governance plugin can complete a
controlled Growth Studio rehearsal inside an isolated workspace:

1. Read Growth Studio inputs from local files without human intervention.
2. Pause on each mutating `write:file` action while Portarium creates a human approval.
3. Resume only after a distinct operator identity approves the pending action.
4. Produce a usable Growth Studio output bundle covering research, planning, content drafting,
   execution staging, and baseline measurement.

## Scope

This experiment validates the live governed loop, not production outbound delivery. The execution
stage is represented as a local execution queue artifact rather than a real CRM or email send.

## Evidence

The run is considered confirmed when:

- OpenClaw runs live with an OpenRouter-backed model.
- Portarium health is confirmed in an isolated dev workspace.
- At least one approval is created and approved during the agent turn.
- The output bundle is written under `results/runtime/workspace/outputs/`.
- Raw logs, approval snapshots, evidence snapshots, and runner outcome are captured under
  `results/`.

# Experiment A: Before-Hook Transparency

Bead: `bead-0962`

## Hypothesis

The OpenClaw `before_tool_call` hook transparently governs every normal agent tool
call without requiring agent code changes.

Expected observations:

- `read:file` is classified as read-only and allowed immediately.
- `write:file` is classified as mutation, creates a pending Approval Gate, and
  only unblocks after an operator approval.
- `shell.exec` is classified as dangerous/manual-only and is denied before the
  tool body can execute.

## Core Signal

The experiment succeeds only when the same registered hook intercepts all three
tool calls at priority `1000`, records policy-visible proposal traffic, and
prevents denied tools from reaching the simulated tool executor.

# Growth Studio OpenClaw Live v2

Owner Bead: `bead-1042`

Status: planned.

## Scenario

OpenClaw proposes multiple governed Actions. At least one Approval Gate remains
pending across a long delay window, then an operator approves it. The agent must
resume the blocked step exactly once without replaying prior writes.

## Required Variants

- `live-wait`: the agent process remains alive while blocked.
- `restart-resume`: the proposal survives process exit and later recovery.

## Required Evidence

- pending approval remains durable across the delay window
- resume latency after approval is measured
- duplicate execution count is zero
- evidence chain is continuous before wait, during wait, and after resume
- report compares this result to the original Growth Studio live run

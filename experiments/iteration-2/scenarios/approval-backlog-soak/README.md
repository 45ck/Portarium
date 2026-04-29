# Approval Backlog Soak

Owner Bead: `bead-1045`

Status: planned.

## Scenario

Generate sustained pending approval pressure across several sessions or tenants.
Hold some items long enough to trigger escalation and expiry paths. Run long
enough to observe queue depth, scheduler behavior, and degradation signals.

## Required Evidence

- escalation and expiry happen independently per approval
- queue depth and pending age are recorded over time
- duplicate escalation event count is zero
- runtime memory, error rate, and backlog metrics are captured for the soak
  window
- report distinguishes product defects from environment or host limits

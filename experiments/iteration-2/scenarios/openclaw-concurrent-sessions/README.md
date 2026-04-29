# OpenClaw Concurrent Sessions

Owner Bead: `bead-1044`

Status: planned.

## Scenario

Several governed OpenClaw sessions run at the same time. Each session proposes,
waits, resumes, and writes to its own output bundle. Operators resolve approvals
in mixed order across active sessions.

## Required Evidence

- approval IDs, Evidence Artifacts, and outputs remain session-scoped
- a decision for one session never unblocks another session
- throughput and latency are recorded for the selected concurrency level
- duplicate execution count is zero when approvals resolve near-simultaneously
- final report states tested concurrency level and observed bottlenecks

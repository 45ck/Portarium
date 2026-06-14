# Approval Consumer Reconciler

Tag: experimental
Bead: bead-1285

## Hypothesis

Portarium can treat a submitted Approval Gate decision as durable intent without
making the approval button itself execute arbitrary work.

An approval consumer can reconcile approved cards into one of four safe follow-up
classes:

- review-only consumption for standing-read and monitor review cards
- executor-gated dispatch for allowlisted safe actions
- executor-gated dispatch for exact scoped browser-query approvals
- blocked follow-up proposals for broad or mutating actions

## Safety Boundary

This experiment does not call a live Portarium API, OpenClaw, provider, browser,
or executor. It models the intended reconciler behavior with deterministic
fixtures and writes only local result artifacts under `results/`.

## Success Criteria

- Approved review cards create a review-consumed event and never execution.
- Approved safe/status cards create exactly one executor-gated dispatch intent.
- Approved scoped browser-query cards create exactly one direct-gate dispatch
  intent and preserve redacted-output requirements.
- Approved broad/mutating cards do not execute and instead produce a narrower
  follow-up proposal intent.
- Pending, denied, expired, executed, and request-changes approvals are handled
  without duplicate execution.

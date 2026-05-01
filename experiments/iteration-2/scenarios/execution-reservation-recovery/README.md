# Execution Reservation Recovery

Bead: `bead-1142`

This deterministic scenario proves that approved Action execution retries recover from execution reservation states without duplicate dispatch and without leaking sensitive request data into result artifacts.

## Variants

- `active-in-progress`: retry sees an active matching execution reservation and returns `Executing` without dispatching again.
- `completed-replay`: retry sees a completed matching reservation and replays the terminal output without dispatching, event, or evidence duplication.
- `fingerprint-conflict`: retry uses the same execution reservation key with different request content and fails closed as a conflict.
- `claim-lost-release`: reservation begins but the approval claim is lost, so the reservation is released and no dispatch occurs.
- `complete-lost-recovery`: dispatch succeeds, completion storage fails, and a recovery retry observes the in-progress reservation instead of dispatching again.

## Acceptance Mapping

- Active and completed execution reservations prevent duplicate Action dispatch.
- Mismatched reservation fingerprints fail closed.
- Lost approval claims release the reservation before returning conflict.
- Lost completion state remains operator-visible as `Executing` on retry.
- Reservation-specific artifacts are redacted before write.

## Run

```bash
node experiments/iteration-2/scenarios/execution-reservation-recovery/run.mjs
```

The runner writes append-only result artifacts under `experiments/iteration-2/results/execution-reservation-recovery/<attempt-id>/` when called by automation with a unique result directory.

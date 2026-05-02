# Weekly Autonomy Digest Artifact v1

## Purpose

The Weekly Autonomy Digest is the operator-facing Artifact for the autonomy confidence loop.
It summarizes routine autonomous activity without creating live interruptions, then records
operator acknowledgement and policy calibration intent in the Evidence Log.

## Digest contents

- The Artifact covers a weekly period and a 90-day history window.
- Weekly activity is grouped by Action class and Execution Tier: Auto, Assisted, and Human-approve.
- Each group records action count, anomaly count, reversal count, anomaly rate, and reversal rate.
- Recommendations are derived from the 90-day history, not only the visible week.
- Recommendations carry a deterministic shortcut payload with:
  - `recommendationId`
  - Action class
  - current Execution Tier
  - recommended Execution Tier
  - `promote` or `demote`
  - supporting count/rate evidence

## Policy calibration shortcut

The shortcut MUST NOT mutate Policy directly. It creates auditable draft intent with
`effect: draft-policy-change-only`; the later Policy workflow remains responsible for review,
approval, versioning, and activation.

## Evidence semantics

- The Markdown digest is stored as an immutable Artifact payload.
- The digest Evidence Log entry references the Artifact payload with kind `Artifact`,
  content type `text/markdown`, and the SHA-256 digest of the Markdown bytes.
- Operator acknowledgement is required for the digest and is recorded as a separate Evidence Log
  entry by a User actor.
- Acknowledgement evidence references the digest Artifact and records the same SHA-256 digest.
- Policy calibration shortcut evidence is category `Policy` and references both the digest Artifact
  and the draft policy calibration snapshot.

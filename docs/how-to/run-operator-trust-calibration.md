# Run The Operator Trust Calibration Eval

This eval checks whether a mixed approval queue is creating useful trust or
approval fatigue.

Use it with the readiness model in
[`docs/internal/governance/operator-readiness-calibration.md`](../internal/governance/operator-readiness-calibration.md).
The eval measures calibration signals; the readiness model decides whether
authority, training status, workload, and verification sampling are sufficient
for the pilot.

It measures:

- time to decision
- approve, deny, request-changes, request-more-evidence, and override mix
- evidence consulted before decision
- missing evidence and opaque Policy rationale
- fast high-risk approvals that look like rubber-stamping
- low-risk cases that create unnecessary friction
- correct decisions made with low operator confidence

Run it locally:

```bash
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-operator-trust-calibration.test.ts
```

The scenario is deterministic and OSS-safe. It does not need live LLM keys.
Recommendations are grouped by target:

- `policy`: change tiering, queue shaping, or approval volume
- `ux`: change decision packet, evidence visibility, or review depth
- `training`: calibrate operators when the product context was sufficient but
  confidence was low

This is the dependency check for the evidence sufficiency packet work in
`bead-1075`.

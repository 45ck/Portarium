# micro-saas-toolchain-redo toolchain-realism-v1

Generated: 2026-04-29T03:00:10.000Z

## Metric Artifacts

- `queue-metrics.json`
- `evidence-summary.json`

## Evidence Completeness

Present: 8
Missing: 0

## Toolchain Preflight

| Tool            | Required | Status                | Rationale                                       |
| --------------- | -------- | --------------------- | ----------------------------------------------- |
| content-machine | true     | runnable              | content-machine CLI responded to --help.        |
| demo-machine    | false    | intentionally-skipped | AppLocker blocks the local demo-machine binary. |

## Tool Usage Evidence

| Tool            | Phase                       | Status                | Evidence                   | External Effect |
| --------------- | --------------------------- | --------------------- | -------------------------- | --------------- |
| content-machine | preflight-and-content-draft | runnable              | toolchain-preflight.json   | none            |
| demo-machine    | post-validation-demo        | intentionally-skipped | toolchain-preflight.json   | none            |
| publish-gateway | external-publish            | stubbed               | external-effect-stubs.json | stubbed         |
| email-gateway   | external-send               | stubbed               | external-effect-stubs.json | stubbed         |

## Post-Validation Demo Path

State: unproven

demo-machine was not runnable in this run, so the post-validation demo path remains unproven with an explicit skip/failure reason.

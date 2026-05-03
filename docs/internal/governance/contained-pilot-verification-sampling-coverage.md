# Contained Pilot Verification-Sampling Coverage

**Bead:** `bead-1151`
**Generated:** 2026-05-03
**Decision scope:** contained pilot only
**Broader business-use claim:** blocked

The machine-readable artifact is
`docs/internal/governance/contained-pilot-verification-sampling-coverage.json`.
It applies the
`.specify/specs/delegated-autonomy-verification-sampling-v1.md` contract to
the `source-to-micro-saas-builder` self-use alpha controlled Action classes.

The coverage is intentionally conservative. It samples the contained-pilot
deterministic evidence and the self-use alpha plan; it does not replace the
missing recurring real self-use ledger.

## Coverage

| Action class                       | Execution Tier | Completed | Sampled | Coverage | Defect findings | Defect rate | Confidence        |
| ---------------------------------- | -------------- | --------- | ------- | -------- | --------------- | ----------- | ----------------- |
| `external-publish-or-distribution` | `ManualOnly`   | 4         | 4       | 100%     | 0               | 0%          | insufficient-data |
| `git-commit`                       | `HumanApprove` | 1         | 1       | 100%     | 0               | 0%          | insufficient-data |
| `repository-file-edit`             | `HumanApprove` | 1         | 1       | 100%     | 1               | 100%        | insufficient-data |
| `source-ingestion`                 | `Assisted`     | 1         | 1       | 100%     | 1               | 100%        | insufficient-data |
| `test-or-quality-gate-run`         | `Assisted`     | 5         | 5       | 100%     | 1               | 20%         | low               |

## Findings

| Finding                        | Outcome                 | Route        | Bead        |
| ------------------------------ | ----------------------- | ------------ | ----------- |
| `vsf-source-ingestion-001`     | `evidence-insufficient` | existing gap | `bead-1149` |
| `vsf-repository-file-edit-001` | `evidence-insufficient` | existing gap | `bead-1148` |
| `vsf-quality-gate-001`         | `evidence-insufficient` | existing gap | `bead-1150` |
| `vsf-git-commit-001`           | `correct`               | none         | none        |
| `vsf-external-publish-001`     | `correct`               | none         | none        |

No new Beads are required from this sampling pass. The non-correct findings map
to already-created follow-up Beads from the pilot readiness decision.

## Decision

Verification sampling shows hidden defects are visible and routed for the
contained pilot, but the confidence state is not enough for broader business
use. The next readiness gate still needs the real self-use alpha ledger,
headed browser evidence, and toolchain preflight remediation before reduced
Approval Gate volume can be treated as a positive signal.

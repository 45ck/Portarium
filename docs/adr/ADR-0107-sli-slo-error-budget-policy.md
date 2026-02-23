# ADR-0107: SLI/SLO Definitions and Error Budget Policy

**Status**: Accepted
**Date**: 2026-02-23
**Bead**: bead-dawn

## Context

Portarium services need quantified reliability targets so that operational
decisions (deploy, rollback, feature-freeze) can be made on data rather than
ad-hoc judgement. Without explicit SLI/SLO definitions and an error budget
policy, alerts are noisy guesswork and canary promotions lack objective
thresholds.

## Decision

### SLI Definitions

| Service           | SLI Name                 | Metric                                 | Good Event                        |
| ----------------- | ------------------------ | -------------------------------------- | --------------------------------- |
| control-plane-api | API Availability         | `http_requests_total`                  | Non-5xx response                  |
| control-plane-api | API Latency (p95)        | `http_request_duration_ms_bucket`      | Response in ≤ 500 ms              |
| execution-plane   | Workflow Completion Rate | `portarium_run_started/completed`      | Run reaches terminal state        |
| execution-plane   | Workflow Latency (p90)   | `portarium_run_duration_ms_bucket`     | Automated run completes in ≤ 60 s |
| worker            | Action Success Rate      | `portarium_worker_action_started/succ` | Activity attempt succeeds         |
| evidence-store    | Write Integrity          | `portarium_evidence_write_attempted`   | Write durably committed           |

### SLO Targets (rolling 30-day window)

| SLI                    | Target | Tier | Monthly Error Budget |
| ---------------------- | ------ | ---- | -------------------- |
| API Availability       | 99.9%  | P0   | ~43 min downtime     |
| API Latency p95        | 95%    | P0   | 5% of requests slow  |
| Workflow Completion    | 99%    | P0   | 1% runs may stall    |
| Workflow Latency p90   | 90%    | P1   | 10% runs may be slow |
| Action Success Rate    | 99.5%  | P0   | 0.5% actions may err |
| Evidence Write Success | 99.99% | P0   | ~4.3 min of failures |

### Error Budget Policy

When remaining error budget for any P0 SLO drops below a threshold, the
following actions are triggered automatically or by the on-call team:

| Budget Remaining | Action                                                         |
| ---------------- | -------------------------------------------------------------- |
| < 50%            | Warn in Slack `#portarium-ops`; on-call reviews recent deploys |
| < 25%            | Freeze non-critical deployments; only hotfixes allowed         |
| < 10%            | Alert fires (`SLOErrorBudgetLow`); reliability sprint required |
| Exhausted (0%)   | Full deployment freeze; post-incident review before resuming   |

Budget resets with the rolling 30-day window; there is no manual "refill".

### Burn-Rate Alerting (MWMBR)

Two severity tiers per SLO following Google SRE Workbook Chapter 5:

- **Page** (fast burn): 14x budget consumed at 1h+5m windows
- **Ticket** (slow burn): 6x budget consumed at 6h+30m windows

Defined in `infra/otel/alerts/slo-burn-rate-alerts.yaml`.

### Progressive Delivery Integration

Canary promotion in the Argo Rollouts pipeline uses SLO metrics as gate
conditions:

| Gate                     | Threshold                          | Action on breach |
| ------------------------ | ---------------------------------- | ---------------- |
| Canary error rate        | > 3x baseline error rate for 5 min | Auto-rollback    |
| Canary p95 latency       | > 2x baseline p95 for 5 min        | Auto-rollback    |
| SLO budget remaining     | < 10% for any P0 SLO               | Block promotion  |
| Workflow completion rate | < 95% during canary window         | Auto-rollback    |

These thresholds are intentionally tighter than the SLO targets to catch
regressions before they consume significant budget.

## Consequences

- All alerting is derived from SLO burn rates, not arbitrary static thresholds
- Deployment velocity is self-regulating: more reliability issues = slower deploys
- SLO dashboard (`infra/otel/dashboards/slo-overview.dashboard.json`) shows
  real-time budget consumption for all six SLIs
- Canary rollback decisions are automated and auditable

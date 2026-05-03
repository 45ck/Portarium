# production-like-pilot-rehearsal pilot-rehearsal-v1

Generated: 2026-05-03T05:05:10.000Z

## Metric Artifacts

- `queue-metrics.json`
- `evidence-summary.json`

## Evidence Completeness

Present: 9
Missing: 0

## Production-like Boundary

- Durable stores: approval, run, policy, evidence, and external-effect stub ledgers.
- Auth boundary: role, Workspace, and Separation of Duties checks are enforced before decisions.
- Cockpit boundary: operator-flow evidence is captured as agent-browser/Playwright command paths.
- External SoR boundary: CRM and billing writes are stubbed and redacted.

## Pilot SLOs

Pending p95: 250000ms
Resume latencies: 850, 850ms
Duplicate executions: 0

## Restart Persistence

Verdict: survived-restart

## Cockpit Operator Flow

- Inbox approval queue
- Approval detail with Plan and Evidence Artifacts
- Approve and request-changes decision controls
- Run resume status
- Evidence Log redaction spot check

## Divergence Classification

- div-pilot-browser-screenshots: test-limitation (requires-live-candidate-browser-run)
- div-external-sor-effects: environment-limitation (acceptable-for-rehearsal)
- div-queue-slo: no-divergence (none)
- div-cockpit-operator-flow: no-divergence (none)
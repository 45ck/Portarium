# production-like-pilot-rehearsal pilot-rehearsal-v1

Generated: 2026-05-03T05:05:10.000Z

## Metric Artifacts

- `queue-metrics.json`
- `evidence-summary.json`

## Evidence Completeness

Present: 10
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

## Release-Candidate Live Browser Attempt

- Headed Playwright Chromium launched successfully.
- Cockpit rendered in Dev live mode with MSW disabled for `ws-local-dev`.
- Production-like stack startup did not complete in this environment: `npm run dev:all` failed compose validation, the tools-profile compose retry could not reach Docker Desktop, and required live-stack smoke found `http://localhost:8080` unavailable.
- The headed browser trace captured a live-auth/API boundary limitation, not successful queue/detail/decision/resume/redaction verification.

## Divergence Classification

- div-pilot-browser-screenshots: environment-limitation (release-claim-constrained-no-production-like-browser-promotion)
- div-external-sor-effects: environment-limitation (acceptable-for-rehearsal)
- div-queue-slo: no-divergence (none)
- div-cockpit-operator-flow: no-divergence (none)

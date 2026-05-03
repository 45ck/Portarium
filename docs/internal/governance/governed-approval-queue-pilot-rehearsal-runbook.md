# Governed Approval Queue Pilot Rehearsal Runbook

**Bead:** bead-1146
**Status:** draft

This runbook defines the production-like rehearsal for governed approval queues
before a controlled pilot. It complements the OpenClaw release gate by proving the
operator queue path, restart persistence, redaction, and divergence handling for
Approval Gates.

## Scope

The rehearsal uses durable local stores and real authorization boundaries where
available. External System of Record effects are not executed; they are recorded
in `external-sor-stubs.json` with idempotency keys and redacted targets.

Required scenario:

```bash
node experiments/iteration-2/scenarios/production-like-pilot-rehearsal/run.mjs \
  --results-dir experiments/iteration-2/results/production-like-pilot-rehearsal/pilot-rehearsal-v1
```

## Preconditions

- `npm run dev:all` and `npm run dev:seed` can boot the local production-like stack.
- Cockpit can run against the API with `VITE_PORTARIUM_ENABLE_MSW=false`.
- The operator principal has the approver role in the pilot Workspace.
- Evidence storage is enabled and available after API and worker restart.
- Browser QA uses `npm run ab -- ...` or Playwright, never the blocked native
  agent-browser binary.

## Rehearsal Steps

1. Run the deterministic rehearsal and confirm `outcome.json` is `confirmed`.
2. Restart the API and worker process, then confirm pending approvals, runs,
   policies, and Evidence Log entries persist.
3. Open Cockpit at `http://cockpit.localhost:1355` with real API/auth mode.
4. Verify the operator flow: Inbox queue, Approval detail, Plan/evidence review,
   approve, request changes, Run resume, and Evidence Log redaction spot check.
5. Confirm queue SLOs: pending p95 no more than 300 seconds, resume latency no
   more than 1 second, duplicate execution count equal to zero.
6. Inspect `external-sor-stubs.json` and confirm CRM/billing effects are stubbed.
7. Inspect `redaction-audit.json` and confirm no forbidden token, email, or
   private System of Record URL appears.
8. Inspect `divergence-classification.json`; product defects block the pilot,
   environment limitations require explicit acceptance, and test limitations
   require a named follow-up evidence run.

## Required Evidence Artifacts

| Artifact                         | Purpose                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `queue-metrics.json`             | Queue SLO, restart, resume, and duplicate-execution metrics               |
| `restart-persistence.json`       | Durable approval, run, policy, and Evidence Log survival                  |
| `browser-qa-evidence.json`       | Cockpit operator-flow verification commands and screenshot paths          |
| `redaction-audit.json`           | Forbidden fragment scan result                                            |
| `divergence-classification.json` | Product defect, environment limitation, or test limitation classification |
| `external-sor-stubs.json`        | Stubbed CRM/billing effect ledger                                         |

## Pilot Gate

The rehearsal passes only when:

- all assertions in `outcome.json` pass
- no divergence is classified as `product-defect`
- redaction audit has no forbidden fragments
- browser QA evidence names the Cockpit queue, Approval detail, decision, Run
  resume, and Evidence Log verification path
- all external System of Record effects are marked `stubbed-external-sor-effect`

The pilot must not proceed from deterministic evidence alone. A release-candidate
run must add headed browser screenshots or Playwright traces at the paths named in
`browser-qa-evidence.json`.

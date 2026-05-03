# Production-like Pilot Rehearsal

**Bead:** bead-1146

This scenario rehearses the governed approval queue pilot against the closest
production-like boundary available in deterministic CI:

- durable approval, run, policy, Evidence Log, and external-effect stub ledgers
- real authorization decisions represented as role, Workspace, and SoD checks
- Cockpit operator flow evidence represented as agent-browser/Playwright command
  boundaries and captured artifact paths
- explicit redaction checks before evidence is committed
- divergence classification for deterministic replay differences

External System of Record effects are stubbed. The rehearsal records the exact
stub contract and verifies that no private endpoint, token, or email appears in
committed evidence.

## Required Artifacts

- `outcome.json`
- `queue-metrics.json`
- `evidence-summary.json`
- `report.md`
- `restart-persistence.json`
- `browser-qa-evidence.json`
- `redaction-audit.json`
- `divergence-classification.json`
- `external-sor-stubs.json`

## Operator Verification Path

The browser evidence boundary is intentionally executable by an operator:

1. Start the production-like local stack and seed data:
   `npm run dev:all`, `npm run dev:seed`, `npm run seed:cockpit-live:validate`.
2. Start Cockpit live mode with real auth/API boundaries:
   `VITE_PORTARIUM_API_BASE_URL=http://localhost:8080 VITE_PORTARIUM_ENABLE_MSW=false npm run cockpit:dev`.
3. Use agent-browser against `http://cockpit.localhost:1355`.
4. Verify Inbox queue triage, Approval detail review, decision submit, Run resume,
   Evidence Log inspection, and redaction spot-check paths.

# ADR-0096 — CI: real Postgres migration apply and integration test gate

**Status:** Accepted
**Date:** 2026-02-22
**Bead:** bead-mig1

## Context

The CI `pr` job previously validated schema migrations only via dry-run
(`migrate:check` + `migrate:dry-run:expand`). No real Postgres instance was
ever started and no SQL was executed against a live database. This created a
gap: schema drift between migration SQL and the actual Postgres engine could
go undetected until a deployment failure.

In addition, the store adapter integration tests used `InMemorySqlClient` — a
test-only stub that pattern-matches SQL comments rather than executing SQL.
This meant the data-access code was never exercised against a real engine.

## Decision

1. **Add a `postgres:16-alpine` service container** to the GitHub Actions `pr`
   job. This matches the production database version declared in
   `docker-compose.yml`.

2. **Add `migrate:apply:ci` npm script** — runs `migrate:dry-run:expand` as a
   preflight gate, then runs `migrate:apply` (= `cli.ts bootstrap`) to apply
   all expand-phase migrations against the live service container.

3. **Add `migrate:apply:deploy` npm script** — same sequence for the CD
   workflow. The CD `deploy` job applies real migrations before rolling out
   new images, gated by the `DATABASE_URL` environment secret.

4. **Add real-DB integration tests** — a new test file
   `postgres-store-adapters.db.test.ts` runs when `DATABASE_URL` is present
   (CI) and skips otherwise (`describe.skipIf`). Covers workspace/run
   persistence, approval/policy round-trip, evidence hash chaining, and
   workspace tenant isolation against the live Postgres instance.

5. **Increase CI `pr` job timeout** from 10 min to 15 min to accommodate the
   postgres startup and migration apply step.

## Consequences

- **Positive:** Schema drift is caught in CI before any deployment. A migration
  that fails on real Postgres will fail the PR job, not a production deployment.
- **Positive:** The real-DB integration tests verify that SQL queries, upsert
  semantics, and tenant isolation actually work against Postgres.
- **Positive:** The CD workflow applies migrations automatically before
  deploying, removing the manual bootstrap step from operator runbooks.
- **Trade-off:** Each PR now starts a Postgres service container, adding
  ~30–60 s to CI wall-clock time and slightly increasing GitHub Actions compute
  cost. The correctness benefit outweighs this cost.
- **Neutral:** Local `npm run test` is unaffected; the new DB tests are skipped
  when `DATABASE_URL` is unset.
- **Operator action required:** The `DATABASE_URL` secret must be set in the
  GitHub environment secrets for each deployment environment (dev/staging/prod)
  for the CD migration apply step to take effect. Until the secret is set, CD
  continues to run dry-run only (with a `::warning::` annotation in the job log).

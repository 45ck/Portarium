# Adoption Readiness Checklist

Complete all items before promoting a Portarium deployment to production (L3 → L4).

## Security

- [ ] **JWT claim schema validated** — Run `npm run test -- src/infrastructure/auth/jwt-claim-schema-v1.test.ts`; all assertions pass.
- [ ] **Dependency vulnerability audit clean** — Run `npm run audit:high`; no HIGH or CRITICAL vulnerabilities in production dependencies.
- [ ] **Secret scanning passed** — Run `npm run scan-secrets` or equivalent; no hardcoded credentials in codebase.
- [ ] **OpenFGA access control model deployed** — `openfga/model.json` loaded into production OpenFGA instance; authorization tests pass.

## Data and storage

- [ ] **Tenant storage tier configured** — Each production tenant has a storage tier assigned (Standard or Archive).
- [ ] **Evidence durability adapter configured** — Either S3 WORM bucket with Object Lock enabled, or FileSystem adapter accepted in writing by security.
- [ ] **Schema migrations applied** — Run `npm run migrate:apply:ci` against production database; `Schema migration registry OK` reported.
- [ ] **Data residency documented** — Region of data storage recorded in the tenant configuration manifest.

## Observability

- [ ] **OpenTelemetry export endpoint configured** — `OTEL_EXPORTER_OTLP_ENDPOINT` set; traces visible in APM dashboard.
- [ ] **Health endpoint monitored** — `GET /health` monitored with ≤ 30 s alert threshold.
- [ ] **Structured logging enabled** — Log output is JSON (pino); log level set to `info` or higher.

## Infrastructure

- [ ] **Database connection pool tuned** — `DATABASE_POOL_MAX` set appropriately for expected concurrent connections.
- [ ] **TLS termination in place** — All external traffic terminates TLS at load balancer or ingress.
- [ ] **Secrets managed via vault/secret manager** — No plaintext secrets in environment manifests.

## Governance

- [ ] **Approval workflows configured** — At least one workflow definition includes an approval gate.
- [ ] **Evidence chain verified** — Run `npm run sdk:verify` against a sample run; chain integrity confirmed.
- [ ] **Rollback plan documented** — Runbook exists for rolling back to previous schema version.

## Sign-off

Once all items are checked, record sign-off in your change management system and advance to
[Adoption Ladder L4](./adoption-ladder.md#l4--full-adopter).

# ADR-0063: Presentation Observability, Deployment and SLOs

**Beads:** bead-0362 (feature flags), bead-0365 (OTel RUM), bead-0370 (rendering), bead-0371 (asset caching), bead-0375 (versioned artefact), bead-0376 (alerting SLOs), bead-0377 (dual-run migration)
**Status:** Accepted
**Date:** 2026-02-18

## Context

The ops-cockpit needs safe, observable production deployment with measurable SLOs and a migration path from the prototype to the production UI.

## Decisions

### Feature-Flag Gated Rollout (bead-0362)

Domain slices enabled in order:

1. **Read-only** (runs list, evidence view, approval queue view) — no commands possible
2. **Approval commands** (approve/deny/request-changes) — requires audit trail
3. **Run commands** (cancel, retry) — requires optimistic state
4. **Admin commands** (adapter registration, agent capability edit)

Flag backend: LaunchDarkly (or simple `featureFlags.json` config for self-hosted).
Flag names: `cockpit.commands.approvals`, `cockpit.commands.runs`, `cockpit.commands.admin`.

### OpenTelemetry Browser Instrumentation (bead-0365)

`@opentelemetry/sdk-trace-web` + `@opentelemetry/instrumentation-fetch` + `@opentelemetry/instrumentation-document-load`.

Traces exported to the Portarium OTEL collector (same endpoint as backend).

Metrics captured:

- `cockpit.navigation.duration` (route load time)
- `cockpit.api.request.duration` (per operationId)
- `cockpit.api.error.rate` (HTTP 4xx/5xx)
- `cockpit.approval.decision.latency` (form open → submit)
- `cockpit.realtime.stale.duration` (seconds without fresh data)

### Static Asset Caching (bead-0371) per RFC 9111

- Hashed assets (`/assets/main.[hash].js`): `Cache-Control: public, max-age=31536000, immutable`
- `index.html`: `Cache-Control: no-cache` (revalidated on every load)
- API responses: `Cache-Control: private, max-age=0, must-revalidate`

CloudFront distribution with S3 origin. Origin access control (OAC) blocks direct S3 access.

### Immutable Versioned Artefact Deployment (bead-0375)

- Each build produces `portarium-cockpit-{semver}-{git-sha}.zip` containing hashed assets
- Deployed to S3 prefix `releases/{version}/`
- CloudFront function rewrites `/` to current `index.html` version
- Rollback: update CloudFront function to point to previous version prefix (< 30 s)
- Old versions retained for 90 days

### Alerting SLOs (bead-0376)

| SLO                       | Target     | Alert threshold     |
| ------------------------- | ---------- | ------------------- |
| Page load (FCP)           | p95 < 2 s  | p95 > 3 s for 5 min |
| Approval decision latency | p95 < 5 s  | p95 > 8 s for 5 min |
| API error rate            | < 1%       | > 2% for 2 min      |
| Stale-data duration       | p95 < 60 s | > 90 s for 10 min   |

Alerts routed to PagerDuty `cockpit-ops` service. SLO burn-rate alerts (1h/6h windows) for early warning.

### Dual-Run Migration Mode (bead-0377)

Phase 1: Deploy new cockpit at `/v2/` subdirectory alongside prototype.
Phase 2: Add `?compare=legacy` query param on new cockpit to show legacy pane side-by-side.
Phase 3: Verify audit parity — both UIs produce identical evidence entries for the same approval action.
Phase 4: Redirect root to `/v2/`; retire prototype.
Phase 5: Remove `/v1/` (prototype) after 30-day stability window.

## Consequences

- Feature flags prevent incomplete features from reaching operators
- OTel RUM provides end-to-end trace correlation (frontend request → backend span)
- Immutable assets enable zero-downtime rollbacks in under 30 seconds
- Dual-run migration reduces risk of switching users to the new UI

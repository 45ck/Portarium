# Supply-Chain Guardrails: Cockpit and Connector Dependencies

Date: 2026-02-23
Bead: `bead-0755`
Owner: Principal Engineer (PE)

## Purpose

Define mandatory supply-chain security controls for Portarium Cockpit and connector
dependencies. These guardrails prevent introduction of vulnerable, malicious, or
license-incompatible packages into the release artifact.

## Scope

Applies to:

- `apps/cockpit/` — the Portarium Cockpit React SPA and its native Capacitor wrapper
- Connector packages consumed via vertical packs or integration adapters
- Any third-party package reachable in the production dependency graph

## Mandatory Controls

### 1. Vulnerability gate (HIGH/CRITICAL)

- `npm run audit:high` runs in `ci:pr` and blocks merge on HIGH or CRITICAL CVEs.
- Only production dependencies are scanned (`--omit=dev`).
- Approved exceptions must be documented in `.nsprc` or `package.json`
  `overrides`/`resolutions` with a justification comment.

### 2. License allowlist gate

- `npm run audit:licenses` runs in `ci:nightly` and blocks on non-OSI-approved licenses.
- Allowed SPDX licenses: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, PostgreSQL,
  CC0-1.0, Unlicense, BlueOak-1.0.0.
- Copyleft (GPL, LGPL, AGPL) and unknown licenses require explicit PE approval.
- Report written to `docs/compliance/vector-graph-license-report.csv`.

### 3. Secret scanning gate

- `scripts/ci/scan-secrets.mjs` runs in `ci:pr` and blocks on hardcoded credentials.
- Scans source files (not node_modules) for patterns: AWS keys, GitHub tokens, Slack
  webhooks, Bearer tokens, private keys.
- Demo content uses only placeholder values that match the script's allowlist.

### 4. Dependency pinning policy

- All direct dependencies in `package.json` use exact versions (no `^` or `~` ranges)
  for security-sensitive packages (auth, crypto, HTTP clients).
- Indirect production dependencies are locked via `package-lock.json` committed to main.
- Dependabot or Renovate PRs reviewed within 5 business days for HIGH/CRITICAL patches.

### 5. Cockpit-specific controls

- Cockpit's `apps/cockpit/package.json` is audited as part of the workspace audit
  (npm workspaces pass `--workspaces` to audit commands).
- Native Capacitor plugins (`@capacitor/*`) are pinned to a known-good minor version
  and reviewed before any major-version upgrade.
- `@capacitor/push-notifications`, `@capacitor/preferences`, `@capacitor/browser`,
  and `@capacitor/app` are all MIT-licensed and OSS-core only.

### 6. Connector dependency controls

- Connector packages (vertical pack adapters) must declare their dependencies in
  `package.json` and pass the same license and vulnerability gates.
- No connector may introduce a GPL/AGPL runtime dependency without PE approval.
- Connector packages are scanned separately in the vertical-pack CI gate
  (`scripts/ci/vertical-pack-publish-gate.mjs`).

## Release Gate Criteria

The supply-chain gate passes only when all of the following are true:

- `audit:high` exits 0 (no HIGH or CRITICAL vulnerabilities in production deps).
- `audit:licenses` exits 0 (all production licenses on allowlist).
- `scan-secrets.mjs` exits 0 (no credential patterns in source).
- `package-lock.json` is committed and up to date.
- Any approved exceptions are documented with CVE ID, justification, and review date.

## Required Artifacts

- This document: `docs/internal/governance/supply-chain-guardrails.md`
- Vulnerability audit script: `scripts/ci/audit-high.mjs`
- License audit script: `scripts/ci/audit-licenses.mjs`
- Secret scan script: `scripts/ci/scan-secrets.mjs`
- License compliance report: `docs/compliance/vector-graph-license-report.csv`
- Vertical pack gate: `scripts/ci/vertical-pack-publish-gate.mjs`

## Rollback Trigger

Any of the following requires immediate rollback and bead re-open:

- A HIGH or CRITICAL CVE is discovered in a production dependency after release.
- A package with a copyleft license is found in the production dependency graph.
- A secret is found in committed source history.

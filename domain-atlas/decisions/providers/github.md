# GitHub

- Provider ID: `github`
- Port Families: `ProjectsWorkMgmt`
- Upstream: `https://github.com/github/rest-api-description`
- Pinned commit: `6c6f1b2a1c8d9ef01a2b3c4d5e6f708192a3b4c5`
- License: `CC-BY-4.0` (`safe_to_reuse`)

## What To Extract Next

- Pull request lifecycle surfaces (`opened`, `synchronize`, `closed`, `merged`) and reviewer/approval states.
- Deployment and deployment-status entities for release evidence.
- Workflow runs and check runs needed for CI status and lead-time telemetry.
- Repository/project metadata needed to scope operations per workspace.

## Current Extraction (Initial)

- CIF: `domain-atlas/extracted/github/cif.json`
- Mapping: `domain-atlas/mappings/github/ProjectsWorkMgmt.mapping.json`
- Capability matrix: `domain-atlas/capabilities/github/ProjectsWorkMgmt.capability-matrix.json`
- Evidence fixtures: `test/fixtures/github/`

## Mapping Notes (Canonical)

- Pull requests are mapped to canonical `Task` for cross-provider work-item semantics.
- Repository, workflow run, and deployment constructs remain `ExternalObjectRef` to avoid canonical overfitting.
- User identities map to canonical `Party` with execution and review role tags at adapter level.

## Capability Matrix Notes

- Read operations default to `Auto`.
- Mutating PR transitions (create/update/merge/comment) default to `HumanApprove`.
- Idempotency is endpoint-dependent; verified-effects mode is preferred when writing.

## Open Questions

- Scope model for GitHub App vs PAT credentials across org/repo boundaries.
- Best default event ingestion mode when webhooks are unavailable (poll cadence and backoff).

# ADR-0125: Release Versioning and Tagging Strategy

**Status:** Accepted
**Date:** 2026-03-09
**Bead:** bead-0915

---

## Context

Portarium has a mature CI/CD pipeline (container builds, Sigstore signing, progressive
delivery via Argo Rollouts) but no release versioning workflow. The `ci-images.yml`
workflow already triggers on `v*` tags, yet no tags have been created. The changelog
at `docs/changelog.md` has a skeletal Unreleased section with no historical entries.
Release analytics (`docs/how-to/release-analytics.md`) targets >= 1 release per quarter
and 100% changelog coverage.

The project needs:

1. A defined versioning scheme compatible with existing pack versioning (ADR-0040, ADR-0045)
2. Tooling to bump versions, collect changelog entries, and create tags
3. A tagging convention that triggers the existing container build pipeline
4. A clear release checklist so any contributor can cut a release

## Decision

### Versioning scheme

Portarium follows **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):

| Bump    | When                                                            |
| ------- | --------------------------------------------------------------- |
| `MAJOR` | Breaking changes to the control-plane HTTP API or domain events |
| `MINOR` | New features, new endpoints, new event types                    |
| `PATCH` | Bug fixes, performance improvements, documentation              |

The version source of truth is `package.json:version`. Pre-1.0 releases follow the
same scheme; the 0.x range signals that the public API is not yet stable.

### Tag convention

Tags use the format `v{MAJOR}.{MINOR}.{PATCH}` (e.g., `v0.2.0`). This matches the
existing `ci-images.yml` trigger on `tags: - 'v*'`.

No pre-release tags (e.g., `v0.2.0-rc.1`) are used initially. If needed later, they
can be added without breaking the existing pipeline.

### Changelog convention

The changelog at `docs/changelog.md` follows **Keep a Changelog 1.1.0**:

- Categories: Added, Changed, Fixed, Removed
- Each entry references the bead ID when applicable
- The `## Unreleased` section accumulates entries between releases
- On release, Unreleased entries move under a dated version header

Entries are collected automatically from:

1. Bead closures in `.beads/issues.jsonl` (primary source)
2. Git commit subjects with conventional prefixes (`feat:`, `fix:`, etc.)
3. Chore/CI/docs/test commits are excluded from the changelog

### Release tooling

Two scripts under `scripts/release/`:

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `collect-changelog.mjs` | Collect entries since last tag; output markdown/JSON |
| `prepare-release.mjs`   | Bump version + update changelog + commit + tag       |

Release workflow:

```bash
# 1. Prepare (bumps version, updates changelog, commits, tags)
node scripts/release/prepare-release.mjs minor

# 2. Push
git push origin main --follow-tags

# 3. GitHub release (optional)
gh release create v0.2.0 --generate-notes
```

The `prepare-release.mjs` script enforces:

- Clean working tree (no uncommitted changes)
- Must be on the `main` branch
- Tag must not already exist
- Supports `--dry-run` for preview

### What this does NOT include

- No automated release-on-merge (releases are intentional, not continuous)
- No npm publish (Portarium is deployed as containers, not an npm package)
- No pre-release channels or release branches
- No conventional commit enforcement via git hooks (too disruptive to adopt now)

## Consequences

- Contributors can cut releases with a single command
- The existing `ci-images.yml` pipeline builds tagged container images automatically
- Changelog coverage is tracked per the release-analytics metrics
- Version bumps are atomic commits with clear `release: X.Y.Z` messages
- Future: if conventional commit enforcement is desired, it can be added as a
  commit-msg hook without changing the release scripts

## Alternatives considered

1. **semantic-release** — fully automated, but requires strict conventional commits
   across all contributors and removes human judgment from release timing.
2. **changesets** — designed for monorepo npm publishing; adds ceremony
   (changeset files per PR) that doesn't fit the bead workflow.
3. **Manual changelog only** — current state; error-prone and produces empty changelogs.

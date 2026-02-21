# Third-Party Workflow UI Licensing Gate

Date: 2026-02-21
Bead: `bead-0750`
Owner: Principal Engineer (PE)

## Purpose

Define a mandatory licensing gate before adopting any third-party cockpit/workflow UI component
into Portarium.

This is an engineering governance control, not legal advice.

## Scope

Applies to any third-party UI/runtime surface used for:

- Workflow authoring/editing
- Cockpit UI components
- Embedded execution product shells
- Plugin/extension packs shipped with those products

## Mandatory Checklist

1. License classification recorded

- Capture SPDX identifier for the core project and each plugin/package in scope.
- Record source URL and pinned version/commit in intake notes.

2. Distribution and commercial model checked

- Confirm whether use is permissive for commercial distribution and multi-tenant SaaS.
- Flag source-available/fair-code terms that limit hosting, resale, white-label, or embed use.

3. Embed/white-label terms verified

- If product UI is embedded or white-labeled, capture explicit terms for that mode.
- If a commercial embed agreement is required, mark status as blocked until approved.

4. Notice and attribution obligations defined

- MIT: preserve copyright and permission notices in redistributed artifacts.
- Apache-2.0: preserve `LICENSE` and `NOTICE` requirements in distributed artifacts.
- Record where third-party notices will be stored in Portarium release artifacts.

5. Copyleft and unknown-license controls enforced

- Block GPL/AGPL/unknown-license dependencies in critical path unless approved by legal.
- Record approved exceptions and expiration/review date.

6. Plugin/extension ecosystem scanned

- Review plugin/piece/pack licenses separately from core runtime license.
- Block enabling plugins with incompatible or unknown license terms.

7. Tenant and credential boundary compatibility checked

- Confirm external product does not force credential-sharing models incompatible with Workspace
  isolation.
- Document boundary controls for secrets, token scope, and Workspace scoping.

8. Gate evidence linked

- Link this checklist outcome in the governing bead body or closure note.
- Link the target ADR/research doc that depends on this licensing decision.

## Release Gate Criteria

The release gate is considered pass only when all are true:

- Checklist items 1-8 are complete and recorded.
- Owner sign-off exists: Principal Engineer (PE).
- Any embed/commercial-license requirement is either:
  - approved with documented terms, or
  - explicitly rejected with fallback path documented.
- `npm run ci:pr` has been run for the bead closure commit.

## Required Artifacts

- This checklist: `docs/governance/third-party-workflow-ui-license-gate.md`
- Related platform audit (if applicable): `docs/governance/external-execution-platform-license-audit.md`
- Strategy linkage (if applicable): `docs/adr/0078-agentic-workflow-cockpit-reuse-vs-build-strategy.md`

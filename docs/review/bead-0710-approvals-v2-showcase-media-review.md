# Review: bead-0710 (Approvals v2 showcase media + README embed)

## Scope

- Capture a polished approvals v2 showcase artifact for repository-facing documentation.
- Embed the showcase media in the root `README.md`.

## Changes

- Added animated showcase media:
  - `docs/ui/cockpit/media/approvals-v2-showcase.gif`
- Updated root documentation:
  - `README.md` now includes a **Feature Showcase** section with an embedded approvals v2 GIF and explanatory copy.

## Validation

- Confirmed the GIF renders locally from repository path.
- Ran `npm run ci:pr` to ensure project quality gates remain green after documentation/media changes.

## Risk Assessment

- Low risk.
- No runtime or domain behavior changes; docs/media only.

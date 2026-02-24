# Review: bead-0710 (Approvals v2 showcase capture + README embed)

## Scope Reviewed

- Reproducible showcase generation script for approvals-v2 flow.
- README embedding of showcase media.
- Cockpit demo docs updates for regeneration instructions.

## Artifacts

- Script: `scripts/qa/render-approvals-v2-showcase.mjs`
- Media: `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.gif`
- Metadata: `docs/internal/ui/cockpit/demo-machine/showcase/approvals-v2-approval-gate.json`
- README embed: `README.md`
- Demo docs updates: `docs/internal/ui/cockpit/demo-machine/README.md`

## Verification Evidence

- `npm run cockpit:demo:approvals-v2:showcase`
- `npm run ci:pr`

## Findings

- No blocking defects found in the implemented scope.

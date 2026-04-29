# Project Intent Planning V1

## Scope

Portarium can turn a human, ops, or agent trigger into a reviewable project plan before any bead worktree is created.

## Contract

- `POST /v1/workspaces/{workspaceId}/intents:plan` accepts:
  - `triggerText`: natural language operator intent.
  - `source`: `Human`, `Ops`, or `Agent`; defaults to `Human`.
  - `constraints`: optional text constraints carried into proposals.
- The route authenticates against the workspace and requires the caller to be allowed to start governed work.
- The response includes:
  - `intent`: normalized `ProjectIntent`.
  - `plan`: `PlanV1` with one planned effect per proposed bead.
  - `proposals`: `BeadProposal[]`, each with `executionTier`, `specRef`, and planned effect IDs.
  - `artifact`: markdown Plan Artifact for human confirmation.
- The endpoint is planning-only. It must not create git worktrees, claim beads, or mutate the bead tracker.

## Cockpit

- `Ctrl+K` exposes a command to open the planning surface.
- The planning surface accepts natural language, shows the Plan Artifact, and lists proposed beads.
- The approval control confirms the plan artifact only; later workflow phases create worktrees after approval.

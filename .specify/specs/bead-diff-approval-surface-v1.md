# Bead Diff Approval Surface v1

## Intent

Operators must be able to review what an agent intends to change before
approving a bead-linked action from Cockpit.

## API Contract

`GET /v1/workspaces/:workspaceId/beads/:beadId/diff` returns an ordered array of
diff hunks for the bead approval packet.

Each hunk includes:

- `hunkId`
- `filePath`
- `changeType`
- old/new line ranges
- unified diff lines with `op`, `content`, `oldLineNumber`, and `newLineNumber`

The endpoint requires authenticated read access. It returns:

- `200` with diff hunks when available
- `401` for unauthenticated callers
- `404` when no diff exists for the bead
- `422` for unsafe bead identifiers
- `501` when bead diff lookup is not configured

## Cockpit Behaviour

`DiffApprovalSurface` is a full-page review surface. It must show:

- bead and approval identifiers
- policy tier, rationale, blast radius, and irreversibility
- the full diff
- SoD eligibility
- the last three relevant evidence entries
- decision controls for approve, deny, and request changes

Decision controls remain disabled until the operator has reached the end of the
diff and entered a rationale of at least 10 characters.

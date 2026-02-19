# Cycle Gate: Implementation Linkage

This gate enforces:

- no implementation bead starts without design/spec linkage, and
- no implementation bead starts without review linkage.

Implementation is enforced via:

- `scripts/beads/check-bead-prerequisites.mjs --cycle-gate`
- linkage registry at `.beads/bead-linkage-map.json`

## Usage

Check one bead:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-0298 --cycle-gate --json
```

List all startable beads under cycle gate:

```bash
node scripts/beads/check-bead-prerequisites.mjs --next --cycle-gate --json
```

## Linkage Registry Contract

Each entry in `.beads/bead-linkage-map.json` may define:

- `specBeads`: bead IDs for design/spec artifacts
- `specPaths`: files (typically `.specify/specs/*.md`) that define behavior
- `reviewBeads`: bead IDs for planned or completed reviews

Example:

```json
{
  "bead-0298": {
    "specPaths": [".specify/specs/port-v1.md"],
    "reviewBeads": ["bead-0263"]
  }
}
```

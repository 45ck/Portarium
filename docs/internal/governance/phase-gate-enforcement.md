# Phase Gate Enforcement

Phase transition beads (`bead-0161` through `bead-0168`) are enforced with
an explicit requirements map and validated by the prerequisite resolver.

## Enforcement Inputs

- checker: `scripts/beads/check-bead-prerequisites.mjs`
- gate map: `.beads/phase-gate-map.json`

## Usage

Check one phase gate:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-0161 --phase-gate --json
```

Evaluate all startable open beads while enforcing phase-gate logic on gate beads:

```bash
node scripts/beads/check-bead-prerequisites.mjs --next --phase-gate --json
```

## Map Contract

Each key in `.beads/phase-gate-map.json` is a gate bead ID.

```json
{
  "bead-0161": {
    "name": "Foundation complete",
    "requirements": [
      {
        "label": "Gate controls",
        "beads": ["bead-0158", "bead-0159", "bead-0160"]
      }
    ]
  }
}
```

Validation behavior:

- every listed bead must exist in `.beads/issues.jsonl`
- every listed bead must have `status: "closed"`
- unresolved requirements block readiness for the phase gate
- malformed or missing gate definitions are reported as missing prerequisites

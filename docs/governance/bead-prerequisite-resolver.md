# Bead Prerequisite Resolver

`scripts/beads/check-bead-prerequisites.mjs` validates whether a bead is ready
to start based on unresolved `blockedBy` prerequisites in `.beads/issues.jsonl`.

## Usage

Check a specific bead:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-0159
```

Machine-readable result:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-0159 --json
```

List all currently startable open beads:

```bash
node scripts/beads/check-bead-prerequisites.mjs --next
```

## Exit Codes

- `0`: ready (or at least one ready bead when using `--next`)
- `1`: bead is not ready due to unresolved prerequisites
- `2`: invalid input (missing bead id, unknown bead id, or bad invocation)

## Resolution Model

- A prerequisite is unresolved when a bead listed in `blockedBy` is not `closed`.
- A prerequisite is invalid when a `blockedBy` reference does not exist.
- A bead is startable only when:
  - its status is `open`, and
  - it has no unresolved/invalid prerequisites.

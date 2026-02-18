# Code Review: bead-0063 (Domain Scaffold Structure)

Reviewed on: 2026-02-18

Scope:

- Domain layer folder structure (`src/domain/*`)
- Branded primitives usage and export surfaces
- Parser/toolkit consistency (`src/domain/validation/*`)
- Architecture boundaries (domain has no infrastructure/presentation imports)

## Findings

### High

- None found.

### Medium

- `docs/domain/README.md` describes an `src/domain/entities/` structure that does not exist in the current codebase.
  - Impact: Contributors may follow the docs and place new domain code in a non-existent location, or assume entity/aggregate layout that has already been refactored.
  - Recommendation: Update `docs/domain/README.md` to reflect the real folder structure (aggregates split across `workspaces/`, `workflows/`, `runs/`, etc.) and remove the outdated example tree.

### Low

- Barrel exports in `src/domain/index.ts` are broad and may increase accidental coupling at higher layers.
  - Impact: Application/infrastructure code may import from `src/domain/index.ts` instead of a narrower module, making boundaries less explicit.
  - Recommendation: Keep the broad barrel for external consumers, but prefer internal imports from specific domain submodules in first-party code where practical.

## Notes

- The domain is organised into bounded submodules (e.g. `evidence/`, `policy/`, `ports/`, `work-items/`) and is kept free of runtime infrastructure concerns, consistent with the hexagonal architecture rules.
- Branded primitives are present and used broadly, reducing accidental ID/type mixing risks.
- Parsing utilities in `src/domain/validation/` are consistently used by the `*V1` schema parsers, keeping the domain error surface predictable.

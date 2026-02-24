# ADR-0036: Product Identity -- Portarium

## Status

Accepted

## Context

The project needs a clear product identity for public release. The internal architecture acronym "VAOP" (Vertical Autonomous Operations Provider) describes the architecture pattern but is not a compelling product name. A distinct product name is needed for the repository, documentation, and public-facing materials.

## Decision

**Portarium** is the product and repository name. **VAOP** remains the internal architecture acronym used in technical documentation, code comments, and domain model references.

- All public-facing materials, the repository name, package name, and project title use "Portarium."
- The codebase standardises on "VAOP" for the architecture pattern (avoid "VOAP" or other misspellings).
- ADRs and domain docs may reference VAOP as the architecture; user-facing docs and README use Portarium.

## Consequences

- Clear product identity for open-source release.
- Two names to maintain (Portarium for product, VAOP for architecture).
- Existing internal docs retain VAOP references.
- New contributors learn both names.

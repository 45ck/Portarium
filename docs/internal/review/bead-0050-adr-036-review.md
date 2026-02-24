# bead-0050 ADR-0036 review: Portarium naming consistency

## Scope reviewed

- Package metadata and README product labels.
- Public API specification description.
- Error-envelope and client problem-type URIs.
- Telemetry metadata labels (`com.portarium.*`, `portarium.control-plane.*`, client label header).

## Findings

- Product-facing docs/spec/package naming now consistently uses Portarium for required surfaces.
- External interfaces use Portarium naming:
  - Problem Details URIs use `https://portarium.dev/problems/...`.
  - CloudEvents namespace uses `com.portarium.*`.
  - Event sources use `portarium.control-plane.*`.
  - Client metadata uses `X-Client: portarium-presentation`.
- One remaining `vaop` token is in a research-programme filename reference (`docs/internal/research/vaop-mvp-domain-atlas-research-programme.md`) and is treated as legacy artifact naming, not product-facing interface metadata.

## Outcome

- ADR-036 naming review criteria satisfied for docs/package/external interface surfaces.
- Full `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline

# ADR-0061: Presentation Security Controls

**Beads:** bead-0356 (CSP), bead-0357 (command payload encoding), bead-0358 (CSRF), bead-0367 (Trusted Types), bead-0368 (HSTS)
**Status:** Accepted
**Date:** 2026-02-18

## Context

The ops-cockpit processes sensitive approval decisions and evidence data. OWASP Top 10 risks relevant to this UI: A03 Injection (XSS), A01 Broken Access Control, A07 Auth failures.

## Decisions

### CSP (Content Security Policy)

Stage 1 (report-only): Deploy `Content-Security-Policy-Report-Only` via CloudFront response headers function.

```
default-src 'self';
script-src 'self' 'nonce-{per-request}';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://api.portarium.io wss://events.portarium.io;
img-src 'self' data:;
frame-ancestors 'none';
report-uri /csp-report
```

Stage 2 (enforce): After 2-week report-only period with zero violations.

### Command Payload Encoding

- All command inputs (approval rationale, workflow definition, adapter credentials) validated server-side with Zod schemas at the application boundary
- Frontend: `textContent` or React's default JSX rendering (not `dangerouslySetInnerHTML`) for all user-provided content
- `encodeURIComponent` for any URL-embedded parameters
- Workflow YAML/JSON definition strings rendered in `<pre><code>` blocks (escaped by React)

### CSRF

Cookie-based auth (HttpOnly, SameSite=Strict) eliminates classical CSRF for same-site API calls.
For cross-origin triggers (webhooks, pack callbacks): verify `Origin` header server-side and require explicit `X-Portarium-Request: 1` header on state-mutating requests.

### Trusted Types

Pilot on workflow builder screen (highest JS manipulation surface):

- `trustedTypes.createPolicy('portarium-default', { createHTML: sanitizeWithDOMPurify })`
- All other DOM manipulation via React (no direct `innerHTML`)
- Browser support check: enforce in Chrome/Edge; skip enforcement in Firefox/Safari until wider support

### HSTS

`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` enforced via CloudFront response header policy for all production domains.
Preload submission after 6-month stable operation.

## Consequences

- CSP blocks injected scripts even if XSS is present
- Trusted Types eliminates DOM XSS class at compile time (where enforced)
- HSTS prevents protocol downgrade attacks
- SameSite=Strict cookies eliminate CSRF without token management
- Report-only stage catches legitimate inline script usage before enforcement breaks UX

## Implementation Mapping

- Closed implementation coverage:
  - `bead-0356`
  - `bead-0357`
  - `bead-0358`
  - `bead-0367`
  - `bead-0368`
- ADR linkage verification review bead:
  - `bead-0617`

## Review Linkage

- `docs/internal/review/bead-0617-adr-0061-linkage-review.md`

# ADR-0100 — JWT Short-Expiry Policy and Token Revocation Risk Acceptance

**Status:** Accepted
**Date:** 2026-02-23
**Bead:** bead-rv3k (resolved via bead-y0ac)
**Report:** docs/internal/research/report-29.md, finding #5

---

## Context

Portarium uses stateless JWT Bearer tokens for authentication. JWTs are validated via
a JWKS endpoint (`PORTARIUM_JWKS_URI`). Because JWTs are self-contained and signed,
there is **no server-side revocation mechanism** — a stolen or leaked token remains
valid until it expires.

Report-29 (Security, 2026-02) identified this as a **Medium** risk and recommended
either short-lived tokens with a refresh flow, or an explicit token denylist/introspection
endpoint.

---

## Decision

**Use short-lived JWTs as the primary revocation mitigation.**

Specifically:

1. **Token expiry (`exp`) MUST be set by the issuing Identity Provider (IdP) to a
   maximum of 15 minutes** for access tokens used with the Portarium API.

2. **Refresh tokens** (if used) should be issued with a maximum lifetime of 24 hours
   and should be rotated on each use.

3. **Portarium does not implement a token denylist** in this release. The risk
   acceptance rationale is:
   - A 15-minute window limits the blast radius of token theft to a narrow window.
   - Implementing a denylist requires a shared distributed store (Redis) across
     all control-plane instances; this is a future-phase concern (see Alternatives).
   - The primary attack surface (mobile Cockpit + direct API) is already guarded
     by short expiry and PKCE.

4. **Bootstrap check:** If `PORTARIUM_JWKS_URI` is set and the issuing IdP supports
   `exp` in the metadata, the control-plane bootstrap SHOULD log a warning if the
   expected token lifetime exceeds 15 minutes (determined from OIDC `access_token_lifetime`
   or equivalent metadata).

5. **PKCE enforcement:** The Cockpit mobile app uses PKCE (ADR-0088) and `offline_access`
   scopes; refresh tokens are stored in the secure keychain, not localStorage.

---

## Consequences

### Positive

- No additional infrastructure required for the current release.
- 15-minute access token windows align with OWASP's short-lived JWT recommendations
  and NIST SP 800-63B guidance on session timeouts.
- PKCE + short access tokens + secure refresh storage gives strong end-to-end
  protection for the mobile client.

### Negative / Accepted Risks

- **Logout latency:** A revoked or logged-out user's access token remains technically
  valid for up to 15 minutes after logout. Operators should account for this in
  security incident response procedures.
- **Compromised refresh token:** If a refresh token is stolen from the secure keychain,
  the attacker can obtain new access tokens for up to 24 hours. This risk is mitigated
  by device-level protections (biometrics, PIN).
- **Long-lived server tokens (M2M):** Machine-to-machine tokens for automation
  workflows may require longer expiry windows. These should use a dedicated client
  credential flow with narrow scopes, not user JWTs.

---

## Alternatives Considered

### Token Denylist (Redis)

A Redis-based denylist would allow immediate revocation upon logout or credential
compromise. This is the gold standard for stateless JWT revocation.

Rejected for the current release because:

- Requires a Redis cluster in all production deployments.
- Adds latency to every authenticated request (denylist lookup).
- Planned as a future hardening item once Redis is already in the stack for
  rate-limiting (bead area: infra/rate-limit-redis).

### Opaque Session Tokens

Replace JWTs with server-issued opaque tokens backed by a session store.

Rejected because:

- Breaks the stateless horizontal-scaling model of the control-plane.
- Incompatible with the existing OIDC/JWKS ecosystem.

### Token Binding (DPoP)

RFC 9449 DPoP (Demonstrating Proof of Possession) binds a token to the client's
private key, preventing replay by a different client even if the token is stolen.

Noted as a future hardening option for high-value operator flows (ADR research item).

---

## Compliance Mapping

| Control            | Standard          | Satisfied by this ADR?                |
| ------------------ | ----------------- | ------------------------------------- |
| Session timeout    | NIST SP 800-63B   | ✅ max 15 min access token expiry     |
| Token revocation   | OWASP ASVS V3.3.3 | ⚠️ Partial — logout latency ≤ 15 min  |
| Credential storage | OWASP MASVS L1    | ✅ Secure keychain for refresh tokens |
| Short-lived tokens | OWASP Top 10 A07  | ✅ max 15 min                         |

---

## Links

- docs/internal/research/report-29.md — finding #5 (token revocation)
- ADR-0088 — PKCE flow for mobile Cockpit
- src/infrastructure/auth/jose-jwt-authentication.ts — JWT validation
- src/presentation/ops-cockpit/cockpit-demo-machine-scripts.test.ts — JWT decode tests

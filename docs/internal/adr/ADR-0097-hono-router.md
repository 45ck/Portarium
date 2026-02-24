# ADR-0097 — Migrate control-plane HTTP routing to Hono

**Status:** Accepted
**Date:** 2026-02-23
**Author:** m5 (bead-e1bh)

---

## Context

The control-plane HTTP server uses a hand-rolled regex routing table in
`src/presentation/runtime/control-plane-handler.ts`. Routes are represented as
`{ method, pattern: RegExp, handle }` records iterated in a `for` loop.

Problems with the current approach:

- Route patterns are brittle (`([^/]+)` capture groups for every path parameter)
- Path parameters require positional extraction (`match[1]`, `match[2]`)
- The `dispatchRoute` loop has O(n) matching
- No framework-enforced structure for middleware ordering
- New routes require manual regex construction and ordering
- No built-in method-not-allowed (405) handling — wrong-method requests fall through to 404

## Decision

Migrate to **Hono** (v4) as the routing framework.

### Hono vs Fastify

| Criterion                     | Hono                | Fastify                  |
| ----------------------------- | ------------------- | ------------------------ |
| Bundle size                   | ~14 KB (core)       | ~60 KB + plugins         |
| Dependencies                  | 0                   | 10+                      |
| TypeScript                    | First-class         | Good                     |
| Routing engine                | Trie + RegExp       | Radix tree (find-my-way) |
| Path param syntax             | `:param` named      | `:param` named           |
| Named RegExp groups in routes | Yes (v4+)           | No                       |
| Node.js integration           | `@hono/node-server` | Native                   |
| Edge/Node parity              | Yes                 | No                       |
| Middleware pattern            | `app.use()`         | hooks/plugins            |

**Hono is chosen** because:

1. Zero production dependencies (simpler supply chain)
2. Smaller footprint appropriate for a focused control-plane
3. Named RegExp route groups handle the non-standard `location-events:stream` path
4. TypeScript generics for `Env` (Bindings + Variables) provide type-safe context threading
5. Aligns with a potential future edge-deployment target

Fastify would be preferred if the team needed a richer plugin ecosystem (multipart, schema
validation via Ajv, etc.) — none of which are required here.

## Integration pattern

Because the existing infrastructure uses a Node.js `http.Server` (via `health-server.ts`),
the migration uses Hono as a **pure routing and middleware layer** rather than a full HTTP
server replacement:

1. A `Hono<HonoEnv>` app is created per `createControlPlaneHandler()` call.
2. Each incoming `(IncomingMessage, ServerResponse)` pair is wrapped in a minimal synthetic
   `Request` (method + URL only — no body) and fed to `app.fetch(req, { incoming, outgoing })`.
3. Hono middleware and route handlers access the raw Node.js objects via `c.env.incoming` /
   `c.env.outgoing` and write responses directly using the existing `respondJson` /
   `respondProblem` utilities.
4. The `Response` returned by `app.fetch()` is discarded — HTTP responses have already been
   written to `outgoing` as a side effect of the route handlers.

This keeps `health-server.ts` unchanged and allows incremental migration.

## Consequences

- **Positive:** Named path parameters (`:workspaceId`, `:runId`, etc.) replace fragile
  regex capture group indices. Route ordering is explicit and declarative.
- **Positive:** Middleware (`rate-limit`, `context-build`) is attached via `app.use()`,
  making the middleware chain visible at a glance.
- **Positive:** `app.notFound()` and `app.onError()` replace ad-hoc fallback logic.
- **Trade-off:** The `app.fetch()` response is a phantom (discarded). This is intentional
  for compatibility with the existing response-writing pattern but means Hono's Response API
  is unused. A future refactor could move response serialisation into Hono handlers
  (returning `c.json()`) and remove the `respondJson`/`respondProblem` utilities.
- **Neutral:** `hono` is added as a production dependency (~14 KB, 0 transitive deps).

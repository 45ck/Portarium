# Application Layer Work Backlog

## Backlog ordering

Priority is sorted by dependency order and delivery risk:

1. Foundations (skeleton, conventions, error taxonomy)
2. Core behaviours (AuthN/AuthZ, commands, idempotency, outbox)
3. Product primitives (workflows, approvals, evidence, CloudEvents)
4. Read path and hardening (query model, caching, observability, rate limits)
5. Protocol and API strategy (transport, versioning, GraphQL BFF eval)
6. Security and compliance
7. Testing pyramid (unit, integration, contract, load, E2E)
8. CI/CD and deployment
9. Release and runbooks

## Epics and stories

### EPIC-A01 — Application layer skeleton and conventions

Goal: establish the directory structure, shared types, handler signatures, and conventions.

- STORY-A01.1 — **DONE** (code exists)
  - `src/application/` directory structure: `common/`, `commands/`, `queries/`, `ports/`, `events/`.
  - AC: barrel exports in place; lint/typecheck green.
- STORY-A01.2 — **DONE** (code exists)
  - Shared `Result<T, E>` type and `AppError` taxonomy in `src/application/common/`.
  - AC: `Ok<T>` / `Err<E>` discriminated union; error kinds: Forbidden, ValidationFailed, Conflict, NotFound, DependencyFailure.
- STORY-A01.3 — **DONE** (code exists)
  - `AppContext` type with `tenantId`, `principalId`, `roles`, `correlationId`.
  - AC: every handler requires `AppContext` as first argument.
- STORY-A01.4 — **DONE** (code exists)
  - `CommandBus` and `QueryBus` with typed handler registration and dispatch.
  - AC: duplicate registration throws; unknown command returns DependencyFailure.
- STORY-A01.5 — bead-0312
  - Application-layer implementation roadmap: scope and acceptance criteria for remaining core use-cases.
  - AC: roadmap document covers register-workspace, start-workflow, submit-approval, and all remaining use-cases.

### EPIC-A02 — AuthN/AuthZ and tenancy guards

Goal: enforce authentication, authorisation, and tenant isolation at every application boundary.

- STORY-A02.1 — bead-0016
  - IAM MVP: workspace users, RBAC roles, auth integration.
  - AC: role mapping strategy defined; token claims mapped to AppContext.
- STORY-A02.2 — bead-0299
  - Authorisation actions and forbidden-action typing contract (.specify specs, ADR).
  - AC: every command/query has a named action; Forbidden error carries action name.
- STORY-A02.3 — bead-0328
  - Authentication/authorization production hardening (OIDC validation claims, tenancy checks, role scoping, token refresh/rotation).
  - AC: OWASP API1 (BOLA) scenarios tested; deny-by-default for unknown roles/scopes.
- STORY-A02.4 — bead-0195
  - Tenant-isolated fixture factories for every aggregate and port operation.
  - AC: cross-tenant leakage blocked in tests.
- STORY-A02.5 — bead-0196
  - Review: verify tenant-isolated fixtures block cross-tenant leakage in tests and docs.
- STORY-A02.6 — bead-0318
  - Policy/authorization matrix for all app commands and queries (APP_ACTIONS coverage + tenant-aware checks).
  - AC: every command/query has a named action with tenant-scoped authorization check.
- STORY-A02.7 — bead-0417
  - Implement production-grade JWT validation and principal extraction against `bearerAuth` defined in OpenAPI contract.
  - AC: invalid/expired tokens rejected with 401; claims extracted to `AppContext`; tenant scoping enforced on every request.
- STORY-A02.8 — bead-0418
  - Wire `AuthorizationPort` to a real authorisation system (Keycloak OIDC + OpenFGA fine-grained authz) with role gating per OpenAPI route.
  - AC: each role (`admin`, `operator`, `approver`, `auditor`) enforced at every route; deny-by-default for unknown roles; OWASP BOLA scenarios pass.

### EPIC-A03 — Command framework, idempotency, and outbox

Goal: reliable command execution with exactly-once publishing intent.

- STORY-A03.1 — **DONE** (code exists)
  - Command handlers: `register-workspace`, `start-workflow`, `submit-approval`.
  - AC: handlers follow `(ctx, input) => Result<T, AppError>` signature.
- STORY-A03.2 — **PARTIALLY DONE** (ports exist)
  - Idempotency store port (`ports/idempotency.ts`) and Unit of Work port (`ports/unit-of-work.ts`).
  - AC: ports defined; infrastructure adapters pending (bead-0335).
- STORY-A03.3 — bead-0316
  - Outbox + event dispatcher for atomic publish of CloudEvents with idempotency and retry semantics.
  - AC: event publishing survives transient bus failure; outbox retry works.
- STORY-A03.4 — bead-0319
  - Missing command/query handlers for workspace/run/approval lifecycle (list, read, search, pagination).
  - AC: full CRUD surface for core aggregates.
- STORY-A03.5 — bead-0340
  - Complete remaining application-layer use-cases beyond the initial three.
- STORY-A03.6 — bead-0332
  - Refactor start-workflow.ts: reduce complexity (22→≤10) and cognitive-complexity (21→≤15) via helper extraction.
  - AC: ESLint complexity rules pass; no behaviour change.
- STORY-A03.7 — bead-0384
  - HTTP precondition support for optimistic concurrency (ETag, If-Match, 412 Precondition Failed).
  - AC: conflicting updates return 409/412; precondition headers propagated through command flow.

### EPIC-A04 — Workflows, approvals, evidence, and CloudEvents

Goal: durable execution with human-in-the-loop and immutable evidence trail.

- STORY-A04.1 — bead-0314
  - Durable workflow adapter integration (start activity, await signals, retry/backoff policy, deterministic execution boundary).
  - AC: workflow/activity split enforced; determinism checks in place.
- STORY-A04.2 — **PARTIALLY DONE** (submit-approval command exists)
  - Approval wait/signal pattern for human-in-the-loop decisions.
  - AC: complete scenario: start workflow → require approval → apply decision → resume.
- STORY-A04.2b — bead-0419
  - Close submit-approval `RequestChanges` gap — current command rejects `RequestChanges`; implement approval cycle support with re-route to initiator.
  - AC: `RequestChanges` decision persists in evidence; workflow signal re-routes to initiator for revision; regression test covers full cycle.
- STORY-A04.2c — bead-0425
  - Implement Temporal worker execution loop: resolve approvals, build plan, execute via adapter, collect verified effects, compute planned-vs-verified diff, write evidence, transition run status.
  - AC: end-to-end run reaches `Succeeded` status; evidence entries written with hash chain; diff computed and stored.
- STORY-A04.2d — bead-0426
  - Idempotent workflow start — repeated `StartWorkflow` with same idempotency key returns same `runId` without creating duplicate Temporal executions.
  - AC: second call with same idempotency key returns existing run; no duplicate Temporal workflow started; idempotency tested under concurrent retry.
- STORY-A04.3 — bead-0041
  - CloudEvents envelope implementation for all event emission points and subscription contracts.
  - AC: events use CloudEvents v1 envelope; type, source, subject fields populated.
- STORY-A04.4 — bead-0310
  - Evidence/audit schema debt clean-up (CloudEvent time, tenant correlation, evidence chain timestamp consistency).
  - AC: immutable evidence entries emitted; integrity metadata present.
- STORY-A04.5 — bead-0383
  - Event schema versioning governance (CloudEvents type versioning rules, schema registry pattern, consumer resilience).
  - AC: versioning rules documented; breaking changes detectable; consumers resilient to additive changes.
- STORY-A04.6 — bead-0308
  - Repository-level aggregate invariants (workspace policy, cross-aggregate uniqueness checks) enforced at application boundaries.

### EPIC-A04b — External execution plane integration

Goal: decouple workflow action dispatch from Temporal-only implementation via typed ports and trigger routing.

- STORY-A04b.1 — bead-0409
  - External action runner port interface for dispatching workflow actions to external execution planes (Activepieces, Langflow, future).
  - AC: `ActionRunner` port defined in `src/application/ports/`; implementation-agnostic; each execution plane registers as an adapter.
- STORY-A04b.2 — bead-0411
  - Trigger-to-execution-plane routing — route `TriggerKind` (`Cron` / `Webhook` / `DomainEvent` / `Manual`) to the correct execution plane adapter at workflow start.
  - AC: `DomainEvent` and `Webhook` triggers dispatch to Activepieces; agentic steps dispatch to Langflow; routing is configurable; unit tests cover all four kinds.

### EPIC-A04c — Machine runtime application integration

Goal: application layer ports and command handlers for machine/agent registration and invocation.

- STORY-A04c.1 — bead-0432
  - `MachineInvokerPort` — port interface for invoking external machine/agent runtimes: `runAgent(...)` (via `/v1/responses`) and `invokeTool(...)` (via `/tools/invoke`) with credential injection contract and correlated error taxonomy.
  - AC: port defined in `src/application/ports/`; `MachineInvokerResult` discriminated union; no infra imports in port.
- STORY-A04c.2 — bead-0433
  - "Agent Task" action execution path in workflow runner — dispatch to `MachineInvokerPort`, apply policy tier gating (`Auto`/`Assisted` pass-through, `HumanApprove` pauses run for approval), append evidence, transition run status.
  - AC: `HumanApprove` tier creates approval gate and pauses run; approved run resumes invocation; evidence entry appended on completion or failure.
- STORY-A04c.3 — bead-0434
  - Machine/agent registration command handlers — `RegisterMachine`, `CreateAgent`, `UpdateAgentCapabilities` with tenancy enforcement, idempotency keys, and evidence emission.
  - AC: commands follow `(ctx, input) => Result<T, AppError>` contract; evidence entry recorded for each registration change; cross-tenant creation rejected.

### EPIC-A05 — Read path and hardening

Goal: performant queries with caching, observability, and resource governance.

- STORY-A05.1 — **DONE** (code exists)
  - Query handlers: `get-run`, `get-workspace` with QueryBus.
  - AC: query handlers follow `(ctx, input) => Result<T, AppError>` signature.
- STORY-A05.2 — bead-0315
  - Query read-model projection strategy (denormalized read tables or materialized views) with cache + invalidation.
  - AC: caching strategy documented; cache invalidation triggers defined.
- STORY-A05.3 — bead-0313
  - Application-level observability: traces/logs/metrics correlation (traceparent, OTel spans, security-safe attributes).
  - AC: each command starts `app.command.<Name>` span; metrics emitted; no secrets logged.
- STORY-A05.4 — bead-0043
  - OTel context propagation in request, workflow, adapter, and machine call stacks.
  - AC: W3C Trace Context (`traceparent`/`tracestate`) propagated end-to-end.
- STORY-A05.5 — bead-0317
  - Rate limiting and anti-abuse guards (tenant/user/action quotas, 429 semantics, Retry-After policy).
  - AC: load test proves graceful shedding; 429 includes safe detail and Retry-After.

### EPIC-A06 — Protocol and API strategy

Goal: right protocol for each boundary; backward-compatible evolution.

- STORY-A06.1 — bead-0326
  - API transport strategy for HTTP/1.1, HTTP/2, optional gRPC and WebSocket event stream.
  - AC: protocol-agnostic application layer; protocol specifics in presentation adapters only.
- STORY-A06.2 — bead-0378
  - API backward compatibility and versioning strategy (versioned paths, additive-only field rules, deprecation policy, content negotiation).
  - AC: versioning rules documented; breaking changes require explicit migration path.
- STORY-A06.3 — bead-0382
  - GraphQL BFF evaluation (evaluate GraphQL as backend-for-frontend for ops cockpit vs REST-only).
  - AC: decision recorded with trade-off analysis; recommendation documented.

### EPIC-A07 — Security and compliance

Goal: defence-in-depth at the application boundary.

- STORY-A07.1 — bead-0379
  - Input validation framework at command/query boundary (schema validation, allow-lists, RFC 9457 rejection for invalid inputs).
  - AC: invalid inputs rejected with Problem Details; fuzz tests show no unsafe deserialisation.
- STORY-A07.2 — bead-0167
  - Phase gate: Security complete only when vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed.
- STORY-A07.3 — bead-0303
  - Temporal invariants and ordering checks in domain models (issued/revoked, started/ended, due/created, retention deadlines).

### EPIC-A08 — Testing pyramid

Goal: layered test coverage from unit through load tests.

- STORY-A08.1 — bead-0334
  - Test coverage for `application/common/errors.ts` (currently 0%).
- STORY-A08.2 — bead-0320
  - Contract tests for application command/query surface (.specify specs) including operation authorization, Forbidden action mapping, schema diffs.
- STORY-A08.3 — bead-0300
  - End-to-end application integration tests for command/query flows with idempotency + outbox + CloudEvent emission under transient failure scenarios.
- STORY-A08.4 — bead-0321
  - End-to-end integration tests for application-layer idempotency, replay safety, outbox dispatch ordering, and failure injections.
- STORY-A08.5 — bead-0381
  - Load and stress testing (rate-limit validation under synthetic load, 429/Retry-After correctness, graceful shedding).
  - AC: system degrades gracefully; 429 responses include Retry-After; no dropped connections.
- STORY-A08.6 — bead-0181
  - Coverage thresholds on all newly added domain/application/infrastructure code.

### EPIC-A09 — CI/CD and deployment

Goal: automated quality gates and reproducible deployments.

- STORY-A09.1 — bead-0380
  - CI security gates: OpenAPI breaking-change diff checks, dependency vulnerability scanning, secret scanning.
  - AC: breaking API changes fail CI; known vulnerabilities flagged; no secrets in source.
- STORY-A09.2 — bead-0329
  - CI/CD provenance and image signing for control-plane/execution-plane containers (SBOM + attestation).
- STORY-A09.3 — bead-0298
  - Infrastructure execution baseline (Terraform and deploy automation).
- STORY-A09.4 — bead-0335
  - Wire infrastructure layer adapters: implement PostgreSQL stores, event publisher, and ID generator behind application ports.

### EPIC-A10 — Release and runbooks

Goal: safe rollout with rollback capability.

- STORY-A10.1 — bead-0188
  - Runbook: start-to-finish execution order with owner assignments.
- STORY-A10.2 — bead-0189
  - Runbook: rollback plan for failing cycle (freeze scope, rollback scope, communication template).
- STORY-A10.3 — bead-0323
  - Code review for application-layer completion: acceptance evidence, test coverage, architecture-guard evidence, rollback plan.
- STORY-A10.4 — bead-0163
  - Phase transition gate: Application complete only when DTOs, use-cases, orchestration tests, and approval/run policy mapping are closed.

## Pre-existing beads (cross-reference)

| Bead      | Status | Relevance                                                        |
| --------- | ------ | ---------------------------------------------------------------- |
| bead-0016 | open   | IAM MVP: workspace users + RBAC roles + auth integration         |
| bead-0019 | closed | Control Plane API v1: domain schemas for Workspace + User (RBAC) |
| bead-0022 | closed | ADR-0032: Event stream CloudEvents v1 (domain + tests)           |
| bead-0041 | open   | CloudEvents envelope implementation                              |
| bead-0043 | open   | OTel context propagation                                         |
| bead-0163 | open   | Phase transition: Application complete                           |
| bead-0167 | open   | Phase transition: Security complete                              |
| bead-0181 | open   | Test coverage thresholds                                         |
| bead-0188 | open   | Runbook: execution order                                         |
| bead-0189 | open   | Runbook: rollback plan                                           |
| bead-0195 | open   | Tenant-isolated fixture factories                                |
| bead-0196 | open   | Review: tenant-isolated fixtures                                 |
| bead-0298 | open   | Infrastructure execution baseline                                |
| bead-0299 | open   | AuthZ actions and forbidden-action typing                        |
| bead-0300 | open   | E2E integration tests (command/query + idempotency + outbox)     |
| bead-0301 | closed | ci:pr green for application-layer changes                        |
| bead-0303 | open   | Temporal invariants and ordering checks                          |
| bead-0308 | open   | Repository-level aggregate invariants                            |
| bead-0310 | open   | Evidence/audit schema debt clean-up                              |
| bead-0312 | open   | Application-layer implementation roadmap                         |
| bead-0313 | open   | Application-level observability                                  |
| bead-0314 | open   | Durable workflow adapter integration                             |
| bead-0315 | open   | Query read-model projection + caching                            |
| bead-0316 | open   | Outbox + event dispatcher                                        |
| bead-0317 | open   | Rate limiting and anti-abuse guards                              |
| bead-0319 | open   | Missing command/query handlers                                   |
| bead-0320 | open   | Contract tests for command/query surface                         |
| bead-0321 | open   | Integration tests for idempotency + outbox                       |
| bead-0323 | open   | Code review: application-layer completion                        |
| bead-0326 | open   | API transport strategy                                           |
| bead-0328 | open   | AuthN/AuthZ production hardening                                 |
| bead-0329 | open   | CI/CD provenance and image signing                               |
| bead-0334 | open   | Test coverage for errors.ts                                      |
| bead-0335 | open   | Wire infrastructure adapters                                     |
| bead-0318 | open   | Policy/authorization matrix for all commands and queries         |
| bead-0332 | open   | Refactor start-workflow.ts complexity                            |
| bead-0340 | open   | Remaining application-layer use-cases                            |

## New beads created for this backlog

| Bead      | Title                                                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| bead-0417 | App: production-grade JWT validation and principal extraction against bearerAuth in OpenAPI contract                                      |
| bead-0418 | App: wire AuthorizationPort to Keycloak OIDC and OpenFGA fine-grained authz                                                               |
| bead-0419 | App: close submit-approval RequestChanges gap                                                                                             |
| bead-0425 | App: Temporal worker execution loop (plan, execute, diff, evidence, run status)                                                           |
| bead-0426 | App: idempotent workflow start (same idempotency key returns same runId)                                                                  |
| bead-0409 | App: external action runner port interface for dispatching workflow actions to external execution planes                                  |
| bead-0411 | App: trigger-to-execution-plane routing - route TriggerKind to correct execution plane adapter at workflow start                          |
| bead-0378 | App: API backward compatibility and versioning strategy                                                                                   |
| bead-0379 | App: input validation framework at command/query boundary                                                                                 |
| bead-0380 | CI: security gates (OpenAPI diff, vuln scan, secret scan)                                                                                 |
| bead-0381 | App: load and stress testing                                                                                                              |
| bead-0382 | App: GraphQL BFF evaluation                                                                                                               |
| bead-0383 | App: event schema versioning governance                                                                                                   |
| bead-0384 | App: HTTP precondition support (optimistic concurrency)                                                                                   |
| bead-0432 | App: MachineInvokerPort — port interface for invoking external machine/agent runtimes (runAgent and invokeTool with credential injection) |
| bead-0433 | App: Agent Task action execution path in workflow runner with policy tier gating and approval gate integration                            |
| bead-0434 | App: machine/agent registration command handlers (RegisterMachine, CreateAgent, UpdateAgentCapabilities)                                  |

## Delivery notes

- The application skeleton (Result, AppContext, CommandBus, QueryBus, three initial commands, two queries) is already implemented and passing ci:pr.
- All ports are defined but infrastructure adapters are not yet wired (bead-0335).
- Priority order: wire adapters → complete command/query surface → add outbox → integrate durable workflows → harden with observability and security.
- Testing should be layered: unit coverage first (bead-0334), then integration (bead-0300, bead-0321), then contract (bead-0320), then load (bead-0381).
- Backward compatibility and versioning strategy (bead-0378) should be decided before the API surface stabilises.

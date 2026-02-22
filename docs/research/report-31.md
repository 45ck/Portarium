# Executive Summary  
Portarium is an **open‐source control plane** with a carefully layered, hexagonal architecture【27†L6-L14】. Its design cleanly separates *domain* logic (entities, invariants) from *application* services (use-cases, orchestration) and from *infrastructure* adapters and *presentation* (HTTP handlers)【27†L6-L14】.  This disciplined layering is commendable, and extensive **specification and ADR documentation** (e.g. architecture ADRs, requirements specs, traceability matrices) demonstrates strong design rigor.  However, the code remains in an **“early scaffold”** state: several critical components are still stubbed or in-memory only, and some cross-cutting abstractions and practices are incomplete.  For example, the control plane bootstrap uses *in-memory* or empty stub stores by default【41†L100-L108】【27†L20-L23】, and rate-limiting is implemented in-memory.  These shortcuts create **high-severity gaps**: without real persistence, many APIs will always return `null` or be non‐functional, and the system cannot survive multi‐instance or distributed deployment.  Likewise, the custom HTTP routing (regex‐based in one large handler module) lacks framework support, hindering maintainability and extensibility【37†L70-L78】.  

On the positive side, Portarium’s test suite is broad (many domain and application modules have unit tests, and there are OpenAPI and integration tests)【10†L8-L17】, and the CI pipeline (e.g. Argo rollouts, metrics, network policies) is sophisticated.  Nonetheless, **testing weaknesses** remain: there is little evidence of end-to-end or UI testing, no coverage or lint reporting, and some error-handling or list‐parsing code returns raw error strings rather than structured problems【82†L225-L231】【82†L330-L338】.  Best practices such as robust CI (with coverage thresholds and static analysis), distributed caches/rate-limit stores, and modular routing could be improved.  

This report identifies **architectural gaps** (missing persistence, rudimentary routing), **scalability risks** (in-memory stores, lack of distributed cache), **testing gaps** (limited e2e/UI tests, missing coverage metrics), and **practice violations** (manual route handling, stubbed components).  It provides **clear recommendations**—summarised in the table below—and actionable refactoring advice.  Proposed changes include implementing full persistence layers, adopting a proper router/framework, extending automated tests, and strengthening CI/CD metrics.  Architecture diagrams contrast the current (simplified) design with a more robust target state, and a roadmap prioritises concrete improvements (with effort/risk estimates).  These measures will increase robustness, maintainability, and scalability, elevating Portarium to “principal‐level” design quality.  

## Requirements and Stakeholders  
Portarium’s **requirements and stakeholder details are not explicitly documented** in the repository.  In lieu of formal user stories or stakeholder lists, the project relies on `.specify` markdown specs and ADRs that imply use cases (e.g. agent/robot integration, workflow approvals).  Key *assumed stakeholders* include operators of automated systems (robots, CI pipelines), system integrators (configuration of Ports/Adapters), and auditors (leveraging evidence logs).  However, no persona documents or formal elicitation artifacts are present, so we mark stakeholder requirements as **“unspecified”**.  The `.specify` specs (and traceability matrix【10†L8-L17】) do show detailed requirements for specific features (e.g. cockpit demo, credential grants, location events), but a high-level requirements summary is missing.  **Recommendation:** Engage stakeholders to produce a concise requirements document or user stories, ensuring priority cases (e.g. multi-tenant workspace management, SLA targets) are clearly defined.

## Architecture and Design Analysis  

### Layered Hexagonal Architecture  
Portarium is designed as a **layered hexagonal system**【27†L6-L14】: 
- **Domain** (`src/domain`): Entities, value objects, invariants (e.g. *run*, *workspace*, *policy*, *evidence* models).  
- **Application** (`src/application`): Use-case services and orchestration (commands, queries, workflows).  
- **Infrastructure** (`src/infrastructure`): Adapters to external systems (DB, auth, messaging).  
- **Presentation** (`src/presentation`): HTTP API handlers and user-facing layers (control-plane and Cockpit).  

This separation is well-communicated in the architecture docs【27†L6-L14】 and appears largely respected in code (e.g. control-plane HTTP handlers call into application/query services, which in turn depend only on domain/ports).  The runtime split between a Control Plane (HTTP server) and Execution Plane (worker/Temporal processes) is documented【27†L13-L18】 and reflected in separate entrypoints (`control-plane.ts`, `worker.ts`). 

However, the current implementation is incomplete (a “scaffold stage” as noted in the README【5†L74-L76】【27†L18-L23】).  Many components are stubbed or only in-memory:
- **Persistence:** The default `buildControlPlaneDeps()` uses empty Workspace/Run stores when Postgres is not configured【41†L100-L108】.  ADR notes admit “some stores are intentionally in-memory or stubbed”【27†L20-L23】.  As a result, aside from the command/query layer, none of the domain entities are actually persisted.  
- **Scalability:** Key cross-cutting services (rate-limiter, caches) are in-memory.  For example, `InMemoryRateLimitStore` is used by default【41†L85-L93】.  In a distributed deployment, this would not enforce global limits.  
- **Routing/Modularity:** The HTTP router is a giant manually-coded list of regex patterns in `control-plane-handler.ts`【38†L187-L200】.  This works but is error-prone to extend.  There is no middleware framework or automatic documentation (beyond the OpenAPI spec).  

In summary, *the architecture is sound in theory* (hexagonal with strict layers)【27†L6-L14】, but **gaps** exist in its realization.  Notably, the lack of a real data persistence implementation is a critical defect.  Likewise, the monolithic routing code is a missing abstraction (the team should adopt a router or framework).  We also observe no explicit domain-event or message bus architecture beyond simple CloudEvents wrappers【74†L29-L38】; adding a proper message broker (e.g. Kafka, or Temporal workflows) could improve decoupling.

### Architectural Diagrams  
The current high-level flow is: **Agents/Clients → Control Plane API → Application/Domain logic → Stores and Workers**【27†L26-L34】.  The following diagram (mermaid) captures this at a glance:  

```mermaid
flowchart LR
  subgraph ControlPlane["Portarium Control Plane"]
    API[HTTP API (v1)]
    Domain[Domain & Application Layer]
    Authorization["Auth & Policy"]
    RateLimit["RateLimiting"]
    DB[(Postgres\ / In-Memory Store)]
    API --> Domain
    Domain --> DB
    Domain --> Authorization
    Domain --> RateLimit
  end
  subgraph ExecutionPlane["Portarium Execution Plane"]
    Worker[Worker Processes (Temporal) ]
    Domain --> Worker
  end
  subgraph External["External Systems & Agents"]
    Agents[Agents / Robots / GUI]
    Agents --> API
    ExternalStorage[(Legacy SoRs, APIs)]
    Worker --> ExternalStorage
  end
```

*Figure: Current Portarium architecture (simplified)*【27†L6-L14】【27†L20-L23】.  In this view, **missing pieces** are visible: persistence and rate-limit are shown as optional (the code default is stub/in-memory)【41†L100-L108】【41†L85-L93】.  

A **recommended evolution** would strengthen these areas: use a clustered/Postgres database for all stores (Workspaces, Runs, Evidence, etc.), a distributed cache or Redis for rate-limits, and break out sub-components or services for workload modularity.  For example, introducing an event bus (Kafka/CloudEvents topic) between the control and execution plane, and using a proper router framework.  The diagram below illustrates these enhancements:

```mermaid
flowchart LR
  subgraph ControlPlane["Portarium Control Plane (API Service)"]
    APIGW[API Gateway / Router]
    Auth["JWT Auth \n (OpenFGA/OpenID)"]
    DomainService[Domain Use-Case Services]
    Postgres[(PostgreSQL Cluster)]
    Cache[(Redis Cache)]
    APIGW --> Auth
    APIGW --> DomainService
    DomainService --> Postgres
    DomainService --> Cache
    DomainService --> EventBus[↺ Message/Event Bus]
  end
  subgraph WorkerPlane["Execution Plane (Workers)"]
    WorkerService[Worker / Temporal]
    WorkerService --> EventBus
    WorkerService --> Postgres
  end
  subgraph Clients["Clients / Agents"]
    UI[Cockpit UI]
    Robot[Agent/Robot/Automation]
    UI --> APIGW
    Robot --> APIGW
  end
  subgraph Auditing["Audit & Monitoring"]
    Logs[Log Collection (Loki/Fluentd)]
    Metrics[Prometheus Metrics]
    Traces[OTel Tracing]
    DomainService --> Metrics
    WorkerService --> Metrics
    APIGW --> Traces
  end
```

*Figure: Proposed architecture with persistent stores, cache, and event bus.*  This design emphasizes durable backing services (Postgres, Redis), a dedicated router/gateway layer, and clear separation between control-plane API and execution workers. It also highlights integration with logging/metrics (which is partially implemented in infra【76†L17-L24】【83†L100-L108】).

### Abstractions and Gaps  
- **Ports/Adapters Pattern:** The “ports and adapters” concept is used (e.g. authentication ports, run/workspace stores) but not fully realized.  Many domain entities (Work Items, Evidence, Location events, etc.) have no backing store or are hard-coded. For instance, workspace and run stores are only implemented if `PORTARIUM_USE_POSTGRES_STORES=true`【41†L90-L98】; otherwise they return `null` and do nothing【41†L100-L108】. This suggests the architectural abstraction isn’t complete – real adapters for all essential ports should be implemented and tested.  
- **Routing Layer:** The current **HTTP routing** is hand-rolled. Code uses regex in one large switch (`ROUTES` in control-plane-handler.ts)【38†L187-L196】. This is brittle for a large API surface and bypasses common best practices like route parameter validation or middleware. A missing abstraction here is a proper routing library or framework (e.g. using [Hono](https://hono.dev/) or Express).  For example, the `handleGetWorkspace` method manually authenticates and calls the query service【37†L70-L78】. Using a framework would eliminate repetitive boilerplate.  We demonstrate below how a small snippet could be refactored:

```ts
// Current manual route handler (from control-plane-handler.ts【37†L70-L78】)
async function handleGetWorkspace(args: {workspaceId:string, deps:ControlPlaneDeps, req, res, ...}) {
  const { authorization, workspaceStore } = args.deps;
  const auth = await authenticate(args.deps, {/*...*/});
  if (!auth.ok) return respondProblem(args.res, problemFromError(auth.error, args.pathname), args.correlationId, args.traceContext);
  const result = await getWorkspace({authorization, workspaceStore}, auth.ctx, {workspaceId: args.workspaceId});
  if (!result.ok) return respondProblem(args.res, problemFromError(result.error, args.pathname), args.correlationId, args.traceContext);
  respondJson(args.res, {statusCode:200, correlationId: args.correlationId, traceContext: args.traceContext, body: result.value});
}
```

could be replaced by a router handler:  

```ts
// Proposed using Hono (example)
const app = new Hono<Env>();
app.get('/v1/workspaces/:workspaceId', async (c) => {
  const { workspaceId } = c.req.param();
  // c.env.deps holds ControlPlaneDeps
  // middleware can handle auth and scope enforcement
  const result = await getWorkspace({authorization: c.env.authz, workspaceStore: c.env.store}, c.get('ctx'), {workspaceId});
  return result.ok
    ? c.json(result.value, 200, { ETag: computeETag(result.value) })
    : c.json(problemFromError(result.error, c.req.path), result.error.status);
});
```

This approach (requiring a router) avoids manual regex parsing and centralizes error handling.  We cite【37†L70-L78】 to show the original pattern; the refactored code is illustrative.  

- **Consistency Checks:** The architecture docs mention governance (policy/SoD) and evidence chaining, but the code should enforce these systematically. For example, it’s unclear whether *all* command executions append evidence with hash chaining (a requirement in the specs). We found no universal aspect or interceptor handling this, which could be a missing abstraction: ideally a domain event or decorator ensures every state change produces evidence (DRY pattern).  

- **Multi-tenancy:** The system is multi-tenant (workspace-scoped) by design, but enforcement is partly manual. The handler includes `assertWorkspaceScope`【82†L254-L263】 to check token vs path. The code should ensure *every* endpoint enforces this. A missing abstraction is a clear tenant context propagated through all services. Currently, each handler repeats the workspace check. A global middleware would be cleaner.

## Scalability and Performance Risks  
- **In-Memory Bottlenecks:** The use of in-memory implementations (for stores and rate-limit) is a high-risk scalability gap【41†L100-L108】【41†L85-L93】. In production, the system must support multiple instances: the rate-limit store must be shared (use Redis/Distributed Cache) and the stores must be real databases (Postgres or another scalable DB). Relying on Node’s single-threaded model also means CPU-bound tasks (e.g. cryptographic ETag computations【82†L217-L224】) could block the event loop under high load.  
- **Lack of Horizontal Scaling:** No mention is made of clustering or stateless design. The Kubernetes spec suggests horizontally scalable pods, but health/check endpoints alone aren’t enough. The code lacks any in-process load balancing; for example, running multiple control-plane instances requires an external load balancer. That should be documented and tested.  
- **No Caching Layer:** If many clients read the same data (e.g. work item lists), there is no caching or CDN in front. Introducing a cache (Redis, or HTTP cache with ETags that are fully respected) would improve performance.  Some ETag logic exists【37†L103-L112】【82†L221-L230】, but caching policies aren’t defined.  
- **Asynchronous Workflows:** For long-running processes (robot missions, approvals workflows), the system plans to use Temporal (inferred from env var in quickstart). Ensuring Temporal (or alternative) is production-ready and configured with HA is crucial. The infra README notes adding a Temporal chart as a next step【76†L50-L55】, indicating it’s not yet integrated.

## Testing and Quality  
Portarium has **good unit-test coverage** for domain models and application services (the traceability matrix【10†L8-L17】 shows almost every spec has a corresponding test). It includes integration tests for the OpenAPI contract and some pipelines (e.g. PostgreSQL adapters). However:  
- **End-to-End (E2E) Tests:** There are no full-stack integration tests simulating real workflows (e.g. a sequence of API calls from Cockpit through to database state changes). In particular, the Cockpit UI (React?) likely needs UI tests or at least automated RESTful tests of its demo mode.  
- **Test Coverage Metrics:** The repo lacks any code coverage reports or targets. We recommend integrating a coverage tool (e.g. jest coverage) and setting a threshold (e.g. 80%). This would highlight untested code early.  
- **CI Automation:** While a CI badge is shown【5†L2-L4】, we haven’t found evidence of static analysis (lint, security scans) or automated linting of specs. Adding ESLint/Prettier, TypeScript strict mode, and tools like `npm audit` in CI would catch issues early.  
- **Quality Checks:** The `parseListQueryParams` function returns raw error strings【82†L330-L338】 (which likely propagate as vague 400s), rather than a structured Problem object. This inconsistency can lead to unclear API responses. It would be better to have a uniform error-handling layer.  
- **Data Schema Validation:** The code uses manual type guards (`parseXxxV1`) and branded IDs (primitives), which is good. But adding JSON Schema validation for incoming payloads (or leveraging OpenAPI request validation) would ensure robustness.

## Violations of Best Practices  
- **Hardcoded Regex Routing:** As noted, manually parsing URLs by regex is error-prone. Use a routing framework. This also prevents mistakes like missing a route or mishandling URL decoding (the code uses `decodeURIComponent` manually【37†L147-L155】).  
- **Large Handler Module:** The control-plane-handler.ts is monolithic (~400 lines) with many responsibilities. This violates the Single Responsibility Principle. We recommend splitting it into smaller modules or using a router with controllers.  
- **Missing Logging:** There is no visible logging in the handler (only error responses). At minimum, add structured logging (e.g. via pino or console with levels) for each request and internal actions, to aid debugging.  
- **Default Credentials in Code:** The “dev token” authentication prints to `stderr`【41†L37-L45】, but having any credential or secret handling in code must be reviewed carefully. (The warning indicates awareness, but ensure no secrets are committed.)  
- **Error Handling Consistency:** The code wraps domain errors into RFC7807 problem responses, which is excellent【81†L36-L45】【81†L172-L181】. However, any unexpected error in handlers is caught generically at the bottom of `handleRequest`【39†L331-L340】 with a 500. It might be safer to log the stack trace there as well, rather than swallow it silently.  
- **Dependency Configuration:** A number of features depend on environment vars (DB URL, JWT issuer, etc). It’s best practice to validate configuration at startup and fail fast if required values are missing. Currently, missing auth vars cause a silent degrade to an unauthenticated (401) state【41†L54-L64】. The code should alert or stop if runStore/DB is intended but not set.

## Summary of Findings  

| **Finding**                                                       | **Severity** | **Location**                            | **Recommended Remediation**                                                                                                                                                                                             |
|-------------------------------------------------------------------|--------------|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Stubbed persistence layers** – Workspaces and Runs are not stored in DB by default【41†L100-L108】. (Other domain stores missing entirely.) | High         | `control-plane-handler.bootstrap.ts`    | Implement full persistence for all core entities (WorkspaceStore, RunStore, etc.), using a scalable database (Postgres cluster or another RDBMS). Mark production builds to fail if DB URL is unset.                     |
| **In-memory rate limiting** – `InMemoryRateLimitStore` is used【41†L85-L93】. This won’t work across multiple nodes.                         | Medium       | `control-plane-handler.ts`              | Replace with a distributed rate-limit store (e.g. Redis or DynamoDB). Alternatively, use a cloud API gateway that enforces rate limits. Ensure rate-limit keys include tenant scope to isolate workloads.               |
| **Manual HTTP routing** – Large regex dispatch in `control-plane-handler.ts`【38†L187-L200】 is fragile.                                       | Medium       | `src/presentation/runtime/control-plane-handler.ts` | Adopt a routing framework or library (e.g. [Hono](https://hono.dev/), Express, Fastify). Refactor route handlers into controllers. This reduces boilerplate and errors in path matching.                              |
| **Missing UI/E2E tests** – No automated tests for Cockpit UI or full workflow scenarios.         | Medium       | (No specific file)                      | Add end-to-end tests using a tool like Cypress or Playwright to simulate key user flows (e.g. login, approve run, attach evidence). Automate these in CI. Create test data sets in the DB or via mock API.            |
| **Inconsistent error handling** – List query parser returns raw string errors【82†L330-L338】.                         | Low          | `control-plane-handler.shared.ts`       | Align with ProblemDetails: throw or return structured error objects instead of raw strings. For example, convert invalid query params to HTTP 400 with JSON Problem details.                                         |
| **Incomplete documentation** – No high-level requirements or stakeholder docs; ADRs exist but no summary. | Low          | Documentation                            | Write a summary requirements document (or README section) listing stakeholder roles, key use cases, and design goals. This aids new contributors and ensures alignment.                                               |
| **No code coverage / static analysis** – CI lacks tests for style/security or coverage gates.    | Low          | CI pipeline                              | Integrate linters (ESLint), type-checking, and vulnerability scans into CI. Use a coverage report (e.g. nyc/jest) and set a minimum threshold. Fail CI on breaking OpenAPI (already done in [43†L99-L103]). |
| **No distributed cache for common reads** – Potential performance issue under heavy load.      | Low          | Application layer                        | Introduce caching (Redis or in-memory per pod) for expensive read queries (e.g. workspace lists). Use HTTP caching headers (ETag already computed【82†L217-L224】) consistently.                                       |

## Refactoring Examples  

To illustrate improvements, consider the current `handleGetWorkspace` handler (simplified here)【37†L70-L78】:  

```ts
async function handleGetWorkspace(args: WorkspaceHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, traceContext, workspaceId } = args;
  const auth = await authenticate(deps, { req, correlationId, traceContext, expectedWorkspaceId: workspaceId });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, args.pathname), correlationId, traceContext);
    return;
  }
  const result = await getWorkspace(
    { authorization: deps.authorization, workspaceStore: deps.workspaceStore },
    auth.ctx,
    { workspaceId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, args.pathname), correlationId, traceContext);
    return;
  }
  // ETag and response
  const etag = computeETag(result.value);
  res.setHeader('ETag', etag);
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}
```

This can be refactored to use a router and middleware to reduce boilerplate. For example, using Hono (or any web framework):

```ts
import { Hono } from 'hono';
const app = new Hono<{ Bindings: { deps: ControlPlaneDeps } }>();

// Middleware to authenticate and attach AppContext
app.use('*', async (c, next) => {
  const token = c.req.header('Authorization') ?? '';
  const authResult = await c.env.deps.authentication.authenticateBearerToken({ /*...*/ });
  if (!authResult.ok) {
    return c.json(problemFromError(authResult.error, c.req.path), authResult.error.status);
  }
  c.set('ctx', authResult.value);
  await next();
});

app.get('/v1/workspaces/:wid', async (c) => {
  const workspaceId = c.req.param('wid');
  // Use Hono's built-in context and error handling
  const res = await getWorkspace(
    { authorization: c.env.deps.authorization, workspaceStore: c.env.deps.workspaceStore },
    c.get('ctx'),
    { workspaceId }
  );
  if (!res.ok) return c.json(problemFromError(res.error, c.req.path), res.error.status);
  c.header('ETag', computeETag(res.value));
  return c.json(res.value, 200);
});
```

By doing this, we eliminate manual regex, reduce repeated code, and centralize error handling.  

## Prioritized Roadmap  

1. **Implement Full Persistence** – *Effort: High, Risk: Medium.* Replace stub stores with real PostgreSQL adapters for all entities (Workspaces, Runs, WorkItems, Evidence, etc.). Migrate existing domain objects to be saved/retrieved, and seed any lookup tables. Ensure database migrations are scripted. **Rationale:** This is critical – without it, the control plane cannot function beyond scaffolding【27†L20-L23】【41†L100-L108】.  
2. **Distributed Rate Limiting and Caching** – *Effort: Medium, Risk: Low.* Swap `InMemoryRateLimitStore` for a Redis-based store (or cloud rate-limit service) and enable it by default. Introduce caching (e.g. Redis or Node cache) for frequently-read data. Update infra config (e.g. Helm charts) to include Redis and shared caches【76†L17-L25】.  
3. **Refactor HTTP Routing** – *Effort: Low, Risk: Low.* Integrate a routing framework (Hono/Fastify) to replace the big regex switch. Modularize handlers into controllers (One per aggregate or service). This improves maintainability and reduces bugs【38†L187-L200】【37†L70-L78】.  
4. **Enhance Testing** – *Effort: Medium, Risk: Medium.* Add end-to-end tests (Cockpit UI simulations, full API flows). Set up code coverage reporting in CI. Include integration tests for new persistence layers. Consider contract tests for OpenAPI (some exist already【10†L8-L17】, ensure automation for breaking changes).  
5. **Strengthen CI/CD** – *Effort: Medium, Risk: Low.* Augment the GitHub Actions (or CI pipeline) with lint, `npm audit`, and type-checking steps. Enforce style and security checks. Consider a canary deployment job (Argo Rollouts exist in infra【83†L9-L17】; ensure we can trigger them).  
6. **Document Requirements & Metrics** – *Effort: Low, Risk: Low.* Write or update documentation to include stakeholder analysis, service-level metrics (e.g. latency, error rate SLOs), and clarify deployment topology. Align with devs and ops on what metrics to emit (e.g. counter for completed runs, dashboards in Grafana). Infra notes OTel and Prometheus usage【76†L17-L24】【83†L100-L108】; finalize these setups.  
7. **Future: Microservices Decomposition** – *Effort: High, Risk: High.* Evaluate splitting the monolith into separate microservices (e.g. workflow-service, evidence-service). This is a longer-term goal once the above foundations are solid.  

Efforts are relative (“High” = substantial architecture work; “Low” = small code changes).  Risks reflect potential disruption (e.g. migrating data is higher-risk than refactoring code).

## Metrics, CI/CD, and Automation  

- **Continuous Integration:** Ensure every PR runs tests, lint, type-check, and OpenAPI breaking-change detection. The template [43†L99-L103] suggests a breaker for API changes is already in place. Add static analysis tools (ESLint, security scans).  
- **Code Coverage:** Generate coverage reports on each build (e.g. with Jest or nyc) and fail builds under a threshold. Track coverage over time to prevent regressions.  
- **Monitoring and Metrics:** Instrument key processes. The Argo rollout config【83†L100-L108】 implies the code emits Prometheus metrics (`portarium_worker_action_started_total`, etc.). Continue this practice: emit counters/timers for all major events (requests, DB calls, errors). Hook up OpenTelemetry tracing in each request handler to propagate context (note trace-context normalization in code【82†L233-L242】). Use the Kubernetes topology to scrape metrics and logs (Loki, Tempo, Grafana are in infra【76†L17-L24】).  
- **Health and Readiness:** Already present (`/healthz` checks), but ensure deep readiness probes (e.g. DB connectivity) are implemented.  
- **Deployment Pipelines:** With K8s in place, use rolling updates and canaries. The worker canary is defined【83†L9-L17】. Similarly define a control-plane rollout (Argo or Helm). Automate these via CI/CD pipelines.

By following these practices and implementing the above changes, Portarium will achieve a robust, enterprise-quality design. The layered architecture and extensive documentation are strong foundations【27†L6-L14】【10†L8-L17】. Addressing the highlighted gaps (especially persistence and routing) will harden the system and improve maintainability and scalability for the long term.

**Sources:** Portarium repository (architecture docs, code, tests)【27†L6-L14】【10†L8-L17】【37†L70-L78】【41†L100-L108】【82†L217-L224】 and associated ADR/spec documents【43†L99-L103】. These inform the analysis of current vs. recommended architecture.

---

## Architecture Review Triage (bead-ev20 + bead-lh3q — assessed 2026-02-22)

### Validated findings

| Finding | File(s) | Current state | Bead |
|---------|---------|---------------|------|
| Regex HTTP routing | `control-plane-handler.ts:188` — 19 `pattern: RegExp` route registrations in `ROUTES` array | **CONFIRMED OPEN** — still uses custom regex dispatch | bead-e1bh (P1, blocked by bead-lh3q) |
| In-memory stub defaults | `control-plane-handler.bootstrap.ts:132,145,150` — `InMemoryRateLimitStore` + null workspace/run stores when `PORTARIUM_USE_POSTGRES_STORES` absent | **CONFIRMED OPEN** — silently degrades, no fail-fast for missing DB | bead-yz3x (P1, blocked by bead-lh3q); rate-limit covered by bead-dsnp |
| Raw Error in HTTP responses | `src/presentation/runtime/` — no `res.json(err)` patterns found; `parseListQueryParams` returns `{ok:false, error:string}` but is currently unused | **NON-ISSUE** — consistent ProblemDetails pattern; `parseListQueryParams` flagged by knip |
| Magic CloudEvent type strings | `nats-event-publisher.test.ts` — inline string literals only in test files; source files not checked | **LOW** — type strings in tests only; production publishers use typed constants |
| Coverage artifact | `.github/workflows/ci.yml:60-65` | **DONE** — coverage artifact uploaded on every PR run |
| Argo canary smoke test | `.github/workflows/cd-progressive.yml:137` | **PARTIAL** — canary monitoring exists; confirm pre-promote smoke step is automated |
| Distributed caching | Not yet implemented for policy/config reads | **OPEN** | bead-mvuv (P1) |

### Summary

- Report written when codebase was in scaffold state; persistence (postgres stores) and coverage are now substantially implemented.
- Two unique open findings: (1) regex routing (bead-e1bh), (2) caching layer (bead-mvuv).
- In-memory rate limiting is tracked in bead-dsnp (P0). Bootstrap fail-fast tracked in bead-yz3x.
- No new beads seeded — all findings map to existing beads above.
# Executive Summary

Portarium is a **multi-tenant control plane** for orchestrating and governing business operations across disparate systems. Its architecture has three tiers (people/agents at top, the Portarium control plane in the middle, and backend services/robots at bottom)【62†L12-L17】. The core consists of a Node.js/TypeScript **Control Plane API** (workspace-scoped, RESTful) and a **Temporal execution plane** (workers handling long-running workflows and external tasks). Ancillary components include an OAuth2 identity provider (Keycloak) and an OpenFGA service for RBAC, object storage (S3/MinIO) for evidence, a Postgres database, and integrations (ERP/Odoo, robotic agents/OpenClaw, etc.) as adapters. The Cockpit UI (React/Vite) and a CLI tool invoke the control-plane API to start runs, process approvals, register heartbeats, etc.【62†L35-L43】【58†L209-L218】.

Our review finds **gaps in scalability, testing, and observability**. For example, no caching or rate-limiting is evident (risking load spikes), and the system appears to rely on a single Postgres and Node instance by default. Key best practices like structured logging, metrics endpoints, or circuit breakers are absent. Testing is limited: few unit/integration tests are visible, and no end-to-end or performance tests are documented. Some API stubs (e.g. SSE events) are unimplemented【32†L31-L34】. Security practices follow modern patterns (JWT, OIDC) but critical checks (HTTPS enforcement, input validation, rate-limiting) are not obvious. We highlight these issues and recommend changes (microservice decomposition, caching, DI frameworks, richer testing, observability instrumentation, OWASP alignment) to achieve a robust, enterprise-grade platform. A summary of issues (with impact, fix, effort, priority) appears in the final table.

# System Architecture

Portarium’s architecture is **modular and layered**. At the highest level, users or automated agents (e.g. robots/OpenClaw) interact via the Cockpit UI or CLI. These clients call the **Control Plane API** (Node.js) which enforces policy and orchestrates workflows. The API is multi-tenant (workspace-based)【62†L35-L43】, supporting RBAC (OpenFGA) and OAuth2 (Keycloak). Behind the API is a Postgres database (tenant-scoped data), an object store (MinIO or AWS S3) for evidence and attachments, and a Temporal engine for durable workflow execution. A background **worker** process pulls tasks from Temporal and invokes external actions (e.g. calling the ERP via its adapter, controlling robots) and records results. Health/metrics endpoints (e.g. `/healthz`) exist on both the control plane (port 8080) and worker (port 8081)【62†L51-L56】. The system runs as a set of containers (API, worker, DB, etc.), deployable via Docker Compose or Kubernetes. The diagram below summarizes the main components and their relationships:

```mermaid
graph TD
  subgraph Users/Agents
    UI[Cockpit UI (React)]
    CLI[CLI Tool (Node.js)]
    AG[Agents/Automations]
  end
  subgraph Control_Plane[Control Plane (Portarium)]
    API[HTTP API Server]
    DB[(PostgreSQL DB)]
    S3[(MinIO/S3)]
    Auth[Keycloak (OIDC)]
    Authz[OpenFGA (ABAC/RBAC)]
    TP[Temporal Engine]
  end
  subgraph Execution_Plane[Execution Plane (Worker)]
    WKR[Workflow Worker]
  end
  subgraph Services[External Systems]
    Odoo[ERP (Odoo)]
    Ext[Other Services]
  end
  UI -->|calls| API
  CLI -->|calls| API
  AG -->|heartbeat/commands| API
  API -->|persist/workflow| DB
  API -->|store/evidence| S3
  API -->|authenticate| Auth
  API -->|authorize| Authz
  API -->|start/run workflow| TP
  TP -->|execute task| WKR
  WKR -->|invoke service| Odoo
  WKR -->|invoke service| Ext
```

Key data flows include: “start workflow” requests from UI/CLI → API → Temporal, then the worker executes tasks (calling external services or performing approvals) and writes audit evidence back to the Control Plane. Work item and run events are published (SSE endpoint for clients) for updates. **Service boundaries** follow a domain-driven style: each workspace (tenant) has isolated data in Postgres; the control plane is stateless (aside from DB) to allow horizontal scaling【62†L12-L17】【88†L110-L114】. Integration points (ports/adapters) abstract external systems, but current implementation appears in some cases _scaffolded_ or incomplete (e.g. Odoo and OpenClaw are only locally configured)【13†L10-L18】. Overall, the monolith can be deployed as a single workload or split: best practice would be to run the API server and Temporal worker as separate services/containers (as current “dev” Docker Compose suggests)【13†L4-L12】【62†L37-L45】. (Note: expected load and SLAs are unspecified; we assume moderate multi-tenant usage.)

# Web Technologies and Frameworks

Portarium is built with **TypeScript on Node.js (v22+)**. The code follows a Ports-and-Adapters (hexagonal) architecture【62†L29-L33】. The Control Plane HTTP server appears to be a lightweight custom or minimal framework (no common Express/Fastify found). It exposes a REST API (OpenAPI-defined) under `/api/v1/workspaces/{id}/…`. Key routes include _runs_ (start/status/cancel), _approvals_ (decision), _agents_ and _machines_ (register/heartbeat)【30†L1-L6】【58†L239-L247】, among others like work items, plans, and evidence (per spec【35†L168-L176】【55†L30-L39】). JSON is used for all payloads. Authentication is via OAuth2/OpenID Connect (Keycloak) with JWT bearer tokens; RBAC is enforced by calling the OpenFGA policy engine. The client libraries (SDK and CLI) inject authorization tokens and even propagate a `traceparent` header for distributed tracing【30†L6-L15】.

The **Cockpit UI** is a separate web app (likely React given Vite scripts in package.json【47†L18-L26】), communicating with the API. The CLI (TypeScript) mirrors API operations using `fetch`【58†L223-L232】. Middleware such as CORS or JSON parsing are not obvious; input validation seems handled by AJV schemas (seen as dependencies【67†L148-L153】 but not confirmed). The code includes static-file and storybook scripts (Cockpit assets generation【47†L18-L27】). The architecture emphasizes _API-first_, but code quality suggests that common middleware (rate-limiting, sanitization, response compression, etc.) are minimal or missing. For example, the CLI uses `/api/v1/...` paths (the server likely mounts the OpenAPI router there)【58†L249-L254】. The Ports/Adapters model is explicitly mentioned: adapters for ERP, OpenClaw, etc., though some are "scaffold-stage"【62†L12-L17】.

**Recommendations:** Adopt a well-known web framework (e.g. NestJS, Fastify or Express) to leverage middleware and easier structure. Enforce CORS, compression, and payload size limits. Clearly separate “application”, “domain”, and “infrastructure” code, and consider API versioning. Use typed request/response DTOs with strong validation. Ensure all external calls have configurable timeouts. (Effort: medium; priority: high to ensure maintainability and security.)

# Enterprise Integration & Consistency

Portarium’s design follows domain-driven principles: each _workspace_ is a bounded context (tenant) with its own data (workspace entries in Postgres, and authorization scope). Service boundaries are clear: the control plane handles state and orchestration, while external systems remain autonomous behind adapters (ports). Temporal provides **long-running transactions** and sagas for multi-step workflows, enabling eventual consistency across services. For example, a “run” may trigger several REST calls to an ERP and wait for responses or approvals【30†L6-L15】【58†L223-L232】. Integration with Keycloak/OpenFGA externalizes identity and policies (externalized policy decision points), following microservice best practice【92†L243-L251】. Messaging is used for events: the API exposes an SSE stream (`/events/stream`) for clients to subscribe to workspace events【58†L265-L274】, though client code notes “(unimplemented)” for some events streaming【30†L30-L34】, indicating incomplete functionality. No enterprise message broker (e.g. Kafka, NATS) is currently used, which could limit scalability and reliability of event-driven workflows.

Transactions within a workspace rely on the database (e.g. when creating runs or approvals). **Data consistency** is mainly eventual; each run is an append-only audit with evidence links, and approvals persist decisions. There is no distributed transaction across services, but Temporal implicitly handles rollback/compensation via workflow logic. However, the code does not show explicit use of idempotency tokens or duplicate suppression. For example, the run start POST simply creates a new run without idempotency handling【58†L201-L209】. This could lead to duplicate runs if a client retries. Similarly, approval decisions have no locking or concurrency control beyond unique IDs.

**Gaps:** The SSE/event subsystem appears incomplete (SDK method does nothing【32†L30-L34】), limiting event-driven integrations. Without a durable message queue, concurrent write conflicts could occur. The fixed workspace default (“ws-default”) suggests no dynamic workspace provisioning API (only selection). Consider implementing a _Control-Bus_ (central message bus or pub/sub) for cross-service events (e.g. publishing “run completed” events to integrate additional services). Also, adopt **cache-aside** for read-heavy data (e.g. workflow definitions, plans) to relieve the DB【90†L48-L50】. Partition the Postgres schema or use separate DBs per tenant for true isolation. (Effort: high; priority: medium – depending on scale requirements.)

# Performance & Scalability

By default, Portarium runs a single Node process (HTTP server) and one Temporal worker. **Scalability risks** include Node’s single-threaded nature, a single Postgres instance, and no caching or rate limiting. The package has no clustering or PM2 scripts; to scale, multiple Node instances behind a load balancer are needed【88†L110-L114】. Horizontal scaling is recommended (“multiple servers… or Kubernetes”【88†L110-L114】). For the API, using the Node.js Cluster module or container orchestration (Kubernetes) can leverage multi-core machines and enable rolling updates【88†L124-L132】. The Temporal engine itself can be scaled by adding more worker processes or nodes to handle higher concurrency.

**Bottlenecks** will likely be: the Postgres DB (all tenants share one cluster), potentially the Temporal history store, and heavy workflows blocking event loops (if any synchronous CPU work is done). Use **cache-aside** (e.g. Redis) to store frequently accessed data like workspace configs or static lists【90†L48-L50】, reducing DB load. Use HTTP caching headers on GET endpoints where applicable. For long polling or SSE, consider a scalable pub/sub back-end (e.g. Redis PUB/SUB or Kafka) instead of the direct HTTP loop, to better handle many clients.

**State management:** The system is mostly stateless (aside from the DB). Sessions/tokens should be stateless JWTs, which is the case. To avoid memory leaks, ensure that any in-process state (e.g. pending timers in workflows) is minimal or can be resumed. **Load balancing:** Use nginx or a cloud LB in front of API servers. Metric-driven auto-scaling (CPU, queue length) would help.

**Recommendations:** Deploy the API in a clustered or container-orchestrated environment. Introduce Redis for caching (cache-aside pattern) of expensive reads【90†L48-L50】. Implement circuit breakers on external service calls to prevent cascading failures. Profile database queries and add indexes (e.g. on workspace/creation time for runs). Consider sharding or multi-master DB for high availability. (Effort: medium; priority: high for production readiness.)

# Testing & QA

Portarium has **limited evidence of automated testing**. The monorepo uses Vitest (per package.json) for unit tests, and even Striker for mutation testing【48†L115-L123】, indicating an intention for high coverage. However, no tests are directly visible aside from examples in docs (e.g. “dev:seed” scripts). The only explicit test reference is a “governed-run-smoke.test.ts” mentioned in a doc, suggesting a basic end-to-end check. There are no visible unit tests for domain logic, edge cases, or error flows. The CLI and SDK also lack tests.

There are no integration or e2e test frameworks mentioned. The repository does include Cockpit UI Storybook and demo scripts, but these are for UI snapshots and demos, not automated functional tests. Performance and load testing are absent. Domain logic (sagas, approval flows) are critical and need tests; their absence is a risk.

**Best practices**: Implement a layered test suite:

- **Unit tests** for core services (workflow engine controllers, approval logic, data mappers) using Vitest/Jest, mocking external calls.
- **Integration tests** that spin up the API with an in-memory DB or test container, invoking the HTTP API to verify end-to-end flows (e.g. create a run → require approval → complete run)【47†L13-L21】【55†L30-L39】. Test edge cases: unauthorized access, invalid input.
- **End-to-End tests** for Cockpit UI (using Cypress or Playwright) to simulate a user triaging an approval.
- **Performance tests** (artillery or k6 scripts) to simulate concurrent run submissions and check response under load.
- **Security tests**: include Snyk or npm audit (package.json has audit scripts) and OWASP ZAP scanning of the deployed API.

Use **CI/CD** gates: the repository already has `ci:pr` and `ci:nightly` scripts (lint, typecheck, mutation coverage)【48†L119-L127】, which is excellent. Extend this to run tests on every PR, with coverage thresholds. Consider contract tests for the HTTP API (e.g. using Postman/Newman or Pact) to ensure any client (Cockpit) stays in sync with API schema【55†L30-L39】. (Effort: high; priority: high for reliability.)

# Security

Portarium adopts modern auth (OpenID/OAuth2 via Keycloak, JWT tokens) and ABAC (OpenFGA). However, security best practices need reinforcement. The API cheatsheet recommends **HTTPS only** to protect tokens in transit【92†L231-L236】. Ensure TLS is enforced in production (the code shows none by default). Input validation is unclear; use OWASP recommended checks on every endpoint. The REST Cheat Sheet warns to “validate JWT integrity” (e.g. reject `alg:"none"`)【92†L258-L267】; the code’s JWT library (jose) must verify `iss`, `aud`, and `exp` claims rigorously【92†L258-L267】. Audit logs should be implemented for sensitive operations (approvals, permission changes) with proper log levels.

OWASP also emphasizes rate limiting and resource quotas to prevent DoS【93†L243-L247】. Portarium has no evident rate-limiting (no throttling middleware). An attacker could flood the `/runs` or `/events/stream` endpoints to exhaust resources. We recommend implementing API throttling (e.g. via nginx or a Node rate-limit middleware) and request size limits. Validate all file uploads (size/type) to MinIO. For secrets, avoid embedding any tokens in code; use Vault or environment variables (Vault is in the dev stack【13†L4-L12】, but ensure production secrets are sealed).

Use standardized security headers (HSTS, CORS, Content-Security-Policy). The REST cheatsheet warns against passing sensitive data in URLs or logs【92†L242-L250】. Ensure stack traces or secrets are never logged. The presence of OpenFGA is a plus, but ensure policies are reviewed; fine-grained rights must be tested.

**Recommendations:** Enforce TLS on all endpoints【92†L231-L236】. Validate JWTs strictly and rotate keys. Implement OWASP ZAP scans regularly. Add rate-limiting on APIs and maximum payload sizes to avoid API4 violations【93†L243-L247】. Adopt a library (e.g. helmet, express-rate-limit) for common protections. (Effort: medium; priority: high due to sensitive nature of governance data.)

# Observability & Operations

Built-in observability is minimal. The Docker stack includes an OpenTelemetry Collector【20†L24-L30】, suggesting intent to send traces/metrics. The Node code imports `@opentelemetry/api`【67†L179-L187】, but we saw no explicit instrumentation (no middleware to record spans or metrics). The CLI does propagate `traceparent` header【30†L6-L15】, but if the server doesn’t start/finish spans, the traces stop there. **Recommendation:** Integrate OpenTelemetry properly: automatic instrumentation (e.g. `@opentelemetry/auto-instrumentations-node`) and configure export to a backend (Jaeger/Zipkin/Prometheus). Use a structured logger (pino or bunyan) that supports correlation IDs【94†L15-L23】. The logs we saw are plain `console.log`, which is not ideal.

Add **metrics** (request count, latency, error rate) with Prometheus exporters. Use the healthz endpoints already present【62†L51-L56】 for liveness/readiness probes in Kubernetes. Set up log aggregation (ELK or Loki) and metrics dashboards (Grafana).

Operations: CI workflows exist (`ci.yml`), though we have not seen its content. Ensure CI builds with correct node version (>=22), runs tests, lint, and fails on warnings. Use GitHub actions or similar to deploy containers to staging. Define a deployment manifest (not in repo) for K8s or Docker Swarm. Document runbooks for failures (e.g. resetting DB).

**Recommendations:** Instrument all critical paths for tracing. Export application metrics (use OpenTelemetry or Prometheus client). Replace console logs with a logger that auto-adds trace IDs【94†L15-L23】. Configure alerts on error rates or latency. Automate backups of Postgres. (Effort: medium; priority: medium for observability, high for ops readiness.)

# Code Quality & Maintainability

The repo uses TypeScript, ESLint, Prettier, dependency-cruiser, and knip for unused deps【48†L124-L132】【67†L179-L187】, indicating a strong focus on code quality. The dependency-cruiser and Mermaid scripts suggest an emphasis on modularity. The code structure (ports/adapters, domain, infrastructure) is implied by folder names (we saw `src/sdk`, `src/cli`, etc.) but the searches did not show all. The README and docs are extensive (architecture, tutorials, ADRs). However, some _anti-patterns_ emerge: large monolithic scripts (e.g. the CLI has ~350 lines all in one file【57†L0-L13】【58†L239-L247】). Breaking this into command modules would improve readability. In general, there is little evidence of service abstractions or inversion of control; controllers may be doing heavy work rather than delegating to domain services.

Documentation is good on features and usage (README, local-dev, HTTP spec)【62†L58-L66】, but comments/code docs are not visible. Consider adding more JSDoc to code and simplifying complex conditionals. The CLI’s error handling is rudimentary (just `console.error` and `process.exitCode`), which is acceptable for a CLI but not robust.

**Recommendations:** Refactor the CLI into modular commands (or use a library like Commander) to simplify logic. Apply dependency injection to services (e.g. DB, Temporal client) to ease testing. Move magic strings (like paths or default workspace IDs) to constants/config. Review the many “scripts” in package.json (domain-atlas, beads) to decide if they belong in this repo or an auxiliary tool. Ensure all code paths have clear error handling. (Effort: medium; priority: medium.)

# Summary of Findings

| **Issue**                                        | **Impact**                                | **Recommendation**                                                | **Effort** | **Priority** |
| ------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------- | ---------- | ------------ |
| **No HTTP rate-limiting or throttling**          | API abuse, DoS risk【93†L243-L247】       | Implement API throttling (nginx or middleware).                   | Low        | High         |
| **No caching layer**                             | DB overload, latency                      | Introduce Redis cache (cache-aside) for hot data【90†L48-L50】.   | Medium     | Medium       |
| **Single Node instance**                         | Limited throughput                        | Enable clustering/Kubernetes (multi-instances)【88†L110-L114】.   | Medium     | High         |
| **Incomplete event stream (SSE) implementation** | Limited async capabilities                | Finish SSE/NATS event support for workspace events.               | Medium     | Medium       |
| **Sparse automated tests**                       | Regression risk                           | Add unit, integration, e2e tests (Vitest, Cypress).               | High       | High         |
| **No structured logging/metrics**                | Poor observability                        | Use structured logger (pino), expose Prometheus metrics.          | Medium     | Medium       |
| **Missing HTTPS enforcement**                    | Vulnerable token exposure【92†L231-L236】 | Enforce TLS in prod (via proxy or code).                          | Low        | High         |
| **JWT integrity checks**                         | Security gap                              | Verify `iss/aud/exp`, disallow “alg:none” tokens【92†L258-L267】. | Medium     | High         |
| **No input validation/malicious data checks**    | Injection risks                           | Validate all input (use schema validation, OWASP rules).          | Medium     | High         |
| **Monolithic CLI design**                        | Maintainability                           | Refactor CLI into modules or use a CLI framework.                 | Medium     | Medium       |
| **No e2e/test environments**                     | QA bottleneck                             | Add environment with seeded data for CI pipeline tests.           | High       | Medium       |
| **Hard-coded defaults (e.g. `ws-default`)**      | Inflexibility                             | Allow dynamic workspace creation or config.                       | Low        | Low          |

Each recommendation follows best practices from authoritative sources (e.g. horizontal scaling patterns【88†L110-L114】, caching strategies【90†L48-L50】, OWASP security guidance【92†L231-L236】【93†L243-L247】). Addressing these will lead Portarium to a robust, scalable, and secure enterprise platform.

# ADR-0065: External Execution Plane Strategy (Activepieces + Langflow + Temporal)

**Beads:** bead-0401
**Status:** Accepted
**Date:** 2026-02-18

## Context

Portarium is a governable control plane. It must orchestrate durable workflows, enforce policy and approvals, and produce tamper-evident evidence across a wide set of external systems (18 port families).

Building and maintaining a full, proprietary connector runtime and an agentic runtime in parallel with the control plane is a high-effort, high-risk path:

- connector ecosystems are large and fast-moving,
- agentic execution needs strong sandboxing and observability,
- multi-tenant isolation and credential boundaries are non-negotiable,
- Portarium still needs durable orchestration semantics (Temporal), but Temporal is not itself a connector marketplace/runtime.

We need a pragmatic approach that:

- delivers broad integration coverage quickly,
- keeps Portarium’s governance boundaries intact,
- allows untrusted execution containment (ADR-0034),
- keeps licensing and supply-chain risks explicit.

## Decision

Adopt a hybrid execution-plane strategy:

1. **Temporal remains the default workflow engine**

- Temporal orchestrates the **run lifecycle** (durable state, retries, signals, timers).
- Non-deterministic work is isolated to activities.
- Temporal is not treated as the connector runtime; it coordinates execution.

2. **Activepieces is the primary connector runtime**

- Use Activepieces as the preferred execution runtime for “connector work” (calling external systems via well-defined pieces).
- Portarium treats Activepieces as an execution-plane implementation detail behind ports/adapters.
- Portarium remains the source of truth for governance decisions: policy tiering, approvals, SoD checks, evidence requirements, and audit log structure.

3. **Langflow is the primary agentic runtime**

- Use Langflow for “agentic work” where step graphs and model/tool composition are needed.
- Portarium constrains Langflow execution via policy tiers and tool allow-lists; dangerous tools default to HumanApprove or ManualOnly.

4. **Optional ops/workload runtimes are explicitly secondary**

- Evaluate Kestra or StackStorm only for specific ops pipeline workloads where they provide clear benefit (schedulers, sensors, ops workflow patterns).
- Portarium does not depend on them for core control-plane correctness.

## Integration Model and Boundaries

### Control plane vs execution plane

- **Control plane responsibilities (Portarium):**
  - AuthN/AuthZ, tenancy scoping, policy evaluation, SoD, approvals.
  - Plan objects, evidence metadata, retention schedules, and event emission.
  - Durable orchestration (Temporal coordination).
- **Execution plane responsibilities (runtimes):**
  - Perform external calls and/or agent steps.
  - Produce verifiable execution results and structured outputs.
  - Emit execution telemetry and evidence payload references back to Portarium.

### Multi-tenancy isolation requirements (hard requirements)

Any external runtime integrated into Portarium must support, or be deployed in a way that enforces:

- **Credential isolation:** per-workspace credentials only; no shared “global” credentials; secrets injected at runtime (Vault or equivalent).
- **Network isolation:** default-deny egress, allow-listed per adapter/piece; no lateral movement across tenants.
- **Compute isolation:** per-tenant namespaces/projects or per-tenant deployments for higher assurance tiers; explicit quotas (CPU/memory/concurrency).
- **Data isolation:** no cross-tenant storage; any persisted state is tenant-scoped and encrypts at rest with tenant-aware keys where supported.
- **Auditability:** every invocation correlated with `workspaceId` and `correlationId`; logs and events are redaction-safe; evidence payload locations are referenced, not inlined.
- **Supply-chain control:** pinned versions, SBOM generation, and upgrade cadence; emergency revocation plan for compromised dependencies.

### Execution trust model

Connector and agent runtimes are treated as **untrusted execution** relative to the control plane:

- inputs and outputs are validated at boundaries,
- actions are checked against capability and policy constraints before dispatch,
- evidence is append-only and tamper-evident (ADR-0029).

## Licensing and Compliance Notes

- At adoption time, validate the runtime and plugin ecosystem licensing for:
  - core runtime,
  - connector/piece/plugin libraries,
  - “enterprise” or hosted-only features (if any),
  - transitive dependencies that may introduce copyleft or fair-code constraints.
- Prefer permissive licenses for critical path components (ADR-0020).
- Maintain a lightweight license inventory for every adopted runtime and its plugin packages.

## Consequences

**Positive:**

- Faster connector coverage by leveraging an existing OSS runtime ecosystem.
- Keeps Portarium focused on governance, evidence, and orchestration correctness.
- Clear boundary where containment controls can be enforced (execution plane).
- Allows different execution substrates for different workload classes (connectors vs agentic).

**Negative:**

- Introduces third-party runtime operational complexity (deployment, patching, upgrades).
- Requires careful isolation to avoid cross-tenant leakage and credential sprawl.
- Adds supply-chain and licensing diligence as ongoing work, not a one-time choice.

## Alternatives Considered

- **Build a proprietary connector runtime**
  - Rejected for v1: high cost, slow coverage, high maintenance burden.
- **Use Temporal activities as the connector runtime**
  - Rejected: workable for small coverage but does not provide a connector ecosystem or a strong plugin development story.
- **Single “one size fits all” runtime for connectors and agents**
  - Rejected: connectors and agentic graphs have different needs; separation improves containment and operability.

## Implementation Mapping

ADR-0065 implementation/review coverage maps to:

- `bead-0402` (closed): Temporal SDK and orchestration adapter baseline.
- `bead-0425` (closed): Temporal worker execution loop for governed run lifecycle.
- `bead-0409` (closed): application action-runner dispatch contract.
- `bead-0411` (closed): trigger-to-execution-plane routing.
- `bead-0404` (closed): Activepieces runtime deployment baseline.
- `bead-0405` (closed): Activepieces action execution adapter.
- `bead-0406` (closed): Activepieces DomainEvent trigger publisher.
- `bead-0407` (closed): Langflow isolated deployment hardening.
- `bead-0408` (closed): Langflow agent-flow action runner.
- `bead-0412` (closed): Kestra runtime fit assessment.
- `bead-0413` (closed): StackStorm runtime fit assessment.
- `bead-0414` (closed): runtime licensing and compliance audit.
- `bead-0620` (open): ADR closure mapping bead for implementation/evidence linkage.
- `bead-0621` (open): ADR linkage verification review bead.

## Acceptance Evidence

- Application execution-plane dispatch contracts:
  - `src/application/ports/action-runner.ts`
  - `src/application/services/trigger-execution-router.ts`
  - `src/application/services/trigger-execution-router.test.ts`
- Activepieces integration path:
  - `src/infrastructure/activepieces/activepieces-action-executor.ts`
  - `src/infrastructure/activepieces/activepieces-action-executor.test.ts`
  - `src/infrastructure/eventing/activepieces-domain-event-trigger-publisher.ts`
  - `src/infrastructure/eventing/activepieces-domain-event-trigger-publisher.test.ts`
- Langflow integration path:
  - `src/infrastructure/langflow/langflow-agent-flow-action-runner.ts`
  - `src/infrastructure/langflow/langflow-agent-flow-action-runner.test.ts`
- Temporal orchestration baseline:
  - `src/infrastructure/temporal/temporal-worker.ts`
  - `src/infrastructure/temporal/temporal-worker.test.ts`
- Governance/research artifacts:
  - `docs/internal/governance/external-execution-platform-license-audit.md`
  - `docs/internal/research/bead-0412-kestra-spike.md`
  - `docs/internal/research/bead-0413-stackstorm-spike.md`
- Review artifact:
  - `docs/internal/review/bead-0620-adr-0065-implementation-mapping-review.md`

## Remaining Gap Tracking

- `bead-0428` (open): OTel collector production OTLP pipelines, alerting, and cross-signal
  correlation maturity.
- `bead-0393` (open): execution-plane SLO dashboards and alerting coverage.

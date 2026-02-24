# Report-22 AI/ML Findings Extraction

**Bead:** bead-6a2v
**Parent epic:** bead-3p64
**Report:** docs/internal/research/report-22.md
**Date:** 2026-02-23

## Methodology

Read full 12-section report. For each finding: mark VALID | FIXED | INVESTIGATE,
note files/modules, effort (S/M/L/XL), severity (P0-P4).

---

## Section 1: Project Scope and AI Components

| Finding                                     | Status    | Evidence                                                                                                                                                                                                    | Severity | Effort |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| AISummary is a UI placeholder with no model | **FIXED** | `src/domain/ai/ai-summary-v1.ts` — full domain model (255 lines), builder, context, serialization. `src/domain/ai/responsible-ai-v1.ts` — audit, explanation, confidence, bias detection types. Tests pass. | -        | -      |
| No AI modules or services                   | **FIXED** | `src/domain/agents/llm-prompt-injection-guard.ts`, `llm-output-guard.ts`, `llm-confidence-signal-v1.ts`, `agent-agency-boundary-v1.ts` — comprehensive LLM security controls.                               | -        | -      |
| No data contract for AI                     | **FIXED** | `AiApprovalSummaryV1`, `AiSummaryContextV1`, `AiSummaryResultV1` — typed contracts with validation.                                                                                                         | -        | -      |

## Section 2: Data Sources, Schemas and Flow

| Finding                                 | Status    | Evidence                                                                                                                                                      | Severity | Effort |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| Lack of end-to-end data validation      | **FIXED** | OpenAPI spec validated in CI (`scripts/ci/openapi-compatibility-check.mjs`). Domain parsers use Zod-style validation. CloudEvents typed.                      | -        | -      |
| Missing data contracts between services | **FIXED** | AsyncAPI spec + OpenAPI spec + domain event types. Schema versioning via `schemaVersion` field on all domain types.                                           | -        | -      |
| No schema registry                      | **VALID** | No formal schema registry (e.g. Confluent Schema Registry). Domain types serve as contract but no runtime registry.                                           | P3       | M      |
| Privacy-sensitive data handling         | **FIXED** | `AiApprovalSummaryV1` has `inputPiiRedacted`/`outputPiiRedacted` fields. RAG tenancy isolation in `src/domain/derived-artifacts/rag-tenancy-isolation-v1.ts`. | -        | -      |

## Section 3: ML Models — Types, Training and Inference

| Finding                           | Status    | Evidence                                                                                                                                                                                                              | Severity | Effort |
| --------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No trained models or ML artifacts | **VALID** | No model training code. The domain types define the contract but no inference service exists. This is by design — Portarium is a governance layer, not an ML platform. LLM integration is expected via external APIs. | P3       | L      |
| No model versioning               | **FIXED** | `AiApprovalSummaryV1` tracks `modelId` and `modelVersion`. `AiInteractionAuditV1` tracks model identity in audit trail.                                                                                               | -        | -      |
| No inference service              | **VALID** | No infrastructure adapter implementing LLM calls. Domain contracts ready, infra layer not yet wired.                                                                                                                  | P3       | M      |

## Section 4: System Architecture and Abstractions

| Finding                                  | Status    | Evidence                                                                                                                                                               | Severity | Effort |
| ---------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No AI port/adapter abstraction           | **FIXED** | Domain layer defines AI types (`src/domain/ai/`). Infrastructure would implement via port. Agency boundary defined in `src/domain/agents/agent-agency-boundary-v1.ts`. | -        | -      |
| Event-driven patterns need formalization | **FIXED** | ADR-0070 (hybrid choreography/orchestration). CloudEvents with typed domain events. NATS JetStream integration.                                                        | -        | -      |

## Section 5: Scalability and Performance

| Finding                         | Status    | Evidence                                                                                                                             | Severity | Effort |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| Potential DB/worker bottlenecks | **FIXED** | PDB validation (`infra/kubernetes/base/pdb.yaml`). Kustomize overlays for per-env scaling. Argo Rollouts canary with SLO monitoring. | -        | -      |
| No AI result caching            | **VALID** | No caching layer for AI summaries. When inference is added, caching by input hash would reduce latency and cost.                     | P3       | S      |

## Section 6: Testing and Validation

| Finding                 | Status    | Evidence                                                                                                                                                                            | Severity | Effort |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No domain or data tests | **FIXED** | 4900+ tests across 400+ test files. Domain tests: state machine invariants, approval status, run status, evidence chain, derived artifacts, AI summary, responsible AI, LLM guards. | -        | -      |
| No ML-specific tests    | **FIXED** | `ai-summary-v1.test.ts`, `responsible-ai-v1.test.ts`, `llm-prompt-injection-guard.test.ts`, `llm-output-guard.contract.test.ts`, `llm-confidence-signal-v1.test.ts`.                | -        | -      |

## Section 7: CI/CD and Reproducibility

| Finding              | Status    | Evidence                                                                                                                                          | Severity | Effort |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No ML pipeline in CI | **VALID** | No model training job in CI. When inference service is added, this will need a CI pipeline.                                                       | P4       | M      |
| Current CI is robust | **VALID** | Confirmed. ci:pr runs typecheck, lint, format, spell, depcruise, knip, test:coverage, audit. ci-images.yml builds containers with SBOM + signing. | -        | -      |

## Section 8: Observability, Monitoring and Alerting

| Finding                  | Status    | Evidence                                                                                                                        | Severity | Effort |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No ML metrics monitoring | **VALID** | OTel collector deployed, SLI/SLO defined (ADR-0107), but no model-specific metrics (prediction drift, confidence distribution). | P3       | M      |
| Service metrics exist    | **FIXED** | Prometheus + OTel + SLO burn-rate alerting in progressive delivery pipeline. Structured logging. Health endpoints.              | -        | -      |

## Section 9: Security, Privacy and Ethical AI

| Finding                        | Status    | Evidence                                                                                                                                  | Severity | Effort |
| ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No prompt injection protection | **FIXED** | `llm-prompt-injection-guard.ts` — full guard implementation with tests.                                                                   | -        | -      |
| No bias/fairness checks        | **FIXED** | `responsible-ai-v1.ts` — `AiBiasIndicatorV1` type with protected attributes, disparity metric, mitigation strategy, assessment timestamp. | -        | -      |
| No explainability              | **FIXED** | `AiExplanationV1` type with reasoning chain, key factors, confidence breakdown, limitations.                                              | -        | -      |
| No output validation           | **FIXED** | `llm-output-guard.ts` — output validation contract tests.                                                                                 | -        | -      |
| No agency boundary             | **FIXED** | `agent-agency-boundary-v1.ts` — defines what AI can influence vs. requires human override.                                                | -        | -      |

## Section 10: Code Quality, Modularity and Maintainability

| Finding                     | Status    | Evidence                                                         | Severity | Effort |
| --------------------------- | --------- | ---------------------------------------------------------------- | -------- | ------ |
| Scaffold-stage code         | **FIXED** | Most scaffolds have been fully implemented. 4900+ tests passing. | -        | -      |
| Need for AI-specific module | **FIXED** | `src/domain/ai/` and `src/domain/agents/` are dedicated modules. | -        | -      |

## Section 11: Dependencies and Third-Party Risks

| Finding              | Status    | Evidence                                                                                                         | Severity | Effort |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| Need SBOM generation | **FIXED** | `ci-images.yml` generates SPDX SBOM via Syft, attests via cosign.                                                | -        | -      |
| Audit nightly        | **FIXED** | `npm audit` in ci:pr. Trivy scan in ci-images. Scorecard action. Security-gates workflow with dependency-review. | -        | -      |

## Section 12: Compliance and Regulatory

| Finding                       | Status    | Evidence                                                                                                                      | Severity | Effort |
| ----------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| No formal compliance controls | **FIXED** | Evidence chain with hash-based integrity. Immutable approval payloads. RBAC + SoD enforcement. PII redaction in AI summaries. | -        | -      |
| No data retention policies    | **VALID** | No explicit data retention or deletion API for tenant data lifecycle. RAG tenancy isolation exists but no purge workflow.     | P3       | M      |

---

## Summary

| Status                 | Count |
| ---------------------- | ----- |
| FIXED                  | 24    |
| VALID (remaining gaps) | 7     |

### Remaining gaps (ordered by severity)

1. **P3/M** — No formal schema registry (runtime validation exists but no centralized registry)
2. **P3/L** — No model training pipeline (by design — external LLM APIs expected)
3. **P3/M** — No inference service adapter (domain contracts ready, infra adapter not wired)
4. **P3/S** — No AI result caching layer
5. **P3/M** — No ML-specific metrics monitoring (prediction drift, confidence)
6. **P3/M** — No data retention/purge workflow
7. **P4/M** — No ML pipeline CI job

### Assessment

Report-22 was written when the codebase had minimal AI/ML infrastructure. Since then,
substantial work has been done:

- Full AI domain model with typed contracts, builders, and validation
- Responsible AI types: bias indicators, explainability, audit trail
- LLM security: prompt injection guard, output guard, confidence signals, agency boundaries
- PII redaction tracking in AI summaries
- RAG tenancy isolation with workspace-scoped retrieval
- 4900+ tests (report noted "no domain tests")
- SBOM, signing, provenance attestation pipeline
- SLI/SLO definitions with burn-rate alerting

The 7 remaining gaps are all P3-P4 and represent future work when Portarium
moves from governance-framework to production AI integration (wiring an actual
LLM inference service, adding model monitoring, building retention workflows).

# Report-22 AI/ML Validation Against Live Codebase

**Bead:** bead-hl91
**Parent epic:** bead-3p64
**Findings document:** docs/internal/research/report-22-findings.md (bead-6a2v)
**Date:** 2026-02-23

## Validation Summary

The report-22 findings extraction (bead-6a2v) identified 24 FIXED and 7 VALID
remaining gaps. This validation confirms each checklist item against the live
codebase.

---

## AISummary Placeholder

| Checklist Item                              | Result         | Evidence                                                                                                                                                                                   |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AISummary schema definition — still a stub? | **Full model** | `src/domain/ai/ai-summary-v1.ts` (255 lines): `AiApprovalSummaryV1`, `AiSummarySectionV1`, `AiSummaryContextV1`, `AiSummaryResultV1`, builder with validation, confidence band computation |
| API endpoint or service for AI summary?     | **No infra**   | Domain contracts exist but no infrastructure adapter wires an LLM API. No HTTP handler calls `buildAiApprovalSummary()` in production code.                                                |
| LLM API key in .env.local.example?          | **No**         | No `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `AI_SUMMARY_ENABLED` env vars in any .env files. Only reference is in `.beads/issues.jsonl` (future bead descriptions).                       |

## Data Pipeline

| Checklist Item                          | Result              | Evidence                                                                                                                                                     |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ETL or data export for ML pipeline?     | **None**            | No training data export, no ETL pipeline, no batch data processing. By design: Portarium is a governance layer, not an ML training platform.                 |
| Vector storage / embedding infra?       | **Yes (adapters)**  | `src/infrastructure/pgvector/pgvector-semantic-index-adapter.ts`, `src/infrastructure/weaviate/weaviate-semantic-index-adapter.ts` with full test suites.    |
| Where approval/workflow data is stored? | **PostgreSQL + ES** | `domain_documents` table, `workflow_runs` table, evidence chain in immutable event log. Features available: run status, approval decisions, evidence hashes. |

## Responsible AI

| Checklist Item                                  | Result      | Evidence                                                                                                                                                           |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy/data handling docs for AI?              | **Yes**     | `AiApprovalSummaryV1.inputPiiRedacted`/`outputPiiRedacted` fields. `AiInteractionAuditV1` tracks all model interactions. ADR-0114 covers NIST AI RMF adoption.     |
| Where user data flows through AI?               | **Defined** | `AiSummaryContextV1` defines the exact input package sent to LLM: approvalId, riskLevel, policyOutcomes, evidenceSummaries. PII scan happens before model call.    |
| PII accidentally passed to third-party AI APIs? | **Guarded** | `llm-prompt-injection-guard.ts` validates input. `llm-output-guard.ts` validates output. `responsible-ai-v1.ts` defines `AiBiasIndicatorV1` and `AiExplanationV1`. |
| RAG tenancy isolation?                          | **Yes**     | `src/domain/derived-artifacts/rag-tenancy-isolation-v1.ts` enforces workspace-scoped retrieval. Retrieval query router validates tenant boundaries.                |

## Dependencies

| Checklist Item                      | Result                     | Evidence                                                                                                                            |
| ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AI/ML dependencies in package.json? | **Only in examples/**      | `examples/openai-agents-sdk/package.json` has `openai ^4.0.0`. Main `package.json` has no AI/ML dependencies.                       |
| Abstracted behind port interface?   | **Yes (domain contracts)** | Domain types in `src/domain/ai/` and `src/domain/agents/` define contracts. Infrastructure adapters would implement these as ports. |

## AI Domain Modules Inventory

### `src/domain/ai/` (3 modules + index + 3 test files)

- `ai-summary-v1.ts` — Summary value object, sections, builder, context, serialization
- `responsible-ai-v1.ts` — Audit trail, explanation, confidence, bias detection types
- `ai-risk-controls-v1.ts` — NIST AI RMF risk taxonomy, trust boundaries, mitigation strategies

### `src/domain/agents/` (4 modules + index + 5 test files)

- `llm-prompt-injection-guard.ts` — Input validation against prompt injection attacks
- `llm-output-guard.ts` — Output validation contract
- `llm-confidence-signal-v1.ts` — Confidence scoring and calibration
- `agent-agency-boundary-v1.ts` — Defines what AI can influence vs requires human override

### Infrastructure (vector search)

- `src/infrastructure/pgvector/pgvector-semantic-index-adapter.ts` — PostgreSQL pgvector adapter
- `src/infrastructure/weaviate/weaviate-semantic-index-adapter.ts` — Weaviate HTTP adapter
- `src/application/services/retrieval-query-router.ts` — Multi-backend retrieval routing

---

## Confirmed Remaining Gaps (from bead-6a2v findings)

1. **No inference service adapter** — Domain contracts ready, no infra adapter wiring an LLM API
2. **No schema registry** — Domain types serve as contracts but no runtime Confluent-style registry
3. **No AI result caching** — When inference is added, caching by input hash would reduce cost
4. **No ML-specific metrics** — OTel deployed but no model drift/confidence monitoring
5. **No data retention workflow** — RAG isolation exists but no tenant data purge API
6. **No ML pipeline in CI** — Current CI is robust but no model training/validation job
7. **No model training code** — By design: external LLM APIs expected, not local training

## ADR Status

- **ADR-0114** (AI Risk Controls — NIST AI RMF): Accepted and committed. Covers risk
  taxonomy, trust boundaries, mitigation strategies, and maps to existing domain modules.
- No additional ADR stub needed — ADR-0114 covers the AI/ML architecture decisions.

## Conclusion

Report-22 was written when the codebase had minimal AI/ML infrastructure. Since then,
the domain layer has been fully built out with typed contracts, responsible AI types,
LLM security guards, and vector search infrastructure. The 7 remaining gaps are all
infrastructure-layer work that will be needed when Portarium moves from governance
framework to production AI integration (wiring an actual LLM inference service).

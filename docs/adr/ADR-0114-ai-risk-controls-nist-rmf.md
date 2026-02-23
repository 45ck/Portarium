# ADR-0114: AI Risk Controls — Lightweight NIST AI RMF Adoption

## Status

Accepted

## Context

Portarium uses AI features across several critical paths: the approval advisor
(recommends approve/deny), evidence summarisation, RAG-based retrieval, blast
radius analysis, and risk assessment. These features influence human decisions
in approval workflows where errors can have operational and compliance
consequences.

The NIST AI Risk Management Framework (AI RMF 1.0) provides a structured
approach to managing AI risks through four core functions: Govern, Map,
Measure, Manage. We need a lightweight adoption that fits Portarium's domain
model without importing the full framework bureaucracy.

Existing foundations already in place:

- PII guardrails and redaction (`responsible-ai-v1.ts` — bead-im6n)
- LLM output validation (`llm-output-guard.ts` — bead-tz6c)
- Prompt injection detection (`llm-prompt-injection-guard.ts` — bead-tz6c)
- Agency boundaries (`agent-agency-boundary-v1.ts` — bead-tz6c)
- Confidence signals (`llm-confidence-signal-v1.ts` — bead-tz6c)
- AI interaction audit logging (`responsible-ai-v1.ts` — bead-im6n)
- Explainability model (`responsible-ai-v1.ts` — bead-im6n)

What was missing: a risk taxonomy, trust boundary definitions (what AI can
influence vs. what requires human override), monitoring metrics, and incident
classification for AI failures.

## Decision

Introduce `ai-risk-controls-v1.ts` in `src/domain/ai/` with:

1. **Risk taxonomy**: Seven risk categories mapped from NIST AI RMF to
   Portarium's context (validity-reliability, safety, fairness-bias,
   transparency, privacy, security, accountability).

2. **Risk rating matrix**: 5x5 impact-by-likelihood matrix producing four
   risk ratings (low, medium, high, critical). Standard enterprise risk
   approach, no novelty.

3. **Trust boundaries**: Per-feature, per-workspace policy defining what
   level of autonomous decision-making (inform-only, recommend,
   auto-with-review, auto-no-review) is permitted at each risk level.
   Enforces monotonicity (higher risk never grants more autonomy) and
   hard limits (critical risk cannot be auto, high risk cannot be
   auto-no-review).

4. **Monitoring metrics**: Structured type for tracking recommendation
   accuracy, false positive/negative rates, acceptance rates, and human
   correction counts per AI feature per time window. Enables the Measure
   function of NIST AI RMF.

5. **Incident classification**: Structured incident records for tracking
   AI failures that led to wrong approvals. Includes severity (sev1-sev4),
   root cause taxonomy, affected decision references, and corrective
   actions. sev1 incidents where AI was the primary cause must have
   corrective actions.

6. **Feature risk assessment**: Per-feature risk profile following the
   Map and Measure functions. Validates that calculated ratings match
   impact x likelihood, and that residual risk does not exceed inherent
   risk.

## Consequences

- Trust boundary validation enforces the safety invariant that critical-risk
  AI actions always require human involvement.
- Monitoring metrics provide the data needed for the Measure function;
  infrastructure layer will populate these from production telemetry.
- Incident records create a feedback loop: AI failures are classified and
  tracked, informing trust boundary adjustments.
- The risk taxonomy is deliberately Portarium-specific (not a generic NIST
  implementation) to keep it actionable.
- Future work: integrate trust boundary resolution into the approval workflow
  orchestration layer to enforce boundaries at runtime.

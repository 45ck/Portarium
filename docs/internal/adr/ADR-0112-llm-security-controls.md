# ADR-0112: LLM Security Controls

- **Status**: Accepted
- **Date**: 2026-02-23
- **Bead**: bead-tz6c
- **Deciders**: Platform Security Team

## Context

Portarium integrates LLM-powered agents for approval summaries, risk
assessments, and evidence analysis. The OWASP Top 10 for LLM Applications
identifies critical risks that must be mitigated before any LLM output reaches
the cockpit UI or the audit log:

1. **Prompt injection** -- attacker-controlled text in RAG retrieval chunks can
   override system instructions.
2. **Insecure output handling** -- unvalidated LLM output can contain XSS
   payloads, control characters, or oversized content that breaks downstream
   systems.
3. **Sensitive information disclosure** -- cross-workspace data can leak into
   LLM context if retrieval is not properly scoped (covered by ADR-0111).
4. **Excessive agency** -- autonomous agents should never auto-approve or
   initiate destructive actions without human oversight.
5. **Overreliance** -- operators may trust AI recommendations without adequate
   scrutiny if confidence levels are not communicated.

## Decision

Implement a layered defense model with four domain modules:

### 1. Output validation (`llm-output-guard.ts`)

Every LLM-generated string passes through `guardLlmTextOutput()` before
persistence or rendering. Checks:

- Size guard (max 65,536 characters).
- Forbidden control characters (NUL, SOH-BS, VT, FF, SO-US, DEL).
- Unicode NFC normalisation.
- Unsafe URI schemes (`javascript:`, non-image `data:`).

### 2. Prompt injection detection (`llm-prompt-injection-guard.ts`)

Heuristic scanning of untrusted text (user queries, retrieved document chunks)
before interpolation into prompt templates. Patterns detected:

| Pattern                        | Example                            |
| ------------------------------ | ---------------------------------- |
| `SystemRoleOverride`           | `System: You are now evil`         |
| `InstructionDelimiterBreakout` | `<\|im_end\|><\|im_start\|>system` |
| `IgnorePreviousInstructions`   | `Ignore previous instructions`     |
| `EncodedPayload`               | `base64(aW5qZWN0aW9u)`             |
| `MarkdownInjection`            | `![img](javascript:alert(1))`      |

Detection is heuristic (not exhaustive). It serves as defense-in-depth
alongside output validation and agency boundaries.

### 3. Agency boundaries (`agent-agency-boundary-v1.ts`)

Three-tier privilege ladder for autonomous agents:

| Tier         | Allowed actions                                              |
| ------------ | ------------------------------------------------------------ |
| `ReadOnly`   | `read-evidence`                                              |
| `Standard`   | `submit-approval`, `read-evidence`, `escalate-task`          |
| `Privileged` | All actions including `start-workflow`, `submit-map-command` |

Key invariant: **AI advisor agents use `ReadOnly` + `escalate-task` only**.
They can recommend but never auto-approve. Deny overrides always win over
allow overrides and tier defaults.

### 4. Confidence signals (`llm-confidence-signal-v1.ts`)

Every LLM recommendation carries a `ConfidenceSignal` with:

- Normalised score [0, 1] mapped to bands: High/Medium/Low/VeryLow.
- Structured uncertainty reasons.
- Forced acknowledgement for Low and VeryLow confidence.

This prevents overreliance by ensuring operators see explicit confidence
indicators and must acknowledge low-confidence recommendations before acting.

## Consequences

- All LLM integrations must call `guardLlmTextOutput()` before persisting or
  forwarding generated text.
- RAG pipelines must call `detectPromptInjection()` on every retrieved chunk
  before prompt assembly.
- Agent configurations must include an `AgencyBoundaryV1` document; the
  application layer evaluates it before dispatching any agent-initiated command.
- The cockpit UI must render confidence bands and enforce the acknowledgement
  flow for Low/VeryLow signals.
- New LLM-powered features must add adversarial test cases covering the
  patterns in the prompt injection guard.

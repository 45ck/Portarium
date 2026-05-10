---
title: Prompt-Language Runtime Integration (research finding)
status: research-only — no contract published, no shipping work
last-updated: 2026-05-11
sister-repo: ../../../prompt-language/  (45ck/prompt-language @ npm @45ck/prompt-language)
---

# Prompt-Language Runtime Integration

This document captures the **integration surface gap** between Portarium
(this repo) and `@45ck/prompt-language` (sister repo at `../prompt-language/`).
It is a research finding, not a published contract or planned spec, and no
code in either repo currently implements this integration.

## Why this exists

Prompt-Language (PL) is a verification-first supervision runtime for coding
agents — gates, retries, model routing, manifests, signed traces. Portarium
is the operator control plane for AI agents — policy, approvals, evidence,
audit. The two repos are designed to plug together: PL would execute
governed flows; Portarium would dispatch them, track approvals, and ingest
the evidence trail. But the contract between them is not written down on
either side.

This document maps the actual exposed surfaces today and lists the
artifacts that would need to exist for the integration to ship.

## Surface today

### Portarium control plane (already shipped)

- HTTP API: `docs/spec/openapi/portarium-control-plane.v1.yaml`
  - `POST /v1/workspaces/{wsId}/agent-actions:propose` — governance gate
    for tool calls (used by the OpenClaw `before_tool_call` hook)
  - `GET|POST /v1/workspaces/{wsId}/runs` — start/poll workflow runs
  - `GET /v1/workspaces/{wsId}/agents` — list registered agents
  - `GET /v1/workspaces/{wsId}/machines` — list OpenClaw machine
    registrations
- SDK: `src/sdk/portarium-client.ts` — orchestration-consumer methods
  (`runs.start`, `approvals.submit`, `evidence.getChain`, `agents.list`)
- Evidence: internal `agent-action-evidence-hooks.ts` records
  `ActionDispatched | ActionCompleted | ActionFailed`; no public push
  endpoint for external runtimes

### Prompt-language runtime (already shipped)

- CLI: `bin/cli.mjs` — local Claude Code plugin; flows persisted to
  `.prompt-language/session-state.json`
- SDK: `src/index.ts`, `src/sdk.ts` — `parseFlow`, `createSession`,
  `evaluateCompletion`, `advanceFlow`; types `FlowSpec`, `CompletionGate`,
  `SessionState`
- MCP server: `bin/mcp-server.mjs` — resources `flow://state`,
  `flow://variables`, `flow://gates`, `flow://audit`; tools
  `flow_status`, `flow_reset`, `flow_set_variable`
- Provenance: signed Merkle trace, witness shim, attestation verifier
  (see PL `docs/tracing-and-provenance.md`)

## The gap

Five contract concerns are unspecified on both sides:

1. **Runtime registration.** No inbound HTTP endpoint on Portarium to
   accept "I am a flow runtime, here is my version/capabilities/endpoint";
   no schema for a `FlowRuntimeDescriptor`. Portarium currently models all
   agents as OpenClaw machine-bound.
2. **Flow dispatch.** No HTTP contract for "start this flow with these
   variables, expect this completion gate." No mapping between Portarium
   `RunId` / `WorkflowId` and PL `SessionState` / `FlowSpec`.
3. **Evidence and gate-result bridge.** No Portarium endpoint for
   `POST /workspaces/{wsId}/flows/{flowInstanceId}/evidence`. No schema
   for `FlowCompletionReport` (gate name, pass/fail, artifacts, timing,
   provenance hash). Current Portarium evidence categories
   (`PolicyViolation | ApprovalGate | ActionCompleted`) have no
   `FlowGateVerification` member.
4. **Workspace / tenant binding.** No declared model for whether a PL
   instance is single-workspace or multi-tenant; no auth contract
   (bearer / mTLS) for PL ↔ Portarium calls.
5. **Capability declaration.** Portarium agents declare `allowedTools`
   and `policyTier`; PL has neither concept. No mapping from PL
   completion gates to Portarium capability/policy tiers.

## Where it would naturally live (Portarium)

Listed for orientation, not as commitment:

- **Domain:** `src/domain/` — `FlowRuntimeRegistration`,
  `FlowExecutionRequest` value objects (alongside `MachineRegistrationV1`,
  `AgentConfigV1`).
- **Application:** `src/application/commands/` — `RegisterFlowRuntime`,
  `DispatchFlowRun`. `src/application/queries/` — runtime listing /
  presence.
- **Presentation:** `src/presentation/runtime/control-plane-handler.flow-runtimes.ts`
  with endpoints `POST /workspaces/{wsId}/flow-runtimes`,
  `POST /workspaces/{wsId}/flow-runtimes/{runtimeId}/heartbeat`,
  `POST /workspaces/{wsId}/runs/{runId}/flow-dispatch`.
- **Evidence:** new `FlowGateVerification` event type in
  `src/domain/event-stream/` and a corresponding evidence hook.
- **SDK:** new `flowRuntimes` and `flowRuns` namespaces on
  `PortariumClient`.
- **Spec:** extension of `docs/spec/openapi/portarium-control-plane.v1.yaml`
  (or sibling YAML) covering the new endpoints.
- **ADR:** a new ADR (provisionally `ADR-0150-prompt-language-verification-runtime-integration`)
  defining the bounded-execution contract between Portarium policy gates
  and PL completion gates.

## Status and trigger

This integration is **deliberately not started**. Justification:

- PL's hybrid local/frontier orchestration thesis is still in the
  evidence-gathering phase (HA-HR1 portfolio, see
  `prompt-language/docs/strategy/program-status.md` §2a). Spec'ing a
  Portarium contract before the PL hypothesis is validated risks
  hardening around an architecture that may need to change.
- Portarium's own roadmap names PL as future work for the same reason
  (see `README.md` §"What's left" line currently being updated alongside
  this doc).

The trigger to start integration work is the first portfolio-level
positive verdict on the kill rule
(`prompt-language/docs/strategy/thesis.md` §"Kill rule") — i.e. ≥3
distinct task classes outside hybrid-failure-mode, ideally with at least
one route producing a claim-eligible bundle per PL §3a. At that point the
PL hypothesis is strong enough that hardening a Portarium contract earns
its keep.

## Cross-references

- PL side: [`prompt-language/docs/research/portarium-integration-spike.md`](../../../prompt-language/docs/research/portarium-integration-spike.md)
- PL kill rule: [`prompt-language/docs/strategy/thesis.md`](../../../prompt-language/docs/strategy/thesis.md) §"Kill rule"
- PL hybrid-efficiency tracker: [`prompt-language/docs/strategy/program-status.md`](../../../prompt-language/docs/strategy/program-status.md) §2a
- Portarium control plane spec: [`docs/spec/openapi/portarium-control-plane.v1.yaml`](../spec/openapi/portarium-control-plane.v1.yaml)

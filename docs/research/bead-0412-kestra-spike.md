# Bead-0412 Spike: Kestra for CloudEvents-Triggered Ops/Pipeline Workloads

Date: 2026-02-20
Bead: `bead-0412`

## Scope

Evaluate Kestra as an optional execution-plane runtime for event-driven ops/pipeline workloads.
Focus areas:

- architecture fit for CloudEvents-style triggers,
- deployment/operational cost,
- OpenTelemetry compatibility,
- license/commercial risk.

## Findings

## 1) Architecture fit

- Kestra provides event/trigger-driven flow execution and supports webhook-style trigger entrypoints, which aligns with CloudEvents ingress patterns where Portarium can map event envelopes to flow inputs.
- Kestra runtime architecture is split into decoupled components with queue-backed execution, which fits scale-out worker models for bursty pipeline workloads.

Assessment: **Good fit** as a secondary runtime for asynchronous ops workflows and pipeline-style jobs.

## 2) Deployment and operational cost

- Kestra deployment is not a single-process toy path at scale; it introduces scheduler/executor/worker and backing services that add operational overhead compared to direct in-process adapters.
- Cost profile is acceptable if used for workloads that benefit from queue-backed execution and native scheduling, but high if used as a default for all action execution.

Assessment: **Moderate cost**; justified only for targeted workload classes.

## 3) OpenTelemetry compatibility

- Kestra official architecture docs indicate OpenTelemetry support (traces/metrics/logs) in recent versions.

Assessment: **Positive compatibility** for Portarium observability requirements.

## 4) License risk

- Kestra OSS core is Apache-2.0.
- Commercial/enterprise feature boundaries exist; critical-path assumptions must remain valid on OSS features.

Assessment: **Low-to-moderate license risk** with clear OSS-only guardrails.

## Recommendation

- Keep Kestra as an **optional secondary runtime** (consistent with ADR-0065), primarily for:
  - CloudEvents-triggered ops pipelines,
  - scheduled/batch-heavy workflow classes,
  - high-concurrency async workloads needing queue-backed execution.
- Do not make Kestra a control-plane correctness dependency.
- Enforce OSS-only compatibility for mandatory behaviors and treat enterprise-only capabilities as optional enhancements.

## References

- Kestra workflow triggers docs: https://kestra.io/docs/workflow-components/triggers
- Kestra architecture and OpenTelemetry notes: https://kestra.io/docs/architecture
- Kestra OSS repository (Apache-2.0): https://github.com/kestra-io/kestra

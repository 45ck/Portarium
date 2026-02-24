# Bead-0413 Spike: StackStorm for Event-Driven IT Ops Automation

Date: 2026-02-20
Bead: `bead-0413`

## Scope

Evaluate StackStorm as an optional execution-plane runtime for event-driven IT ops automation.
Focus areas:

- architecture fit for sensors/rules/workflows in ITSM/monitoring families,
- deployment/operational cost,
- observability compatibility (including OpenTelemetry posture),
- license risk.

## Findings

## 1) Architecture fit

- StackStorm is explicitly event-driven and built around sensors -> triggers -> rules -> actions/workflows, which aligns with IT operations response patterns.
- Its pack-based model is useful for organizing domain-specific automation capabilities and can map to Portarium adapter-family boundaries.

Assessment: **Strong fit** for ITSM/monitoring event automation workloads.

## 2) Deployment and operational cost

- StackStorm architecture includes multiple services and supporting infrastructure, increasing deployment/maintenance complexity versus lightweight adapters.
- Operational cost is reasonable for dedicated IT ops automation domains, but expensive if used as a general-purpose execution substrate across all workflows.

Assessment: **Moderate-to-high cost**; best for focused IT ops scope.

## 3) Observability compatibility

- Official docs include metrics/monitoring guidance (for example, Prometheus/StatsD style telemetry), but first-class OpenTelemetry-native guidance is limited.
- Inference: OpenTelemetry can be integrated via bridge/export pipelines, but is not as turnkey as runtimes with explicit OTel-first support.

Assessment: **Usable with extra integration effort** for OTel-standardized telemetry.

## 4) License risk

- StackStorm OSS core is Apache-2.0.
- Main risk area is third-party pack ecosystem license/compliance drift.

Assessment: **Low core license risk**, **moderate ecosystem governance risk**.

## Recommendation

- Keep StackStorm as an **optional targeted runtime** for ITSM/monitoring family scenarios that benefit from sensor/rule automation.
- Do not use it as default execution runtime for all Portarium workloads.
- If adopted:
  - gate pack adoption with license/security review,
  - constrain to well-defined event classes,
  - enforce telemetry normalization into Portarium OTel pipelines.

## References

- StackStorm docs: https://docs.stackstorm.com/
- StackStorm architecture: https://docs.stackstorm.com/reference/architecture.html
- StackStorm metrics/monitoring: https://docs.stackstorm.com/admin/st2metrics.html
- StackStorm OSS repository (Apache-2.0): https://github.com/StackStorm/st2

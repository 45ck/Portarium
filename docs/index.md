# Portarium Docs

This is the documentation map for Portarium. Start with the shortest path for what you need.

## New To Portarium

1. [README](../README.md) - short product explanation
2. [Project overview](project-overview.md) - what Portarium is and is not
3. [Project scope](project-scope.md) - core product vs future work
4. [Glossary](glossary.md) - project vocabulary
5. [Competitive positioning](positioning/competitive-positioning.md) - how Portarium differs from alternatives
6. [Architecture](explanation/architecture.md) - system design
7. [Agent traffic controller](explanation/agent-traffic-controller.md) - how agents route actions through governance

## First 30 Minutes

These docs focus on the core tested governance loop.

1. `docs/getting-started/hello-portarium.md` - fastest local validation
2. `docs/tutorials/hello-governed-workflow.md` - guided end-to-end flow
3. [Core governance eval](how-to/run-core-governance-eval.md) - simulated agent plus approval stream check
4. [Evidence trace](tutorials/evidence-trace.md) - inspect evidence from a governed action
5. [Quality gates](how-to/run-quality-gates.md) - local verification commands
6. [CI and quality reference](reference/ci-and-quality.md) - what the gates cover
7. [Scenario traceability](internal/governance/scenario-traceability-matrix.md) - internal test coverage mapping

## Run It Locally

1. [Local development](getting-started/local-dev.md)
2. [Runtime and environment variables](reference/runtime-and-env.md)
3. [First-run local integrations](how-to/first-run-local-integrations.md)
4. [Cockpit demos locally](how-to/run-cockpit-demos-locally.md)

## Build With Portarium

1. [HTTP API reference](reference/http-api.md)
2. [OpenAPI contract](spec/openapi/portarium-control-plane.v1.yaml)
3. [SDK integration patterns](sdk/integration-patterns.md)
4. [Ports and adapters](explanation/ports-and-adapters.md)
5. [Integration ladder](integration/integration-ladder.md)
6. [Integration demo walkthrough](integration/demo-walkthrough.md)
7. [Generate integration scaffolds](how-to/generate-integration-scaffolds.md)

## Operate And Secure It

1. [Security policy](../SECURITY.md)
2. [Support](../SUPPORT.md)
3. [Security baseline gates](how-to/security-baseline-gates.md)
4. [Supply-chain guardrails](how-to/supply-chain-guardrails.md)
5. [Runtime and env vars](reference/runtime-and-env.md)
6. [Compliance docs](compliance/vector-graph-embedding-license-gate.md)

## Contribute

1. [Contributing](../CONTRIBUTING.md)
2. [Code of conduct](../CODE_OF_CONDUCT.md)
3. [Contributor onboarding](getting-started/contributor-onboarding.md)
4. [Development workflow](getting-started/dev-workflow.md)
5. [Repo organization](reference/repo-organization.md)
6. [Developer onboarding track](onboarding/dev-track.md)
7. [SRE onboarding track](onboarding/sre-track.md)
8. [SecOps onboarding track](onboarding/secops-track.md)
9. [Glossary](glossary.md)

## Product Direction

1. [Roadmap](roadmap.md)
2. [Project scope](project-scope.md)
3. [Competitive positioning](positioning/competitive-positioning.md)
4. [Dual-voice guide](positioning/dual-voice-guide.md)

## Reference

- [Schemas](reference/schemas.md)
- [Domain model](domain/README.md)
- [Canonical objects](domain/canonical-objects.md)
- [ADR index](explanation/adr-index.md)
- [FAQ](faq.md)
- [Changelog](changelog.md)

## Internal Maintainer Docs

Internal planning, reviews, runbooks, and Beads governance live under [docs/internal](internal/index.md). They are useful for maintainers, but new users should start with the public docs above.

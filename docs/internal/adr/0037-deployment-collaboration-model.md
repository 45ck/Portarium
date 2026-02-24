# ADR-0037: Deployment and Collaboration Model

## Status

Accepted

## Context

VAOP/Portarium must support both solo developers running locally and teams deploying to shared infrastructure. The system has two kinds of truth: definitions (runbooks, policies, adapter manifests) that benefit from version control, and runtime state (runs, approvals, evidence) that requires a persistent store.

## Decision

Portarium ships as an **API server + database + evidence store** (required components). A one-command local compose (`docker compose up`) provides a complete dev environment.

- **Git is the source of truth for definitions** (workflows/runbooks, policies, adapter manifests, capability matrices).
- The **Portarium database is the source of truth for runtime state** (runs, approvals, evidence, credentials).
- Execution runs on **distributed workers** (local laptops, on-prem servers, cloud) that report verified effects back to the control plane.
- Workers authenticate via the same tenant credential/RBAC system.

## Consequences

- Clear separation between "what should happen" (Git) and "what did happen" (DB).
- Local development is straightforward with a single compose command.
- Teams can review workflow/policy changes via standard Git workflows (PRs, code review).
- Distributed workers enable flexible deployment topologies.
- Requires a sync mechanism between Git definitions and runtime configuration.

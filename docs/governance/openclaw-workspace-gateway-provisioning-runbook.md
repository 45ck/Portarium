# OpenClaw Workspace Gateway Provisioning Runbook

## Purpose

Provision a new OpenClaw Gateway instance for a single workspace with enforceable
credential and network isolation controls from ADR-0072.

## Preconditions

- Workspace exists and has a stable `workspaceId`.
- Control-plane worker identity for the target environment is available.
- Vault (or equivalent secrets manager) is available.
- Gateway deployment manifests/chart are available for the environment.

## Required Inputs

- `workspaceId`
- `environment` (`dev`, `staging`, `prod`)
- Allowed OpenClaw upstream endpoints for this workspace
- Credential grant references for this workspace

## Procedure

1. Create a dedicated workspace namespace/deployment boundary.

- Name should include `workspaceId`.
- No other workspace Gateway is deployed into this boundary.

2. Configure workspace-scoped credential paths.

- Create workspace-specific secrets path (for example, `secret/portarium/workspaces/<workspaceId>/openclaw`).
- Grant read access only to the workspace Gateway workload identity.
- Do not configure shared/global fallback credentials.

3. Configure Gateway runtime for strict workspace binding.

- Set `WORKSPACE_ID=<workspaceId>` (or equivalent runtime binding).
- Enable fail-closed request validation for workspace mismatch.
- Ensure any credential grant lookup is scoped by `workspaceId`.

4. Apply default-deny network policy.

- Ingress: allow only control-plane worker identity to Gateway API port.
- Egress: allow only OpenClaw upstream endpoint(s), vault endpoint, and telemetry endpoint(s).
- Deny all other traffic.

5. Deploy or update the workspace Gateway instance.

- Apply deployment manifests/Helm values for the workspace.
- Confirm readiness and health checks pass.

6. Register runtime endpoint and credential grants.

- Ensure control-plane registration points machine/tool invocations to this workspace Gateway instance.
- Verify credential grants for the workspace are present and active.

7. Run post-provision validation.

- Happy path: invocation from the same workspace succeeds.
- Boundary path: invocation with a different workspace context is rejected (`PolicyDenied`).
- Network path: outbound traffic to non-allow-listed destination is blocked.
- Logging path: records include `workspaceId`, `runId`, `correlationId` and no secrets.

8. Record evidence artifacts.

- Applied network policy manifests.
- Credential policy/access configuration evidence.
- Smoke test outputs for same-workspace success and cross-workspace rejection.

## Deprovision

1. Disable new traffic routing to the workspace Gateway.
2. Revoke workspace Gateway credential access.
3. Remove deployment/namespace.
4. Archive operational evidence per retention policy.

## Related Documents

- `docs/adr/0072-openclaw-gateway-multi-tenant-isolation.md`
- `docs/adr/0034-untrusted-execution-containment.md`
- `docs/adr/0065-external-execution-plane-strategy.md`

# ADR-0034: Untrusted Execution Containment

## Status

Accepted

## Context

VAOP is the governance choke point for business operations. Adapters and machines execute against external systems with real credentials. A compromised or buggy adapter could exfiltrate data, exceed authorised scope, or cause irreversible damage.

## Decision

Treat adapter and machine execution as untrusted:

- **Least-privilege credentials:** adapters receive only the scopes required for their declared capabilities.
- **Per-tenant isolation:** adapter instances are isolated per tenant; cross-tenant data leakage is architecturally prevented.
- **Controlled egress:** adapter execution environments restrict outbound network access to declared SoR endpoints.
- **Workflow authoring restrictions:** workflow authors cannot bypass policy evaluation or evidence logging.
- **Sandbox enforcement:** capability matrix sandbox availability is verified during adapter registration.

## Consequences

- Reduces catastrophic blast radius given VAOP's choke-point role.
- Increases adapter deployment complexity (isolation, egress controls).
- Forces credential vaulting to be fine-grained.
- Makes security posture auditable through capability matrices and evidence.

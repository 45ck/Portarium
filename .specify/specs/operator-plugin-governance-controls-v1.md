# Operator Plugin Governance Controls v1

## Scope

Operator plugins include Cockpit extension packages and Portarium-facing operator
surfaces that are installed or enabled through the host. They must not become a
separate authority path around Portarium policy, approval, evidence, tenancy, or
audit controls.

## Requirements

1. Every Cockpit extension manifest declares governance metadata before it can
   be enabled:
   - publisher identity and attestation digest,
   - package name and pinned version,
   - explicit permission grants for data queries, commands, and governed
     actions,
   - emergency disable, rollback, and lifecycle audit events.
2. Permission grants are descriptive only. The host validates that every route
   and command references declared grants and that guards are at least as strict
   as the referenced grant requirements.
3. Workspace activation can emergency-disable an installed extension by
   manifest ID. Emergency disable suppresses routes, navigation, commands,
   shortcuts, and data loading from the same resolved registry state.
4. Operators can inspect permission grants and audit event obligations before
   enabling or re-enabling a plugin.
5. Installed package references must match manifest version pins. Mismatches
   fail closed as install governance problems.
6. Missing, malformed, duplicate, or weaker-than-declared governance controls
   make the plugin invalid and expose no executable surfaces.

## Acceptance Evidence

- `apps/cockpit/src/lib/extensions/registry.test.ts`
- `apps/cockpit/src/lib/extensions/installed.test.ts`
- `apps/cockpit/src/components/cockpit/extensions/external-route-adapter.test.ts`
- `apps/cockpit/src/routes/explore/extensions.test.tsx`
- `src/infrastructure/cockpit/env-cockpit-extension-activation-source.test.ts`
- `src/presentation/runtime/control-plane-handler.test.ts`

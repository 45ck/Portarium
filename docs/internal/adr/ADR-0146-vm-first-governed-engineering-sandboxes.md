# ADR-0146: VM-First Governed Engineering Sandboxes

## Status

Proposed

## Context

The governed engineering layer currently describes agents executing beads in
isolated git worktrees, with Portarium policy checks before consequential tool
actions. That is a useful baseline, but worktree isolation does not contain
package installs, shell commands, browser automation, local services, Docker
usage, or malicious/untrusted repository behavior.

The product direction is task-native isolated development: every engineering
bead can become its own disposable, reviewable development universe with a
branch, runtime, preview, logs, browser state, evidence, and approval flow.

Portarium already has the core primitives:

- Work Items and Beads
- Runs and Evidence
- Approval Gates and policy tiers
- Cockpit engineering routes
- Diff approval surface
- Agent action governance
- sandbox-boundaries spec
- Temporal execution scaffolding

The missing decision is whether the engineering layer should remain
worktree-first or introduce a provider abstraction that makes VM-backed
sandboxes the default for autonomous coding.

## Decision

Portarium will model governed engineering execution through a provider-neutral
Sandbox Execution Plane. The existing worktree-focused executor concept becomes
`SandboxExecutor`; worktree execution is one provider, not the architecture.

The default execution mode for autonomous coding tasks is `vm`. `container` and
`worktree` remain available as lower-cost modes, but only when workspace policy
allows them.

The engineering workflow will use explicit ports:

- `GitWorkspacePort` for branch, worktree, diff, PR, and merge operations
- `SandboxProviderPort` for environment provisioning and lifecycle
- `AgentRuntimePort` for launching agents with the Portarium hook loaded
- `PreviewPort` for dev server, browser, and snapshot evidence

`MachineInvokerPort` remains the machine/agent invocation boundary. It must not
become the sandbox lifecycle interface.

Provider selection is a policy decision. It must be recorded as evidence and
shown in Cockpit.

The user-selected mode is advisory. Policy may raise isolation automatically and
must never silently lower isolation. Any downgrade from `vm` to `container` or
`worktree` requires explicit policy allowance, evidence, and usually approval.

## Options considered

| Option                          | Outcome                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Worktree-only                   | Fastest to build, but weak containment and weaker governance story                |
| Container-first                 | Good reproducibility, but still shared-kernel and weaker for untrusted agent work |
| VM-first with provider fallback | Best alignment with autonomous coding risk while preserving lower-cost modes      |
| Hosted-only sandboxes           | Good startup and scale, but weaker source/secrets control and vendor dependency   |
| Self-hosted Kata-only           | Strong isolation, but too heavy as the only local development path                |

## Consequences

Positive:

- Portarium can govern what agents build with the same policy/evidence model it
  uses for external actions.
- Operators can review not only the diff, but also the environment that produced
  it.
- VM-backed providers reduce host blast radius for package installs, Docker,
  browser automation, and shell execution.
- The provider abstraction lets local, self-hosted, and hosted options coexist.
- Worktree and container modes remain useful for low-risk tasks.

Negative:

- VM-backed workflows add cold-start, resource, and cleanup complexity.
- Cockpit must expose execution mode clearly or reviewers may over-trust diffs.
- Provider capability drift becomes a governance concern.
- Hosted providers require explicit source-code and secrets policy.
- Local Windows machines may only support the worktree/container baseline unless
  a VM-capable provider is installed.
- Windows/WSL local providers are development-only unless backed by a dedicated
  Linux VM provider with production-equivalent controls.

## Implementation notes

The first implementation should not require production VM infrastructure.

Recommended sequence:

1. Add domain/spec contracts for `ExecutionMode`, `EngineeringSandboxV1`,
   `EngineeringRuntimePolicyV1`, provider capabilities, and sandbox lifecycle
   evidence.
2. Implement `local-worktree` through the new provider contract as the baseline.
3. Implement `docker-devcontainer` for repeatable local project environments.
4. Add a VM provider behind a feature flag. Candidate providers are Docker
   Sandboxes for local machines and Atelier/Kata for self-hosted Linux/KVM.
5. Require evidence completeness before diff approval and merge.
6. Add Cockpit mode chips, sandbox state, preview state, and provider health.

## Security requirements

- Mode downgrade must never happen silently.
- Workspace policy must authorize the requested mode before provisioning.
- Mode changes require a rebuild and new evidence.
- Credential grants must be sandbox scoped and TTL limited.
- Network egress must default deny for VM and remote providers.
- Agent hooks must fail closed.
- Missing provider, policy, or evidence dependencies must return explicit
  failures and append governance-bypass evidence where possible.

## References

- `.specify/specs/engineering-sandbox-provider-v1.md`
- `.specify/specs/sandbox-boundaries-v1.md`
- `docs/internal/engineering-layer/vm-sandbox-execution-plan.md`
- `docs/internal/engineering-layer/system-architecture.md`
- `docs/internal/engineering-layer/build-plan.md`

# ADR-0074: Untrusted Tool Sandbox Boundaries

| Field    | Value                          |
| -------- | ------------------------------ |
| Status   | Proposed                       |
| Date     | 2026-02-21                     |
| Deciders | Platform engineering, Security |
| Bead     | bead-0676                      |

## Context

Portarium dispatches workflow actions to external tool runtimes (OpenClaw gateways,
Activepieces actions, Langflow agent flows). Some of these tools execute arbitrary
or semi-trusted code on behalf of tenants. We need a containment boundary that:

1. Prevents lateral movement from a compromised tool to Portarium infrastructure.
2. Isolates tenant workloads from each other.
3. Limits resource consumption (CPU, memory, network, disk).
4. Provides a deterministic startup/teardown lifecycle.

## Options Considered

### Option A: MicroVM isolation (Firecracker / gVisor)

**Description**: Each tool invocation runs inside a lightweight microVM or a gVisor
sandbox. Firecracker boots a minimal Linux kernel in ~125 ms; gVisor interposes
syscalls through a user-space kernel.

**Pros**:

- Strong hardware-level isolation (Firecracker) or syscall-level isolation (gVisor).
- Mature supply chain: Firecracker powers AWS Lambda/Fargate; gVisor powers GKE Sandbox.
- Full Linux compatibility: any language/runtime works unmodified.
- Network namespace isolation is native; egress can be controlled via iptables.
- Resource limits enforced at VM/cgroup level.

**Cons**:

- Higher per-invocation overhead (~125 ms cold start for Firecracker, ~50 ms for gVisor).
- Requires KVM on the host (Firecracker) or ptrace/KVM (gVisor), which limits
  cloud provider compatibility.
- Image management: must build and maintain rootfs images or OCI layers.
- Memory overhead: each microVM reserves a fixed memory footprint.

### Option B: WASM sandbox (Wasmtime / WasmEdge)

**Description**: Each tool invocation compiles to WebAssembly and executes in a WASM
runtime. The sandbox enforces capability-based security: no filesystem, no network,
no syscalls unless explicitly granted.

**Pros**:

- Near-zero cold start (~1-5 ms).
- Extremely small memory footprint per instance.
- Capability-based security by default: deny-all, opt-in access.
- Portable: no KVM dependency, runs on any CPU architecture.
- WASI preview 2 provides a growing standard for host-guest interfaces.
- Deterministic execution simplifies auditing and evidence capture.

**Cons**:

- Language support is limited: Rust, C/C++, Go (TinyGo), and AssemblyScript compile
  well; Python and Node.js support via WASI is experimental and performance-constrained.
- Existing tool runtimes (Activepieces Node.js, Langflow Python) would require
  significant porting effort.
- WASI networking and filesystem proposals are still stabilizing.
- Debugging is harder: no native debugger attachment, limited profiling.

### Option C: Hybrid approach

**Description**: Use WASM for simple, deterministic tool actions (data transforms,
validation, lightweight API calls) and microVMs for complex runtimes that need full
OS-level compatibility (Python agents, Node.js flows).

**Pros**:

- Optimizes for the strengths of each technology.
- WASM covers the majority of simple actions with minimal overhead.
- MicroVMs handle the long tail of complex tools without requiring WASM porting.
- Gradual migration path: start with microVMs, move actions to WASM as tooling matures.

**Cons**:

- Two runtime boundaries to maintain, monitor, and secure.
- Increased operational complexity.
- Developers must understand which boundary their tool targets.

## Recommendation

**Option C: Hybrid approach**, with the following phasing:

### Phase 1 (current milestone)

Deploy gVisor (runsc) as the default sandbox for execution-plane pods. This provides
immediate containment with minimal code changes:

- Configure the Kubernetes RuntimeClass to use gVisor for agent/worker pods.
- Enforce network policies (bead-0673) at the Kubernetes level.
- Use the sidecar proxy (bead-0675) for egress allowlist enforcement.

### Phase 2 (next quarter)

Introduce Wasmtime as an alternative execution target for simple, stateless tool actions:

- Define a WASM tool interface using WASI preview 2 + Component Model.
- Build a Portarium WASM host that provides capability grants (network, secrets).
- Migrate deterministic actions (data transforms, validation) to WASM.

### Phase 3 (future)

Evaluate Firecracker for high-security tenants requiring hardware-level isolation:

- Useful for regulated industries or when tenants bring untrusted code.
- Higher cost justifiable for these specific use cases.

## Decision Criteria Summary

| Criterion              | Firecracker | gVisor    | Wasmtime  | Hybrid     |
| ---------------------- | ----------- | --------- | --------- | ---------- |
| Isolation strength     | Excellent   | Very good | Excellent | Very good+ |
| Cold start latency     | ~125 ms     | ~50 ms    | ~1-5 ms   | Mixed      |
| Language support       | Any         | Any       | Limited   | Any        |
| Operational complexity | Moderate    | Low       | Low       | Moderate   |
| Migration effort       | Low         | Low       | High      | Moderate   |
| Resource efficiency    | Moderate    | Good      | Excellent | Good       |

## Consequences

- Execution-plane Kubernetes manifests will specify a `runtimeClassName: gvisor` in Phase 1.
- The sidecar proxy enforces application-level egress policy regardless of sandbox type.
- Future WASM tool interface will be specified in a follow-up ADR.
- Evidence capture must work across both sandbox types.

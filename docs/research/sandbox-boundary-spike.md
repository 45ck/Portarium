# Sandbox Boundaries for Untrusted Tool Execution -- Research Spike

**Status**: Spike complete
**Date**: 2026-02-21
**Author**: agent-gateway

## Context

Portarium dispatches tool invocations to external runtimes (OpenClaw, LangFlow,
Activepieces). Some tools execute untrusted code or interact with sensitive
systems. We need containment boundaries to limit blast radius when a tool
misbehaves or is compromised.

## Candidates Evaluated

### 1. Firecracker (AWS microVM)

| Aspect              | Assessment                                          |
| ------------------- | --------------------------------------------------- |
| Isolation level     | Full VM-level isolation (KVM-based microVM)         |
| Cold-start latency  | ~125ms (best case); 200-500ms typical               |
| Memory overhead     | ~5 MiB per microVM (minimal kernel)                 |
| Language support    | Any (runs full Linux guest)                         |
| Node.js fit         | Good: run Node.js inside microVM                    |
| Networking          | TAP device + host firewall rules                    |
| Maturity            | Production (Lambda, Fargate)                        |
| Limitations         | Requires Linux KVM; not available on Windows/macOS  |
|                     | Requires root or nested virt in containers          |

**Verdict**: Best isolation but heavy operational requirements. Recommended for
`ManualOnly` tier tools that need full OS-level containment.

### 2. gVisor (Google container sandbox)

| Aspect              | Assessment                                          |
| ------------------- | --------------------------------------------------- |
| Isolation level     | Syscall interception (application kernel in userspace)|
| Cold-start latency  | ~50-100ms                                           |
| Memory overhead     | ~10-20 MiB per sandbox                              |
| Language support    | Any (OCI-compatible containers)                     |
| Node.js fit         | Good: standard container with runsc runtime          |
| Networking          | netstack (userspace network stack)                  |
| Maturity            | Production (GKE Sandbox)                            |
| Limitations         | ~10-30% syscall overhead; some incompatible syscalls|
|                     | Requires Linux; container runtime integration       |

**Verdict**: Good balance of isolation and performance. Recommended for
`HumanApprove` tier tools that need syscall-level containment without
full VM overhead.

### 3. Wasmtime (Bytecode Alliance)

| Aspect              | Assessment                                          |
| ------------------- | --------------------------------------------------- |
| Isolation level     | Wasm sandbox (linear memory, capability-based)      |
| Cold-start latency  | ~1-5ms (AOT compiled)                               |
| Memory overhead     | ~1-2 MiB per instance                               |
| Language support    | Rust, C/C++, Go (WASI); limited JS via wasm-tools   |
| Node.js fit         | Poor: Node.js cannot run inside Wasm natively       |
|                     | JS tools need compilation via wasm-tools/QuickJS    |
| Networking          | WASI socket support (experimental)                  |
| Maturity            | Production-ready for compiled languages             |
| Limitations         | No native Node.js/TypeScript support                |
|                     | Complex JS-to-Wasm toolchain; limited npm ecosystem |

**Verdict**: Excellent isolation and performance for compiled tools.
Not suitable as primary sandbox for Portarium's Node.js/TypeScript tool
ecosystem.

### 4. WasmEdge (CNCF)

| Aspect              | Assessment                                          |
| ------------------- | --------------------------------------------------- |
| Isolation level     | Wasm sandbox (same model as Wasmtime)               |
| Cold-start latency  | ~1-5ms                                              |
| Memory overhead     | ~1-3 MiB per instance                               |
| Language support    | Rust, C/C++, JavaScript (QuickJS built-in)          |
| Node.js fit         | Partial: built-in QuickJS runtime for JS            |
|                     | Not Node.js-compatible (no npm, no async I/O)       |
| Networking          | WASI socket support; HTTP proxy plugin              |
| Maturity            | CNCF Sandbox; less production evidence than Wasmtime|
| Limitations         | JS runtime is QuickJS (not V8); limited APIs        |
|                     | No native TypeScript support                        |

**Verdict**: More JS-friendly than Wasmtime but still far from Node.js
compatibility. Useful for simple scripting sandboxes, not for running
existing TypeScript tools.

## Recommendation

### Tiered approach matching execution tiers

| Execution Tier  | Recommended Sandbox       | Rationale                     |
| --------------- | ------------------------- | ----------------------------- |
| `Auto`          | Process isolation + seccomp | Lightweight for read-only tools |
| `Assisted`      | gVisor (runsc)            | Syscall-level for mutations   |
| `HumanApprove`  | gVisor (runsc)            | Same as Assisted              |
| `ManualOnly`    | Firecracker microVM       | Full VM for dangerous tools   |

### Architecture

```
                 +------------------+
                 | Portarium        |
                 | Control Plane    |
                 +--------+---------+
                          |
                 +--------v---------+
                 | Execution Worker |
                 | (Temporal/K8s)   |
                 +--------+---------+
                          |
              +-----------+-----------+
              |           |           |
         +----v----+ +---v----+ +---v--------+
         | seccomp | | gVisor | | Firecracker|
         | sandbox | | sandbox| | microVM    |
         | (Auto)  | | (Asst) | | (ManualOnly)|
         +---------+ +--------+ +------------+
```

### Phase 1 (Near-term)

1. Use Kubernetes `RuntimeClass` with gVisor (`runsc`) for tool execution pods.
2. Apply seccomp profiles for `Auto` tier read-only tools.
3. Network policies restrict egress from tool pods (handled by sidecar egress proxy).

### Phase 2 (Future)

1. Evaluate Firecracker for `ManualOnly` tier via Kata Containers integration.
2. Consider WasmEdge for simple script sandboxing (non-Node.js tools).

### Why not Wasm-first?

Portarium's tool ecosystem is Node.js/TypeScript-based. WASM runtimes cannot
execute Node.js natively. The JS-in-Wasm solutions (QuickJS) lack the npm
ecosystem, async I/O, and TypeScript support that Portarium tools depend on.
gVisor provides equivalent isolation for containerized Node.js workloads with
zero toolchain changes.

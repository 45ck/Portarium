# Sandbox Boundaries v1

## Purpose

Define the containment model for untrusted tool execution within Portarium's
execution plane. Tools dispatched by agents may execute arbitrary code or
interact with sensitive external systems; sandbox boundaries limit blast radius.

## Containment Tiers

| Execution Tier  | Sandbox Technology        | Isolation Level           |
| --------------- | ------------------------- | ------------------------- |
| `Auto`          | seccomp + process isolation | Syscall filtering         |
| `Assisted`      | gVisor (runsc)            | Application kernel        |
| `HumanApprove`  | gVisor (runsc)            | Application kernel        |
| `ManualOnly`    | Firecracker microVM       | Full VM (KVM)             |

## Constraints

1. All tool execution pods run with a non-root UID.
2. Filesystem is read-only except for a tmpfs scratch volume.
3. Network egress is enforced by the sidecar egress proxy.
4. CPU and memory limits are set per pod (resourceQuota).
5. Execution timeout is enforced by the Temporal activity heartbeat.

## Technology Choices

- **gVisor**: Primary sandbox for Portarium's Node.js/TypeScript tools.
  Provides syscall-level isolation without requiring guest OS changes.
  Deployed via Kubernetes `RuntimeClass`.

- **Firecracker**: Reserved for `ManualOnly` tier tools that need full OS-level
  isolation (e.g. shell execution, browser automation). Deployed via Kata
  Containers.

- **WASM**: Not recommended for primary use due to lack of native Node.js
  support. May be used for simple script sandboxes in future.

## Kubernetes Integration

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: portarium-gvisor
handler: runsc
scheduling:
  nodeSelector:
    portarium.dev/sandbox: gvisor
```

Tool execution pods reference the RuntimeClass:
```yaml
spec:
  runtimeClassName: portarium-gvisor
  securityContext:
    runAsNonRoot: true
    readOnlyRootFilesystem: true
```

## Future Work

- Firecracker integration via Kata Containers.
- WasmEdge for non-Node.js scripting sandboxes.
- Sandbox performance benchmarks in CI.

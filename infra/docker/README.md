# Container Image Scaffold

These Dockerfiles are infrastructure scaffolds for a Control Plane + Execution Plane.

They provide a minimal runtime boundary for infrastructure validation:

- each image exposes a HTTP health endpoint at `/healthz` and `/readyz`;
- each process is non-interactive and ready for readiness/liveness validation;
- entrypoints are explicit to support deployment and compose parity checks.

When Portarium ships production runtime binaries, keep the same probe contract and replace
the current minimal HTTP runtimes in `src/presentation/runtime/` with the real service(s).

## Components

- `control-plane.Dockerfile` — builds the API/control-plane container image.
- `worker.Dockerfile` — builds the execution worker container image.
  (This worker currently exposes HTTP health endpoints and does not yet run the Temporal worker loop.)

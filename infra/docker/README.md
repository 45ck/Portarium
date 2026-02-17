# Container Image Scaffold

These Dockerfiles are infrastructure scaffolds for a Control Plane + Execution Plane.

They provide a minimal runtime boundary for infrastructure validation:

- each image exposes a HTTP health endpoint at `/healthz` and `/readyz`;
- each process is non-interactive and ready for readiness/liveness validation;
- entrypoints are explicit to support deployment and compose parity checks.

When Portarium ships production runtime binaries, replace `/usr/local/bin/portarium-runtime.sh`
with the real application image layer (binary or node entrypoint) and keep the same probe contract.

## Components

- `control-plane.Dockerfile` — builds the API/control-plane container image.
- `worker.Dockerfile` — builds the execution worker container image.
- `bootstrap.sh` — temporary guarded startup script while runnable service binaries are not
  wired in this repository milestone.

# Reference: Runtime and Environment

## Runtime entrypoints

- Control plane: `src/presentation/runtime/control-plane.ts`
- Execution plane worker: `src/presentation/runtime/worker.ts`
- Health server: `src/presentation/runtime/health-server.ts`

## Control plane env

- `PORTARIUM_HTTP_PORT` or `PORTARIUM_PORT` (default: `8080`)
- `PORTARIUM_CONTAINER_ROLE` or `PORTARIUM_ROLE` (default: `control-plane`)
- `PORTARIUM_JWKS_URI` (enables JWT auth)
- `PORTARIUM_JWT_ISSUER` (optional)
- `PORTARIUM_JWT_AUDIENCE` (optional)

## Worker env

- `PORTARIUM_HTTP_PORT` or `PORTARIUM_PORT` (default: `8081`)
- `PORTARIUM_CONTAINER_ROLE` or `PORTARIUM_ROLE` (default: `execution-plane`)
- `PORTARIUM_ENABLE_TEMPORAL_WORKER` (`true|1|yes|on` to enable)

## Health endpoints

Available on both runtimes:

- `/healthz`
- `/readyz`
- `/ready`
- `/health`

Response shape:

```json
{ "service": "control-plane", "status": "ok", "startedAt": "..." }
```

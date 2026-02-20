# Activepieces Helm Chart

This chart deploys a self-hosted Activepieces runtime for Portarium environments.

## What it includes

- Activepieces deployment and service.
- Optional in-cluster PostgreSQL and Redis for quick environments.
- Ingress template for staging/prod exposure.

## Staging deploy command

```bash
helm upgrade --install activepieces ./infra/helm/activepieces \
  --namespace portarium-staging \
  --create-namespace \
  -f ./infra/helm/activepieces/values-staging.yaml
```

## Local validation without local Helm install

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace alpine/helm:3.16.2 \
  lint infra/helm/activepieces

docker run --rm -v "$PWD:/workspace" -w /workspace alpine/helm:3.16.2 \
  template activepieces infra/helm/activepieces \
  -f infra/helm/activepieces/values-staging.yaml >/tmp/activepieces-staging.yaml
```

## Secrets

Set environment-specific secret values before deploying:

- `activepieces.encryptionKey`
- `activepieces.jwtSecret`
- `activepieces.postgres.password`
- `activepieces.redis.password`

# Temporal Helm Deployment

Temporal workflow runtime for the Portarium execution plane.

## Chart source

Official chart: [temporalio/helm-charts](https://github.com/temporalio/helm-charts)

```bash
helm repo add temporalio https://go.temporal.io/helm-charts
helm repo update
```

## Environments

| File | Target | Persistence | HA | Visibility |
|---|---|---|---|---|
| `values-dev.yaml` | dev cluster | PostgreSQL (single) | No | PostgreSQL standard |
| `values-staging.yaml` | staging cluster | PostgreSQL (HA) | Yes (2 replicas) | PostgreSQL advanced |
| `values-prod.yaml` | prod cluster | PostgreSQL (HA, multi-AZ) | Yes (3+ replicas) | PostgreSQL advanced |

## Deploying

```bash
# Dev
helm upgrade --install temporal temporalio/temporal \
  --namespace temporal \
  --create-namespace \
  --values infra/helm/temporal/values-dev.yaml \
  --set server.config.persistence.default.sql.password="$TEMPORAL_DB_PASSWORD" \
  --set server.config.persistence.visibility.sql.password="$TEMPORAL_DB_PASSWORD"

# Staging
helm upgrade --install temporal temporalio/temporal \
  --namespace temporal \
  --create-namespace \
  --values infra/helm/temporal/values-staging.yaml \
  --set server.config.persistence.default.sql.password="$TEMPORAL_DB_PASSWORD" \
  --set server.config.persistence.visibility.sql.password="$TEMPORAL_DB_PASSWORD"

# Prod
helm upgrade --install temporal temporalio/temporal \
  --namespace temporal \
  --create-namespace \
  --values infra/helm/temporal/values-prod.yaml \
  --set server.config.persistence.default.sql.password="$TEMPORAL_DB_PASSWORD" \
  --set server.config.persistence.visibility.sql.password="$TEMPORAL_DB_PASSWORD"
```

Passwords should be injected from Vault at deploy time — never committed.

## Namespace

The Temporal namespace for Portarium workflows must be registered post-install:

```bash
kubectl exec -n temporal deployment/temporal-frontend -- \
  temporal operator namespace create \
    --namespace portarium \
    --retention 30d \
    --description "Portarium execution plane workflows"
```

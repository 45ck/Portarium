# Environment Model v1 — Definitions, Config-per-Env, Artefact Promotion

**Bead:** bead-0387
**Status:** accepted
**Implements:** ADR-0056 (infrastructure reference architecture), ADR-0082 (artefact promotion strategy)

---

## Purpose

Define the canonical environment model for Portarium and specify how container
artefacts move through the promotion pipeline. This spec is the authoritative
reference for CI/CD workflows, Terraform, and Kustomize configuration.

---

## Environment Definitions

Four named environments exist. The canonical definition is in
`infra/environments.json`.

| Environment | Runtime        | Tier    | Promotion trigger      | Approval gate        |
| ----------- | -------------- | ------- | ---------------------- | -------------------- |
| `local`     | Docker Compose | local   | n/a                    | n/a                  |
| `dev`       | Kubernetes     | dev     | CI images pass on main | automatic            |
| `staging`   | Kubernetes     | staging | dev validated          | manual (1 reviewer)  |
| `prod`      | Kubernetes     | prod    | staging validated      | manual (2 reviewers) |

Promotion path: **`dev` → `staging` → `prod`**. An artefact may not skip
tiers.

---

## Environment Topology

### local

- **Runtime:** `docker-compose.yml` at repo root.
- **Services:** PostgreSQL, Temporal (SQLite), MinIO (evidence store with Object Lock),
  Vault (dev mode), OpenTelemetry Collector, Grafana Tempo, Grafana, NATS JetStream.
- **Purpose:** zero-infrastructure developer loop. No cloud credentials required.
- **Override:** `docker-compose.local.yml` for app service addition without touching
  the baseline.

### dev

- **Runtime:** Kubernetes; Kustomize overlay at `infra/kubernetes/overlays/dev/`.
- **Replicas:** control-plane ×1, execution-plane ×1.
- **Terraform (AWS):** `infra/terraform/aws/examples/dev.tfvars` — 2-node EKS,
  `db.t4g.medium`, 7-day backups, no multi-AZ, no Object Lock.
- **Purpose:** rapid iteration; receives every commit that passes CI.

### staging

- **Runtime:** Kubernetes; Kustomize overlay at `infra/kubernetes/overlays/staging/`.
- **Replicas:** control-plane ×3, execution-plane ×4.
- **Terraform (AWS):** `infra/terraform/aws/examples/staging.tfvars` — 3–5 node EKS,
  `db.t4g.large`, multi-AZ, 14-day backups, Object Lock GOVERNANCE mode, 365-day retention.
- **Purpose:** pre-production parity; mirrors prod topology for reliability and DR rehearsal.
  Compliance features enabled for evidence object lock validation.

### prod

- **Runtime:** Kubernetes; Kustomize overlay at `infra/kubernetes/overlays/prod/`.
- **Replicas:** control-plane ×3, execution-plane ×4.
- **Terraform (AWS):** `infra/terraform/aws/examples/prod.tfvars` — 4–8 node EKS,
  `db.t4g.large`, multi-AZ, 30-day backups, deletion protection, Object Lock COMPLIANCE mode,
  1095-day (3-year) retention.
- **Purpose:** production. Full compliance controls active. Deletion protection prevents
  accidental teardown.

---

## Configuration per Environment

Configuration is layered:

```
Dimension              local     dev       staging   prod
─────────────────────────────────────────────────────────────────────
IaC                    —         Terraform Terraform Terraform
Secrets                .env      Vault     Vault     Vault (prod role)
K8s config             —         Overlay   Overlay   Overlay
Image tag strategy     n/a       git-SHA   git-SHA   git-SHA
Evidence Object Lock   MinIO     disabled  GOVERNANCE COMPLIANCE
Evidence retention     7d        7d        365d      1095d
Multi-AZ RDS           —         false     true      true
Deletion protection    —         false     false     true
```

### Kubernetes configuration (Kustomize overlays)

Each environment has a Kustomize overlay under `infra/kubernetes/overlays/<env>/`:

- `kustomization.yaml` — image pin (maintained by `cd-promote.yml`)
- `patches/replicas.yaml` — replica counts per environment

The `images[].newTag` field in each overlay is the **only** mutable field
managed by the promotion workflow. All other overlay configuration is static.

### Terraform variable files

Per-environment `.tfvars` files in each provider's `examples/` directory:

```
infra/terraform/aws/examples/
  dev.tfvars
  staging.tfvars
  prod.tfvars
```

These are **reference examples** for human operators. The CI IaC validation
workflow (`ci-infra.yml`) performs `fmt -check`, `init -backend=false`, `validate`,
and Trivy IaC scan against all stacks automatically.

### Secret injection

Kubernetes secrets are injected from Vault at pod startup via the Vault Agent
Injector. GitHub Actions secrets (`KUBECONFIG_B64`) are scoped to GitHub
environments (`dev`, `staging`, `prod`) which align to the Kubernetes clusters.

---

## Artefact Promotion Pipeline

### Artefact identity

An artefact is identified by its **git SHA** at time of build. Container images
are tagged with:

```
ghcr.io/<org>/portarium-<component>:<git-sha>
```

This tag is immutable — it cannot be overwritten because the SHA is unique per
commit. Mutable tags (e.g., `dev-latest`, `staging-latest`) are not used for
promotion because they do not guarantee which content is deployed.

### Promotion workflow

`cd-promote.yml` orchestrates the promotion. It runs in two modes:

**Auto-promotion to dev** (triggered by `workflow_run` on `CI (Container Images)`):

1. `CI (Container Images)` builds and signs images for the merge commit on `main`.
2. `cd-promote.yml` triggers automatically.
3. `resolve-artefact` job determines the commit SHA to promote.
4. `pin-artefact` job updates `infra/kubernetes/overlays/dev/kustomization.yaml`
   with the new SHA via `kustomize edit set image` and commits the change to `main`.
5. Operators run `cd-k8s-deploy.yml` (manually or triggered) to apply the overlay
   to the dev cluster.

**Manual promotion to staging or prod** (triggered by `workflow_dispatch`):

1. Operator selects target environment (`staging` or `prod`) and optionally provides
   the commit SHA to promote (defaults to latest SHA in `dev` overlay).
2. GitHub environment protection rules require approval from designated reviewers.
3. After approval, `pin-artefact` updates the target overlay and commits.
4. Operators apply via `cd-k8s-deploy.yml`.

### Promotion gates

| Stage     | Gate                                                |
| --------- | --------------------------------------------------- |
| `dev`     | `CI (Container Images)` passes on `main`            |
| `staging` | Manual dispatch + 1 reviewer approval (GitHub env)  |
| `prod`    | Manual dispatch + 2 reviewer approvals (GitHub env) |

In addition to approval, the deploying operator should verify:

- `kubectl rollout status` exits 0 after apply (checked by `cd-k8s-deploy.yml`)
- Key smoke routes return HTTP 200 (manual or automated health probe)
- No CRITICAL alerts firing in Grafana

### Rollback

To roll back environment `<env>` to SHA `<prev-sha>`:

1. Run `cd-promote.yml` with `workflow_dispatch`, target environment = `<env>`,
   `image_sha` = `<prev-sha>`.
2. Approve (if staging/prod).
3. Run `cd-k8s-deploy.yml` for `<env>` to apply.

The Kustomize overlay history in git is the rollback log.

---

## Compliance

- **Evidence Object Lock** is enabled for `staging` (GOVERNANCE mode) and `prod`
  (COMPLIANCE mode). This prevents deletion or overwrite of evidence objects during
  the retention window.
- **Deletion protection** on Terraform-managed RDS instances in `prod` prevents
  accidental `terraform destroy` from dropping the database.
- **Multi-AZ** is enabled for `staging` and `prod` to support DR rehearsal and
  production failover.
- **Image signing**: all images are signed with Sigstore keyless (Fulcio CA +
  Rekor transparency log) in `ci-images.yml`. `cd-k8s-deploy.yml` verifies
  signatures via `verify-provenance.yml` before any deployment.

---

## Related Specifications and ADRs

- `infrastructure-layer-v1.md` — infrastructure primitive requirements
- ADR-0056 — infrastructure reference architecture (4-environment model)
- ADR-0075 — multi-region readiness (RPO/RTO targets per tier)
- ADR-0082 — artefact promotion strategy (git-SHA pinning, approval gates)

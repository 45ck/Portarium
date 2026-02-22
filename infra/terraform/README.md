# Infrastructure as Code Baseline (Phase 1)

Terraform is the baseline Infrastructure as Code strategy for ADR-0056.

## Scope

- Keep this folder provider-neutral at the repository level while shipping explicit
  provider entry points for portability.
- Define network, cluster, database, object store, and secret integration in
  provider-specific implementations.
- Track all intent (environment defaults, state names, and rollout assumptions) in
  version control through Terraform code and examples.

## Remote state and locking

All provider stacks use remote state with provider-native locking. A one-time
bootstrap step provisions the state storage **before** the main stack is first
applied. After bootstrapping, uncomment the `backend` block in each stack's
`backend.tf` and run `terraform init -migrate-state`.

| Provider | Backend | Lock mechanism            | Bootstrap dir              |
| -------- | ------- | ------------------------- | -------------------------- |
| AWS      | S3      | DynamoDB (`LockID` table) | `aws-backend-bootstrap/`   |
| Azure    | azurerm | Native blob lease         | `azure-backend-bootstrap/` |
| GCP      | gcs     | Native Cloud Storage lock | `gcp-backend-bootstrap/`   |

### Bootstrap procedure (all providers)

```bash
# 1. Provision state storage with a local backend (run once per environment)
cd infra/terraform/<provider>-backend-bootstrap
terraform init
terraform apply -var="environment=dev"

# 2. Capture the generated backend config snippet
terraform output backend_config_snippet

# 3. Paste the snippet into infra/terraform/<provider>/backend.tf and uncomment

# 4. Migrate local state (if any) into the remote backend
cd ../infra/terraform/<provider>
terraform init -migrate-state
```

The bootstrap modules themselves use **local state only** and are intentionally
minimal — they provision nothing that depends on the main platform stack.

### State key convention

```
portarium/<provider>/<stack>/terraform.tfstate
```

Examples:

- `portarium/aws/platform/terraform.tfstate`
- `portarium/azure/platform/terraform.tfstate`
- `portarium/gcp/platform/terraform.tfstate`

## Current status

- Provider baseline status:
  - ✅ `aws/` — concrete reference implementation (network, control plane,
    data persistence, evidence storage). Remote state: S3 + DynamoDB.
  - ✅ `azure/` — stub with provider config and remote state scaffolding.
  - ✅ `gcp/` — stub with provider config and remote state scaffolding.
  - ✅ `*-backend-bootstrap/` — bootstrap modules for all three providers.
- ADR-0056 and `.specify/specs/infrastructure-layer-v1.md` define required
  capabilities and acceptance criteria.
- The provider entry points are intentionally aligned to the same operational
  contract (control-plane cluster + runtime storage + evidence store + policy
  controls).

## Planned module set

- `core-network`: VPC/VNet + subnet segmentation + service endpoints.
- `control-plane-cluster`: Kubernetes cluster + API server IAM/policy.
- `control-plane-services`: Postgres, Vault integration, object store interface.
- `temporal-stack`: Durable workflow platform persistence and worker ingress points.
- `observability-stack`: OTel collector plus metrics/trace/log backends.
- `policy-engine`: Cloud-native policy controls (egress allowlists, network policies).

## Remote state backend

All provider stacks use S3 + DynamoDB for remote state and distributed locking.
The backend resources are bootstrapped once per environment using the dedicated
bootstrap stack before applying any application infrastructure.

### Bootstrap sequence (first time per environment)

```bash
# 1. Provision the S3 bucket and DynamoDB lock table
cd infra/terraform/bootstrap
terraform init
terraform plan  -var-file=examples/dev.tfvars
terraform apply -var-file=examples/dev.tfvars

# 2. Capture the backend snippet
terraform output -raw backend_config_snippet

# 3. Configure the AWS application stack to use remote state
cd ../aws
cp backend.tf.example backend.tf
# Paste the snippet values into backend.tf, then migrate local state:
terraform init -migrate-state
```

Alternatively use partial backend config files (one per environment):

```bash
cd infra/terraform/aws
cp backends/dev.s3.tfbackend.example backends/dev.s3.tfbackend
# Fill in real values from bootstrap outputs, then:
terraform init -backend-config=backends/dev.s3.tfbackend
```

See `bootstrap/README.md` for full instructions and `aws/backend.tf.example`
for the backend block shape.

## Validation

- `terraform fmt -recursive` in CI for all checked-in Terraform files.
- `terraform init -backend=false` and `terraform validate` in provider-specific
  stacks, including the bootstrap stack.
- Review gates requiring explicit owner signoff before environment rollout.

## AWS usage example

```bash
cd infra/terraform/aws
terraform init -backend-config=backends/dev.s3.tfbackend
terraform validate
terraform plan -var-file=examples/dev.tfvars
```

For staging/prod use the corresponding `.s3.tfbackend` and `.tfvars` files.

## Acceptance check for this layer

- `terraform init` / `terraform validate` are green for all checked-in provider stacks.
- Outputs are stable and include control-plane endpoint, DB endpoint, and evidence store identifiers.
- Secrets/credentials are injected through run-time secret managers, not committed state.

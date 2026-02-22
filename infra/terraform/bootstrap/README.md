# Terraform Remote State Bootstrap (AWS)

This bootstrap stack provisions the S3 bucket and DynamoDB table that act as
the remote state backend for all Portarium AWS provider stacks.

## Why a separate bootstrap stack?

Terraform state must be stored somewhere before you can use remote state. This
"bootstrap" stack uses **local state** (stored in `terraform.tfstate` in this
directory) to create the S3 bucket and DynamoDB table. Once provisioned, all
other stacks point to those resources for their own remote state.

> **Important:** Back up `terraform.tfstate` from this directory after every
> apply. Losing it means the state-backend resources become unmanaged by
> Terraform. Store the backup in a secure location (e.g. a password manager,
> encrypted vault, or the bucket itself after the first apply).

## Resources created

| Resource                                             | Name pattern                         | Purpose                                       |
| ---------------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| `aws_s3_bucket`                                      | `<namespace>-<env>-tfstate-<suffix>` | Stores `.tfstate` files                       |
| `aws_s3_bucket_versioning`                           | —                                    | Enables versioning for point-in-time recovery |
| `aws_s3_bucket_server_side_encryption_configuration` | —                                    | KMS encryption at rest                        |
| `aws_s3_bucket_public_access_block`                  | —                                    | Blocks all public access                      |
| `aws_s3_bucket_lifecycle_configuration`              | —                                    | Expires old noncurrent versions               |
| `aws_kms_key`                                        | alias `<namespace>-<env>-tfstate`    | Encrypts state objects                        |
| `aws_dynamodb_table`                                 | `<namespace>-<env>-tfstate-lock`     | Provides distributed state locking            |

## Usage

```bash
cd infra/terraform/bootstrap

# 1. Initialise with local backend — no remote state required
terraform init

# 2. Review the plan
terraform plan -var-file=examples/dev.tfvars

# 3. Apply
terraform apply -var-file=examples/dev.tfvars

# 4. Retrieve the ready-to-paste backend config snippet
terraform output -raw backend_config_snippet
```

## Connecting the main stacks

After the bootstrap apply completes, configure each Portarium stack to use the
new backend:

1. Copy the snippet from `terraform output -raw backend_config_snippet`.
2. Paste it into `infra/terraform/<stack>/backend.tf` (replace the `<stack-name>`
   key placeholder with the appropriate path, e.g. `aws/terraform.tfstate`).
3. Run `terraform init` in the stack directory to migrate state to S3.

See `infra/terraform/aws/backend.tf.example` for a complete example.

Alternatively use partial backend configuration files:

```bash
cd infra/terraform/aws
terraform init -backend-config=backends/dev.s3.tfbackend
```

See `infra/terraform/aws/backends/*.s3.tfbackend.example` for per-environment
examples.

## Environment isolation

Each environment (dev, staging, prod) must have its own bootstrap apply —
either in a dedicated account or using separate state key prefixes within the
same bucket. Separate AWS accounts are strongly recommended for production.

| Environment | Tfvars file             |
| ----------- | ----------------------- |
| dev         | examples/dev.tfvars     |
| staging     | examples/staging.tfvars |
| prod        | examples/prod.tfvars    |

## Locking semantics

State locking is provided by the DynamoDB table. Every `terraform plan` and
`terraform apply` acquires an exclusive lock on the `LockID` key for the
affected state file. Concurrent runs against the same workspace are blocked
until the lock is released (or forcibly removed with `terraform force-unlock`
if a run crashed without releasing it).

## Azure and GCP

When the Azure and GCP Terraform stacks are implemented, equivalent bootstrap
stacks will live at:

- `infra/terraform/azure/` — Azure Blob + table storage backend
- `infra/terraform/gcp/` — GCS backend with Firestore or Spanner for locking

See their `README.md` files for planned configuration.

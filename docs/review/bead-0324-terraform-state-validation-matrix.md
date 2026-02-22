# bead-0324 Terraform State Validation Matrix

**Status:** implemented
**CI workflow:** `.github/workflows/ci-infra.yml`

---

## Validation matrix — all Terraform stacks

| Stack           | Path                                       | fmt -check  | init -backend=false | validate    | Trivy IaC                   | Infracost   |
| --------------- | ------------------------------------------ | ----------- | ------------------- | ----------- | --------------------------- | ----------- |
| AWS platform    | `infra/terraform/aws/`                     | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | ⚠️ advisory |
| AWS bootstrap   | `infra/terraform/aws-backend-bootstrap/`   | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | ⚠️ advisory |
| Azure platform  | `infra/terraform/azure/`                   | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | —           |
| Azure bootstrap | `infra/terraform/azure-backend-bootstrap/` | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | —           |
| GCP platform    | `infra/terraform/gcp/`                     | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | —           |
| GCP bootstrap   | `infra/terraform/gcp-backend-bootstrap/`   | ✅ blocking | ✅ blocking         | ✅ blocking | ✅ blocking (CRITICAL/HIGH) | —           |

**Legend:**

- ✅ blocking — CI failure blocks merge
- ⚠️ advisory — `continue-on-error: true`; results visible in job output but do not block merge
- — — not yet applicable (Infracost supports AWS/Azure/GCP but Azure/GCP stubs have no costed resources)

---

## Gate descriptions

### `terraform fmt -recursive -check`

Enforces canonical HCL formatting. Run over each stack directory. Any diff
causes a hard failure. Format violations must be fixed with `terraform fmt -recursive`.

### `terraform init -backend=false`

Downloads provider plugins and validates provider lock files **without**
connecting to a real backend. All stacks use a commented-out backend block, so
`-backend=false` is always safe.

### `terraform validate`

Validates HCL syntax, resource types, argument types, and inter-resource
references. Uses `-json` output and parses `valid` field for reliable exit code.

### Trivy IaC scan

[Trivy](https://trivy.dev/) scans all `.tf` files for:

- Insecure defaults (e.g., S3 bucket public access, unencrypted resources)
- Missing encryption at rest
- Overly permissive IAM policies
- Network exposure risks

Severity threshold: **CRITICAL and HIGH** findings cause CI failure.
Medium/Low findings are reported but do not block.

### Infracost (advisory)

[Infracost](https://www.infracost.io/) estimates monthly cloud costs for the
AWS stacks. Results are printed as a table in job output. This gate is:

1. **Gated behind** `INFRACOST_API_KEY` secret presence — skipped if the
   secret is not configured.
2. **Advisory only** (`continue-on-error: true`) — unexpected cost spikes
   surface as warnings without blocking merges.

To activate cost estimation: add `INFRACOST_API_KEY` to GitHub repository
secrets (Settings → Secrets and variables → Actions).

---

## Adding new stacks

The validation matrix auto-discovers stacks by scanning `infra/terraform/*/`
for directories containing `versions.tf` or `main.tf`. New stacks are
automatically included in all gates without modifying the CI workflow.

---

## Local validation

To replicate CI checks locally:

```bash
# Format check
terraform -chdir=infra/terraform/aws fmt -recursive -check

# Init + validate (all stacks)
for DIR in infra/terraform/*/; do
  [ -f "${DIR}versions.tf" ] || continue
  terraform -chdir="$DIR" init -backend=false -input=false
  terraform -chdir="$DIR" validate
done

# Security scan (requires trivy CLI)
trivy config infra/terraform --severity CRITICAL,HIGH

# Cost estimate (requires infracost CLI and API key)
infracost breakdown --path infra/terraform/aws --terraform-init-flags="-backend=false"
```

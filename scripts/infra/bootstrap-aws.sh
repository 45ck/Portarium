#!/usr/bin/env bash
# bootstrap-aws.sh — One-click AWS control-plane bootstrap
#
# Usage:
#   ./scripts/infra/bootstrap-aws.sh <environment> [--dry-run] [--skip-backend]
#
# Environments: dev | staging | prod
#
# What it does:
#   1. Validates prerequisites (terraform, aws CLI, IAM identity)
#   2. Bootstraps the S3 + DynamoDB remote state backend (if not already present)
#   3. Migrates the main stack to the remote backend
#   4. Applies the full AWS platform stack (EKS + VPC + RDS + S3 + KMS)
#
# One-click patterns:
#   ./scripts/infra/bootstrap-aws.sh dev          # dev environment
#   ./scripts/infra/bootstrap-aws.sh staging      # staging environment
#   ./scripts/infra/bootstrap-aws.sh prod         # prod (prompts for confirmation)

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/infra/terraform"
AWS_STACK="${TERRAFORM_DIR}/aws"
BOOTSTRAP_STACK="${TERRAFORM_DIR}/aws-backend-bootstrap"
EXAMPLES_DIR="${AWS_STACK}/examples"
BACKEND_TF="${AWS_STACK}/backend.tf"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()   { echo "[bootstrap-aws] $*"; }
info()  { echo "[bootstrap-aws] ℹ  $*"; }
ok()    { echo "[bootstrap-aws] ✓  $*"; }
warn()  { echo "[bootstrap-aws] ⚠  $*" >&2; }
fail()  { echo "[bootstrap-aws] ✗  $*" >&2; exit 1; }

confirm() {
  local prompt="$1"
  read -r -p "${prompt} [yes/no]: " reply
  [[ "$reply" == "yes" ]] || fail "Aborted."
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

ENVIRONMENT="${1:-}"
DRY_RUN=false
SKIP_BACKEND=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)       DRY_RUN=true ;;
    --skip-backend)  SKIP_BACKEND=true ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

case "${ENVIRONMENT}" in
  dev|staging|prod) ;;
  "") fail "Usage: $0 <dev|staging|prod> [--dry-run] [--skip-backend]" ;;
  *)  fail "Unknown environment '${ENVIRONMENT}'. Must be: dev, staging, or prod" ;;
esac

TFVARS_FILE="${EXAMPLES_DIR}/${ENVIRONMENT}.tfvars"
[[ -f "${TFVARS_FILE}" ]] || fail "tfvars file not found: ${TFVARS_FILE}"

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

check_prerequisites() {
  log "Checking prerequisites…"

  command -v terraform >/dev/null 2>&1 || fail "terraform not found in PATH"
  command -v aws       >/dev/null 2>&1 || fail "aws CLI not found in PATH"

  local tf_version
  tf_version=$(terraform version -json | python3 -c "import sys,json; print(json.load(sys.stdin)['terraform_version'])" 2>/dev/null || terraform version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
  info "Terraform: ${tf_version}"

  local aws_identity
  aws_identity=$(aws sts get-caller-identity --output text --query 'Arn' 2>/dev/null) \
    || fail "AWS credentials not configured. Run 'aws configure' or set AWS_PROFILE."
  info "AWS identity: ${aws_identity}"

  # Read region from tfvars
  AWS_REGION=$(grep 'aws_region' "${TFVARS_FILE}" | head -1 | grep -oE '"[^"]+"' | tr -d '"' || echo "us-east-1")
  NAMESPACE=$(grep 'namespace' "${TFVARS_FILE}" | head -1 | grep -oE '"[^"]+"' | tr -d '"' || echo "portarium")
  info "Environment: ${ENVIRONMENT}"
  info "Region: ${AWS_REGION}"
  info "Namespace: ${NAMESPACE}"

  ok "Prerequisites satisfied"
}

# ---------------------------------------------------------------------------
# Backend bootstrap
# ---------------------------------------------------------------------------

STATE_BUCKET_NAME=""
LOCK_TABLE_NAME=""

bootstrap_backend() {
  if [[ "${SKIP_BACKEND}" == true ]]; then
    info "Skipping backend bootstrap (--skip-backend)"
    return
  fi

  log "Step 1/3 — Bootstrap remote state backend…"

  local expected_bucket="${NAMESPACE}-${ENVIRONMENT}-tfstate"
  local expected_table="${NAMESPACE}-${ENVIRONMENT}-tfstate-lock"

  # Check if the bucket already exists
  if aws s3api head-bucket --bucket "${expected_bucket}" --region "${AWS_REGION}" 2>/dev/null; then
    ok "State bucket already exists: ${expected_bucket}"
    STATE_BUCKET_NAME="${expected_bucket}"
    LOCK_TABLE_NAME="${expected_table}"
    return
  fi

  info "State bucket not found — provisioning bootstrap stack…"

  if [[ "${DRY_RUN}" == true ]]; then
    info "[dry-run] Would run: terraform apply in ${BOOTSTRAP_STACK}"
    STATE_BUCKET_NAME="${expected_bucket}"
    LOCK_TABLE_NAME="${expected_table}"
    return
  fi

  terraform -chdir="${BOOTSTRAP_STACK}" init -backend=false -input=false
  terraform -chdir="${BOOTSTRAP_STACK}" apply \
    -var="aws_region=${AWS_REGION}" \
    -var="namespace=${NAMESPACE}" \
    -var="environment=${ENVIRONMENT}" \
    -auto-approve \
    -input=false

  STATE_BUCKET_NAME=$(terraform -chdir="${BOOTSTRAP_STACK}" output -raw state_bucket)
  LOCK_TABLE_NAME=$(terraform -chdir="${BOOTSTRAP_STACK}" output -raw lock_table)

  ok "State backend ready: s3://${STATE_BUCKET_NAME} / ${LOCK_TABLE_NAME}"
}

# ---------------------------------------------------------------------------
# Configure backend in main stack
# ---------------------------------------------------------------------------

configure_backend() {
  if [[ "${SKIP_BACKEND}" == true ]] || [[ "${DRY_RUN}" == true ]]; then
    info "Skipping backend configuration"
    return
  fi

  log "Step 2/3 — Configure remote backend in main stack…"

  local state_key="portarium/aws/${ENVIRONMENT}/terraform.tfstate"

  # Check if backend.tf already has an active (uncommented) backend block
  if grep -q '^  backend "s3"' "${BACKEND_TF}" 2>/dev/null; then
    ok "Backend already configured in ${BACKEND_TF}"
    return
  fi

  # Write active backend.tf
  cat > "${BACKEND_TF}" <<TFEOF
# Auto-generated by scripts/infra/bootstrap-aws.sh
# Managed backend — do not edit manually; re-run bootstrap-aws.sh to update.

terraform {
  backend "s3" {
    bucket         = "${STATE_BUCKET_NAME}"
    key            = "${state_key}"
    region         = "${AWS_REGION}"
    encrypt        = true
    dynamodb_table = "${LOCK_TABLE_NAME}"
  }
}
TFEOF

  ok "Backend configured: s3://${STATE_BUCKET_NAME}/${state_key}"

  # Migrate any local state
  terraform -chdir="${AWS_STACK}" init \
    -migrate-state \
    -input=false \
    -force-copy \
    || terraform -chdir="${AWS_STACK}" init -input=false
}

# ---------------------------------------------------------------------------
# Apply main AWS stack
# ---------------------------------------------------------------------------

apply_stack() {
  log "Step 3/3 — Apply AWS platform stack (${ENVIRONMENT})…"

  if [[ "${ENVIRONMENT}" == "prod" ]] && [[ "${DRY_RUN}" == false ]]; then
    warn "You are about to apply changes to the PRODUCTION environment."
    confirm "Are you sure you want to proceed?"
  fi

  terraform -chdir="${AWS_STACK}" init -input=false

  if [[ "${DRY_RUN}" == true ]]; then
    info "[dry-run] Running terraform plan only (no apply)"
    terraform -chdir="${AWS_STACK}" plan \
      -var-file="${TFVARS_FILE}" \
      -input=false \
      -out="/tmp/portarium-${ENVIRONMENT}.tfplan"
    ok "Plan complete — review /tmp/portarium-${ENVIRONMENT}.tfplan"
    return
  fi

  terraform -chdir="${AWS_STACK}" apply \
    -var-file="${TFVARS_FILE}" \
    -input=false \
    -auto-approve

  ok "AWS platform stack applied for '${ENVIRONMENT}'"
}

# ---------------------------------------------------------------------------
# Post-apply summary
# ---------------------------------------------------------------------------

print_summary() {
  log "─────────────────────────────────────────────"
  log "Bootstrap complete: ${ENVIRONMENT}"
  log "─────────────────────────────────────────────"

  if [[ "${DRY_RUN}" == false ]]; then
    terraform -chdir="${AWS_STACK}" output 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  check_prerequisites
  bootstrap_backend
  configure_backend
  apply_stack
  print_summary
}

main "$@"

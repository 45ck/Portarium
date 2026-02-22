# Module: github-oidc
#
# Provisions GitHub Actions OIDC trust on AWS, Azure, and GCP so that
# CI/CD workflows can obtain short-lived cloud credentials without any
# long-lived access keys or service account credentials stored in GitHub
# Secrets.
#
# Usage (AWS only):
#   module "github_oidc" {
#     source           = "../modules/github-oidc"
#     clouds           = ["aws"]
#     github_org       = "45ck"
#     github_repo      = "Portarium"
#     environment      = "prod"
#     namespace        = "portarium"
#     aws_deploy_policy_arns = [
#       "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
#       aws_iam_policy.ecr_push.arn,
#     ]
#   }
#
# Bead: bead-0395

locals {
  name_prefix = "${var.namespace}-${var.environment}"
  enable_aws  = contains(var.clouds, "aws")
  enable_azure = contains(var.clouds, "azure")
  enable_gcp   = contains(var.clouds, "gcp")

  # GitHub OIDC issuer (same for all GH Actions).
  github_oidc_url = "https://token.actions.githubusercontent.com"

  # Subject claim: repo + branch/environment filter.
  # Allow both main-branch deploys and environment-specific deploys.
  github_subjects = concat(
    [
      "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main",
      "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.github_main_branch}",
    ],
    [for env in var.allowed_environments :
      "repo:${var.github_org}/${var.github_repo}:environment:${env}"
    ],
    var.extra_subjects,
  )

  common_tags = merge(
    {
      Project     = var.namespace
      Environment = var.environment
      ManagedBy   = "Terraform"
      Purpose     = "github-oidc"
    },
    var.extra_tags,
  )
}

# ── AWS ────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {
  count = local.enable_aws ? 1 : 0
}

# OIDC provider (idempotent: only one per account needed, but Terraform
# manages it per module — use `create_oidc_provider = false` to reference
# an existing one).
resource "aws_iam_openid_connect_provider" "github" {
  count = local.enable_aws && var.aws_create_oidc_provider ? 1 : 0

  url = local.github_oidc_url
  # GitHub's OIDC thumbprint (stable as of 2024).
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  client_id_list  = ["sts.amazonaws.com"]
  tags            = local.common_tags
}

locals {
  aws_oidc_provider_arn = local.enable_aws ? (
    var.aws_create_oidc_provider
      ? aws_iam_openid_connect_provider.github[0].arn
      : "arn:aws:iam::${data.aws_caller_identity.current[0].account_id}:oidc-provider/token.actions.githubusercontent.com"
  ) : ""
}

data "aws_iam_policy_document" "github_assume_role" {
  count = local.enable_aws ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.aws_oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.github_subjects
    }
  }
}

resource "aws_iam_role" "github_ci" {
  count = local.enable_aws ? 1 : 0

  name               = "${local.name_prefix}-github-ci"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role[0].json
  max_session_duration = 3600  # 1 hour — sufficient for any CI job

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-github-ci" })
}

resource "aws_iam_role_policy_attachment" "github_ci" {
  count      = local.enable_aws ? length(var.aws_deploy_policy_arns) : 0
  role       = aws_iam_role.github_ci[0].name
  policy_arn = var.aws_deploy_policy_arns[count.index]
}

# Inline policy: EKS token generation + ECR login (minimum required for CD).
resource "aws_iam_role_policy" "github_ci_inline" {
  count = local.enable_aws ? 1 : 0
  name  = "github-ci-baseline"
  role  = aws_iam_role.github_ci[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EKSDescribeAndToken"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:AccessKubernetesApi",
        ]
        Resource = "arn:aws:eks:${var.aws_region}:${data.aws_caller_identity.current[0].account_id}:cluster/${local.name_prefix}-*"
      },
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current[0].account_id}:repository/${var.namespace}/*"
      },
    ]
  })
}

# ── GCP ────────────────────────────────────────────────────────────────────
# Workload Identity Federation: GitHub OIDC → GCP Service Account.

resource "google_iam_workload_identity_pool" "github" {
  count                     = local.enable_gcp ? 1 : 0
  project                   = var.gcp_project_id
  workload_identity_pool_id = "${var.namespace}-${var.environment}-github"
  display_name              = "GitHub Actions — ${var.namespace} ${var.environment}"
  description               = "Allows GitHub Actions to authenticate to GCP without long-lived keys."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = local.enable_gcp ? 1 : 0
  project                            = var.gcp_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  oidc {
    issuer_uri = local.github_oidc_url
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}'"
}

resource "google_service_account" "github_ci" {
  count        = local.enable_gcp ? 1 : 0
  project      = var.gcp_project_id
  account_id   = "${var.namespace}-${var.environment}-gh-ci"
  display_name = "GitHub CI — ${var.namespace} ${var.environment}"
}

resource "google_service_account_iam_member" "github_wif" {
  count              = local.enable_gcp ? length(local.github_subjects) : 0
  service_account_id = google_service_account.github_ci[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

# ── Azure ──────────────────────────────────────────────────────────────────
# Federated credentials on an App Registration.

resource "azuread_application" "github_ci" {
  count        = local.enable_azure ? 1 : 0
  display_name = "${local.name_prefix}-github-ci"
  owners       = []
}

resource "azuread_service_principal" "github_ci" {
  count     = local.enable_azure ? 1 : 0
  client_id = azuread_application.github_ci[0].client_id
}

resource "azuread_application_federated_identity_credential" "github_main" {
  count          = local.enable_azure ? 1 : 0
  application_id = azuread_application.github_ci[0].id
  display_name   = "github-main"
  description    = "GitHub Actions main branch"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = local.github_oidc_url
  subject        = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
}

resource "azuread_application_federated_identity_credential" "github_envs" {
  count          = local.enable_azure ? length(var.allowed_environments) : 0
  application_id = azuread_application.github_ci[0].id
  display_name   = "github-env-${var.allowed_environments[count.index]}"
  description    = "GitHub Actions environment: ${var.allowed_environments[count.index]}"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = local.github_oidc_url
  subject        = "repo:${var.github_org}/${var.github_repo}:environment:${var.allowed_environments[count.index]}"
}

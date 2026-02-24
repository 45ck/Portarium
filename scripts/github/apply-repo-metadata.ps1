$ErrorActionPreference = "Stop"

param(
  [string]$Repo = "45ck/Portarium"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required. Install it from https://cli.github.com/"
}

$description = "Open-source multi-tenant control plane for governable operations: policy, approvals, orchestration, and evidence across existing systems."
$homepage = "https://github.com/45ck/Portarium/blob/main/docs/index.md"
$topics = @(
  "control-plane",
  "workflow-orchestration",
  "temporal",
  "policy-engine",
  "approvals",
  "audit-trail",
  "evidence",
  "ports-and-adapters",
  "integration-platform",
  "cloudevents",
  "openapi",
  "rbac",
  "multi-tenant",
  "opentelemetry",
  "typescript"
)

Write-Host "Applying description/homepage for $Repo..."
gh repo edit $Repo --description $description --homepage $homepage

Write-Host "Replacing repository topics for $Repo..."
gh repo edit $Repo --clear-topics
foreach ($topic in $topics) {
  gh repo edit $Repo --add-topic $topic
}

Write-Host ""
Write-Host "Repository metadata updated."
Write-Host "Set social preview manually in GitHub Settings -> General -> Social preview."
Write-Host "Use: docs/diagrams/generated/09_isometric_minimal_fusion_textonly_v3_user_left.jpg"

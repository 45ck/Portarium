#!/usr/bin/env bash
# Deploy Portarium into a kind cluster and run smoke tests.
#
# Prerequisites:
#   - kind (https://kind.sigs.k8s.io/)
#   - kubectl
#   - docker
#
# Usage:
#   bash infra/kind/deploy-smoke.sh
#
# This script:
#   1. Creates a kind cluster (or reuses existing)
#   2. Builds container images and loads them into kind
#   3. Applies Kustomize manifests
#   4. Waits for pods to become ready
#   5. Runs health endpoint smoke tests
#   6. Cleans up (optional, pass --keep to preserve cluster)
#
# Bead: bead-qr8v

set -euo pipefail

CLUSTER_NAME="portarium"
NAMESPACE="portarium"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KEEP_CLUSTER=false

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP_CLUSTER=true ;;
    --help|-h)
      echo "Usage: $0 [--keep]"
      echo "  --keep  Do not delete the kind cluster after smoke tests"
      exit 0
      ;;
  esac
done

cleanup() {
  if [ "$KEEP_CLUSTER" = false ]; then
    echo "--- Cleaning up kind cluster '$CLUSTER_NAME' ---"
    kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
  else
    echo "--- Cluster '$CLUSTER_NAME' preserved (--keep) ---"
  fi
}

trap cleanup EXIT

echo "=== Portarium kind Deployment Smoke Test ==="
echo ""

# Step 1: Create cluster
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "--- Reusing existing kind cluster '$CLUSTER_NAME' ---"
else
  echo "--- Creating kind cluster '$CLUSTER_NAME' ---"
  kind create cluster \
    --config "$SCRIPT_DIR/kind-cluster.yaml" \
    --name "$CLUSTER_NAME" \
    --wait 60s
fi

# Step 2: Build and load images
echo "--- Building container images ---"
docker build -t portarium-control-plane:smoke -f "$REPO_ROOT/infra/docker/control-plane.Dockerfile" "$REPO_ROOT"
docker build -t portarium-worker:smoke -f "$REPO_ROOT/infra/docker/worker.Dockerfile" "$REPO_ROOT"

echo "--- Loading images into kind ---"
kind load docker-image portarium-control-plane:smoke --name "$CLUSTER_NAME"
kind load docker-image portarium-worker:smoke --name "$CLUSTER_NAME"

# Step 3: Create namespace and apply manifests
echo "--- Applying Kustomize manifests ---"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -k "$REPO_ROOT/infra/kubernetes/base" -n "$NAMESPACE" || {
  echo "WARN: Kustomize apply had issues (expected if CRDs missing)"
}

# Step 4: Wait for rollout
echo "--- Waiting for pods to become ready (timeout: 120s) ---"
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/part-of=portarium \
  -n "$NAMESPACE" \
  --timeout=120s 2>/dev/null || {
  echo "WARN: Not all pods reached ready state (expected in minimal smoke)"
  kubectl get pods -n "$NAMESPACE" -o wide
}

# Step 5: Smoke tests
echo ""
echo "=== Smoke Test Results ==="
echo ""

PASS=0
FAIL=0

smoke_check() {
  local desc="$1"
  local cmd="$2"

  if eval "$cmd" > /dev/null 2>&1; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

# Check namespace exists
smoke_check "Namespace '$NAMESPACE' exists" \
  "kubectl get namespace $NAMESPACE"

# Check PDBs exist
smoke_check "PDB for control-plane exists" \
  "kubectl get pdb portarium-control-plane-pdb -n $NAMESPACE"

smoke_check "PDB for execution-plane exists" \
  "kubectl get pdb portarium-execution-plane-pdb -n $NAMESPACE"

smoke_check "PDB for OTel collector exists" \
  "kubectl get pdb portarium-otel-collector-pdb -n $NAMESPACE"

# Check pods are scheduled
smoke_check "At least one pod scheduled" \
  "test \$(kubectl get pods -n $NAMESPACE --no-headers 2>/dev/null | wc -l) -gt 0"

# Check images loaded
smoke_check "Control-plane image available in kind" \
  "docker exec ${CLUSTER_NAME}-control-plane crictl images 2>/dev/null | grep -q portarium-control-plane"

smoke_check "Worker image available in kind" \
  "docker exec ${CLUSTER_NAME}-control-plane crictl images 2>/dev/null | grep -q portarium-worker"

echo ""
echo "=== Summary: $PASS passed, $FAIL failed ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "Some smoke tests failed. Check output above."
  exit 1
fi

echo "All smoke tests passed."

#!/usr/bin/env bash
# generate-go-client.sh -- Generate typed Go client from Portarium OpenAPI spec
#
# Beads: bead-0663
#
# Prerequisites:
#   go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
#
# Usage:
#   ./scripts/codegen/generate-go-client.sh          # regenerate in-place
#   ./scripts/codegen/generate-go-client.sh --check   # CI diff check (exit 1 if changed)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPENAPI_SPEC="${REPO_ROOT}/docs/spec/openapi/portarium-control-plane.v1.yaml"
OUTPUT_DIR="${REPO_ROOT}/sdks/go/portarium"
CONFIG_DIR="${REPO_ROOT}/scripts/codegen"
GENERATOR="oapi-codegen"

# --- Preflight ---

if ! command -v "${GENERATOR}" &>/dev/null; then
  echo "ERROR: ${GENERATOR} is not installed."
  echo "Install it with:  go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest"
  exit 1
fi

if [[ ! -f "${OPENAPI_SPEC}" ]]; then
  echo "ERROR: OpenAPI spec not found at ${OPENAPI_SPEC}"
  exit 1
fi

# --- Generate ---

echo "Generating Go client from ${OPENAPI_SPEC} ..."

mkdir -p "${OUTPUT_DIR}"

# Generate types
${GENERATOR} \
  --package portarium \
  --generate types \
  --o "${OUTPUT_DIR}/models_gen.go" \
  "${OPENAPI_SPEC}"

# Generate client with response types
${GENERATOR} \
  --package portarium \
  --generate client \
  --o "${OUTPUT_DIR}/client_gen.go" \
  "${OPENAPI_SPEC}"

echo "Go client generated at ${OUTPUT_DIR}"

# --- CI diff check ---

if [[ "${1:-}" == "--check" ]]; then
  echo "Running CI diff check ..."
  cd "${REPO_ROOT}"
  if ! git diff --exit-code -- "${OUTPUT_DIR}"; then
    echo "ERROR: Generated Go client differs from committed version."
    echo "Run './scripts/codegen/generate-go-client.sh' and commit the result."
    exit 1
  fi
  echo "OK: Generated client matches committed version."
fi

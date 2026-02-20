#!/usr/bin/env bash
# generate-python-client.sh -- Generate typed Python client from Portarium OpenAPI spec
#
# Beads: bead-0662
#
# Prerequisites:
#   pip install openapi-python-client
#
# Usage:
#   ./scripts/codegen/generate-python-client.sh          # regenerate in-place
#   ./scripts/codegen/generate-python-client.sh --check   # CI diff check (exit 1 if changed)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OPENAPI_SPEC="${REPO_ROOT}/docs/spec/openapi/portarium-control-plane.v1.yaml"
OUTPUT_DIR="${REPO_ROOT}/sdks/python/portarium-client"
GENERATOR="openapi-python-client"

# --- Preflight ---

if ! command -v "${GENERATOR}" &>/dev/null; then
  echo "ERROR: ${GENERATOR} is not installed."
  echo "Install it with:  pip install openapi-python-client"
  exit 1
fi

if [[ ! -f "${OPENAPI_SPEC}" ]]; then
  echo "ERROR: OpenAPI spec not found at ${OPENAPI_SPEC}"
  exit 1
fi

# --- Generate ---

echo "Generating Python client from ${OPENAPI_SPEC} ..."

# Remove previous generated output (generator creates a fresh directory)
if [[ -d "${OUTPUT_DIR}" ]]; then
  rm -rf "${OUTPUT_DIR}"
fi

mkdir -p "$(dirname "${OUTPUT_DIR}")"

${GENERATOR} generate \
  --path "${OPENAPI_SPEC}" \
  --output-path "${OUTPUT_DIR}" \
  --config "${REPO_ROOT}/scripts/codegen/python-client-config.yaml" \
  --meta poetry

echo "Python client generated at ${OUTPUT_DIR}"

# --- CI diff check ---

if [[ "${1:-}" == "--check" ]]; then
  echo "Running CI diff check ..."
  cd "${REPO_ROOT}"
  if ! git diff --exit-code -- "${OUTPUT_DIR}"; then
    echo "ERROR: Generated Python client differs from committed version."
    echo "Run './scripts/codegen/generate-python-client.sh' and commit the result."
    exit 1
  fi
  echo "OK: Generated client matches committed version."
fi

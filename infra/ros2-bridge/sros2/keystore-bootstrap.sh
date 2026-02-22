#!/usr/bin/env bash
# keystore-bootstrap.sh — Bootstrap SROS2 keystore for portarium_bridge
#
# Generates the DDS-Security keystore structure required for SROS2 on a
# new robot/gateway host. Requires ros2 CLI and openssl.
#
# Usage:
#   KEYSTORE_DIR=/etc/portarium/sros2_keystore \
#   ENCLAVE=/portarium_bridge \
#   CA_CERT=/etc/portarium/pki/ca_cert.pem \
#   CA_KEY=/etc/portarium/pki/ca_key.pem \
#   ./keystore-bootstrap.sh
#
# Bead: bead-0520
set -euo pipefail

KEYSTORE_DIR="${KEYSTORE_DIR:-/etc/portarium/sros2_keystore}"
ENCLAVE="${ENCLAVE:-/portarium_bridge}"
CA_CERT="${CA_CERT:-}"
CA_KEY="${CA_KEY:-}"
GOVERNANCE_XML="$(dirname "$0")/governance.xml"
ENCLAVE_POLICY_XML="$(dirname "$0")/enclave_portarium_bridge.xml"

# ── Validate ──────────────────────────────────────────────────────────────────

if ! command -v ros2 &>/dev/null; then
  echo "ERROR: ros2 CLI not found. Source your ROS 2 workspace first." >&2
  exit 1
fi

if [[ -z "${CA_CERT}" || -z "${CA_KEY}" ]]; then
  echo "ERROR: CA_CERT and CA_KEY environment variables must be set." >&2
  exit 1
fi

# ── Create keystore directory ─────────────────────────────────────────────────

echo "[sros2-bootstrap] Creating keystore at ${KEYSTORE_DIR}"
ros2 security create_keystore "${KEYSTORE_DIR}"

# ── Install CA into keystore ──────────────────────────────────────────────────

echo "[sros2-bootstrap] Installing CA certificate"
cp "${CA_CERT}" "${KEYSTORE_DIR}/public/ca.cert.pem"
cp "${CA_KEY}"  "${KEYSTORE_DIR}/private/ca.key.pem"
chmod 600       "${KEYSTORE_DIR}/private/ca.key.pem"

# ── Install governance document ───────────────────────────────────────────────

echo "[sros2-bootstrap] Signing and installing governance policy"
openssl smime \
  -sign \
  -in    "${GOVERNANCE_XML}" \
  -out   "${KEYSTORE_DIR}/public/governance.p7s" \
  -signer "${CA_CERT}" \
  -inkey  "${CA_KEY}" \
  -nodetach \
  -outform PEM

# ── Create enclave keypair and access-control certificate ────────────────────

echo "[sros2-bootstrap] Creating enclave: ${ENCLAVE}"
ros2 security create_enclave "${KEYSTORE_DIR}" "${ENCLAVE}"

# ── Install access-control policy ────────────────────────────────────────────

echo "[sros2-bootstrap] Signing and installing access-control policy"
openssl smime \
  -sign \
  -in    "${ENCLAVE_POLICY_XML}" \
  -out   "${KEYSTORE_DIR}${ENCLAVE}/permissions.p7s" \
  -signer "${CA_CERT}" \
  -inkey  "${CA_KEY}" \
  -nodetach \
  -outform PEM

cp "${ENCLAVE_POLICY_XML}" "${KEYSTORE_DIR}${ENCLAVE}/permissions.xml"

# ── Set file permissions ──────────────────────────────────────────────────────

echo "[sros2-bootstrap] Locking down keystore permissions"
find "${KEYSTORE_DIR}" -name "*.key.pem" -exec chmod 600 {} \;
find "${KEYSTORE_DIR}" -name "*.cert.pem" -exec chmod 644 {} \;
find "${KEYSTORE_DIR}" -name "*.p7s" -exec chmod 644 {} \;

echo "[sros2-bootstrap] Keystore bootstrap complete."
echo "  Keystore : ${KEYSTORE_DIR}"
echo "  Enclave  : ${ENCLAVE}"
echo ""
echo "Set these environment variables before launching the bridge node:"
echo "  export ROS_SECURITY_ENABLE=true"
echo "  export ROS_SECURITY_STRATEGY=Enforce"
echo "  export ROS_SECURITY_KEYSTORE=${KEYSTORE_DIR}"
echo "  export ROS_SECURITY_ENCLAVE_OVERRIDE=${ENCLAVE}"

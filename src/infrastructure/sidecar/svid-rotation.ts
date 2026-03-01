/**
 * SPIFFE SVID rotation lifecycle for the Portarium sidecar.
 *
 * Monitors X.509 SVID certificate files on disk and triggers
 * credential reload before expiry. Implements the safe rotation
 * pattern: validate new cert → swap → log rotation event.
 *
 * ADR-0115 Section 5: Workload identity (mTLS/SPIFFE).
 * ADR-0076: SPIRE workload identity — SVID rotation.
 *
 * Bead: bead-0836
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SvidCertInfo = Readonly<{
  /** SPIFFE ID from the certificate. */
  spiffeId: string;
  /** Certificate not-valid-after as epoch seconds. */
  expiresAtEpochSec: number;
  /** Certificate fingerprint (SHA-256 of DER). */
  fingerprint: string;
}>;

export type SvidRotationConfig = Readonly<{
  /** Path to the SVID certificate PEM file. */
  svidCertPath: string;
  /** Path to the SVID private key PEM file. */
  svidKeyPath: string;
  /** Path to the trust bundle CA certificate PEM file. */
  trustBundlePath: string;
  /** Check interval in seconds. Default: 60. */
  checkIntervalSec?: number;
  /** Rotation buffer in seconds — rotate this far before expiry. Default: 300 (5 min). */
  rotationBufferSec?: number;
  /** Clock function for testability. */
  nowEpochSec?: () => number;
}>;

export type RotationCheckResult =
  | Readonly<{ action: 'none'; reason: string; currentCert: SvidCertInfo }>
  | Readonly<{ action: 'rotate'; reason: string; currentCert: SvidCertInfo }>
  | Readonly<{ action: 'error'; reason: string }>;

export type SvidRotationEvent = Readonly<{
  type: 'svid_rotated' | 'svid_expiring_soon' | 'svid_expired' | 'svid_check_error';
  spiffeId?: string;
  fingerprint?: string;
  expiresAtEpochSec?: number;
  remainingSec?: number;
  message: string;
}>;

/**
 * Callback for SVID lifecycle events (logging, metrics, alerting).
 */
export type SvidEventHandler = (event: SvidRotationEvent) => void;

/**
 * Reads and parses the current SVID certificate from disk.
 * Injected for testability — production implementation uses node:crypto.
 */
export type SvidCertReader = (certPath: string) => SvidCertInfo | undefined;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CHECK_INTERVAL_SEC = 60;
const DEFAULT_ROTATION_BUFFER_SEC = 300; // 5 minutes before expiry

// ---------------------------------------------------------------------------
// Rotation logic
// ---------------------------------------------------------------------------

/**
 * Check whether the current SVID needs rotation.
 *
 * Returns 'rotate' when:
 * - The certificate is within the rotation buffer window.
 * - The certificate has already expired.
 *
 * Returns 'none' when the certificate is healthy.
 * Returns 'error' when the certificate cannot be read.
 */
export function checkSvidRotation(
  config: SvidRotationConfig,
  certReader: SvidCertReader,
): RotationCheckResult {
  const nowSec = (config.nowEpochSec ?? (() => Math.floor(Date.now() / 1000)))();
  const buffer = config.rotationBufferSec ?? DEFAULT_ROTATION_BUFFER_SEC;

  const cert = certReader(config.svidCertPath);
  if (!cert) {
    return { action: 'error', reason: 'Failed to read SVID certificate.' };
  }

  const remainingSec = cert.expiresAtEpochSec - nowSec;

  if (remainingSec <= 0) {
    return {
      action: 'rotate',
      reason: `SVID has expired (${Math.abs(remainingSec)}s ago).`,
      currentCert: cert,
    };
  }

  if (remainingSec <= buffer) {
    return {
      action: 'rotate',
      reason: `SVID expires in ${remainingSec}s (within ${buffer}s rotation buffer).`,
      currentCert: cert,
    };
  }

  return {
    action: 'none',
    reason: `SVID healthy, ${remainingSec}s remaining.`,
    currentCert: cert,
  };
}

/**
 * Validate that a newly rotated SVID is usable.
 *
 * Checks:
 * 1. Certificate can be read from disk.
 * 2. SPIFFE ID is non-empty.
 * 3. New certificate is not already expired.
 * 4. New fingerprint differs from the old one (rotation actually happened).
 */
export function validateRotatedSvid(
  config: SvidRotationConfig,
  certReader: SvidCertReader,
  previousFingerprint?: string,
): { valid: true; cert: SvidCertInfo } | { valid: false; reason: string } {
  const nowSec = (config.nowEpochSec ?? (() => Math.floor(Date.now() / 1000)))();

  const cert = certReader(config.svidCertPath);
  if (!cert) {
    return { valid: false, reason: 'Cannot read rotated SVID certificate.' };
  }

  if (!cert.spiffeId?.startsWith('spiffe://')) {
    return { valid: false, reason: `Invalid SPIFFE ID in rotated SVID: '${cert.spiffeId}'.` };
  }

  if (cert.expiresAtEpochSec <= nowSec) {
    return { valid: false, reason: 'Rotated SVID is already expired.' };
  }

  if (previousFingerprint && cert.fingerprint === previousFingerprint) {
    return {
      valid: false,
      reason: 'Rotated SVID has same fingerprint as previous — rotation may not have occurred.',
    };
  }

  return { valid: true, cert };
}

/**
 * Build a rotation event for structured logging/alerting.
 */
export function buildRotationEvent(
  result: RotationCheckResult,
  config: SvidRotationConfig,
): SvidRotationEvent {
  const nowSec = (config.nowEpochSec ?? (() => Math.floor(Date.now() / 1000)))();
  const buffer = config.rotationBufferSec ?? DEFAULT_ROTATION_BUFFER_SEC;

  if (result.action === 'error') {
    return { type: 'svid_check_error', message: result.reason };
  }

  const remainingSec = result.currentCert.expiresAtEpochSec - nowSec;

  if (remainingSec <= 0) {
    return {
      type: 'svid_expired',
      spiffeId: result.currentCert.spiffeId,
      fingerprint: result.currentCert.fingerprint,
      expiresAtEpochSec: result.currentCert.expiresAtEpochSec,
      remainingSec: 0,
      message: `SVID expired ${Math.abs(remainingSec)}s ago.`,
    };
  }

  if (result.action === 'rotate') {
    return {
      type: 'svid_expiring_soon',
      spiffeId: result.currentCert.spiffeId,
      fingerprint: result.currentCert.fingerprint,
      expiresAtEpochSec: result.currentCert.expiresAtEpochSec,
      remainingSec,
      message: `SVID expires in ${remainingSec}s (buffer: ${buffer}s). Rotation required.`,
    };
  }

  return {
    type: 'svid_rotated',
    spiffeId: result.currentCert.spiffeId,
    fingerprint: result.currentCert.fingerprint,
    expiresAtEpochSec: result.currentCert.expiresAtEpochSec,
    remainingSec,
    message: `SVID healthy, ${remainingSec}s remaining.`,
  };
}

/**
 * Parse the check interval from config (with default).
 * Exported for use by sidecar daemon loop.
 */
export function getCheckIntervalMs(config: SvidRotationConfig): number {
  return (config.checkIntervalSec ?? DEFAULT_CHECK_INTERVAL_SEC) * 1000;
}

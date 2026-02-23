/**
 * DDS-Security defaults enforcement for robotics communication.
 *
 * Implements the "no harden-later" policy: robotics gateway configurations
 * MUST specify secure transport by default. Insecure connections are only
 * allowed when explicitly opted in via a development-mode flag.
 *
 * This is a pure domain module — no external dependencies.
 *
 * Bead: bead-fv8i
 * ADR: ADR-0103
 */

// ── Transport security modes ────────────────────────────────────────────────

const TRANSPORT_SECURITY_MODES = ['mTLS', 'TLS', 'SROS2', 'Insecure'] as const;

export type TransportSecurityMode = (typeof TRANSPORT_SECURITY_MODES)[number];

export function isTransportSecurityMode(value: string): value is TransportSecurityMode {
  return (TRANSPORT_SECURITY_MODES as readonly string[]).includes(value);
}

// ── Gateway security profile ────────────────────────────────────────────────

export type GatewaySecurityProfile = Readonly<{
  /** Identifier for the gateway adapter (e.g., 'grpc', 'mqtt', 'ros2-bridge'). */
  gatewayType: string;
  /** Transport security mode configured for this gateway. */
  transportSecurity: TransportSecurityMode;
  /** Whether this is explicitly a development/test configuration. */
  developmentMode: boolean;
}>;

// ── Validation result ───────────────────────────────────────────────────────

export type DdsSecurityValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

// ── Secure transport set ────────────────────────────────────────────────────

const SECURE_TRANSPORT_MODES: ReadonlySet<TransportSecurityMode> = new Set([
  'mTLS',
  'TLS',
  'SROS2',
]);

/**
 * Returns true if the given transport security mode is considered secure
 * (i.e., provides encryption and optionally mutual authentication).
 */
export function isSecureTransport(mode: TransportSecurityMode): boolean {
  return SECURE_TRANSPORT_MODES.has(mode);
}

// ── Core validation ─────────────────────────────────────────────────────────

/**
 * Validates that a gateway security profile enforces the "no harden-later"
 * policy for DDS-Security.
 *
 * Rules:
 * 1. Production gateways MUST use a secure transport mode (mTLS, TLS, or SROS2).
 * 2. Insecure transport is only permitted when `developmentMode` is explicitly true.
 * 3. ROS 2 bridge gateways in production MUST use SROS2 (not just TLS).
 */
export function validateGatewaySecurityProfile(
  profile: GatewaySecurityProfile,
): DdsSecurityValidationResult {
  // Rule 2: Insecure is allowed in development mode
  if (profile.developmentMode && profile.transportSecurity === 'Insecure') {
    return { valid: true };
  }

  // Rule 1: Non-development gateways must use secure transport
  if (!isSecureTransport(profile.transportSecurity)) {
    return {
      valid: false,
      reason:
        `Gateway '${profile.gatewayType}' uses '${profile.transportSecurity}' transport ` +
        `but developmentMode is not enabled. Production gateways MUST use mTLS, TLS, or SROS2. ` +
        `Set developmentMode=true for local testing or configure secure transport credentials.`,
    };
  }

  // Rule 3: ROS 2 bridge in production requires SROS2
  if (
    profile.gatewayType === 'ros2-bridge' &&
    !profile.developmentMode &&
    profile.transportSecurity !== 'SROS2'
  ) {
    return {
      valid: false,
      reason:
        `ROS 2 bridge gateways in production MUST use SROS2 transport security ` +
        `(configured: '${profile.transportSecurity}'). SROS2 provides DDS-native ` +
        `authentication, encryption, and access control via governance policies. ` +
        `TLS alone does not protect the DDS data bus.`,
    };
  }

  return { valid: true };
}

/**
 * Validates an array of gateway security profiles. Returns the first
 * validation failure, or a success result if all profiles pass.
 */
export function validateAllGatewaySecurityProfiles(
  profiles: readonly GatewaySecurityProfile[],
): DdsSecurityValidationResult {
  for (const profile of profiles) {
    const result = validateGatewaySecurityProfile(profile);
    if (!result.valid) return result;
  }
  return { valid: true };
}

// ── SROS2 keystore configuration ────────────────────────────────────────────

export type Sros2KeystoreConfig = Readonly<{
  /** Path to the SROS2 keystore directory. */
  keystorePath: string;
  /** DDS domain ID for the ROS 2 domain. */
  domainId: number;
  /** Enclave name within the keystore (e.g., 'portarium_bridge'). */
  enclaveName: string;
  /** Certificate TTL in days. Must be > 0. */
  certTtlDays: number;
  /** Days before expiry to begin auto-renewal. Must be < certTtlDays. */
  renewalLeadDays: number;
}>;

/**
 * Validates SROS2 keystore configuration invariants.
 */
export function validateSros2KeystoreConfig(
  config: Sros2KeystoreConfig,
): DdsSecurityValidationResult {
  if (!config.keystorePath || config.keystorePath.trim() === '') {
    return { valid: false, reason: 'SROS2 keystorePath must be a non-empty path.' };
  }

  if (config.domainId < 0 || config.domainId > 232 || !Number.isInteger(config.domainId)) {
    return {
      valid: false,
      reason: `SROS2 domainId must be an integer between 0 and 232, got ${config.domainId}.`,
    };
  }

  if (!config.enclaveName || config.enclaveName.trim() === '') {
    return { valid: false, reason: 'SROS2 enclaveName must be a non-empty string.' };
  }

  if (config.certTtlDays <= 0) {
    return {
      valid: false,
      reason: `SROS2 certTtlDays must be positive, got ${config.certTtlDays}.`,
    };
  }

  if (config.renewalLeadDays >= config.certTtlDays) {
    return {
      valid: false,
      reason:
        `SROS2 renewalLeadDays (${config.renewalLeadDays}) must be less than ` +
        `certTtlDays (${config.certTtlDays}).`,
    };
  }

  if (config.renewalLeadDays < 0) {
    return {
      valid: false,
      reason: `SROS2 renewalLeadDays must be non-negative, got ${config.renewalLeadDays}.`,
    };
  }

  return { valid: true };
}

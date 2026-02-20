/**
 * Portarium Sidecar daemon -- design module.
 *
 * The sidecar runs alongside each workload container and handles:
 * 1. mTLS termination (using SPIFFE/SPIRE SVID).
 * 2. Automatic token acquisition and refresh (JWT for control plane).
 * 3. Egress allowlist enforcement (all outbound traffic routes through proxy).
 * 4. W3C trace-context header injection on all proxied requests.
 *
 * This module defines the sidecar configuration types and lifecycle hooks.
 * The actual HTTP proxy implementation is in egress-proxy.ts.
 */

import type { EgressProxyConfig } from './egress-proxy.js';

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export type SidecarMtlsConfig = Readonly<{
  /** Path to the SPIFFE SVID certificate file. */
  svidCertPath: string;
  /** Path to the SPIFFE SVID private key file. */
  svidKeyPath: string;
  /** Path to the trust bundle CA certificate. */
  trustBundlePath: string;
  /** SVID rotation check interval in seconds. */
  rotationCheckIntervalSeconds: number;
}>;

export type SidecarTokenConfig = Readonly<{
  /** URL of the token endpoint (e.g. OIDC token exchange). */
  tokenEndpointUrl: string;
  /** Client ID for the token exchange. */
  clientId: string;
  /** Path to client secret file (not embedded in config). */
  clientSecretPath: string;
  /** Audience for the requested token. */
  audience: string;
  /** Refresh buffer in seconds (refresh before expiry). */
  refreshBufferSeconds: number;
}>;

export type SidecarConfig = Readonly<{
  /** Workspace ID this sidecar is scoped to. */
  workspaceId: string;
  /** mTLS configuration for inbound termination. */
  mtls: SidecarMtlsConfig;
  /** Token acquisition config for control-plane auth. */
  token: SidecarTokenConfig;
  /** Egress proxy configuration. */
  egress: EgressProxyConfig;
  /** Local proxy listen port. Defaults to 15001. */
  proxyPort?: number;
  /** Admin/health port. Defaults to 15000. */
  adminPort?: number;
}>;

// ---------------------------------------------------------------------------
// Lifecycle hooks (design-level -- no implementation)
// ---------------------------------------------------------------------------

export type SidecarState = 'initializing' | 'ready' | 'draining' | 'stopped';

export type SidecarStatus = Readonly<{
  state: SidecarState;
  workspaceId: string;
  tokenExpiresAtIso?: string;
  svidExpiresAtIso?: string;
  egressRuleCount: number;
}>;

/**
 * Build a sidecar status from the config. Used by the admin endpoint.
 */
export function buildInitialStatus(config: SidecarConfig): SidecarStatus {
  return {
    state: 'initializing',
    workspaceId: config.workspaceId,
    egressRuleCount: config.egress.allowlist.length,
  };
}

/**
 * Enforcement mode for the sidecar proxy (ADR-0115 migration phases).
 * - 'enforce': deny non-allowlisted egress (default-deny, fail-closed)
 * - 'monitor': log violations but allow all traffic (Phase 1 instrumentation)
 */
export type SidecarEnforcementMode = 'enforce' | 'monitor';

/**
 * Configuration for the Portarium sidecar proxy.
 *
 * The sidecar sits between the agent/execution workload and the network,
 * enforcing egress allowlists, injecting auth headers, and propagating
 * W3C trace context.
 */
export type SidecarConfigV1 = Readonly<{
  /** Upstream service URL the sidecar proxies requests to. */
  upstreamUrl: string;
  /** Allowlist of egress host patterns (exact host or wildcard like *.example.com). */
  egressAllowlist: readonly string[];
  /** Interval in milliseconds for token refresh. Default: 300000 (5 min). */
  tokenRefreshIntervalMs: number;
  /** Path to the mTLS client certificate (SPIRE SVID). */
  mtlsCertPath?: string;
  /** Port the sidecar listens on. Default: 15001. */
  listenPort: number;
  /** Enforcement mode: 'enforce' (default-deny) or 'monitor' (log-only). */
  enforcementMode: SidecarEnforcementMode;
}>;

export const DEFAULT_SIDECAR_CONFIG: SidecarConfigV1 = {
  upstreamUrl: 'http://localhost:3000',
  egressAllowlist: [],
  tokenRefreshIntervalMs: 300_000,
  listenPort: 15001,
  enforcementMode: 'enforce',
};

export class SidecarConfigParseError extends Error {
  public override readonly name = 'SidecarConfigParseError';
}

export function parseSidecarConfigV1(value: unknown): SidecarConfigV1 {
  if (typeof value !== 'object' || value === null) {
    throw new SidecarConfigParseError('Sidecar config must be an object.');
  }
  const record = value as Record<string, unknown>;

  const upstreamUrl = requireNonEmptyString(record, 'upstreamUrl');
  const egressAllowlist = requireStringArray(record, 'egressAllowlist');
  const tokenRefreshIntervalMs = requirePositiveNumber(
    record,
    'tokenRefreshIntervalMs',
    DEFAULT_SIDECAR_CONFIG.tokenRefreshIntervalMs,
  );
  const listenPort = requirePositiveNumber(record, 'listenPort', DEFAULT_SIDECAR_CONFIG.listenPort);
  const mtlsCertPath = optionalString(record, 'mtlsCertPath');
  const enforcementMode = parseEnforcementMode(record);

  return {
    upstreamUrl,
    egressAllowlist,
    tokenRefreshIntervalMs,
    listenPort,
    enforcementMode,
    ...(mtlsCertPath !== undefined ? { mtlsCertPath } : {}),
  };
}

function parseEnforcementMode(record: Record<string, unknown>): SidecarEnforcementMode {
  const value = record['enforcementMode'];
  if (value === undefined || value === null) return DEFAULT_SIDECAR_CONFIG.enforcementMode;
  if (value !== 'enforce' && value !== 'monitor') {
    throw new SidecarConfigParseError('enforcementMode must be "enforce" or "monitor".');
  }
  return value;
}

function requireNonEmptyString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SidecarConfigParseError(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function requireStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new SidecarConfigParseError(`${key} must be an array.`);
  }
  return value.map((item, idx) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new SidecarConfigParseError(`${key}[${idx}] must be a non-empty string.`);
    }
    return item.trim();
  });
}

function requirePositiveNumber(
  record: Record<string, unknown>,
  key: string,
  defaultValue: number,
): number {
  const value = record[key];
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new SidecarConfigParseError(`${key} must be a positive number.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim();
}

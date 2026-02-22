/**
 * SPIFFE Workload API credential helper for Portarium robot gateways.
 *
 * Fetches X.509 SVIDs from the SPIRE Agent via the SPIFFE Workload API Unix
 * socket. The returned credentials can be used for mTLS in any of the
 * robotics gateway adapters (gRPC, MQTT, ROS 2 bridge, OPC UA).
 *
 * The SPIFFE Workload API is served by the SPIRE Agent on the UDS path
 * specified by $SPIFFE_ENDPOINT_SOCKET (default: unix:///run/spire/sockets/agent.sock).
 *
 * SVID rotation: call `fetchSVID()` and cache the result until `expiresAt`.
 * Re-fetch when within `renewBeforeExpiryMs` (default 5 minutes) of expiry.
 *
 * This module has no hard dependency on `@spiffe/spiffe-workload-api` because
 * that package is not guaranteed to be installed; it loads it via createRequire
 * and gracefully fails with a descriptive error if not present.
 *
 * Bead: bead-0521
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SpiffeX509Svid {
  /** SPIFFE ID (e.g. spiffe://portarium.robotics/ns/portarium/sa/robotics-gateway/pod-xyz) */
  spiffeId: string;
  /** PEM-encoded leaf certificate. */
  certPem: string;
  /** PEM-encoded private key. */
  keyPem: string;
  /** PEM-encoded CA bundle for the trust domain. */
  bundlePem: string;
  /** ISO-8601 UTC expiry of the SVID. */
  expiresAt: string;
}

export interface SpiffeCredentialOptions {
  /** SPIFFE Workload API socket path. Default: value of $SPIFFE_ENDPOINT_SOCKET or /run/spire/sockets/agent.sock */
  socketPath?: string;
  /** Refresh the SVID this many ms before expiry. Default: 300 000 (5 min). */
  renewBeforeExpiryMs?: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CachedSvid {
  svid: SpiffeX509Svid;
  expiresAtMs: number;
}

let cache: CachedSvid | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the current X.509 SVID from the SPIFFE Workload API.
 *
 * Uses an in-process cache and re-fetches when within `renewBeforeExpiryMs`
 * of the SVID's expiry. Thread-safety note: multiple concurrent callers may
 * both trigger a fetch; this is benign (last write wins).
 */
export async function fetchSVID(options: SpiffeCredentialOptions = {}): Promise<SpiffeX509Svid> {
  const renewBefore = options.renewBeforeExpiryMs ?? 300_000;
  const now = Date.now();

  if (cache !== null && cache.expiresAtMs - renewBefore > now) {
    return cache.svid;
  }

  const svid = await fetchFromWorkloadApi(options.socketPath);
  cache = {
    svid,
    expiresAtMs: new Date(svid.expiresAt).getTime(),
  };
  return svid;
}

/** Clear the SVID cache (useful in tests). */
export function clearSvidCache(): void {
  cache = null;
}

// ── Workload API client ────────────────────────────────────────────────────────

async function fetchFromWorkloadApi(socketPath?: string): Promise<SpiffeX509Svid> {
  const socket =
    socketPath ??
    process.env['SPIFFE_ENDPOINT_SOCKET'] ??
    'unix:///run/spire/sockets/agent.sock';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workloadApi: any;
  try {
    workloadApi = require('@spiffe/spiffe-workload-api');
  } catch {
    throw new Error(
      'SPIFFE Workload API client not available. ' +
      'Install @spiffe/spiffe-workload-api or ensure the package is in node_modules. ' +
      `Socket: ${socket}`,
    );
  }

  const client = workloadApi.X509Source
    ? new workloadApi.X509Source({ socketPath: socket })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : workloadApi.createX509Source?.({ socketPath: socket }) as any;

  if (!client) {
    throw new Error('SPIFFE Workload API: no X509Source constructor found in package.');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svid: any = await (client.getX509SVID?.() ?? client.fetch?.());

    return {
      spiffeId: String(svid.spiffeId ?? svid.id ?? ''),
      certPem: toPem(svid.certificates ?? svid.cert ?? svid.x509Svid?.certificates),
      keyPem: toPem(svid.privateKey ?? svid.key ?? svid.x509Svid?.privateKey),
      bundlePem: toPem(svid.bundle ?? svid.federatedBundles ?? svid.x509BundleSet),
      expiresAt: toIso(svid.expiresAt ?? svid.expiry),
    };
  } finally {
    client.close?.();
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function toPem(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (Array.isArray(value)) return value.map(toPem).join('\n');
  return '';
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  return new Date(Date.now() + 3_600_000).toISOString(); // fallback: +1h
}

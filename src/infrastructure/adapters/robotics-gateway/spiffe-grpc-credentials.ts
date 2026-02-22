/**
 * SPIFFE → gRPC mTLS credential bridge.
 *
 * Converts a SPIFFE X.509 SVID into a gRPC `ChannelCredentials` object
 * suitable for mutual TLS connections. Intended for use with
 * `GrpcMissionGateway` and any other gRPC-based robot gateway adapters.
 *
 * Usage:
 *   const creds = await buildSpiffeGrpcCredentials();
 *   const gateway = new GrpcMissionGateway({ endpoint, credentials: creds });
 *
 * The underlying SVID is cached and automatically refreshed before expiry
 * by `fetchSVID` (see spiffe-workload-credential.ts).
 *
 * Bead: bead-0521
 */

import { createRequire } from 'module';
import {
  fetchSVID,
  type SpiffeCredentialOptions,
  type SpiffeX509Svid,
} from './spiffe-workload-credential.js';

const require = createRequire(import.meta.url);

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A gRPC `ChannelCredentials` object (opaque outside @grpc/grpc-js).
 * We keep the type loose so this module does not require grpc-js at
 * compile time.
 */
export type GrpcChannelCredentials = object;

/** Minimal interface for the grpc credentials factory we need. */
export interface GrpcCredentialsFactory {
  createSsl(
    rootCerts: Buffer | null,
    privateKey?: Buffer | null,
    certChain?: Buffer | null,
  ): GrpcChannelCredentials;
}

// ── Test seam ─────────────────────────────────────────────────────────────────

/**
 * Override for tests. When set, `loadGrpcCredentials` returns this instead of
 * dynamically requiring `@grpc/grpc-js`. Only use from test files.
 *
 * @internal
 */
export let _grpcCredentialsOverride: GrpcCredentialsFactory | null = null;

/** @internal - for tests only */
export function _setGrpcCredentialsOverride(factory: GrpcCredentialsFactory | null): void {
  _grpcCredentialsOverride = factory;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert an already-fetched `SpiffeX509Svid` to gRPC `ChannelCredentials`
 * for mutual TLS.
 *
 * @param svid - The X.509 SVID returned by `fetchSVID()`.
 * @returns `grpc.credentials.createSsl(rootCerts, privateKey, certChain)`
 * @throws If `@grpc/grpc-js` is not installed.
 */
export function svidToGrpcCredentials(svid: SpiffeX509Svid): GrpcChannelCredentials {
  const creds = loadGrpcCredentials();
  const rootCerts = Buffer.from(svid.bundlePem, 'utf8');
  const privateKey = Buffer.from(svid.keyPem, 'utf8');
  const certChain = Buffer.from(svid.certPem, 'utf8');
  return creds.createSsl(rootCerts, privateKey, certChain);
}

/**
 * Fetch the current SPIFFE SVID and convert it to gRPC `ChannelCredentials`.
 *
 * Convenience wrapper that combines `fetchSVID()` + `svidToGrpcCredentials()`.
 * Credentials are rebuilt on each call to pick up newly rotated SVIDs;
 * cache the result if your gateway is long-lived.
 *
 * @param options - SPIFFE Workload API options (socket path, renewal window).
 * @returns Resolved `ChannelCredentials` for mTLS.
 * @throws If the SPIRE Agent is unreachable or `@grpc/grpc-js` is not installed.
 */
export async function buildSpiffeGrpcCredentials(
  options?: SpiffeCredentialOptions,
): Promise<GrpcChannelCredentials> {
  const svid = await fetchSVID(options);
  return svidToGrpcCredentials(svid);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function loadGrpcCredentials(): GrpcCredentialsFactory {
  if (_grpcCredentialsOverride !== null) {
    return _grpcCredentialsOverride;
  }
  try {
    const grpc = require('@grpc/grpc-js') as typeof import('@grpc/grpc-js');
    return grpc.credentials;
  } catch {
    throw new Error(
      '@grpc/grpc-js is not installed. ' +
        'Add it to your dependencies to use SPIFFE gRPC credentials.',
    );
  }
}

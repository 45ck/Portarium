/**
 * Shared HTTP → governance error-mapping policy for all OpenClaw bridge adapters.
 *
 * All OpenClaw management bridges (tenant-scoped and operator-scoped) must
 * translate HTTP error responses using the same policy so callers receive
 * consistent `BridgeOperationResult` semantics regardless of which bridge
 * implementation is in use.
 *
 * Policy table
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP status   | ok    | governance meaning
 * ─────────────────────────────────────────────────────────────────────────────
 * 2xx           | true  | Operation confirmed by gateway.
 * 401           | false | Credentials missing or expired; re-authenticate.
 * 403           | false | Access denied by gateway policy; escalate to admin.
 * 404 (DELETE)  | true  | Agent already absent — idempotent delete succeeded.
 * 409           | false | Concurrent modification conflict; retry with backoff.
 * 422           | false | Payload rejected as invalid; fix request data.
 * 5xx           | false | Gateway is degraded; defer and retry later.
 * other 4xx     | false | Unexpected client error from gateway.
 * network error | false | Gateway unreachable; defer and retry later.
 * timeout       | false | Request timed out; defer and retry later.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @see bead-0786
 */

import type { BridgeOperationResult } from '../../application/ports/openclaw-management-bridge-port.js';

/**
 * Maps an HTTP response from an OpenClaw management endpoint to a
 * `BridgeOperationResult` using the canonical governance error policy.
 *
 * @param response  - The HTTP response received from the gateway.
 * @param operation - Name of the bridge operation (for human-readable reasons).
 */
export function mapGatewayResponse(response: Response, operation: string): BridgeOperationResult {
  if (response.ok) return { ok: true };

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      reason: `Gateway denied ${operation}: authorization failure (HTTP ${response.status}).`,
    };
  }
  if (response.status === 409) {
    return { ok: false, reason: `Gateway conflict during ${operation} (HTTP 409).` };
  }
  if (response.status === 422) {
    return { ok: false, reason: `Gateway rejected ${operation} payload as invalid (HTTP 422).` };
  }
  if (response.status >= 500) {
    return {
      ok: false,
      reason: `Gateway internal error during ${operation} (HTTP ${response.status}).`,
    };
  }
  return {
    ok: false,
    reason: `Unexpected gateway response for ${operation} (HTTP ${response.status}).`,
  };
}

/**
 * Converts a caught network/timeout error into a human-readable failure reason.
 *
 * Distinguishes `AbortError` (request timeout) from other network failures
 * so callers can apply the correct retry policy.
 */
export function describeNetworkError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Management bridge request timed out.';
    return error.message;
  }
  return 'Unknown error contacting management bridge.';
}

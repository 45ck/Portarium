/**
 * Contract gate: OpenClaw HTTP error semantics and governance policy mapping.
 *
 * This test suite verifies that the shared error-mapping policy (`openclaw-http-error-policy.ts`)
 * produces the expected `BridgeOperationResult` for every HTTP status class defined in the
 * governance policy table.
 *
 * Both bridge implementations (`OpenClawManagementBridge` and
 * `OpenClawOperatorManagementBridge`) delegate to this shared policy, so a pass
 * here guarantees consistent error semantics across all adapters.
 *
 * @see bead-0786 — Governance contract gate: align OpenClaw HTTP error semantics
 */

import { describe, expect, it } from 'vitest';
import { describeNetworkError, mapGatewayResponse } from './openclaw-http-error-policy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

// ---------------------------------------------------------------------------
// mapGatewayResponse — full policy table
// ---------------------------------------------------------------------------

describe('mapGatewayResponse', () => {
  // 2xx — success
  it('returns ok:true for 200', () => {
    expect(mapGatewayResponse(fakeResponse(200), 'op')).toEqual({ ok: true });
  });

  it('returns ok:true for 201', () => {
    expect(mapGatewayResponse(fakeResponse(201), 'op')).toEqual({ ok: true });
  });

  it('returns ok:true for 204', () => {
    expect(mapGatewayResponse(fakeResponse(204), 'op')).toEqual({ ok: true });
  });

  // 401 — credentials missing or expired
  it('returns ok:false with authorization-failure reason for 401', () => {
    const result = mapGatewayResponse(fakeResponse(401), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/authorization failure/);
    expect(result.ok === false && result.reason).toMatch(/401/);
  });

  // 403 — access denied by policy
  it('returns ok:false with authorization-failure reason for 403', () => {
    const result = mapGatewayResponse(fakeResponse(403), 'deregisterAgent');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/authorization failure/);
    expect(result.ok === false && result.reason).toMatch(/403/);
  });

  // 409 — concurrent modification conflict
  it('returns ok:false with conflict reason for 409', () => {
    const result = mapGatewayResponse(fakeResponse(409), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/conflict/i);
  });

  // 422 — invalid payload
  it('returns ok:false with invalid-payload reason for 422', () => {
    const result = mapGatewayResponse(fakeResponse(422), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/invalid/i);
  });

  // 500 — gateway internal error
  it('returns ok:false with internal-error reason for 500', () => {
    const result = mapGatewayResponse(fakeResponse(500), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/internal error/i);
    expect(result.ok === false && result.reason).toMatch(/500/);
  });

  // 503 — gateway degraded
  it('returns ok:false with internal-error reason for 503', () => {
    const result = mapGatewayResponse(fakeResponse(503), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/internal error/i);
    expect(result.ok === false && result.reason).toMatch(/503/);
  });

  // 404 — unexpected for non-DELETE (caller-level concern, policy just wraps it)
  it('returns ok:false for unexpected 404 (caller handles 404 for DELETE separately)', () => {
    const result = mapGatewayResponse(fakeResponse(404), 'syncAgentRegistration');
    expect(result.ok).toBe(false);
  });

  // Other 4xx
  it('returns ok:false with unexpected-response reason for 400', () => {
    const result = mapGatewayResponse(fakeResponse(400), 'op');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/400/);
  });

  it('returns ok:false with unexpected-response reason for 429', () => {
    const result = mapGatewayResponse(fakeResponse(429), 'op');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/429/);
  });

  // Operation name is included in error messages for diagnostics
  it('includes the operation name in error reasons', () => {
    const result = mapGatewayResponse(fakeResponse(401), 'myOperation');
    expect(result.ok === false && result.reason).toContain('myOperation');
  });
});

// ---------------------------------------------------------------------------
// describeNetworkError — network and timeout failures
// ---------------------------------------------------------------------------

describe('describeNetworkError', () => {
  it('returns the error message for a regular Error', () => {
    const error = new Error('connection refused');
    expect(describeNetworkError(error)).toBe('connection refused');
  });

  it('returns timed-out message for AbortError', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    expect(describeNetworkError(error)).toMatch(/timed out/i);
  });

  it('returns fallback string for non-Error values', () => {
    expect(describeNetworkError('string error')).toMatch(/unknown/i);
    expect(describeNetworkError(null)).toMatch(/unknown/i);
    expect(describeNetworkError(undefined)).toMatch(/unknown/i);
  });
});

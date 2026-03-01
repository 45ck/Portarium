/**
 * Production guard for dev-mode authentication paths.
 *
 * Extends the existing dev-token-env-gate with additional checks that
 * ensure no dev-mode auth path can leak into production deployments
 * through gateway or sidecar configuration.
 *
 * Guards:
 * 1. Dev static bearer tokens (existing: dev-token-env-gate.ts).
 * 2. Dev-mode JWT bypass (e.g. unsigned tokens, skip-verify flags).
 * 3. Sidecar mTLS skip (insecure plaintext mode for local dev).
 *
 * Bead: bead-0836
 */

import { checkDevAuthEnvGate, type DevAuthEnvGateResult } from './dev-token-env-gate.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DevAuthViolation = Readonly<{
  /** Which dev-mode path was detected. */
  path: 'dev-token' | 'jwt-skip-verify' | 'mtls-skip' | 'insecure-audience';
  /** Human-readable description of the violation. */
  detail: string;
}>;

export type ProductionGuardResult =
  | Readonly<{ safe: true }>
  | Readonly<{ safe: false; violations: readonly DevAuthViolation[] }>;

export type ProductionGuardInput = Readonly<{
  /** Environment variables (defaults to process.env). */
  env?: Record<string, string | undefined>;
  /** Whether JWT signature verification is disabled. */
  jwtSkipVerify?: boolean;
  /** Whether mTLS is disabled (plaintext mode). */
  mtlsDisabled?: boolean;
  /** Configured JWT audience values. */
  jwtAudience?: readonly string[];
}>;

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/** Audience values that indicate a dev/test configuration. */
const DEV_AUDIENCE_PATTERNS = [
  'http://localhost',
  'http://127.0.0.1',
  'https://localhost',
  'dev-audience',
  'test-audience',
] as const;

/**
 * Check that no dev-mode authentication paths are active in a production context.
 *
 * This is a composite guard that checks multiple dev-mode escape hatches.
 * Call this during application startup to fail-fast if the deployment
 * is misconfigured.
 *
 * In non-production environments (NODE_ENV=development|test), all checks
 * are skipped and the result is always `{ safe: true }`.
 */
export function checkProductionAuthGuard(input?: ProductionGuardInput): ProductionGuardResult {
  const env = input?.env ?? process.env;
  const nodeEnv = (env['NODE_ENV'] ?? '').trim();

  // In dev/test environments, all dev paths are acceptable
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return { safe: true };
  }

  const violations: DevAuthViolation[] = [];

  // 1. Check dev token env gate
  const devTokenResult: DevAuthEnvGateResult = safeCheckDevAuthEnvGate(env);
  if (devTokenResult.allowed) {
    violations.push({
      path: 'dev-token',
      detail: 'ENABLE_DEV_AUTH=true is active in a non-development environment.',
    });
  }

  // 2. Check JWT skip-verify
  if (input?.jwtSkipVerify) {
    violations.push({
      path: 'jwt-skip-verify',
      detail: 'JWT signature verification is disabled. This must never be disabled in production.',
    });
  }

  // 3. Check mTLS skip
  if (input?.mtlsDisabled) {
    violations.push({
      path: 'mtls-skip',
      detail: 'mTLS is disabled (plaintext mode). All production traffic must use mTLS.',
    });
  }

  // 4. Check for dev audience values in production
  if (input?.jwtAudience) {
    const devAudiences = input.jwtAudience.filter((aud) =>
      DEV_AUDIENCE_PATTERNS.some((pattern) => aud.toLowerCase().startsWith(pattern)),
    );
    if (devAudiences.length > 0) {
      violations.push({
        path: 'insecure-audience',
        detail:
          `JWT audience contains dev/localhost values: ${devAudiences.join(', ')}. ` +
          'Production tokens must use real audience URIs.',
      });
    }
  }

  if (violations.length === 0) return { safe: true };
  return { safe: false, violations };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps checkDevAuthEnvGate to catch the FATAL throw and convert it
 * to a simple allowed/not-allowed result. The throw is the correct
 * behavior for standalone use, but here we want to collect all violations.
 */
function safeCheckDevAuthEnvGate(env: Record<string, string | undefined>): DevAuthEnvGateResult {
  try {
    return checkDevAuthEnvGate(env);
  } catch {
    // The gate threw because ENABLE_DEV_AUTH=true in non-dev env — that IS a violation
    return { allowed: true };
  }
}

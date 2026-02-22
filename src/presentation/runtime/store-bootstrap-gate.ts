/**
 * Startup guard for store configuration (bead-yz3x).
 *
 * Ensures that deployers explicitly opt-in to in-memory stub stores
 * (DEV_STUB_STORES=true) in development/test environments. In any other
 * environment, using stub stores is a misconfiguration that produces a
 * silently non-functional system, so we fail fast with a clear error.
 */

export type StoreBootstrapGateResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/**
 * Checks whether in-memory stub stores may be used in this environment.
 *
 * Returns `{ allowed: true }` only when DEV_STUB_STORES=true and NODE_ENV is
 * "development" or "test".  In any other case returns `{ allowed: false }` or
 * throws a FATAL error (when DEV_STUB_STORES=true but NODE_ENV is production or
 * unknown, which is an obviously dangerous misconfiguration).
 *
 * @param env - Injectable environment map (defaults to `process.env`).
 */
export function checkStoreBootstrapGate(
  env: Record<string, string | undefined> = process.env,
): StoreBootstrapGateResult {
  if (env['DEV_STUB_STORES'] !== 'true') {
    return {
      allowed: false,
      reason: 'DEV_STUB_STORES is not set to "true".',
    };
  }

  const nodeEnv = (env['NODE_ENV'] ?? '').trim();
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      `[portarium] FATAL: DEV_STUB_STORES=true but NODE_ENV="${nodeEnv}". ` +
        'In-memory stub stores must never be used outside development or test environments. ' +
        'Set PORTARIUM_USE_POSTGRES_STORES=true and PORTARIUM_DATABASE_URL in production.',
    );
  }

  return { allowed: true };
}

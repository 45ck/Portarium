/**
 * Environment gate for DevTokenAuthentication.
 *
 * Enforces that dev-mode static bearer token auth is:
 *   1. Explicitly opted-in (ENABLE_DEV_AUTH=true) — not just the absence of NODE_ENV=production.
 *   2. Never activated outside development or test environments.
 */

export type DevAuthEnvGateResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/**
 * Checks whether DevTokenAuthentication may be activated in the current environment.
 *
 * Rules:
 * - `ENABLE_DEV_AUTH` must be explicitly `"true"` to opt-in.
 * - If `ENABLE_DEV_AUTH=true` but `NODE_ENV` is not `"development"` or `"test"`, this
 *   throws a fatal error to prevent accidental production activation.
 *
 * @param env - Environment variables (defaults to `process.env`; injectable for tests).
 * @returns `{ allowed: true }` when dev auth may be activated.
 * @returns `{ allowed: false, reason }` when the gate is closed (not an error — just inactive).
 * @throws {Error} When `ENABLE_DEV_AUTH=true` but `NODE_ENV` is not `development` or `test`.
 */
export function checkDevAuthEnvGate(
  env: Record<string, string | undefined> = process.env,
): DevAuthEnvGateResult {
  if (env['ENABLE_DEV_AUTH'] !== 'true') {
    return {
      allowed: false,
      reason: 'ENABLE_DEV_AUTH is not set to "true".',
    };
  }

  const nodeEnv = (env['NODE_ENV'] ?? '').trim();
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      `[portarium] FATAL: ENABLE_DEV_AUTH=true but NODE_ENV="${nodeEnv}". ` +
        'Dev token auth must never be enabled outside development or test environments. ' +
        'Refusing to start.',
    );
  }

  return { allowed: true };
}

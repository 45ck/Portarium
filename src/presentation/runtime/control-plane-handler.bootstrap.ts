import { err } from '../../application/common/result.js';
import { WorkspaceRbacAuthorization } from '../../application/iam/rbac/workspace-rbac-authorization.js';
import type {
  AuthenticationPort,
  AuthorizationPort,
  RunStore,
  WorkspaceStore,
} from '../../application/ports/index.js';
import { DevTokenAuthentication } from '../../infrastructure/auth/dev-token-authentication.js';
import { checkDevAuthEnvGate } from '../../infrastructure/auth/dev-token-env-gate.js';
import { JoseJwtAuthentication } from '../../infrastructure/auth/jose-jwt-authentication.js';
import { OpenFgaAuthorization } from '../../infrastructure/auth/openfga-authorization.js';
import { NodePostgresSqlClient } from '../../infrastructure/postgresql/node-postgres-sql-client.js';
import {
  PostgresRunStore,
  PostgresWorkspaceStore,
} from '../../infrastructure/postgresql/postgres-store-adapters.js';
import { InMemoryRateLimitStore } from '../../infrastructure/rate-limiting/index.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import { checkStoreBootstrapGate } from './store-bootstrap-gate.js';

/**
 * Returns any configuration warnings for the JWT authentication setup.
 * Exported for testing; the bootstrap calls this and writes warnings to stderr.
 */
export function getJoseAuthConfigWarnings(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const warnings: string[] = [];

  if (!env['PORTARIUM_JWT_ISSUER']?.trim()) {
    warnings.push(
      '[portarium] WARNING: PORTARIUM_JWT_ISSUER is not set. ' +
        'Without issuer validation, tokens from any issuer will be accepted. ' +
        'Set PORTARIUM_JWT_ISSUER to the expected token issuer URL.',
    );
  }
  if (!env['PORTARIUM_JWT_AUDIENCE']?.trim()) {
    warnings.push(
      '[portarium] WARNING: PORTARIUM_JWT_AUDIENCE is not set. ' +
        'Without audience validation, tokens intended for other services will be accepted. ' +
        'Set PORTARIUM_JWT_AUDIENCE to this service\'s expected audience value.',
    );
  }

  return warnings;
}

function tryBuildJoseAuthentication(): AuthenticationPort | null {
  const jwksUri = process.env['PORTARIUM_JWKS_URI']?.trim();
  if (!jwksUri) return null;

  const issuer = process.env['PORTARIUM_JWT_ISSUER']?.trim();
  const audience = process.env['PORTARIUM_JWT_AUDIENCE']?.trim();

  for (const warning of getJoseAuthConfigWarnings()) {
    process.stderr.write(warning + '\n');
  }

  return new JoseJwtAuthentication({
    jwksUri,
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  });
}

function tryBuildDevAuthentication(): AuthenticationPort | null {
  const devToken = process.env['PORTARIUM_DEV_TOKEN']?.trim();
  const devWorkspaceId = process.env['PORTARIUM_DEV_WORKSPACE_ID']?.trim();
  if (!devToken || !devWorkspaceId) return null;

  // Hard env-gate: ENABLE_DEV_AUTH=true must be explicitly set.
  // Throws a fatal error if ENABLE_DEV_AUTH=true but NODE_ENV is not development/test.
  const gate = checkDevAuthEnvGate();
  if (!gate.allowed) {
    process.stderr.write(
      `[portarium] WARNING: PORTARIUM_DEV_TOKEN is set but dev token auth is NOT activated: ${gate.reason} ` +
        'Set ENABLE_DEV_AUTH=true (in a development or test environment) to enable.\n',
    );
    return null;
  }

  // Log a visible warning so operators know dev auth is active.
  process.stderr.write(
    '[portarium] WARNING: Dev token auth is enabled (PORTARIUM_DEV_TOKEN). ' +
      'This bypasses JWKS validation and must never be used in production.\n',
  );

  const devUserId = process.env['PORTARIUM_DEV_USER_ID']?.trim();
  return new DevTokenAuthentication({
    token: devToken,
    workspaceId: devWorkspaceId,
    ...(devUserId ? { userId: devUserId } : {}),
  });
}

function buildAuthentication(): AuthenticationPort {
  return (
    tryBuildJoseAuthentication() ??
    tryBuildDevAuthentication() ?? {
      authenticateBearerToken: ({ correlationId }) =>
        Promise.resolve(
          err({
            kind: 'Unauthorized',
            message: `Authentication not configured. (${correlationId})`,
          }),
        ),
    }
  );
}

function buildAuthorization(): AuthorizationPort {
  const apiUrl = process.env['PORTARIUM_OPENFGA_API_URL']?.trim();
  const storeId = process.env['PORTARIUM_OPENFGA_STORE_ID']?.trim();
  const authorizationModelId = process.env['PORTARIUM_OPENFGA_AUTHORIZATION_MODEL_ID']?.trim();
  const apiToken = process.env['PORTARIUM_OPENFGA_API_TOKEN']?.trim();

  if (apiUrl && storeId) {
    return new OpenFgaAuthorization({
      apiUrl,
      storeId,
      ...(authorizationModelId ? { authorizationModelId } : {}),
      ...(apiToken ? { apiToken } : {}),
    });
  }

  return new WorkspaceRbacAuthorization();
}

export function buildControlPlaneDeps(): ControlPlaneDeps {
  const authentication = buildAuthentication();
  const authorization = buildAuthorization();
  const rateLimitStore = new InMemoryRateLimitStore();

  const usePostgresStores = process.env['PORTARIUM_USE_POSTGRES_STORES']?.trim() === 'true';
  const connectionString = process.env['PORTARIUM_DATABASE_URL']?.trim();

  if (usePostgresStores && connectionString) {
    const sqlClient = new NodePostgresSqlClient({ connectionString });
    const workspaceStore: WorkspaceStore = new PostgresWorkspaceStore(sqlClient);
    const runStore: RunStore = new PostgresRunStore(sqlClient);
    return { authentication, authorization, workspaceStore, runStore, rateLimitStore };
  }

  // Guard: in-memory stub stores require DEV_STUB_STORES=true in dev/test.
  const gate = checkStoreBootstrapGate();
  if (!gate.allowed) {
    throw new Error(
      `[portarium] FATAL: No persistent store configured and DEV_STUB_STORES is not enabled. ` +
        `Set PORTARIUM_USE_POSTGRES_STORES=true and PORTARIUM_DATABASE_URL to use Postgres, ` +
        `or set DEV_STUB_STORES=true (in NODE_ENV=development or test) to allow in-memory stubs. ` +
        `(${gate.reason})`,
    );
  }

  // DEV_STUB_STORES=true in development/test: warn and use in-memory stubs.
  process.stderr.write(
    '[portarium] WARNING: Using in-memory stub stores (DEV_STUB_STORES=true). ' +
      'Data will not persist across restarts. Do not use in production.\n',
  );

  const workspaceStore: WorkspaceStore = {
    getWorkspaceById: () => Promise.resolve(null),
    getWorkspaceByName: () => Promise.resolve(null),
    saveWorkspace: () => Promise.resolve(),
  };
  const runStore: RunStore = {
    getRunById: () => Promise.resolve(null),
    saveRun: () => Promise.resolve(),
  };

  return { authentication, authorization, workspaceStore, runStore, rateLimitStore };
}
